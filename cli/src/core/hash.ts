/**
 * SHA-256 utility wrapper using Node.js native crypto.
 * Zero external dependencies (RNF-04).
 */

import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import os from 'node:os'

/** Compute SHA-256 of a string and return hex digest */
export function hashString(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex')
}

/** Compute SHA-256 of a Buffer and return hex digest */
export function hashBuffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

/** Compute SHA-256 of a file on disk and return hex digest */
export async function hashFile(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath)
  return hashBuffer(content)
}

/** Compute a short machine ID from hostname + username (12 chars) */
export function machineId(): string {
  const hostname = os.hostname()
  const username = os.userInfo().username
  return hashString(`${hostname}:${username}`).slice(0, 12)
}

/** Verify a SHA-256 hex digest matches expected */
export function verifyHash(content: string | Buffer, expectedSha256: string): boolean {
  const actual = typeof content === 'string'
    ? hashString(content)
    : hashBuffer(content)
  return actual === expectedSha256
}
