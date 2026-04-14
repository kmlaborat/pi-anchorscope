---
name: anchorscope-core
description: Use when modifying existing code to enforce deterministic, verifiable edits via the AnchorScope protocol — prevents non-deterministic replacements, context loss, and unsafe modifications
---

> **Related skills:** Extracting a scope? `/skill:anchorscope-scope-anchoring`. Reading an Anchor Buffer? `/skill:anchorscope-buffer-reader`. Want to delegate phases? `/skill:anchorscope-decomposer` → `/skill:anchorscope-proposer` → `/skill:anchorscope-validator` → `/skill:anchorscope-integrator`.

# AnchorScope Core

**Announce at start:** "I'm using the anchorscope-core skill to edit this code deterministically."

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

Read the file with `as.read`. Identify the parent scope (smallest enclosing function, class, or module). Select anchors that are unique within that parent scope. Compute SHA-256 hash and True ID.

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
    algorithm: sha256
    before: <hash of original anchored content>
    after: null              # filled after COMMITTED
  true_id: sha256:<hash>
  content: |
    <verbatim anchored code>
  proposed_change: |
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

## Recursion

A COMMITTED task may generate further DISCOVERED sub-tasks. Track parent-child relationships in `parent_id` and `children`. Terminate when all tasks are COMMITTED and none remain REJECTED.

## Prohibited Actions

- NEVER edit code without verified anchors
- NEVER skip hash verification before writing
- NEVER modify code outside the Anchored Scope
- NEVER fabricate context from memory instead of reading the file
- NEVER perform blind search-and-replace
- NEVER proceed when anchor uniqueness is uncertain
