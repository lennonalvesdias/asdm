/**
 * Cross-platform filesystem utilities.
 * Normalizes paths for macOS, Linux, and Windows (RNF-06).
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

/** Normalize path separators to forward slashes */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

/** Ensure a directory exists, creating it recursively if needed */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true })
}

/** Write a file, creating parent directories as needed */
export async function writeFile(filePath: string, content: string | Buffer): Promise<void> {
  await ensureDir(path.dirname(filePath))
  await fs.writeFile(filePath, content, 'utf-8')
}

/** Read a file as UTF-8 string, returns null if not found */
export async function readFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

/** Check if a path exists */
export async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/** Remove a file, no-op if not found */
export async function removeFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
}

/** List all files in a directory recursively */
export async function listFiles(dirPath: string): Promise<string[]> {
  const results: string[] = []

  async function walk(current: string) {
    const entries = await fs.readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
      } else {
        results.push(fullPath)
      }
    }
  }

  await walk(dirPath)
  return results
}

/** Get ASDM config directory: ~/.config/asdm */
export function getAsdmConfigDir(): string {
  return path.join(os.homedir(), '.config', 'asdm')
}

/** Get ASDM cache directory: ~/.cache/asdm */
export function getAsdmCacheDir(): string {
  const xdgCache = process.env['XDG_CACHE_HOME']
  if (xdgCache) return path.join(xdgCache, 'asdm')
  return path.join(os.homedir(), '.cache', 'asdm')
}

/** Read a JSON file, returns null if not found */
export async function readJson<T = unknown>(filePath: string): Promise<T | null> {
  const content = await readFile(filePath)
  if (content === null) return null
  return JSON.parse(content) as T
}

/** Write a JSON file with pretty-printing */
export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(data, null, 2))
}

/** Copy a file, creating parent directories as needed */
export async function copyFile(src: string, dest: string): Promise<void> {
  await ensureDir(path.dirname(dest))
  await fs.copyFile(src, dest)
}
