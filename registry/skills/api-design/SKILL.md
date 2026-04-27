---
name: api-design
type: skill
description: "RESTful and GraphQL API design principles for consistent, developer-friendly interfaces"
version: 1.0.0
tags: [api, rest, graphql, design, openapi]
trigger: "When designing or reviewing API endpoints, schemas, or contracts"

providers:
  opencode:
    location: skills/api-design/
  claude-code:
    location: skills/api-design/
  copilot:
    applyTo: "**/*.{ts,js,yaml,json}"
---

# API Design Skill

## Core Principles

A good API is a product. Its consumers are developers, and their experience — discoverability, predictability, error clarity, and ease of evolution — is the measure of quality. Design APIs for the caller, not the implementation.

## RESTful API Standards

### Resource Naming
- Use plural nouns for collections: `/users`, `/orders`, `/products`
- Nest resources only when the child cannot exist without the parent: `/users/{id}/addresses`
- Avoid verbs in URLs — use HTTP methods to express actions: `POST /orders` not `POST /createOrder`
- Use kebab-case for multi-word resources: `/shipping-addresses`

### HTTP Methods
| Method | Semantics | Idempotent | Safe |
|--------|-----------|-----------|------|
| GET | Retrieve resource(s) | Yes | Yes |
| POST | Create new resource | No | No |
| PUT | Replace entire resource | Yes | No |
| PATCH | Partial update | No | No |
| DELETE | Remove resource | Yes | No |

### Status Codes
- `200 OK` — successful retrieval or update
- `201 Created` — resource created; include `Location` header
- `204 No Content` — successful delete or no body to return
- `400 Bad Request` — client sent invalid input; include error details
- `401 Unauthorized` — authentication required
- `403 Forbidden` — authenticated but not authorized
- `404 Not Found` — resource does not exist
- `409 Conflict` — state conflict (duplicate, stale update)
- `422 Unprocessable Entity` — validation failed; include field-level errors
- `429 Too Many Requests` — rate limit exceeded; include `Retry-After`
- `500 Internal Server Error` — server fault; never expose internals

### Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "details": [
      { "field": "email", "message": "must be a valid email address" }
    ]
  }
}
```

## Pagination

For collection endpoints returning potentially large result sets:
```json
{
  "data": [...],
  "pagination": {
    "cursor": "eyJpZCI6MTAwfQ==",
    "hasNext": true,
    "pageSize": 20
  }
}
```
Prefer cursor-based pagination over offset for large or frequently-updated datasets.

## Versioning

- Version via URL path prefix: `/v1/`, `/v2/`
- Never break backward compatibility within a version
- Deprecate with `Deprecation` and `Sunset` response headers before removing

## GraphQL Guidelines

- Queries should be colocated with their consuming component (fragment colocation)
- Never expose raw database IDs — use opaque global IDs
- Use DataLoader for all resolver-level data fetching to avoid N+1
- Mutations return the mutated resource — callers should not need a follow-up query
- Rate limit by query complexity, not just request count

## Rules

- ALWAYS document every endpoint with request schema, response schema, and error conditions
- NEVER change the meaning of an existing field — add a new field instead
- Include an `X-Request-Id` header in every response for distributed tracing
- Validate all inputs at the API boundary; reject before processing
