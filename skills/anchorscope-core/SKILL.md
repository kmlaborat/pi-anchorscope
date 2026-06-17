---
name: anchorscope-core
description: Use when modifying existing code to enforce deterministic, verifiable edits via the AnchorScope protocol — prevents non-deterministic replacements, context loss, and unsafe modifications
compatibility: pi-v0.22.0+
---

> **Related skills:** Extracting a scope? `/skill:anchorscope-scope-anchoring`. Reading an Anchor Buffer? `/skill:anchorscope-buffer-reader`. Want to delegate phases? `/skill:anchorscope-decomposer` → `/skill:anchorscope-proposer` → `/skill:anchorscope-validator` → `/skill:anchorscope-integrator`. See each skill for detailed phase instructions. Use `/skill:anchorscope-decomposer` for single-phase tasks.

# AnchorScope Core

**Announce at start:** "I'm using the anchorscope-core skill to edit this code deterministically. I will use the `anchorscope` tool to execute AnchorScope commands for managing the Anchor Buffer and applying changes."

## Tool Selection Strategy

| Purpose | Recommended Tool | Reason |
|---------|------------------|--------|
| Quick file structure check | `read` | Fast, no anchoring overhead |
| Finding anchor candidates | `read` | Exploratory, not yet deterministic |
| Setting anchors | `as_read` | Deterministic, with `scope_hash`/`true_id` |
| Actual edits | `as_write` | Hash-verified, atomic |
| Debugging buffers | `as_paths` | Inspect buffer locations |

**Rule of thumb:**
- Use `read` when you just need to **look around** (exploration phase)
- Use `as_read` when you need to **set an anchor and start editing** (deterministic phase)
- Use `as_write` for any actual code modification

## Tool Usage Reference

| Standard Tool | AnchorScope Equivalent | When to Use |
|---------------|----------------------|-------------|
| `read` | `anchorscope read` | Exploration: finding anchor candidates, quick structure checks |
| `write` | `anchorscope write` | **ALWAYS** for actual edits |
| `bash` | `anchorscope pipe/paths` | For buffer management |

**Critical:** For deterministic, hash-verified edits, always use `as_read` and `as_write`. They provide the anchoring needed for safe, reproducible changes.

## Why AnchorScope

LLMs editing code have four systemic failure modes. AnchorScope addresses each:

| Failure | Solution |
|---|---|
| Context loss — can't hold full file in mind | **Anchored Scope** — provide only the minimal necessary context |
| Wrong edits — modifying unintended code | **True ID** — uniquely identify the edit target |
| Lost state — forgets work history | **Anchor Buffer** — persist task state externally |
| Non-determinism — unreproducible changes | **Hash Verification** — verify integrity before every write |

**Governing principle: No Match, No Hash, No Write.**

## Execution Modes

This skill runs the full workflow by itself (Single-Agent Mode). Each phase can optionally be delegated to a dedicated sub-skill when available (Multi-Agent Mode). The choice belongs to your coding agent or your human partner — not to this skill.

## State Machine

```
DISCOVERED → SCOPED → DRAFTED → REVIEWING → APPROVED → COMMITTED
                                     ↓
                                 REJECTED → DRAFTED (retry)
```

| State | Meaning | Responsible skill |
|---|---|---|
| DISCOVERED | Task identified | anchorscope-core |
| SCOPED | Anchored Scope extracted, True ID computed | `/skill:anchorscope-decomposer` |
| DRAFTED | Modification proposed | `/skill:anchorscope-proposer` |
| REVIEWING | Proposal under validation | `/skill:anchorscope-validator` |
| APPROVED | Validation passed | `/skill:anchorscope-validator` |
| COMMITTED | Change written to file | `/skill:anchorscope-integrator` |
| REJECTED | Validation failed, retry required | `/skill:anchorscope-proposer` |

## Workflow

### Phase 1 — DISCOVERED

Identify the target file and the purpose of the modification. Initialize the Anchor Buffer:

```yaml
anchorscope_task:
  id: AS-<timestamp>
  state: DISCOVERED
  file: <path/to/file>
  description: <what to change and why>
  history:
    - state: DISCOVERED
      timestamp: <ISO8601>
```

### Phase 2 — SCOPED

→ Detailed anchoring procedure: `/skill:anchorscope-scope-anchoring`

**First**, use standard `read` to understand the file structure and identify potential anchor candidates. This is exploratory and doesn't need hash verification yet.

**Then**, when you've found a stable, unique anchor, use `as_read` to establish the Anchored Scope with `scope_hash` and `true_id`. Normalize line endings (CRLF → LF) before hashing. Identify the parent scope (smallest enclosing function, class, or module). Compute `xxh3_64` hash and True ID.

**ABORT if anchor uniqueness cannot be guaranteed.** Return to DISCOVERED and reconsider the scope.

### Phase 3 — DRAFTED

→ `/skill:anchorscope-proposer`

Generate a modification that touches only the Anchored Scope. Preserve all surrounding code exactly. Produce a minimal diff.

### Phase 4 — REVIEWING

→ `/skill:anchorscope-validator`

Verify anchor integrity, hash consistency, scope containment, minimal diff, and syntactic correctness.

### Phase 5a — APPROVED → COMMITTED

→ `/skill:anchorscope-integrator`

Re-verify hash immediately before writing. Apply change atomically with `as.write`. Record `hash.after` in the Anchor Buffer. If child tasks exist, start each from DISCOVERED.

### Phase 5b — REJECTED → DRAFTED

Record the rejection reason in the Anchor Buffer. Return to Phase 3. Address every issue raised. Do not reproduce the previous proposal.

