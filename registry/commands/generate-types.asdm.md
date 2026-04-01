---
name: generate-types
type: command
description: "Generates TypeScript types from a JSON Schema, OpenAPI spec, or database schema"
version: 1.0.0

providers:
  opencode:
    slash_command: /generate-types
    agent: architect
  claude-code:
    slash_command: /generate-types
    agent: architect
  copilot:
    slash_command: /generate-types
    agent: architect
---

# /generate-types

Generates fully-typed TypeScript interfaces and types from a schema source. Supports JSON Schema, OpenAPI 3.x specifications, GraphQL schemas, and SQL table definitions.

## Usage

```
/generate-types <source>
/generate-types schemas/user.schema.json
/generate-types openapi.yaml --output src/types/api.ts
/generate-types --from-sql "CREATE TABLE users (...)"
```

## Options

- `<source>` — Required. Path to schema file or inline schema string
- `--output <path>` — Write generated types to this file (default: stdout)
- `--from-sql` — Parse a SQL CREATE TABLE statement and generate types
- `--strict` — Generate strict types with no implicit `any` or loose unions
- `--prefix <name>` — Prefix all generated type names (e.g., `--prefix Api` → `ApiUser`)
- `--readonly` — Mark all generated object properties as `readonly`

## Supported Sources

| Source | Format |
|--------|--------|
| JSON Schema | `*.schema.json` |
| OpenAPI 3.x | `openapi.yaml`, `openapi.json` |
| GraphQL | `*.graphql`, `schema.gql` |
| SQL DDL | Inline `CREATE TABLE` statements |

## Output Example

Input (`user.schema.json`):
```json
{
  "type": "object",
  "required": ["id", "email"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "email": { "type": "string", "format": "email" },
    "name": { "type": "string" },
    "createdAt": { "type": "string", "format": "date-time" }
  }
}
```

Generated output:
```typescript
/** Auto-generated from user.schema.json — do not edit manually */

export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt?: string;
}
```

## Rules

- Generated files always include a header comment marking them as auto-generated
- Required fields are non-optional; optional fields use `?` notation
- `format: date-time` maps to `string` by default; use `--date-type Date` to use `Date` objects
