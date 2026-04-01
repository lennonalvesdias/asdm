/**
 * Generates the content of a .git/hooks/post-merge script
 * that runs `asdm sync` after a git pull/merge if .asdm.json exists.
 */
export function generatePostMergeHook(): string {
  return `#!/usr/bin/env sh
# ASDM MANAGED — post-merge hook
if [ -f ".asdm.yaml" ] || [ -f ".asdm.json" ]; then
  echo "\u{1F504} ASDM: syncing after merge..."
  npx asdm sync
fi
`
}
