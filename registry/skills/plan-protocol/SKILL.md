---
name: plan-protocol
type: skill
description: "Structured implementation planning methodology with citations and quality gates"
version: 1.0.0
tags: [planning, methodology, implementation, documentation]
trigger: "When asked to plan, design, or implement a feature, task, or system change"

providers:
  opencode:
    location: skills/plan-protocol/
  claude-code:
    location: skills/plan-protocol/
  copilot:
    applyTo: "**/*"
---

# Plan Protocol

## Overview

Before implementing any non-trivial change, produce a structured plan that can be reviewed, approved, and referenced throughout execution. A plan is not a to-do list — it is a contract between what you intend to do and why, enabling collaborators to catch mistakes before they become code.

## When to Write a Plan

Apply this skill whenever:
- The task spans more than one file or component
- The approach involves a non-obvious technical choice
- The implementation has dependencies on external systems or contracts
- Another person needs to understand what you are about to do

For trivial, single-file changes that implement obvious logic, proceed without a formal plan.

## Plan Structure

A well-formed implementation plan contains the following sections:

### 1. Problem Statement
One paragraph describing the current state, why it is insufficient, and what success looks like. Be specific: "users cannot reset their password" is better than "improve auth."

### 2. Approach
A narrative description of the chosen solution. Explain the key design decisions and why this approach was selected over alternatives. Reference any research, prior art, or constraints that shaped the decision.

### 3. Implementation Steps
An ordered list of concrete steps. Each step should be independently verifiable and small enough to complete in a single session. Number the steps; do not use bullets.

### 4. Affected Components
An explicit list of files, services, schemas, or APIs that will change. This prevents scope creep and helps reviewers understand blast radius.

### 5. Risk and Rollback
What could go wrong, and how to undo the change if it must be reverted. Every plan should have a rollback path.

### 6. Open Questions
Unresolved decisions that require input before or during implementation. If a plan has no open questions, it was written too quickly.

## Citations

When a decision is informed by research, link the source inline using `(ref:<delegation-id>)` notation. This creates an audit trail from decision to evidence.

## Quality Gates

Before marking a plan as final:
- [ ] Every implementation step is atomic and independently reviewable
- [ ] Affected components list is complete
- [ ] Rollback procedure is defined
- [ ] Open questions are either answered or explicitly deferred with a reason
