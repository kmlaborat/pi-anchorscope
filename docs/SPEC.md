# AnchorScope Protocol Specification

## Overview

AnchorScope is a deterministic code editing protocol for LLM-based coding agents. It compensates for four systemic failure modes that arise when LLMs edit code:

| Failure | Root cause | AnchorScope solution |
|---|---|---|
| Context loss | LLM cannot hold an entire file in working memory | **Anchored Scope** — provide only the minimal necessary context |
| Wrong edits | LLM modifies unintended regions | **True ID** — uniquely identify the edit target before touching it |
| Lost state | LLM forgets work history across turns or after compaction | **Anchor Buffer** — persist task state externally |
| Non-determinism | Same edit cannot be reproduced reliably | **Hash Verification** — verify integrity before every write |

**Governing principle: No Match, No Hash, No Write.**

---

## Core Concepts

### Anchored Scope

A precisely delimited region of source code, identified by a start anchor and an end anchor. The scope provides the minimum context needed to understand and modify the target without exposing the rest of the file.

**Uniqueness requirement:** The anchored scope MUST be unique within its parent scope. If the same anchor text appears more than once within the enclosing function, class, or module, the anchor is invalid and must be expanded until uniqueness is guaranteed.

**Parent scope:** The smallest enclosing syntactic unit that contains the edit target — a function body, a class definition, or the module level. Choosing a smaller parent scope makes uniqueness easier to verify and harder to accidentally violate.

**Minimality:** The scope should include only what is necessary to establish uniqueness and cover the edit target. Unnecessary context increases the risk of hash mismatch on future edits.

### True ID

A stable, content-derived identifier for the Anchored Scope, computed as:

```
true_id = "sha256:" + SHA-256(anchored_scope_content)
```

The hash is computed from the raw bytes of the anchored content, including all whitespace and newlines, with no normalization. True ID serves as both a unique identifier and an integrity check seed.

### Anchor Buffer

An external state record that persists the full context of an editing task. It compensates for LLM context compaction and session boundaries. The Anchor Buffer is the single source of truth for task state.

A task can be resumed at any point by reading the Anchor Buffer — no information needs to be reconstructed from conversation history.

### Hash Verification

Before any write operation, the current content of the anchored region is read from disk and its SHA-256 hash is compared to the stored `hash.before`. A mismatch means the file has changed since the scope was established, and the write is aborted. This prevents silent corruption when multiple edits are in flight or when a file is modified externally.

---

## State Machine

```
DISCOVERED → SCOPED → DRAFTED → REVIEWING → APPROVED → COMMITTED
                                      ↓
                                  REJECTED → DRAFTED (retry)
```

| State | Meaning | Produced by |
|---|---|---|
| DISCOVERED | Task identified; file and purpose known | Orchestrator / user |
| SCOPED | Anchored Scope extracted; True ID and `hash.before` computed | Decomposer |
| DRAFTED | Replacement code proposed | Proposer |
| REVIEWING | Proposal under validation | Validator |
| APPROVED | All validation criteria passed | Validator |
| COMMITTED | Replacement written to file; `hash.after` recorded | Integrator |
| REJECTED | Validation failed; retry required | Validator |

### Transition rules

- `DISCOVERED → SCOPED`: anchor uniqueness verified, hash computed
- `SCOPED → DRAFTED`: proposal touches only the anchored region
- `DRAFTED → REVIEWING`: validation process begins
- `REVIEWING → APPROVED`: all five validation criteria pass
- `REVIEWING → REJECTED`: any criterion fails
- `REJECTED → DRAFTED`: proposer addresses all rejection comments
- `APPROVED → COMMITTED`: final hash re-verified immediately before write

---

## Anchor Buffer Schema

```yaml
anchorscope_task:
  id: AS-<timestamp>
  parent_id: null            # set if this is a sub-task
  state: <state>
  file: <path/to/file>
  description: <what to change and why>
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
    <verbatim anchored code as of SCOPED>
  proposed_replacement: |
    <proposed replacement>   # present from DRAFTED onward
  validation:
    status: pending          # pending | approved | rejected
    comments: []             # rejection reasons, if any
  children: []               # IDs of recursive sub-tasks
  history:
    - state: DISCOVERED
      timestamp: <ISO8601>
```

---

## Anchoring Algorithm

Extracting a valid Anchored Scope is the most failure-prone step. The algorithm must be followed in order.

