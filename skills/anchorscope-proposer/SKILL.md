---
name: anchorscope-proposer
description: Use to execute the DRAFTED phase of an AnchorScope task — generates a precise, minimal code modification within the established Anchored Scope; also handles re-generation after REJECTED
compatibility: pi-v0.22.0+
---

> **Related skills:** Requires SCOPED state from `/skill:anchorscope-decomposer`. On completion, hand off to `/skill:anchorscope-validator`. If restarting after rejection, check `/skill:anchorscope-buffer-reader` first. Full workflow at `/skill:anchorscope-core`. Validate changes with `/skill:anchorscope-validator`.

# AnchorScope Proposer

SCOPED → **DRAFTED**  
REJECTED → **DRAFTED** (re-generation)

## Pre-condition

Anchor Buffer must be in SCOPED or REJECTED state with `anchor`, `content`, and `hash.before` present.

## Rules

- MUST modify only code within the Anchored Scope
- MUST preserve all code outside the scope exactly
- MUST produce syntactically correct output
- MUST produce a minimal diff — no unrelated changes
- MUST NOT change function signatures unless that is the explicit goal
- MUST NOT introduce new imports or dependencies unless instructed
- NEVER fabricate content from outside the Anchored Scope

## Procedure

1. Read `content` (original code) and `description` from the Anchor Buffer
2. If REJECTED: read `validation.comments` and understand every issue before proceeding
3. Generate the replacement — scope only, no padding
4. Confirm the diff is minimal and does not touch anything outside the Anchored Scope
5. Update Anchor Buffer to DRAFTED

## Output

```yaml
state: DRAFTED
proposed_replacement: |
  <modified code — exact replacement for the Anchored Scope content>
rationale: >
  <what changed and why, referencing description>
```

## On Re-generation After REJECTED

Address every point in `validation.comments`. Do not reproduce the previous proposal. State what changed in `rationale`.

## Common Mistakes

- Reformatting lines that should be unchanged — this is an unrelated change
- Adding a trailing newline that wasn't there — hash will not match
- Changing a function signature when only the body was meant to change
- Assuming context outside the Anchored Scope without reading it first

## External Tool Integration

### stdout mode (default)

```bash
anchorscope pipe --true-id {true_id} --out | external-tool | anchorscope pipe --true-id {true_id} --in
```

### file-io mode (Windows-compatible)

```bash
anchorscope pipe --true-id {true_id} --tool <tool> --file-io --tool-args "<args>"
```

This passes the content path to the external tool, which writes output to a path provided by `pipe`.

### When to Use file-io Mode

- **Windows compatibility:** Avoids shell pipe issues with special characters
- **Complex tool chains:** Easier debugging with explicit file paths
- **Large content:** Avoids stdout buffering issues

### Complete External Tool Workflow

```bash
# 1. Get True ID from decomposer
TRUE_ID=<true_id>

# 2. Pipe to external tool (file-io mode)
anchorscope pipe --true-id $TRUE_ID --tool my-transform-tool --file-io --tool-args "--option value"

# 3. Write from buffer to file
anchorscope write --true-id $TRUE_ID --from-replacement
```

The proposed replacement will use the tool's output.

## Debugging Paths

Use `anchorscope paths` to inspect buffer locations:
```bash
anchorscope paths --true-id {true_id}
anchorscope paths --label {alias}
```
