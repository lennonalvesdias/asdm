---
name: data-pipeline
type: skill
description: "Data ingestion, transformation, and pipeline patterns for reliable data engineering"
version: 1.0.0
tags: [data, pipeline, etl, elt, airflow, dbt, streaming]
trigger: "When designing data pipelines, ETL/ELT jobs, transformations, or data engineering workflows"

providers:
  opencode:
    location: skills/data-pipeline/
  claude-code:
    location: skills/data-pipeline/
  copilot:
    applyTo: "**/*.{py,sql,yaml}"
---

# Data Pipeline Skill

## Core Pipeline Principles

Data pipelines fail silently more often than they fail loudly. A pipeline that produces wrong results without alerting is more dangerous than one that crashes. Build in correctness guarantees, observability, and recovery mechanisms from the start.

## Pipeline Properties

Every production data pipeline must guarantee:

### Idempotency
Re-running a pipeline job for the same time window must produce identical output. Achieve this by:
- Using `INSERT OVERWRITE` or `MERGE` instead of raw `INSERT`
- Partitioning output tables by the event time of the source data
- Making the job aware of its own run ID to detect and skip duplicate processing

### Backfill Safety
Historical reprocessing must not double-count, corrupt, or miss data. Design for:
- Explicit time range parameters: every job accepts `start_date` and `end_date`
- Deterministic partitioning: data for a given time range always lands in the same partition
- Atomicity: write to a staging table, then swap; never append-then-fail

### Observability
- Log row counts at every transformation stage
- Emit metrics: records processed, records rejected, processing duration, lag
- Alert on anomalies: row count drops >20%, null rate increases, schema drift

## Transformation Patterns

### Source Layer (Bronze)
- Ingest raw data with minimal transformation — preserve source fidelity
- Add ingestion metadata: `_ingested_at`, `_source_system`, `_batch_id`
- Schema-on-read for semi-structured sources (JSON, Avro)

### Cleansing Layer (Silver)
- Apply type casting, null handling, and deduplication
- Validate referential integrity against dimension tables
- Flag invalid records — route to a dead-letter table for investigation, do not silently drop

### Aggregation Layer (Gold)
- Build business-level aggregates designed for query patterns
- Optimize partition and clustering keys for consumer query shapes
- Document freshness SLA and update frequency

## SQL Transformation Best Practices

```sql
-- Always filter before aggregating
WITH filtered_events AS (
  SELECT user_id, event_type, occurred_at
  FROM raw.events
  WHERE occurred_at >= '{{ start_date }}'
    AND occurred_at <  '{{ end_date }}'
    AND event_type IS NOT NULL
),
-- Aggregate on already-filtered data
event_counts AS (
  SELECT user_id, event_type, COUNT(*) AS event_count
  FROM filtered_events
  GROUP BY 1, 2
)
SELECT * FROM event_counts
```

## dbt Guidelines

- One model per transformation step — don't chain multiple heavy transformations in one model
- Use `ref()` for all model dependencies; never hardcode database/schema names
- Document every model with a YAML schema file: column descriptions and data tests
- Run `not_null` and `unique` tests on primary keys for every model
- Tag models by layer (`bronze`, `silver`, `gold`) and schedule accordingly

## Rules

- NEVER use `SELECT *` in production pipeline queries — explicit columns only
- ALWAYS test a pipeline on a small time slice before running against full history
- Log every schema change to source tables and alert downstream pipeline owners
- Treat schema evolution as a first-class concern: `COALESCE(new_col, default_val)` before backfill
