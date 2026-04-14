---
name: anchorscope-decomposer
description: Use to execute the SCOPED phase of an AnchorScope task — reads the target file and extracts a uniquely identifiable Anchored Scope with True ID and hash
---

> **Related skills:** Called after DISCOVERED phase in `/skill:anchorscope-core`. Anchoring details at `/skill:anchorscope-scope-anchoring`. On completion, hand off to `/skill:anchorscope-proposer`.

# AnchorScope Decomposer

DISCOVERED → **SCOPED**

## Pre-condition

Anchor Buffer must be in DISCOVERED state. If uncertain, check first with `/skill:anchorscope-buffer-reader`.

## Rules

- MUST use `as.read` — never reconstruct file content from memory
- MUST verify anchor uniqueness within the parent scope before recording
- MUST abort if uniqueness cannot be guaranteed
- MUST compute SHA-256 hash from raw anchored content
- MUST store all results in the Anchor Buffer

## Procedure

Follow `/skill:anchorscope-scope-anchoring` step by step:

1. Read file with `as.read`
2. Identify smallest enclosing parent scope
3. Select candidate anchors (prefer signatures and class definitions)
4. Verify each anchor appears exactly once in the parent scope
5. Expand anchors if needed to restore uniqueness
6. Extract verbatim anchored content
7. Compute SHA-256 hash and True ID
8. Update Anchor Buffer to SCOPED

## Output

```yaml
state: SCOPED
file: <path>
parent_scope: <function | class | module>
anchor:
  start: |
    <verbatim start anchor>
  end: |
    <verbatim end anchor>
hash:
  algorithm: sha256
  value: <hash>
true_id: sha256:<hash>
content: |
  <verbatim anchored code>
```

## On Failure

```
ERROR: Cannot establish unique anchor.
Reason: <explanation>
Action: <expanding anchor | requesting clarification from your human partner>
```
