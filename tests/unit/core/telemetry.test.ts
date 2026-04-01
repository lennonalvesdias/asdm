import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { TelemetryWriter, createTelemetryWriter } from '../../../src/core/telemetry.js'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asdm-telemetry-test-'))
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

const TELEMETRY_FILE = '.asdm-telemetry.jsonl'

describe('TelemetryWriter.write()', () => {
  it('appends a valid JSONL line to the telemetry file', async () => {
    const writer = new TelemetryWriter(tmpDir)
    await writer.write({ event: 'sync.completed', profile: 'fullstack-engineer' })

    const content = await fs.readFile(path.join(tmpDir, TELEMETRY_FILE), 'utf-8')
    expect(content).toContain('"sync.completed"')
    expect(content).toContain('"fullstack-engineer"')
    // Each line ends with a newline
    expect(content).toMatch(/\n$/)
  })

  it('appends a second line on the next write', async () => {
    const writer = new TelemetryWriter(tmpDir)
    await writer.write({ event: 'sync.started' })
    await writer.write({ event: 'sync.completed' })

    const content = await fs.readFile(path.join(tmpDir, TELEMETRY_FILE), 'utf-8')
    const lines = content.trim().split('\n')
    expect(lines).toHaveLength(2)
  })

  it('includes timestamp, machineId, and version in each event', async () => {
    const writer = new TelemetryWriter(tmpDir)
    await writer.write({ event: 'init.completed' })

    const events = await writer.readAll()
    const event = events[0]

    expect(event).toBeDefined()
    // ISO 8601 timestamp
    expect(event?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    // machineId is 12 hex chars
    expect(event?.machineId).toHaveLength(12)
    expect(event?.machineId).toMatch(/^[a-f0-9]+$/)
    // version is injected at test time as '0.0.0-test'
    expect(event?.version).toBeTruthy()
  })

  it('stores optional fields when provided', async () => {
    const writer = new TelemetryWriter(tmpDir)
    await writer.write({
      event: 'sync.completed',
      profile: 'mobile',
      registry: 'github://org/repo',
      durationMs: 1234,
      assetCount: 10,
      providers: ['opencode', 'claude-code'],
    })

    const events = await writer.readAll()
    expect(events[0]?.profile).toBe('mobile')
    expect(events[0]?.registry).toBe('github://org/repo')
    expect(events[0]?.durationMs).toBe(1234)
    expect(events[0]?.assetCount).toBe(10)
    expect(events[0]?.providers).toEqual(['opencode', 'claude-code'])
  })
})

describe('TelemetryWriter.readAll()', () => {
  it('returns empty array when file does not exist', async () => {
    const writer = new TelemetryWriter(tmpDir)
    const events = await writer.readAll()
    expect(events).toEqual([])
  })

  it('parses all valid JSONL lines', async () => {
    const writer = new TelemetryWriter(tmpDir)
    await writer.write({ event: 'sync.started' })
    await writer.write({ event: 'sync.completed', assetCount: 5 })

    const events = await writer.readAll()
    expect(events).toHaveLength(2)
    expect(events[0]?.event).toBe('sync.started')
    expect(events[1]?.event).toBe('sync.completed')
    expect(events[1]?.assetCount).toBe(5)
  })

  it('skips malformed lines without throwing', async () => {
    const filePath = path.join(tmpDir, TELEMETRY_FILE)
    // Mix of valid JSON, invalid JSON, and blank lines
    const validLine1 = '{"event":"sync.started","timestamp":"2026-01-01T00:00:00.000Z","machineId":"abc123def456","version":"0.1.0"}'
    const validLine2 = '{"event":"sync.completed","timestamp":"2026-01-01T00:01:00.000Z","machineId":"abc123def456","version":"0.1.0"}'
    await fs.writeFile(
      filePath,
      `${validLine1}\nNOT_VALID_JSON\n\n${validLine2}\n`,
      'utf-8'
    )

    const writer = new TelemetryWriter(tmpDir)
    const events = await writer.readAll()

    expect(events).toHaveLength(2)
    expect(events[0]?.event).toBe('sync.started')
    expect(events[1]?.event).toBe('sync.completed')
  })
})

describe('TelemetryWriter.rotate()', () => {
  it('does nothing when entry count is at or below maxEntries', async () => {
    const writer = new TelemetryWriter(tmpDir)
    await writer.write({ event: 'sync.completed' })
    await writer.write({ event: 'verify.passed' })

    await writer.rotate(10)

    const events = await writer.readAll()
    expect(events).toHaveLength(2)
  })

  it('trims file to the last N entries when over the limit', async () => {
    const writer = new TelemetryWriter(tmpDir)
    for (let i = 0; i < 5; i++) {
      await writer.write({ event: 'sync.completed', metadata: { i } })
    }

    await writer.rotate(3)

    const events = await writer.readAll()
    expect(events).toHaveLength(3)
    // Keeps the last 3 (indices 2, 3, 4)
    expect(events[0]?.metadata?.['i']).toBe(2)
    expect(events[1]?.metadata?.['i']).toBe(3)
    expect(events[2]?.metadata?.['i']).toBe(4)
  })

  it('is a no-op when the telemetry file does not exist', async () => {
    const writer = new TelemetryWriter(tmpDir)
    // Should not throw even when file is absent
    await expect(writer.rotate(10)).resolves.toBeUndefined()
  })
})

describe('TelemetryWriter.clear()', () => {
  it('removes the telemetry file', async () => {
    const writer = new TelemetryWriter(tmpDir)
    await writer.write({ event: 'sync.started' })

    await writer.clear()

    const events = await writer.readAll()
    expect(events).toHaveLength(0)
  })

  it('is a no-op when the telemetry file does not exist', async () => {
    const writer = new TelemetryWriter(tmpDir)
    await expect(writer.clear()).resolves.toBeUndefined()
  })
})

describe('createTelemetryWriter()', () => {
  it('returns a TelemetryWriter instance when enabled is true', () => {
    const writer = createTelemetryWriter(tmpDir, true)
    expect(writer).toBeInstanceOf(TelemetryWriter)
  })

  it('returns null when enabled is false', () => {
    const writer = createTelemetryWriter(tmpDir, false)
    expect(writer).toBeNull()
  })

  it('the returned writer writes to the project root', async () => {
    const writer = createTelemetryWriter(tmpDir, true)
    await writer!.write({ event: 'doctor.ran' })

    const filePath = path.join(tmpDir, '.asdm-telemetry.jsonl')
    const content = await fs.readFile(filePath, 'utf-8')
    expect(content).toContain('"doctor.ran"')
  })
})
