/**
 * Generates the functional body of a post-merge hook script.
 * The body contains the ASDM marker and the sync logic, but no shebang line.
 * Callers prepend the appropriate header depending on the hook mode.
 */
export function generatePostMergeHookBody(): string {
  return `# ASDM MANAGED — post-merge hook
if [ -f ".asdm.yaml" ] || [ -f ".asdm.json" ]; then
  echo "\u{1F504} ASDM: syncing after merge..."
  npx asdm sync
fi
`
}

/**
 * Generates the full content of a .git/hooks/post-merge script
 * (shebang + body). Preserved for backward compatibility.
 */
export function generatePostMergeHook(): string {
  return `#!/usr/bin/env sh\n${generatePostMergeHookBody()}`
}
