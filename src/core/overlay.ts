/**
 * Overlay System — Local customizations on top of managed agent files.
 *
 * Overlays are stored in <projectRoot>/overlays/<agent-name>.md.
 * They are NOT managed by ASDM (no managed header) and are appended
 * after the managed section when an adapter emits a file.
 *
 * This satisfies RF-08: "Allow local additive overlay for personal customizations".
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import { exists, readFile } from '../utils/fs.js'

export interface Overlay {
  agentId: string
  content: string
  path: string
}

const OVERLAY_SEPARATOR = [
  '',
  '<!-- managed content above -->',
  '',
  '---',
  '<!-- LOCAL OVERLAY — this section is not managed by ASDM -->',
  '',
].join('\n')

/**
 * Reads all overlay files from <projectRoot>/overlays/
 * Returns a map of agentId -> Overlay.
 *
 * Filenames map directly to agentIds:
 *   overlays/code-reviewer.md → agentId "code-reviewer"
 */
export async function readOverlays(projectRoot: string): Promise<Map<string, Overlay>> {
  const overlaysDir = path.join(projectRoot, 'overlays')

  const dirExists = await exists(overlaysDir)
  if (!dirExists) return new Map()

  const entries = await fs.readdir(overlaysDir, { withFileTypes: true })
  const overlayMap = new Map<string, Overlay>()

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue

    const agentId = entry.name.slice(0, -'.md'.length)
    const overlayPath = path.join(overlaysDir, entry.name)
    const content = await readFile(overlayPath)

    if (content === null) continue

    overlayMap.set(agentId, { agentId, content, path: overlayPath })
  }

  return overlayMap
}

/**
 * Applies an overlay to managed content.
 * Returns the combined content with overlay appended after a separator.
 *
 * Output structure:
 *   <managed content>
 *   <!-- managed content above -->
 *
 *   ---
 *   <!-- LOCAL OVERLAY — this section is not managed by ASDM -->
 *
 *   <overlay content>
 */
export function applyOverlay(managedContent: string, overlay: Overlay): string {
  return managedContent + OVERLAY_SEPARATOR + overlay.content
}
