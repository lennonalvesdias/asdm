/**
 * Syncer — Orchestrates the full sync flow.
 * 
 * Flow:
 *   1. Resolve config (3 layers)
 *   2. Read project + user config → get registry URL
 *   3. Fetch manifest from registry
 *   4. Resolve profile (inheritance chain)
 *   5. Compute diff (manifest vs lockfile)
 *   6. Download changed assets
 *   7. Verify SHA-256 of each download
 *   8. Run emit adapters for each provider
 *   9. Write lockfile
 *  10. Write telemetry event (local JSONL)
 */

import path from 'node:path'
import { readProjectConfig, readUserConfig, resolveConfig } from './config.js'
import { RegistryClient } from './registry-client.js'
import { resolveProfileFromManifest } from './profile-resolver.js'
import { getProfileAssetPaths, diffManifest } from './manifest.js'
import { readLockfile, buildLockfile, writeLockfile, createLockEntry } from './lockfile.js'
import { hashString } from './hash.js'
import { writeFile, ensureDir, getAsdmCacheDir } from '../utils/fs.js'
import { IntegrityError } from '../utils/errors.js'
import type { EmitAdapter, EmittedFile } from '../adapters/base.js'
import type { ParsedAsset } from './parser.js'
import { parseAsset } from './parser.js'
import type { TelemetryWriter } from './telemetry.js'

export interface SyncOptions {
  cwd: string
  force?: boolean         // Re-download all assets (ignore cache)
  dryRun?: boolean        // Show what would be done, don't write
  noEmit?: boolean        // Download assets but don't emit to providers
  provider?: string       // Sync only for this provider
  verbose?: boolean
  quiet?: boolean
  telemetry?: TelemetryWriter
}

export interface SyncStats {
  filesAdded: number
  filesUpdated: number
  filesUnchanged: number
  filesRemoved: number
  duration: number        // ms
  manifestVersion: string
  profile: string
  providers: string[]
}

export interface SyncResult {
  stats: SyncStats
  emittedFiles: EmittedFile[]
  dryRun: boolean
}

/** Load the appropriate adapter for each provider */
async function loadAdapters(providers: string[]): Promise<EmitAdapter[]> {
  const adapters: EmitAdapter[] = []
  
  for (const provider of providers) {
    switch (provider) {
      case 'opencode': {
        const { createOpenCodeAdapter } = await import('../adapters/opencode.js')
        adapters.push(createOpenCodeAdapter())
        break
      }
      case 'claude-code': {
        const { createClaudeCodeAdapter } = await import('../adapters/claude-code.js')
        adapters.push(createClaudeCodeAdapter())
        break
      }
      case 'copilot': {
        const { createCopilotAdapter } = await import('../adapters/copilot.js')
        adapters.push(createCopilotAdapter())
        break
      }
    }
  }
  
  return adapters
}

/** Get CLI version (injected at build time) */
async function getCliVersion(): Promise<string> {
  return __ASDM_VERSION__
}

/**
 * Run the full sync operation.
 */
