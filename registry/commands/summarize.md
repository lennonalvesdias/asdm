---
name: summarize
type: command
description: "Generates a concise summary of a file, module, or diff for documentation or review"
version: 1.0.0

providers:
  opencode:
    slash_command: /summarize
    agent: documentation-writer
    model: github-copilot/claude-haiku-4.5
  claude-code:
    slash_command: /summarize
    agent: documentation-writer
  copilot:
    slash_command: /summarize
    agent: documentation-writer
---

# /summarize

Generates a structured summary of code or documentation. Useful for understanding unfamiliar code, writing commit messages, preparing PR descriptions, or producing change logs.

## Usage

```
/summarize <path>
/summarize src/core/parser.ts
/summarize --format changelog src/
/summarize --diff HEAD~1
```

## Options

- `<path>` — File or directory to summarize
- `--format <type>` — Output format: `prose` (default), `bullets`, `changelog`, `pr-description`
- `--diff <ref>` — Summarize changes since a git ref instead of the full file
- `--depth <level>` — Level of detail: `brief` (1 paragraph), `standard` (default), `detailed` (full breakdown)

## Behavior

For a **file**: Describes purpose, key exports, notable patterns, and any caveats.

For a **directory**: Describes the module boundary, what it owns, and how components relate.

For a **diff**: Describes what changed, why it likely changed (based on context), and the risk surface of the change.

## Output Example (file)

```
## src/core/parser.ts

Parses ASDM asset files (.md) from raw string content into structured ParsedAsset objects.

**Exports:** `parseAsset(content, sourcePath, provider?)`

**Behavior:** Splits YAML frontmatter from Markdown body, validates required fields (name, type,
description, version), extracts provider-specific config, and computes the SHA-256 of the raw content.
Throws a ParseError for malformed input with a descriptive message.

**Dependencies:** yaml (frontmatter parsing), crypto (SHA-256 hash)
```
