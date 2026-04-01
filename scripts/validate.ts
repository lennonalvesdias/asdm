#!/usr/bin/env node
/**
 * scripts/validate.ts
 *
 * Validates the ASDM registry against the built manifest:
 *   - Every asset path in the manifest exists on disk
 *   - SHA-256 hashes match the files on disk
 *   - .asdm.md frontmatter has required fields (name, type, description, version)
 *   - profile.yaml files have required fields
 *
 * Exits 0 if all checks pass, 1 if any fail.
 *
 * Run with: tsx scripts/validate.ts
 */

import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { existsSync } from 'node:fs'

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
  allowed_profiles: string[]
  allowed_providers: string[]
  min_cli_version: string
  locked_fields?: string[]
  telemetry?: boolean
  auto_verify?: boolean
  install_hooks?: boolean
}

interface Manifest {
  version: string
  policy: ManifestPolicy
  profiles: Record<string, ManifestProfile>
  assets: Record<string, AssetEntry>
}

// --- Validation Result ---

let hasFailure = false

function pass(label: string): void {
  console.log(`  ✅ ${label}`)
}

function fail(label: string, detail?: string): void {
  hasFailure = true
  const suffix = detail ? `\n       ${detail}` : ''
  console.log(`  ❌ ${label}${suffix}`)
}

// --- Utilities ---

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/
const SEMVER_RE = /^\d+\.\d+\.\d+$/
const KEBAB_RE = /^[a-z][a-z0-9-]*$/
const SHA256_RE = /^[a-f0-9]{64}$/

function computeSha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

function parseFrontmatter(content: string): Record<string, unknown> | null {
  const match = content.match(FRONTMATTER_RE)
  if (!match) return null
  try {
    return parseYaml(match[1]) as Record<string, unknown>
  } catch {
    return null
  }
}

// --- Schema Validators ---

function validateAgentFrontmatter(fm: Record<string, unknown>, label: string): boolean {
  if (typeof fm['name'] !== 'string' || !KEBAB_RE.test(fm['name'])) {
    fail(`${label} — 'name' must be a kebab-case string`)
    return false
  }
  if (fm['type'] !== 'agent') {
    fail(`${label} — 'type' must be "agent", got "${String(fm['type'])}"`)
    return false
  }
  if (
    typeof fm['description'] !== 'string' ||
    fm['description'].length < 10 ||
    fm['description'].length > 200
  ) {
    fail(`${label} — 'description' must be a string between 10 and 200 characters`)
    return false
  }
  if (typeof fm['version'] !== 'string' || !SEMVER_RE.test(fm['version'])) {
    fail(`${label} — 'version' must be a semver string (x.y.z)`)
    return false
  }
  return true
}

function validateSkillFrontmatter(fm: Record<string, unknown>, label: string): boolean {
  if (typeof fm['name'] !== 'string' || !KEBAB_RE.test(fm['name'])) {
    fail(`${label} — 'name' must be a kebab-case string`)
    return false
  }
  if (fm['type'] !== 'skill') {
    fail(`${label} — 'type' must be "skill", got "${String(fm['type'])}"`)
    return false
  }
  if (
    typeof fm['description'] !== 'string' ||
    fm['description'].length < 10 ||
    fm['description'].length > 200
  ) {
    fail(`${label} — 'description' must be a string between 10 and 200 characters`)
    return false
  }
  if (typeof fm['version'] !== 'string' || !SEMVER_RE.test(fm['version'])) {
    fail(`${label} — 'version' must be a semver string (x.y.z)`)
    return false
  }
  return true
}

function validateCommandFrontmatter(fm: Record<string, unknown>, label: string): boolean {
  if (typeof fm['name'] !== 'string' || !KEBAB_RE.test(fm['name'])) {
    fail(`${label} — 'name' must be a kebab-case string`)
    return false
  }
  if (fm['type'] !== 'command') {
    fail(`${label} — 'type' must be "command", got "${String(fm['type'])}"`)
    return false
  }
  if (
    typeof fm['description'] !== 'string' ||
    fm['description'].length < 10 ||
    fm['description'].length > 200
  ) {
    fail(`${label} — 'description' must be a string between 10 and 200 characters`)
    return false
  }
  if (typeof fm['version'] !== 'string' || !SEMVER_RE.test(fm['version'])) {
    fail(`${label} — 'version' must be a semver string (x.y.z)`)
    return false
  }
  return true
}

function validateProfileYaml(yaml: Record<string, unknown>, profileName: string): boolean {
  const label = `profiles/${profileName}/profile.yaml`
  if (typeof yaml['name'] !== 'string' || !KEBAB_RE.test(yaml['name'])) {
    fail(`${label} — 'name' must be a kebab-case string`)
    return false
  }
  // agents, skills, commands, providers must be arrays of strings (if present)
  for (const field of ['agents', 'skills', 'commands', 'providers'] as const) {
    const value = yaml[field]
    if (value !== undefined && !Array.isArray(value)) {
      fail(`${label} — '${field}' must be an array if present`)
      return false
    }
    if (Array.isArray(value) && !value.every(v => typeof v === 'string')) {
      fail(`${label} — '${field}' must be an array of strings`)
      return false
    }
  }
  return true
}

// --- Manifest Loader ---