export async function sync(options: SyncOptions): Promise<SyncResult> {
  const startTime = Date.now()
  const { cwd } = options

  // Emit sync.started immediately — fire-and-forget
  options.telemetry?.write({ event: 'sync.started' }).catch(() => {})

  try {
    // Step 1: Read config
    const projectConfig = await readProjectConfig(cwd)
    const userConfig = await readUserConfig(cwd)
    
    // Step 2: Initialize registry client
    const client = new RegistryClient(projectConfig.registry)
    
    // Step 3: Fetch manifest
    const manifest = await client.getLatestManifest()
    
    // Step 4: Resolve config with policy from manifest
    const resolvedConfig = resolveConfig(projectConfig, userConfig, manifest.policy)
    
    // Filter providers if --provider flag was used
    const activeProviders = options.provider
      ? resolvedConfig.providers.filter(p => p === options.provider)
      : resolvedConfig.providers
    
    // Step 5: Resolve profile from manifest
    const resolvedProfile = resolveProfileFromManifest(manifest.profiles, resolvedConfig.profile)
    
    // Step 6: Get required asset paths for this profile
    const assetPaths = getProfileAssetPaths(
      manifest,
      resolvedProfile.agents,
      resolvedProfile.skills,
      resolvedProfile.commands
    )
    
    // Step 7: Read existing lockfile for incremental sync
    const existingLockfile = options.force ? null : await readLockfile(cwd)
    
    // Build local sha map from lockfile (source asset paths → sha256)
    const localSourceShas: Record<string, string> = {}
    if (existingLockfile) {
      // Map source asset paths to their expected hashes
      for (const [, entry] of Object.entries(existingLockfile.files)) {
        if (entry.managed && entry.source) {
          localSourceShas[entry.source] = entry.sha256
        }
      }
    }
    
    // Step 8: Compute diff
    const diff = diffManifest(manifest, localSourceShas, assetPaths)
    
    const toDownload = options.force
      ? assetPaths
      : [...diff.added, ...diff.updated]
    
    // Cache directory for downloaded canonical assets
    const cacheDir = path.join(getAsdmCacheDir(), manifest.version)
    await ensureDir(cacheDir)
    
    // Step 9: Download changed assets
    const downloadedAssets: Map<string, string> = new Map()  // assetPath → content
    
    for (const assetPath of toDownload) {
      const assetMeta = manifest.assets[assetPath]
      if (!assetMeta) continue
      
      const content = await client.downloadAsset(assetPath, manifest.version)
      
      // Verify SHA-256 after download
      const downloadedSha = hashString(content)
      if (downloadedSha !== assetMeta.sha256) {
        throw new IntegrityError(
          `SHA-256 mismatch for ${assetPath}: expected ${assetMeta.sha256}, got ${downloadedSha}`,
          'The asset may have been tampered with or the manifest is stale. Run `asdm sync --force`.'
        )
      }
      
      // Cache the file
      const cachedPath = path.join(cacheDir, assetPath)
      if (!options.dryRun) {
        await writeFile(cachedPath, content)
      }
      
      downloadedAssets.set(assetPath, content)
    }
    
    // Also load unchanged assets from cache (needed for emit)
    for (const assetPath of diff.unchanged) {
      const cachedPath = path.join(cacheDir, assetPath)
      try {
        const { readFile } = await import('../utils/fs.js')
        const cached = await readFile(cachedPath)
        if (cached) downloadedAssets.set(assetPath, cached)
      } catch {
        // Cache miss — will be re-downloaded next time
      }
    }
    
    if (options.dryRun || options.noEmit) {
      const stats: SyncStats = {
        filesAdded: diff.added.length,
        filesUpdated: diff.updated.length,
        filesUnchanged: diff.unchanged.length,
        filesRemoved: diff.removed.length,
        duration: Date.now() - startTime,
        manifestVersion: manifest.version,
        profile: resolvedConfig.profile,
        providers: activeProviders,
      }
      options.telemetry?.write({
        event: 'sync.completed',
        profile: resolvedConfig.profile,
        registry: resolvedConfig.registry,
        providers: activeProviders,
        assetCount: 0,
        durationMs: stats.duration,
      }).catch(() => {})
      return { stats, emittedFiles: [], dryRun: !!options.dryRun }
    }
    
    // Step 10: Load and run emit adapters
    const adapters = await loadAdapters(activeProviders)
    const allEmittedFiles: EmittedFile[] = []
    
    for (const adapter of adapters) {
      // Emit agents
      for (const agentName of resolvedProfile.agents) {
        const assetPath = `agents/${agentName}.asdm.md`
        const content = downloadedAssets.get(assetPath)
        if (!content) continue
        
        const parsed: ParsedAsset = parseAsset(content, assetPath, adapter.name)
        const emitted = adapter.emitAgent(parsed, cwd)
        allEmittedFiles.push(...emitted)
      }
      
      // Emit skills
      for (const skillName of resolvedProfile.skills) {
        const assetPath = `skills/${skillName}/SKILL.asdm.md`
        const content = downloadedAssets.get(assetPath)
        if (!content) continue
        
        const parsed: ParsedAsset = parseAsset(content, assetPath, adapter.name)
        const emitted = adapter.emitSkill(parsed, cwd)
        allEmittedFiles.push(...emitted)
      }
      
      // Emit commands
      for (const commandName of resolvedProfile.commands) {
        const assetPath = `commands/${commandName}.asdm.md`
        const content = downloadedAssets.get(assetPath)
        if (!content) continue
        
        const parsed: ParsedAsset = parseAsset(content, assetPath, adapter.name)
        const emitted = adapter.emitCommand(parsed, cwd)
        allEmittedFiles.push(...emitted)
      }
      
      // Emit root instructions and config
      const rootFiles = adapter.emitRootInstructions(resolvedProfile, cwd)
      allEmittedFiles.push(...rootFiles)
      
      const configFiles = adapter.emitConfig(resolvedProfile, cwd)
      allEmittedFiles.push(...configFiles)
    }
    
    // Step 11: Write emitted files to disk
    for (const emittedFile of allEmittedFiles) {
      const absolutePath = path.join(cwd, emittedFile.relativePath)
      await writeFile(absolutePath, emittedFile.content as string)
    }
    
    // Step 12: Build and write lockfile
    const lockfileFiles: Record<string, ReturnType<typeof createLockEntry>> = {}
    
    for (const emittedFile of allEmittedFiles) {
      lockfileFiles[emittedFile.relativePath] = createLockEntry(
        emittedFile.sha256,
        emittedFile.sourcePath,
        emittedFile.adapter,
        manifest.assets[emittedFile.sourcePath]?.version ?? '0.0.0'
      )
    }
    
    const cliVersion = await getCliVersion()
    const lockfile = buildLockfile({
      cliVersion,
      manifestVersion: manifest.version,
      manifestCommit: manifest.commit_sha,
      registry: resolvedConfig.registry,
      profile: resolvedConfig.profile,
      resolvedProfiles: resolvedProfile.resolvedFrom,
      files: lockfileFiles,
    })
    
    await writeLockfile(cwd, lockfile)
    
    const stats: SyncStats = {
      filesAdded: diff.added.length,
      filesUpdated: diff.updated.length,
      filesUnchanged: diff.unchanged.length,
      filesRemoved: diff.removed.length,
      duration: Date.now() - startTime,
      manifestVersion: manifest.version,
      profile: resolvedConfig.profile,
      providers: activeProviders,
    }

    options.telemetry?.write({
      event: 'sync.completed',
      profile: resolvedConfig.profile,
      registry: resolvedConfig.registry,
      providers: activeProviders,
      assetCount: allEmittedFiles.length,
      durationMs: stats.duration,
    }).catch(() => {})
    
    return { stats, emittedFiles: allEmittedFiles, dryRun: false }

  } catch (err) {
    options.telemetry?.write({
      event: 'sync.failed',
      error: err instanceof Error ? err.message : String(err),
    }).catch(() => {})
    throw err
  }
}
