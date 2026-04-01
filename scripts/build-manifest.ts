#!/usr/bin/env node
/**
 * scripts/build-manifest.ts
 *
 * Scans registry assets, computes SHA-256 checksums, reads profile YAML files,
 * and writes the ASDM manifest to registry/v<version>.json and registry/latest.json.
 *
 * Run with: tsx scripts/build-manifest.ts
 */

import { readFile, writeFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { execSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const ROOT = resolve(dirname(__filename), '..')
const REGISTRY_DIR = join(ROOT, 'registry')

// --- Types ---

interface AssetEntry {
  sha256: string
  size: number
  version: string
}

interface ManifestProfile {
  extends?: string[]
  agents?: string[]
  skills?: string[]
  commands?: string[]
  providers?: string[]
}

interface ManifestPolicy {
  locked_fields: string[]
  telemetry: boolean
  auto_verify: boolean
  install_hooks: boolean
  allowed_profiles: string[]
  allowed_providers: string[]
  min_cli_version: string
}

interface Manifest {
  $schema: string
  version: string
  built_at: string
  commit_sha: string
  policy: ManifestPolicy
  profiles: Record<string, ManifestProfile>
  assets: Record<string, AssetEntry>
}

// --- Utilities ---

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/

function computeSha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

function extractFrontmatterVersion(content: string, label: string): string {
  const match = content.match(FRONTMATTER_RE)
  if (!match) {
    console.warn(`  ⚠  No frontmatter in ${label}, defaulting version to 0.0.0`)
    return '0.0.0'
  }
  try {
    const fm = parseYaml(match[1]) as Record<string, unknown>
    const ver = fm['version']
    return typeof ver === 'string' ? ver : '0.0.0'
  } catch {
    console.warn(`  ⚠  Could not parse frontmatter in ${label}, defaulting version to 0.0.0`)
    return '0.0.0'
  }
}

function getGitCommitSha(): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf-8' }).trim()
  } catch {
    return '0000000000000000000000000000000000000000'
  }
}

// --- Asset Processors ---

async function processAsdmFile(
  absolutePath: string,
  registryRelativePath: string,
): Promise<[string, AssetEntry]> {
  const buf = await readFile(absolutePath)
  const sha256 = computeSha256(buf)
  const size = buf.length
  const version = extractFrontmatterVersion(buf.toString('utf-8'), registryRelativePath)
  return [registryRelativePath, { sha256, size, version }]
}

// --- Registry Scanners ---

async function scanAgents(): Promise<[string, AssetEntry][]> {
  const agentsDir = join(REGISTRY_DIR, 'agents')
  const entries = await readdir(agentsDir, { withFileTypes: true })
  const asdmFiles = entries.filter(e => e.isFile() && e.name.endsWith('.asdm.md'))

  console.log(`  agents:   ${asdmFiles.length} file(s)`)

  return Promise.all(
    asdmFiles.map(e => processAsdmFile(join(agentsDir, e.name), `agents/${e.name}`)),
  )
}

async function scanSkills(): Promise<[string, AssetEntry][]> {
  const skillsDir = join(REGISTRY_DIR, 'skills')
  const entries = await readdir(skillsDir, { withFileTypes: true })
  const skillDirs = entries.filter(e => e.isDirectory())

  const results: [string, AssetEntry][] = []

  for (const dir of skillDirs) {
    const skillFilePath = join(skillsDir, dir.name, 'SKILL.asdm.md')
    const registryPath = `skills/${dir.name}/SKILL.asdm.md`
    try {
      results.push(await processAsdmFile(skillFilePath, registryPath))
    } catch {
      console.warn(`  ⚠  No SKILL.asdm.md in skills/${dir.name} — skipping`)
    }
  }

  console.log(`  skills:   ${results.length} file(s)`)
  return results
}

async function scanCommands(): Promise<[string, AssetEntry][]> {
  const commandsDir = join(REGISTRY_DIR, 'commands')
  const entries = await readdir(commandsDir, { withFileTypes: true })
  const asdmFiles = entries.filter(e => e.isFile() && e.name.endsWith('.asdm.md'))

  console.log(`  commands: ${asdmFiles.length} file(s)`)

  return Promise.all(
    asdmFiles.map(e => processAsdmFile(join(commandsDir, e.name), `commands/${e.name}`)),
  )
}

