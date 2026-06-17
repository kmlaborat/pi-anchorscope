---
name: anchorscope-integrator
description: Use to execute the COMMITTED phase of an AnchorScope task — applies an approved modification using as.write after a final hash verification; the only skill that writes to files
compatibility: pi-v0.22.0+
---

> **Related skills:** Receives from `/skill:anchorscope-validator` (APPROVED). On completion, check for follow-on tasks with `/skill:anchorscope-core`. On hash mismatch before write, re-anchor with `/skill:anchorscope-scope-anchoring`. Full workflow at `/skill:anchorscope-core`. Only skill that writes to files.

# AnchorScope Integrator

APPROVED → **COMMITTED**

This is the only skill that writes to files. One wrong write can corrupt the codebase. Verify before every write, no exceptions.

**IMPORTANT:** Use the `anchorscope` tool to execute `anchorscope write --true-id {true_id} --from-replacement` or `anchorscope write --label {alias} --from-replacement`.

## Pre-condition

Anchor Buffer must be in APPROVED state with `validation_report.anchor_valid: true` and `validation_report.hash_valid: true`.

## Rules

- MUST re-verify the hash immediately before writing — not once during REVIEWING, again now
- MUST use `as.write` for all file modifications (the only skill that writes to files)
- MUST apply changes atomically — no partial writes
- MUST abort if the final hash check fails
- MUST record `hash.after` in the Anchor Buffer after a successful write
- NEVER write without completing the final hash verification

**Note:** `as.write` is mandatory for all file modifications in AnchorScope. Standard `write` doesn't provide hash verification and can silently corrupt code.

## Procedure

1. Read `anchor`, `hash.before`, and `proposed_replacement` from the Anchor Buffer
2. Read the current file with `as.read`
3. Normalize line endings (CRLF → LF)
4. Locate the anchored region and compute `xxh3_64` of the normalized content
5. Compare to `hash.before`
   - Match → proceed to step 6
   - Mismatch → ABORT (see below)
6. Construct the new file content: everything before the anchor + `proposed_replacement` + everything after the anchor
7. Apply CRLF → LF normalization to the full new content
8. Write with `as.write` atomically
9. Re-read the written file and confirm the change landed correctly
10. Compute `hash.after` = `xxh3_64` of the new anchored region (normalized)
11. Update Anchor Buffer: state → COMMITTED, `hash.after` → recorded

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
    algorithm: xxh3_64
    before: <original hash>
    after: <new hash>  # null if aborted
  true_id: <16-char lowercase hex>
  status: success | aborted
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

## External Tool Integration

Tools can provide `replacement` content:
```bash
anchorscope pipe --true-id {true_id} --out | external-tool | anchorscope pipe --true-id {true_id} --in
```

## Label Support

If a label is used instead of `true_id`, AnchorScope resolves it internally:

```bash
anchorscope write --label <name> --from-replacement
```

The `label` is stored in `{TMPDIR}/anchorscope/labels/<name>.json`.

### Label Resolution Workflow

```bash
# 1. Create label
anchorscope label --name "main_function" --true-id 8db42edf7905d28f

# 2. Use label in write
anchorscope write --label "main_function" --from-replacement

# 3. AnchorScope internally:
#    a. Resolves "main_function" → 8db42edf7905d28f
#    b. Reads from buffer/{8db42edf7905d28f}/replacement
#    c. Validates and writes to file
```

### When to Use Labels

- **Manual workflows:** Easier to remember "main_function" than a hex hash
- **Interactive sessions:** No need to copy-paste long True IDs
- **Multi-step processes:** More readable in scripts and documentation

### Limitations

- Labels cannot be combined with `--expected-hash` in `write` operations
- Labels point to True IDs, so the same stale buffer rules apply

## Debugging Paths

Use `anchorscope paths` to inspect buffer locations:
```bash
anchorscope paths --true-id {true_id}
anchorscope paths --label {alias}
```