## Anchor Buffer Schema

```yaml
anchorscope_task:
  id: AS-<timestamp>
  parent_id: null            # set if this is a sub-task
  state: SCOPED
  file: <path>
  description: <what and why>
  anchor:
    start: |
      <verbatim start anchor>
    end: |
      <verbatim end anchor>
  hash:
    algorithm: xxh3_64
    before: <hash of original anchored content>
    after: null              # filled after COMMITTED
  true_id: <16-char lowercase hex>
  content: |
    <verbatim anchored code>
  proposed_replacement: |
    <proposed replacement>   # present from DRAFTED onward
  validation:
    status: pending          # pending | approved | rejected
    comments: []
  children: []               # IDs of recursive sub-tasks
  history:
    - state: DISCOVERED
      timestamp: <ISO8601>
```

→ How to read the Anchor Buffer: `/skill:anchorscope-buffer-reader`

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
- `labels/{alias}.json` — human-readable alias mappings

⚠️ **The buffer is ephemeral** — it is automatically cleaned up after a successful `write` operation.

## Buffer Structure

The Anchor Scope protocol uses `true_id` as the primary identifier for anchored scopes:

```
true_id = xxh3_64(hex(file_hash) || 0x5F || hex(scope_hash))
```

For nested anchoring (level 2+):
```
true_id = xxh3_64(hex(parent_scope_hash) || 0x5F || hex(child_scope_hash))
```

### True ID Benefits
- **Stable identification**: Content-derived identifier that persists across edits
- **Parent context**: Encodes parent scope for nested anchoring
- **Human-readable aliases**: Use `anchorscope label` to create memorable names

→ See `/skill:anchorscope-scope-anchoring` for detailed anchoring algorithm.

## External Tool Integration

For advanced workflows, use external tools to process the anchored scope:

### Pipe Mode

**stdout mode (default):**
```bash
anchorscope pipe --true-id {true_id} --out | external-tool | anchorscope pipe --true-id {true_id} --in
# or using label
anchorscope pipe --label {alias} --out | external-tool | anchorscope pipe --label {alias} --in
```

* `--out`: streams `buffer/{true_id}/content` to stdout
* `--in`: reads from stdin, validates and normalizes, writes to `buffer/{true_id}/replacement`

**file-io mode:**
```bash
anchorscope pipe --true-id {true_id} --tool external-tool --file-io
# or with tool arguments
anchorscope pipe --true-id {true_id} --tool <external-tool> --file-io --tool-args "<arg1> <arg2>"
```

* Passes `buffer/{true_id}/content` path to external tool
* External tool writes output to a path provided by `pipe`
* `pipe` validates and normalizes output, then stores it as `replacement`

### Paths Mode

```bash
anchorscope paths --true-id {true_id}
# or
anchorscope paths --label {alias}
```

Returns absolute paths of `content` and `replacement` for debugging or external tool integration.

### Label Mode

```bash
anchorscope label --name <name> --true-id <hash>
```

Assigns a human-readable alias to a True ID for easier reference.

## Recursion

A COMMITTED task may generate further DISCOVERED sub-tasks. Track parent-child relationships in `parent_id` and `children`. Terminate when all tasks are COMMITTED and none remain REJECTED.

## Prohibited Actions

- NEVER edit code without verified anchors
- NEVER skip hash verification before writing
- NEVER modify code outside the Anchored Scope
- NEVER fabricate context from memory instead of reading the file
- NEVER perform blind search-and-replace
- NEVER proceed when anchor uniqueness is uncertain

## ⚠️ Stale Buffer Protocol (CRITICAL)

When a child task successfully commits, the parent buffer becomes STALE:

| Level | Operation | Buffer State |
|-------|-----------|--------------|
| 1 | `read --file file.rs --anchor "fn foo()"` | Buffer 1 fresh |
| 2 | `read --true-id <id1> --anchor "..."` | Buffer 2 fresh |
| 2 | `write --true-id <id2> --from-replacement` | Buffer 2 deleted, Buffer 1 **STALE** |

**Before re-reading a parent buffer, you MUST verify it hasn't been made stale by a child write.**
If uncertain, re-read from the original file.

See Tutorial Section 10.6 for full explanation: `/skill:anchorscope-tutorial` (if you have it), `/skill:anchorscope-anchoring-guide` (detailed strategies), or refer to the AnchorScope tutorial at `AnchorScope-tutorial.md`.

### Example Stale Buffer Scenario

```bash
# Level 1: Read function (creates buffer)
anchorscope read --file demo.rs --anchor "fn calculate_area()"
TRUE_ID_1=<result>

# Level 2: Read pattern inside function (reads from buffer 1)
anchorscope read --true-id $TRUE_ID_1 --anchor "width * height"
TRUE_ID_2=<result>

# Level 2: Write replacement (deletes buffer 2, makes buffer 1 STALE)
anchorscope write --true-id $TRUE_ID_2 --from-replacement

# ❌ WRONG: Do NOT use TRUE_ID_1 now - it's stale!
# anchorscope read --true-id $TRUE_ID_1 --anchor "other pattern"

# ✅ CORRECT: Re-read the parent from original file to refresh
anchorscope read --file demo.rs --anchor "fn calculate_area()"
TRUE_ID_1_FRESH=<new_result>
```

### LLM Safety Checklist

- [ ] Before each `read`, verify the target buffer is fresh (not made stale by a child `write`)
- [ ] Never reuse a True ID if it was parent to any successful `write`
- [ ] When uncertain, re-read from the original file
