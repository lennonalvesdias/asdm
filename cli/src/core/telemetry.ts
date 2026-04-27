/**
 * Local-only telemetry writer.
 *
 * Appends structured events to .asdm-telemetry.jsonl in the project root.
 * All data stays on disk — no HTTP calls, no external services.
 *
 * Callers use fire-and-forget: telemetry?.write(event).catch(() => {})
 * Telemetry failures must NEVER propagate to callers.
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import { machineId } from './hash.js'

export type TelemetryEventType =
  | 'sync.started'
  | 'sync.completed'
  | 'sync.failed'
  | 'verify.passed'
  | 'verify.failed'
  | 'verify.modified'
  | 'init.completed'
  | 'use.completed'
  | 'doctor.ran'

export interface TelemetryEvent {
  timestamp: string                    // ISO 8601
  event: TelemetryEventType
  machineId: string                    // 12-char hash from hash.ts machineId()
  version: string                      // __ASDM_VERSION__ at build time
  profile?: string
  registry?: string
  durationMs?: number
  assetCount?: number
  violations?: number
  providers?: string[]
  error?: string
  metadata?: Record<string, unknown>
}

const TELEMETRY_FILE = '.asdm-telemetry.jsonl'

export class TelemetryWriter {
  private logPath: string

  constructor(projectRoot: string) {
    this.logPath = path.join(projectRoot, TELEMETRY_FILE)
  }

  /** Append one telemetry event as a JSONL line */
  async write(
    event: Omit<TelemetryEvent, 'timestamp' | 'machineId' | 'version'>
  ): Promise<void> {
    const fullEvent: TelemetryEvent = {
      timestamp: new Date().toISOString(),
      machineId: machineId(),
      version: __ASDM_VERSION__,
      ...event,
    }
    const line = JSON.stringify(fullEvent) + '\n'
    await fs.appendFile(this.logPath, line, 'utf-8')
  }

  /** Read and parse all events, silently skipping malformed lines */
  async readAll(): Promise<TelemetryEvent[]> {
    let content: string
    try {
      content = await fs.readFile(this.logPath, 'utf-8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw err
    }

    return content
      .split('\n')
      .filter(line => line.trim().length > 0)
      .flatMap(line => {
        try {
          return [JSON.parse(line) as TelemetryEvent]
        } catch {
          return []
        }
      })
  }

  /**
   * Rotate the log file, keeping only the last N entries.
   * Prevents unbounded growth — default cap is 1000 events.
   */
  async rotate(maxEntries = 1000): Promise<void> {
    const entries = await this.readAll()
    if (entries.length <= maxEntries) return

    const trimmed = entries.slice(entries.length - maxEntries)
    const content = trimmed.map(e => JSON.stringify(e)).join('\n') + '\n'
    await fs.writeFile(this.logPath, content, 'utf-8')
  }

  /** Delete the telemetry log file */
  async clear(): Promise<void> {
    try {
      await fs.unlink(this.logPath)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
  }
}

/**
 * Creates a TelemetryWriter for the given project root.
 * Returns null when telemetry is disabled — callers use optional chaining.
 */
export function createTelemetryWriter(
  projectRoot: string,
  enabled: boolean
): TelemetryWriter | null {
  if (!enabled) return null
  return new TelemetryWriter(projectRoot)
}
