---
name: threat-modeling
type: skill
description: "Security threat modeling using the STRIDE framework for application and infrastructure"
version: 1.0.0
tags: [security, threat-modeling, stride, risk, architecture]
trigger: "When designing new features, reviewing security architecture, or assessing risk of system changes"

providers:
  opencode:
    location: skills/threat-modeling/
  claude-code:
    location: skills/threat-modeling/
  copilot:
    applyTo: "**/*"
---

# Threat Modeling Skill

## Purpose

Threat modeling is the practice of systematically identifying, classifying, and mitigating security risks before they are built into a system. It is most effective when applied at design time — retrofitting security is exponentially more expensive than designing it in.

## STRIDE Framework

STRIDE categorizes threats by the property of a secure system they violate:

| Threat | Violated Property | Example |
|--------|-----------------|---------|
| **S**poofing | Authentication | Attacker impersonates a legitimate user |
| **T**ampering | Integrity | Attacker modifies data in transit or at rest |
| **R**epudiation | Non-repudiation | User denies performing an action; no audit trail |
| **I**nformation Disclosure | Confidentiality | Sensitive data exposed in error messages or logs |
| **D**enial of Service | Availability | Attacker exhausts resources, making the service unavailable |
| **E**levation of Privilege | Authorization | User gains access beyond their permission level |

## Threat Modeling Process

### Step 1: Define Scope
Identify the components, data flows, and trust boundaries in scope. Draw a Data Flow Diagram (DFD):
- **External entities**: Actors outside the system boundary (users, third-party services)
- **Processes**: Code that transforms data
- **Data stores**: Databases, caches, files, queues
- **Data flows**: How data moves between entities, processes, and stores
- **Trust boundaries**: Lines a threat actor must cross to reach sensitive components

### Step 2: Identify Threats (STRIDE per Element)
For each element in the DFD, apply STRIDE systematically. Not every category applies to every element:
- External entities: primarily Spoofing, Repudiation
- Processes: all STRIDE categories
- Data stores: primarily Tampering, Information Disclosure, Denial of Service
- Data flows: primarily Tampering, Information Disclosure, Denial of Service

### Step 3: Assess Risk
For each identified threat, score using DREAD or CVSS v3.1:
- **Damage potential**: How severe is the impact?
- **Reproducibility**: How reliably can the attack be repeated?
- **Exploitability**: What skill level is required?
- **Affected users**: How many users are impacted?
- **Discoverability**: How easy is the attack to discover?

### Step 4: Define Mitigations
For each threat above the accepted risk threshold, define a specific technical control:

| Threat Category | Common Mitigations |
|----------------|-------------------|
| Spoofing | Strong authentication (MFA, passkeys), certificate pinning |
| Tampering | HMAC signatures, TLS mutual auth, database row-level security |
| Repudiation | Immutable audit logs, digital signatures, structured event logging |
| Information Disclosure | Encryption at rest and in transit, field-level masking, minimal logging |
| Denial of Service | Rate limiting, circuit breakers, autoscaling, WAF rules |
| Elevation of Privilege | Principle of least privilege, RBAC/ABAC, input validation |

### Step 5: Document and Track
Produce a threat model document with:
1. DFD diagram with trust boundaries annotated
2. Threat inventory: ID, STRIDE category, affected element, risk score
3. Mitigation plan: control, owner, target resolution date
4. Accepted risks: threats below threshold with explicit justification

## Rules

- Threat model BEFORE implementation — design-time fixes cost 30× less than production fixes
- NEVER accept a risk without explicit sign-off from a security lead
- Update the threat model when the architecture changes — stale models create false confidence
- Prioritize by exploitability × impact; theoretical low-exploitability threats are low priority
- Document the trust boundaries explicitly — most security failures occur at boundary crossings
