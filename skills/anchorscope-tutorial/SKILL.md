---
name: anchorscope-tutorial
description: Use when you need the detailed AnchorScope protocol specification and full CLI command reference
compatibility: pi-v0.22.0+
---

> **Related skills:** Learning anchoring strategies? `/skill:anchorscope-anchoring-guide`. Core workflow? `/skill:anchorscope-core`.

# AnchorScope Tutorial (Reference)

> **Note:** This skill provides access to the complete AnchorScope protocol specification. For detailed usage guidance, see `/skill:anchorscope-anchoring-guide`.

## Overview

AnchorScope is a protocol for deterministic, verifiable code editing through:

1. **Anchored Scopes** - Exact byte-level matching with minimal context
2. **True IDs** - Content-derived identifiers for stable references
3. **Hash Verification** - Integrity checks before every write
4. **Buffer Management** - External state persistence via pipe/paths

**Governing principle: No Match, No Hash, No Write.**

---

## Quick Reference

### Basic Read Operation
```bash
anchorscope read --file <path> --anchor "<string>"
```

Output includes:
- `hash=` - **scope_hash** (use this for `--expected-hash`)
- `true_id=` - Buffer identification
- `content=` - Matched text (CRLF normalized to LF)

### Basic Write Operation
```bash
anchorscope write \
  --file <path> \
  --anchor "<string>" \
  --expected-hash <scope_hash> \
  --replacement "<new_content>"
```

---

## Command Reference

| Command | Purpose |
|---------|---------|
| `read` | Locate and hash an anchored scope |
| `write` | Replace scope with hash verification |
| `label` | Assign human-readable alias to True ID |
| `tree` | Visualize buffer structure |
| `pipe` | Bridge with external tools |
| `paths` | Get buffer file paths for debugging |

---

## Multi-Level Anchoring

### Level 1 (File-level)
```bash
anchorscope read --file file.rs --anchor "fn main()"
# Creates: {file_hash}/{true_id}/content
```

### Level 2 (Buffer-level)
```bash
anchorscope read --true-id <level1_true_id> --anchor "for i in range(10):"
# Reads from: {file_hash}/{level1_true_id}/content
# Creates: {file_hash}/{level1_true_id}/{true_id}/content
```

**Critical:** Level 2+ operations read from buffer copies, NOT the original file.

---

## Stale Buffer Protocol

When a child level writes successfully, the parent buffer becomes **STALE**:

| Level | Operation | Buffer State |
|-------|-----------|--------------|
| 1 | `read --file file.rs --anchor "fn foo()"` | Buffer 1 fresh |
| 2 | `read --true-id <id1> --anchor "..."` | Buffer 2 fresh |
| 2 | `write --true-id <id2>` | Buffer 2 deleted, Buffer 1 **STALE** |

**Before re-reading a parent buffer, verify it hasn't been made stale by a child write.**

---

## Error Conditions

| Error | Description |
|-------|-------------|
| `NO_MATCH` | Zero occurrences of anchor found |
| `MULTIPLE_MATCHES (N)` | Anchor appears N>1 times |
| `HASH_MISMATCH` | Matched scope differs from expected |
| `IO_ERROR: ...` | File I/O or UTF-8 validation failure |

---

## External Tool Integration

```bash
# stdout mode
anchorscope pipe --label <name> --out | external-tool | anchorscope pipe --label <name> --in

# file-io mode (Windows-compatible)
anchorscope pipe --label <name> --tool <tool> --file-io --tool-args "<args>"
```

---

## Complete Workflow

```bash
# 1. Read to get True ID and scope_hash
anchorscope read --file file.rs --anchor "fn main()"
# Note the hash and true_id

# 2. (Optional) Create label for easier reference
anchorscope label --name "main" --true-id <true_id>

# 3. Prepare replacement via pipe (optional)
anchorscope pipe --label "main" --out | transform-tool | anchorscope pipe --label "main" --in

# 4. Write with hash verification
anchorscope write --label "main" --from-replacement
# Or: anchorscope write --true-id <id> --expected-hash <hash> --from-replacement
```

---

## Buffer Structure

```
{TMPDIR}/anchorscope/
├── buffer/
│   └── {file_hash}/
│       └── {true_id}/
│           ├── content      # Anchored scope content
│           └── replacement  # Proposed replacement (via pipe)
└── labels/
    └── {alias}.json         # Human-readable aliases
```

---

## Key Protocol Points

1. **`--expected-hash`** must use the **scope_hash** from the *previous* `read` operation
2. Multi-level anchoring reads from **buffer copies**, not the original file
3. Child `write` success makes parent buffer **stale** - re-read before using parent again
4. External tools return content is validated (UTF-8) and normalized (LF) before storage

---

## When to Use

- LLM-driven code editing where determinism is critical
- Multi-step edits requiring state persistence
- External tool integration with content transformation
- Debugging buffer state with tree/paths commands
- Multi-line anchor matching with exact byte preservation
