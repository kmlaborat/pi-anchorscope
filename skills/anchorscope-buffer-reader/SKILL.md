---
name: anchorscope-buffer-reader
description: Use when reading or resuming from an Anchor Buffer — interprets task state, validates hash integrity, and determines the next action to take
compatibility: pi-v0.22.0+
---

> **Related skills:** Part of the AnchorScope workflow. Full overview at `/skill:anchorscope-core`. For re-anchoring after hash mismatch, use `/skill:anchorscope-scope-anchoring`. Learn about each phase: `/skill:anchorscope-decomposer`, `/skill:anchorscope-proposer`, `/skill:anchorscope-validator`, `/skill:anchorscope-integrator`.

# Anchor Buffer Reader

The Anchor Buffer is AnchorScope's external memory. It compensates for context compaction and session boundaries. When a buffer is present, read it before doing anything else.

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

### Debugging

To inspect the buffer contents for troubleshooting:
```bash
# View all buffers
cat %TEMP%\anchorscope\buffer\*\*\content  # Windows
cat $TMPDIR/anchorscope/buffer/*/*/content   # macOS/Linux

# View labels
cat %TEMP%\anchorscope\labels\*.json        # Windows
cat $TMPDIR/anchorscope/labels/*.json         # macOS/Linux
```

## Parsing Procedure

### Step 1 — Parse the buffer

Parse as YAML or JSON. On parse failure:

```
IO_ERROR: Buffer file unreadable
  Action: Request the original buffer from your human partner
```

### Step 2 — Validate required fields

Check that all of the following exist:

- `id`, `state`, `file`
- `anchor.start`, `anchor.end`
- `hash.algorithm`, `hash.before`
- `true_id`

For each missing field:

```
IO_ERROR: Buffer missing required field
  Field: <field>
  Action: Request the original buffer from your human partner
```

### Step 3 — Identify current state

| State | Meaning | Next action |
|---|---|---|
| DISCOVERED | Task identified, scope not yet extracted | Extract scope → `/skill:anchorscope-decomposer` |
| SCOPED | Anchors established, awaiting proposal | Generate proposal → `/skill:anchorscope-proposer` |
| DRAFTED | Proposal exists, awaiting validation | Validate → `/skill:anchorscope-validator` |
| REVIEWING | Under validation | Complete review → `/skill:anchorscope-validator` |
| APPROVED | Validated, awaiting write | Write to file → `/skill:anchorscope-integrator` |
| COMMITTED | Written successfully | Check `children` for follow-on tasks → `/skill:anchorscope-core` |
| REJECTED | Validation failed | Read `validation.comments`, revise → `/skill:anchorscope-proposer` |

### Step 4 — Extract anchored scope identifiers

Record: `file`, `anchor.start`, `anchor.end`, `true_id`, `content` (if present).

### Step 5 — Verify hash integrity (when state is SCOPED or later)

Read the current file with `as.read`. Locate the anchor region. Normalize line endings (CRLF → LF). Compute `xxh3_64` of the normalized content between anchors.

```
Computed hash == hash.before → integrity confirmed, continue
Computed hash != hash.before → hash mismatch
```

On mismatch:

```
HASH_MISMATCH: File changed since SCOPED
  Expected: <expected>
  Actual: <computed>
  Action: Re-anchor the scope with /skill:anchorscope-scope-anchoring
```

### Step 6 — Determine next action

Use the state table from Step 3. Output the analysis.

### Step 7 — Restore recursive context (if applicable)

If `parent_id` is set, locate and read the parent buffer. If `children` is non-empty, note each child's current state to understand overall progress.

## Output Format

```yaml
buffer_analysis:
  task_id: <id>
  current_state: <state>
  file: <path>
  true_id: <true_id>
  hash_integrity: valid | invalid | unchecked
  next_action: <description>
  next_skill: <skill name>
  ready_for_execution: true | false
  issues: []
```

## When to Call This Skill

- Resuming an AnchorScope task after context compaction
- Starting a new turn mid-workflow
- Unsure which phase is active
- After a hash mismatch or anchor error during another phase
