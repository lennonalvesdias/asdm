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
import { readProjectConfigFromPath, readUserConfig, resolveConfig } from './config.js'
import { RegistryClient } from './registry-client.js'
import { resolveProfileFromManifest } from './profile-resolver.js'
import { getProfileAssetPaths, diffManifest } from './manifest.js'
import { readLockfile, buildLockfile, writeLockfile, createLockEntry } from './lockfile.js'
import { hashString } from './hash.js'
import { writeFile, readFile, listFiles, ensureDir, getAsdmCacheDir, resolveGlobalEmitPath, getGlobalLockfilePath, removeFile } from '../utils/fs.js'
import { IntegrityError } from '../utils/errors.js'
import type { EmitAdapter, EmittedFile } from '../adapters/base.js'
import type { ParsedAsset } from './parser.js'
import { parseAsset } from './parser.js'
import type { TelemetryWriter } from './telemetry.js'

export interface SyncOptions {
  cwd: string
  configPath?: string      // Explicit path to config file; defaults to cwd/.asdm.json
  force?: boolean         // Re-download all assets (ignore cache)
  dryRun?: boolean        // Show what would be done, don't write
  noEmit?: boolean        // Download assets but don't emit to providers
  provider?: string       // Sync only for this provider
  global?: boolean        // Install to global provider config dirs instead of project-local
  clean?: boolean         // Remove managed files from previous profile that are no longer needed
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

/** Directories owned by each adapter, for disk-scan orphan detection. */
const ADAPTER_SCAN_DIRS: Record<string, string[]> = {
  'opencode': ['.opencode/agents', '.opencode/skills', '.opencode/commands'],
  'claude-code': ['.claude/agents', '.claude/skills', '.claude/commands'],
  'copilot': ['.github/agents', '.github/skills'],
  'agents-dir': ['.agents'],
}

/**
 * Walks `dir` recursively and returns absolute paths of files containing the ASDM managed header.
 * Returns an empty array if the directory does not exist.
 */
async function findManagedFilesInDir(dir: string): Promise<string[]> {
  let allFiles: string[]
  try {
    allFiles = await listFiles(dir)
  } catch {
    return []  // Directory doesn't exist — skip silently
  }
  const result: string[] = []
  for (const filePath of allFiles) {
    const content = await readFile(filePath)
    if (content?.includes('ASDM MANAGED FILE')) {
      result.push(filePath)
    }
  }
  return result
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
      case 'agents-dir': {
        const { createAgentsDirAdapter } = await import('../adapters/agents-dir.js')
        adapters.push(createAgentsDirAdapter())
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
    const configFilePath = options.configPath ?? path.join(cwd, '.asdm.json')
    const projectConfig = await readProjectConfigFromPath(configFilePath)
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
    
    // Step 7: Read existing lockfile for incremental sync and orphan detection.
    // Always read unconditionally — even when --force is active — so --clean can
    // identify orphaned files regardless of whether assets are being force-downloaded.
    const lockfilePath = options.global ? getGlobalLockfilePath() : undefined
    const existingLockfile = await readLockfile(cwd, lockfilePath)
    
    // Build local sha map from lockfile (source asset paths → sha256).
    // Skipped when --force so the diff treats all assets as changed and re-downloads them.
    const localSourceShas: Record<string, string> = {}
    if (!options.force && existingLockfile) {
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
        const cached = await readFile(cachedPath)
        if (cached) downloadedAssets.set(assetPath, cached)
      } catch {
        // Cache miss — will be re-downloaded next time
      }
    }

    // noEmit early return — skip all emit and orphan logic
    if (options.noEmit) {
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
      return { stats, emittedFiles: [], dryRun: false }
    }
    
    // Step 10: Load and run emit adapters.
    // Runs before the dryRun return so orphan detection can use the emitted-file set.
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

    // Step 11: Compute orphans for --clean mode
    // Phase 1 uses the lockfile; Phase 2 scans disk for ghost files not in lockfile.
    // Both phases run before the dryRun return so dry-run stats reflect the correct
    // filesRemoved count when --clean is active.
    // Only files whose adapter was active in this sync run are considered orphans,
    // preventing cross-provider clobber when --provider filters to a single adapter.
    const newRelativePaths = new Set(allEmittedFiles.map(f => f.relativePath))
    const orphansToDelete: string[] = []  // absolute paths of managed files to remove

    if (options.clean) {
      const activeAdapterSet = new Set(
        options.provider ? [options.provider] : activeProviders
      )

      // Phase 1: lockfile-based orphans (managed files tracked in old lockfile but not in new emit set)
      if (existingLockfile) {
        for (const [relPath, entry] of Object.entries(existingLockfile.files)) {
          if (!entry.managed || !activeAdapterSet.has(entry.adapter)) continue
          if (newRelativePaths.has(relPath)) continue

          let absPath: string
          if (options.global) {
            const p = resolveGlobalEmitPath(relPath, entry.adapter)
            if (!p) continue
            absPath = p
          } else {
            absPath = path.join(cwd, relPath)
          }
          orphansToDelete.push(absPath)
        }
      }

      // Phase 2: disk scan for ghost managed files not tracked in lockfile (local mode only).
      // Catches files left on disk from a previous profile sync that was never --clean'd.
      if (!options.global) {
        const orphanAbsPaths = new Set(orphansToDelete)
        for (const provider of activeProviders) {
          const scanDirs = ADAPTER_SCAN_DIRS[provider] ?? []
          for (const scanDir of scanDirs) {
            const absDir = path.join(cwd, scanDir)
            const managed = await findManagedFilesInDir(absDir)
            for (const absFile of managed) {
              // Normalize to forward-slash relative path for comparison
              const relPath = path.relative(cwd, absFile).split(path.sep).join('/')
              if (!newRelativePaths.has(relPath) && !orphanAbsPaths.has(absFile)) {
                orphansToDelete.push(absFile)
                orphanAbsPaths.add(absFile)
              }
            }
          }
        }
      }
    }

    // dryRun early return — includes orphan count for accurate --clean reporting
    if (options.dryRun) {
      const stats: SyncStats = {
        filesAdded: diff.added.length,
        filesUpdated: diff.updated.length,
        filesUnchanged: diff.unchanged.length,
        filesRemoved: diff.removed.length + orphansToDelete.length,
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
      return { stats, emittedFiles: [], dryRun: true }
    }

    // Step 12: Write emitted files to disk
    // In global mode, strip provider prefix and write to provider's global config dir.
    // Pre-compute resolved absolute paths; entries with a null path (project-root files) are skipped.
    const resolvedPaths = new Map<string, string>()
    for (const emittedFile of allEmittedFiles) {
      const absolutePath: string | null = options.global
        ? resolveGlobalEmitPath(emittedFile.relativePath, emittedFile.adapter)
        : path.join(cwd, emittedFile.relativePath)
      if (absolutePath !== null) {
        resolvedPaths.set(emittedFile.relativePath, absolutePath)
      }
    }

    for (const emittedFile of allEmittedFiles) {
      const absolutePath = resolvedPaths.get(emittedFile.relativePath)
      if (absolutePath === undefined) continue
      await writeFile(absolutePath, emittedFile.content)
    }

    // Step 13: Delete orphan files identified in step 11.
    // removeFile handles ENOENT internally; real errors (EPERM, EACCES) bubble up.
    let orphanFilesRemoved = 0
    for (const absPath of orphansToDelete) {
      await removeFile(absPath)
      orphanFilesRemoved++
    }
    
    // Step 14: Build and write lockfile
    const lockfileFiles: Record<string, ReturnType<typeof createLockEntry>> = {}
    
    for (const emittedFile of allEmittedFiles) {
      if (!resolvedPaths.has(emittedFile.relativePath)) continue
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
      registry: resolvedConfig.registry,
      profile: resolvedConfig.profile,
      resolvedProfiles: resolvedProfile.resolvedFrom,
      files: lockfileFiles,
    })
    
    await writeLockfile(cwd, lockfile, lockfilePath)
    
    const stats: SyncStats = {
      filesAdded: diff.added.length,
      filesUpdated: diff.updated.length,
      filesUnchanged: diff.unchanged.length,
      filesRemoved: diff.removed.length + orphanFilesRemoved,
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