async function loadManifest(): Promise<Manifest> {
  // Prefer latest.json; fall back to scanning for the newest v*.json
  const latestPath = join(REGISTRY_DIR, 'latest.json')

  if (existsSync(latestPath)) {
    const raw = await readFile(latestPath, 'utf-8')
    return JSON.parse(raw) as Manifest
  }

  // Scan for v*.json files as fallback
  const { readdir } = await import('node:fs/promises')
  const entries = await readdir(REGISTRY_DIR)
  const versionFiles = entries
    .filter(e => /^v\d+\.\d+\.\d+\.json$/.test(e))
    .sort()
    .reverse()

  if (versionFiles.length === 0) {
    throw new Error(
      'No manifest found. Run `npm run build:manifest` first to generate registry/latest.json',
    )
  }

  const fallbackPath = join(REGISTRY_DIR, versionFiles[0])
  console.log(`  ℹ  Using fallback manifest: registry/${versionFiles[0]}`)
  const raw = await readFile(fallbackPath, 'utf-8')
  return JSON.parse(raw) as Manifest
}

// --- Validators ---

function validateManifestStructure(manifest: unknown): manifest is Manifest {
  if (!manifest || typeof manifest !== 'object') return false
  const m = manifest as Record<string, unknown>
  return (
    typeof m['version'] === 'string' &&
    typeof m['policy'] === 'object' &&
    m['policy'] !== null &&
    typeof m['profiles'] === 'object' &&
    m['profiles'] !== null &&
    typeof m['assets'] === 'object' &&
    m['assets'] !== null
  )
}

async function validateAsset(assetPath: string, entry: AssetEntry): Promise<void> {
  const absolutePath = join(REGISTRY_DIR, assetPath)
  const label = assetPath

  // Check 1: File exists on disk
  if (!existsSync(absolutePath)) {
    fail(`${label} — file not found on disk`)
    return
  }

  // Check 2: SHA-256 hash matches
  const buf = await readFile(absolutePath)
  const actualSha256 = computeSha256(buf)

  if (!SHA256_RE.test(entry.sha256)) {
    fail(`${label} — manifest sha256 is not a valid 64-char hex string`)
    return
  }

  if (actualSha256 !== entry.sha256) {
    fail(
      `${label} — sha256 mismatch`,
      `expected: ${entry.sha256.slice(0, 16)}...\n       actual:   ${actualSha256.slice(0, 16)}...`,
    )
    return
  }

  // Check 3: Frontmatter is valid for the asset type
  const content = buf.toString('utf-8')
  const fm = parseFrontmatter(content)

  if (!fm) {
    fail(`${label} — could not parse YAML frontmatter`)
    return
  }

  let frontmatterValid = false
  if (assetPath.startsWith('agents/')) {
    frontmatterValid = validateAgentFrontmatter(fm, label)
  } else if (assetPath.startsWith('skills/')) {
    frontmatterValid = validateSkillFrontmatter(fm, label)
  } else if (assetPath.startsWith('commands/')) {
    frontmatterValid = validateCommandFrontmatter(fm, label)
  } else {
    frontmatterValid = true // Unknown asset type — skip frontmatter check
  }

  if (frontmatterValid) {
    pass(`${label}`)
  }
}

async function validateProfile(profileName: string): Promise<void> {
  const profilePath = join(REGISTRY_DIR, 'profiles', profileName, 'profile.yaml')
  const label = `profiles/${profileName}/profile.yaml`

  if (!existsSync(profilePath)) {
    fail(`${label} — profile.yaml not found on disk`)
    return
  }

  const content = await readFile(profilePath, 'utf-8')
  let yaml: Record<string, unknown>

  try {
    yaml = parseYaml(content) as Record<string, unknown>
  } catch (err) {
    fail(`${label} — YAML parse error: ${(err as Error).message}`)
    return
  }

  if (validateProfileYaml(yaml, profileName)) {
    pass(`${label}`)
  }
}

// --- Main ---

async function main(): Promise<void> {
  console.log('🔍 Validating ASDM registry...\n')

  // Load and verify manifest structure
  console.log('📄 Loading manifest...')
  let manifest: Manifest

  try {
    const raw = await loadManifest()
    if (!validateManifestStructure(raw)) {
      console.error('❌ Manifest is missing required top-level fields')
      process.exit(1)
    }
    manifest = raw
    pass(`Manifest loaded (version ${manifest.version})`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`❌ Failed to load manifest: ${message}`)
    process.exit(1)
  }

  // Validate policy required fields
  console.log('\n📋 Validating policy...')
  const policy = manifest.policy as Record<string, unknown>

  if (!Array.isArray(policy['allowed_profiles']) || policy['allowed_profiles'].length === 0) {
    fail('policy.allowed_profiles — must be a non-empty array')
  } else {
    pass('policy.allowed_profiles')
  }

  if (!Array.isArray(policy['allowed_providers']) || policy['allowed_providers'].length === 0) {
    fail('policy.allowed_providers — must be a non-empty array')
  } else {
    pass('policy.allowed_providers')
  }

  if (
    typeof policy['min_cli_version'] !== 'string' ||
    !SEMVER_RE.test(policy['min_cli_version'])
  ) {
    fail('policy.min_cli_version — must be a semver string (x.y.z)')
  } else {
    pass('policy.min_cli_version')
  }

  // Validate assets
  const assetPaths = Object.keys(manifest.assets)
  console.log(`\n📦 Validating ${assetPaths.length} asset(s)...`)

  await Promise.all(
    assetPaths.map(assetPath => validateAsset(assetPath, manifest.assets[assetPath])),
  )

  // Validate profiles
  const profileNames = Object.keys(manifest.profiles)
  console.log(`\n👤 Validating ${profileNames.length} profile(s)...`)

  await Promise.all(profileNames.map(name => validateProfile(name)))

  // Summary
  console.log()
  if (hasFailure) {
    console.log('❌ Validation FAILED — fix the issues above and re-run.')
    process.exit(1)
  } else {
    console.log('✅ All checks passed.')
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('\n❌ Unexpected error:', message)
  process.exit(1)
})
