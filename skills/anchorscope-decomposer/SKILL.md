---
name: anchorscope-decomposer
description: Use to execute the SCOPED phase of an AnchorScope task — reads the target file and extracts a uniquely identifiable Anchored Scope with True ID and hash
compatibility: pi-v0.22.0+
---

> **Related skills:** Called after DISCOVERED phase in `/skill:anchorscope-core`. Anchoring details at `/skill:anchorscope-scope-anchoring`. On completion, hand off to `/skill:anchorscope-proposer`. Full workflow at `/skill:anchorscope-core`. Read Anchor Buffer with `/skill:anchorscope-buffer-reader`.

# AnchorScope Decomposer

DISCOVERED → **SCOPED**

## Pre-condition

Anchor Buffer must be in DISCOVERED state. If uncertain, check first with `/skill:anchorscope-buffer-reader`.

## Rules

- MUST use `as.read` — never reconstruct file content from memory
- MUST normalize line endings (CRLF → LF) before hashing or matching
- MUST verify anchor uniqueness within the parent scope before recording
- MUST abort if uniqueness cannot be guaranteed
- MUST compute `xxh3_64` hash from normalized anchored content
- MUST compute True ID as `xxh3_64(hex(file_hash) || 0x5F || hex(scope_hash))`
- MUST store all results in the Anchor Buffer

## Procedure

Follow `/skill:anchorscope-scope-anchoring` step by step:

1. Read file with `as.read`
2. Normalize line endings (CRLF → LF)
3. Identify smallest enclosing parent scope
4. Select candidate anchors (prefer signatures and class definitions)
5. Verify each anchor appears exactly once in the parent scope
6. Expand anchors if needed to restore uniqueness
7. Extract verbatim anchored content (CRLF normalized)
8. Compute `xxh3_64` scope hash and True ID
9. Update Anchor Buffer to SCOPED

**Multi-line anchors:** For multi-line content, consider using `--anchor-file` instead of inline `--anchor` strings to avoid shell escaping issues. See Tutorial Section 9 for details.

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
  algorithm: xxh3_64
  before: <16-char lowercase hex>
true_id: <16-char lowercase hex>
content: |
  <verbatim anchored code, CRLF normalized to LF>
```

## Buffer Storage

The Anchor Buffer is stored in the AnchorScope buffer directory:

| Platform | Path |
|----------|------|
| Windows | `%TEMP%\anchorscope\` |
| macOS/Linux | `$TMPDIR/anchorscope/` |

```bash
# Windows
tree %TEMP%\anchorscope\

# macOS/Linux
tree $TMPDIR/anchorscope/
```

The buffer contains:
- `buffer/{file_hash}/{true_id}/content` — normalized anchored content
- `buffer/{file_hash}/{true_id}/replacement` — proposed replacement (created by external tools)

⚠️ **The buffer is ephemeral** — it is automatically cleaned up after a successful write.

## External Tool Integration

Use `anchorscope pipe` to integrate external tools:

```bash
# Pipe the anchored scope to an external tool
anchorscope pipe --true-id {true_id} --out | external-tool | anchorscope pipe --true-id {true_id} --in
```

The external tool's output is stored in `replacement` and used by `anchorscope-proposer`.

## On Failure

```
NO_MATCH: Anchor not found in file
  Action: Re-analyze the target code region
```

```
HASH_MISMATCH: File changed since SCOPED
  Expected: <expected_hash>
  Actual: <actual_hash>
  Action: Re-run /skill:anchorscope-scope-anchoring
```

```
ERROR: Cannot establish unique anchor.
  Reason: <explanation>
  Action: <expanding anchor | requesting clarification from your human partner>
```

Note: If expansion fails, consider moving to a larger parent scope (e.g., from function to class level).
