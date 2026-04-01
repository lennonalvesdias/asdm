---
name: analyze-schema
type: command
description: "Analyzes a database schema for normalization issues, missing indexes, and design problems"
version: 1.0.0

providers:
  opencode:
    slash_command: /analyze-schema
    agent: data-analyst
  claude-code:
    slash_command: /analyze-schema
    agent: data-analyst
  copilot:
    slash_command: /analyze-schema
    agent: data-analyst
---

# /analyze-schema

Analyzes a database schema definition for normalization violations, missing constraints, index opportunities, and design patterns that could cause performance or data quality issues at scale.

## Usage

```
/analyze-schema <path>
/analyze-schema schema.sql
/analyze-schema migrations/
/analyze-schema --dialect postgres schema.sql
```

## Options

- `<path>` — Required. SQL file, directory of migration files, or Prisma/Drizzle schema file
- `--dialect <db>` — Database dialect: `postgres` (default), `mysql`, `sqlite`
- `--focus <area>` — Limit analysis: `normalization`, `indexes`, `constraints`, `naming`
- `--threshold <nf>` — Normalization target: `1nf`, `2nf`, `3nf` (default), `bcnf`

## Analysis Categories

### Normalization
- Detects repeating groups that violate 1NF (unnormalized arrays in non-array columns)
- Identifies partial dependencies that violate 2NF
- Flags transitive dependencies that violate 3NF
- Suggests decomposition with example `CREATE TABLE` statements

### Missing Constraints
- Foreign keys without an index on the referencing column
- VARCHAR/TEXT columns that should have a NOT NULL constraint
- Unique constraints missing on columns used in lookups
- Check constraints that could enforce business rules at the database level

### Index Analysis
- Columns referenced in common JOIN patterns without indexes
- High-cardinality columns suitable for B-tree indexes
- Low-cardinality columns better served by partial indexes
- Composite index column ordering recommendations based on selectivity

### Naming Conventions
- Inconsistent table or column naming (snake_case vs camelCase)
- ID columns that do not follow a consistent naming pattern
- Boolean columns not using `is_` or `has_` prefix

## Output Example

```
HIGH   orders.customer_id — Foreign key missing index (full table scan on JOIN)
HIGH   users.email — UNIQUE constraint missing; used as lookup key
MEDIUM products — Table has no created_at or updated_at timestamp columns
LOW    order_items.qty — Column name 'qty' should be 'quantity' (consistency)

3 tables analyzed, 4 findings (2 HIGH, 1 MEDIUM, 1 LOW)
```
