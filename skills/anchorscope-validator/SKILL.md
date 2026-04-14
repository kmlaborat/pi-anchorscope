---
name: anchorscope-validator
description: Use to execute the REVIEWING phase of an AnchorScope task — validates the proposed modification for anchor integrity, hash consistency, scope containment, and correctness; produces APPROVED or REJECTED
compatibility: pi-v0.22.0+
---

> **Related skills:** Receives from `/skill:anchorscope-proposer`. On APPROVED, hand off to `/skill:anchorscope-integrator`. On REJECTED, send back to `/skill:anchorscope-proposer`. Hash mismatch needs `/skill:anchorscope-scope-anchoring`. Full workflow at `/skill:anchorscope-core`. Verify anchor integrity first.

# AnchorScope Validator

DRAFTED → **REVIEWING** → **APPROVED** | **REJECTED**

Nothing is written until this skill approves. An approval that misses an error will corrupt the codebase. Be thorough.

## Pre-condition

Anchor Buffer must be in DRAFTED state with `proposed_replacement` present.

## Validation Criteria

Run all five checks. A single failure means REJECTED.

### 1. Anchor Integrity

Read the current file with `as.read`. Confirm:
- `anchor.start` appears in the file
- `anchor.end` appears in the file
- Both are unique within the parent scope

### 2. Hash Integrity

Locate the anchored region in the current file. Normalize line endings (CRLF → LF). Compute `xxh3_64` of the normalized content. Compare to `hash.before`.

```
Match → proceed
Mismatch → ABORT, do not approve or reject
```

On mismatch:

```
HASH_MISMATCH: File changed since SCOPED
  Expected: <expected_hash>
  Actual: <actual_hash>
  Action: Re-run /skill:anchorscope-scope-anchoring before retrying
```

### 3. Scope Containment

Confirm that `proposed_replacement` addresses only the Anchored Scope. The replacement must not reference, delete, or insert anything outside the anchor boundaries.

### 4. Minimal Diff

Check that the proposal contains no changes unrelated to the stated `description`: no reformatting, no renames, no additional refactoring.

### 5. Syntactic Correctness

Verify that the replacement is syntactically valid for the target language. Check indentation, bracket matching, and that no existing signatures or types are unintentionally altered.

## Output (APPROVED)

```yaml
state: APPROVED
validation_report:
  anchor_valid: true
  hash_valid: true
  scope_contained: true
  minimal_diff: true
  syntactically_correct: true
  comments: ""  # Empty string for approved tasks
```

## Output (REJECTED)

```yaml
state: REJECTED
validation_report:
  anchor_valid: <true|false>
  hash_valid: <true|false>
  scope_contained: <true|false>
  minimal_diff: <true|false>
  syntactically_correct: <true|false>
  comments: >
    <List of strings: specific rejection reasons and corrective instructions>
```

## Human-in-the-Loop

If your human partner wants to approve manually, produce the validation report and wait. Do not auto-advance to COMMITTED without their confirmation.