async function scanProfiles(): Promise<Record<string, ManifestProfile>> {
  const profilesDir = join(REGISTRY_DIR, 'profiles')
  const entries = await readdir(profilesDir, { withFileTypes: true })
  const profileDirs = entries.filter(e => e.isDirectory())

  const profiles: Record<string, ManifestProfile> = {}

  for (const dir of profileDirs) {
    const profileFilePath = join(profilesDir, dir.name, 'profile.yaml')
    try {
      const content = await readFile(profileFilePath, 'utf-8')
      const yaml = parseYaml(content) as Record<string, unknown>

      const profile: ManifestProfile = {}
      if (Array.isArray(yaml['extends'])) profile.extends = yaml['extends'] as string[]
      if (Array.isArray(yaml['agents'])) profile.agents = yaml['agents'] as string[]
      if (Array.isArray(yaml['skills'])) profile.skills = yaml['skills'] as string[]
      if (Array.isArray(yaml['commands'])) profile.commands = yaml['commands'] as string[]
      if (Array.isArray(yaml['providers'])) profile.providers = yaml['providers'] as string[]

      profiles[dir.name] = profile
    } catch {
      console.warn(`  ⚠  Could not read profile ${dir.name} — skipping`)
    }
  }

  console.log(`  profiles: ${Object.keys(profiles).length} file(s)`)
  return profiles
}

async function readPolicy(minCliVersion: string): Promise<ManifestPolicy> {
  const policyPath = join(REGISTRY_DIR, 'policy.yaml')
  const content = await readFile(policyPath, 'utf-8')
  const yaml = parseYaml(content) as Record<string, unknown>

  const allowedProfiles = Array.isArray(yaml['allowed_profiles'])
    ? (yaml['allowed_profiles'] as string[])
    : []

  // emit_targets in policy.yaml maps to allowed_providers in the manifest
  const allowedProviders = Array.isArray(yaml['emit_targets'])
    ? (yaml['emit_targets'] as string[])
    : ['opencode', 'claude-code', 'copilot']

  return {
    locked_fields: ['telemetry', 'install_hooks', 'auto_verify'],
    telemetry: true,
    auto_verify: true,
    install_hooks: true,
    allowed_profiles: allowedProfiles,
    allowed_providers: allowedProviders,
    min_cli_version: minCliVersion,
  }
}

// --- Main ---

async function main(): Promise<void> {
  console.log('🔨 Building ASDM manifest...\n')

  const pkgRaw = await readFile(join(ROOT, 'package.json'), 'utf-8')
  const pkg = JSON.parse(pkgRaw) as { version: string }
  const version = pkg.version

  console.log(`📦 Version:    ${version}`)

  const commitSha = getGitCommitSha()
  console.log(`🔑 Commit SHA: ${commitSha.slice(0, 12)}...`)

  console.log('\n📂 Scanning registry:')

  const [agentEntries, skillEntries, commandEntries, profiles, policy] = await Promise.all([
    scanAgents(),
    scanSkills(),
    scanCommands(),
    scanProfiles(),
    readPolicy(version),
  ])

  const assets: Record<string, AssetEntry> = {}
  for (const [path, entry] of [...agentEntries, ...skillEntries, ...commandEntries]) {
    assets[path] = entry
  }

  const totalAssets = Object.keys(assets).length
  console.log(`\n  Total:    ${totalAssets} asset(s) hashed`)

  const manifest: Manifest = {
    $schema: 'https://asdm.dev/schemas/manifest.schema.json',
    version,
    built_at: new Date().toISOString(),
    commit_sha: commitSha,
    policy,
    profiles,
    assets,
  }

  const manifestJson = JSON.stringify(manifest, null, 2) + '\n'
  const versionedPath = join(REGISTRY_DIR, `v${version}.json`)
  const latestPath = join(REGISTRY_DIR, 'latest.json')

  await writeFile(versionedPath, manifestJson, 'utf-8')
  await writeFile(latestPath, manifestJson, 'utf-8')

  console.log(`\n📄 Written: registry/v${version}.json`)
  console.log(`📄 Written: registry/latest.json`)
  console.log('\n✨ Manifest built successfully!')
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('\n❌ Build failed:', message)
  process.exit(1)
})