1. **Read the file** — use `as.read`; never reconstruct from memory
2. **Identify the parent scope** — choose the smallest enclosing function, class, or module
3. **Select candidate anchors** — prefer function/method signatures and class definitions; avoid generic lines (`return result`, `pass`, bare closing braces) and lines that appear multiple times
4. **Verify uniqueness** — each anchor must appear exactly once within the parent scope text
5. **Expand if needed** — if uniqueness fails, extend the anchor to include adjacent distinguishing lines (decorators, preceding comments, etc.); if uniqueness still cannot be achieved, move to the next enclosing scope level
6. **Extract content** — copy the anchored region verbatim from start anchor through end anchor, inclusive; no trimming or reformatting
7. **Compute hash and True ID** — SHA-256 of raw bytes
8. **Record in Anchor Buffer** — advance state to SCOPED

### Anchor selection guidelines

| Preferred | Avoid |
|---|---|
| Function/method signature | `return result` |
| Class definition line | `pass` |
| Unique configuration key | Blank lines only |
| Characteristic comment | Lines differing only in indentation |

---

## Validation Criteria

Before APPROVED can be issued, all five criteria must pass:

1. **Anchor integrity** — `anchor.start` and `anchor.end` are present in the current file and unique within the parent scope
2. **Hash integrity** — SHA-256 of the current anchored region matches `hash.before`; mismatch aborts validation entirely and requires re-anchoring
3. **Scope containment** — `proposed_replacement` modifies only content within the anchor boundaries
4. **Minimal diff** — no changes unrelated to the stated `description` (no reformatting, no unrelated renames, no opportunistic refactoring)
5. **Syntactic correctness** — the replacement is syntactically valid; indentation, bracket matching, and existing signatures are preserved unless explicitly changing them

---

## Write Protocol

The Integrator is the only component that writes to files. It follows this sequence without exception:

1. Read `anchor`, `hash.before`, and `proposed_replacement` from the Anchor Buffer
2. Read the current file with `as.read`
3. Locate the anchored region and compute SHA-256 — compare to `hash.before`
4. If mismatch: abort, report, do not write
5. Construct new file content: `<before anchor> + proposed_replacement + <after anchor>`
6. Write atomically with `as.write`
7. Re-read and confirm the change landed correctly
8. Compute `hash.after` of the new anchored region
9. Update Anchor Buffer to COMMITTED

---

## Recursive Application

A COMMITTED task may generate further DISCOVERED sub-tasks, enabling hierarchical editing of large codebases. Parent-child relationships are tracked in `parent_id` and `children`.

**Termination conditions:**
- All tasks are in COMMITTED state
- No tasks remain in REJECTED state
- The original objective is fully satisfied

**Recursion levels (illustrative):**

| Level | Scope | Example |
|---|---|---|
| 0 | Single expression or statement | Fix a type error |
| 1 | Single function | Add type annotations |
| 2 | Multiple functions | Extract helper functions |
| 3 | Module | Refactor a class hierarchy |
| 4 | System | Cross-module architectural change |

---

## Execution Modes

AnchorScope is designed to run in a single agent without any subagent infrastructure. Each phase can optionally be delegated to a dedicated skill when the coding environment supports subagent dispatch. The protocol is identical in both modes.

| Mode | Description |
|---|---|
| Single-Agent | One agent executes all phases sequentially |
| Multi-Agent | Each phase is delegated to a specialized sub-skill |

The choice of mode belongs to the coding agent or the user, not to the protocol.

---

## Skill Structure

Each phase of the protocol is implemented as a pi skill:

| Phase | State | Skill |
|---|---|---|
| Entry point / orchestration | DISCOVERED | `anchorscope-core` |
| Scope extraction | SCOPED | `anchorscope-decomposer` |
| Anchoring algorithm (detail) | SCOPED | `anchorscope-scope-anchoring` |
| Proposal generation | DRAFTED | `anchorscope-proposer` |
| Validation | REVIEWING → APPROVED/REJECTED | `anchorscope-validator` |
| Write | COMMITTED | `anchorscope-integrator` |
| State resumption | any | `anchorscope-buffer-reader` |

Skills cross-reference each other via `/skill:name`. This keeps the skill chain present in LLM context even after compaction. Clearing context ends the AnchorScope session.

---

## Attribution

AnchorScope protocol designed by kmlaborat with design assistance from ChatGPT and Claude.

Skill format and structure adapted from [pi-superpowers](https://github.com/coctostan/pi-superpowers) by coctostan, itself adapted from [Superpowers](https://github.com/obra/superpowers) by Jesse Vincent, licensed under MIT.
