---
name: anchorscope-scope-anchoring
description: Use when extracting an Anchored Scope for AnchorScope editing — provides the step-by-step algorithm to identify a target code region that is uniquely identifiable within its parent scope
---

> **Related skills:** Called from `/skill:anchorscope-decomposer`. When scope is established, proceed to `/skill:anchorscope-proposer`. If the Anchor Buffer needs reading first, use `/skill:anchorscope-buffer-reader`. Full workflow at `/skill:anchorscope-core`.

# Anchored Scope Anchoring

**Governing principle: The anchored scope MUST be unique within its parent scope.**

This is the hardest part of AnchorScope. A wrong anchor silently breaks determinism. Follow every step.

## Anchoring Algorithm

### Step 1 — Read the file

Use `as.read` to retrieve the full file. Do not use memory. Do not use partial reads.

### Step 2 — Identify the parent scope

Choose the **smallest** enclosing scope that contains the edit target:

1. Function or method body
2. Class definition
3. Module level (entire file)

Smaller parent scopes are better: uniqueness is easier to verify and harder to accidentally violate.

### Step 3 — Select candidate anchors

**Use these (in order of preference):**

1. Function or method signature line — `def calculate_total(items: list) -> int:`
2. Class definition line — `class BillingService:`
3. A syntactically distinct block that appears only once
4. A unique configuration key or characteristic comment

**Avoid:**

- Blank lines only
- Generic single-liners — `return result`, `pass`, `i += 1`, `}`
- Fragments that appear multiple times anywhere in the file
- Lines distinguished only by indentation level

### Step 4 — Verify uniqueness within the parent scope

Search for the candidate start anchor and end anchor within the parent scope text.

```
Each anchor appears exactly 1 time → proceed to Step 6
Either anchor appears more than 1 time → go to Step 5
```

### Step 5 — Expand anchors to restore uniqueness

Extend start anchor upward or end anchor downward to include distinguishing context: decorators, preceding comments, adjacent unique lines. Re-verify after each expansion.

If uniqueness cannot be established within the current parent scope, move to the next enclosing scope level (e.g., from function body to class body). If still unresolvable, report to your human partner and request guidance.

### Step 6 — Normalize and extract the anchored content

The Anchored Scope is the exact text from the first character of the start anchor through the last character of the end anchor, inclusive. Copy verbatim — **apply CRLF → LF normalization**, no other transformations (no trimming, no Unicode normalization, no whitespace changes).

Keep the scope minimal. Include only what is necessary to establish uniqueness and cover the edit target.

### Step 7 — Compute hash and True ID

```
scope_hash = xxh3_64(normalized anchored bytes)
file_hash  = xxh3_64(normalized full file bytes)
true_id    = xxh3_64(hex(file_hash) || 0x5F || hex(scope_hash))
```

- All hashes are 16-character lowercase hex strings
- `0x5F` is the ASCII underscore `_` used as separator
- **For nested anchoring (level 2+):** replace `file_hash` with the parent's `scope_hash`:
  ```
  true_id = xxh3_64(hex(parent_scope_hash) || 0x5F || hex(child_scope_hash))
  ```
- Normalization (CRLF → LF) MUST be applied before hashing

#### Example: Nested Anchoring

Level 1 (file-level anchor):
```
scope_hash = xxh3_64("def add(a, b):\n    return a + b")
file_hash  = xxh3_64("<full file content>")
true_id    = xxh3_64(hex(file_hash) || 0x5F || hex(scope_hash))
```

Level 2 (nested within function):
```
parent_scope_hash = <Level 1's scope_hash>
nested_hash       = xxh3_64("return a + b")
nested_true_id    = xxh3_64(hex(parent_scope_hash) || 0x5F || hex(nested_hash))
```

### Step 8 — Write to Anchor Buffer

Record all fields and advance state to SCOPED.

## Anchor Selection Quick Reference

| Context | Good anchor | Bad anchor |
|---|---|---|
| Python function | `def add(a: int, b: int) -> int:` | `return a + b` |
| Class method | `def __init__(self, config: Config):` | `self.value = 0` |
| JS export | `export function renderHeader(props) {` | `}` |
| Config key | `"retry_limit": 3,` | `3,` |

## Output Format

```yaml
state: SCOPED
file: <path>
parent_scope: <function name | class name | module>
anchor:
  start: |
    <verbatim start anchor — copied exactly from file>
  end: |
    <verbatim end anchor — copied exactly from file>
hash:
  algorithm: xxh3_64
  value: <16-char lowercase hex>
true_id: <16-char lowercase hex>
content: |
  <verbatim anchored code, CRLF normalized to LF>
```

## Error Reporting

```
ERROR: Anchor not unique within parent scope.
  Anchor: "<text>"
  Occurrences in <parent_scope>: <N>
  Action: Expanding anchor to include <description of added context>.
```

```
ERROR: Cannot establish unique anchor in <parent_scope> or any enclosing scope.
  Reason: <explanation>
  Action: Requesting guidance from your human partner.
```

## Checklist Before Proceeding

- [ ] File read with `as.read` — not from memory
- [ ] Parent scope identified
- [ ] Start anchor appears exactly once in parent scope
- [ ] End anchor appears exactly once in parent scope
- [ ] Content is a verbatim copy of the anchored region, CRLF normalized to LF
- [ ] `xxh3_64` hash computed from normalized content
- [ ] True ID computed as `xxh3_64(hex(file_hash) || 0x5F || hex(scope_hash))`
- [ ] Anchor Buffer updated to SCOPED
