---
name: anchorscope-integrator
description: Use to execute the COMMITTED phase of an AnchorScope task — applies an approved modification using as.write after a final hash verification; the only skill that writes to files
---

> **Related skills:** Receives from `/skill:anchorscope-validator` (APPROVED). On completion, check for follow-on tasks with `/skill:anchorscope-core`. On hash mismatch before write, re-anchor with `/skill:anchorscope-scope-anchoring`.

# AnchorScope Integrator

APPROVED → **COMMITTED**

This is the only skill that writes to files. One wrong write can corrupt the codebase. Verify before every write, no exceptions.

## Pre-condition

Anchor Buffer must be in APPROVED state with `validation_report.anchor_valid: true` and `validation_report.hash_valid: true`.

## Rules

- MUST re-verify the hash immediately before writing — not once during REVIEWING, again now
- MUST use `as.write` for all file modifications
- MUST apply changes atomically — no partial writes
- MUST abort if the final hash check fails
- MUST record `hash.after` in the Anchor Buffer after a successful write
- NEVER write without completing the final hash verification

## Procedure

1. Read `anchor`, `hash.before`, and `proposed_replacement` from the Anchor Buffer
2. Read the current file with `as.read`
3. Locate the anchored region and compute SHA-256
4. Compare to `hash.before`
   - Match → proceed to step 5
   - Mismatch → ABORT (see below)
5. Construct the new file content: everything before the anchor + `proposed_replacement` + everything after the anchor
6. Write with `as.write` atomically
7. Re-read the written file and confirm the change landed correctly
8. Compute `hash.after` of the new anchored region
9. Update Anchor Buffer: state → COMMITTED, `hash.after` → recorded

## Output

```yaml
state: COMMITTED
anchorscope_edit:
  file: <path>
  anchor:
    start: |
      <start anchor>
    end: |
      <end anchor>
  hash:
    algorithm: sha256
    before: <original hash>
    after: <new hash>
  true_id: <true_id>
  status: success
```

## On Abort — Final Hash Mismatch

```
ABORT: Final hash verification failed — file changed between APPROVED and now.
  Expected (hash.before): <value>
  Computed now:           <value>
  Action: Do NOT write. Re-anchor with /skill:anchorscope-scope-anchoring.
```

Report to your human partner before proceeding.

## After COMMITTED

Check `children` in the Anchor Buffer. If any sub-tasks are pending, start each from DISCOVERED via `/skill:anchorscope-core`. If `parent_id` is set, update the parent buffer to reflect this task's completion.
