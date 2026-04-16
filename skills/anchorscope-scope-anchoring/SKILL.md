---
name: anchorscope-scope-anchoring
description: Use when extracting an Anchored Scope for AnchorScope editing — provides the step-by-step algorithm to identify a target code region that is uniquely identifiable within its parent scope
compatibility: pi-v0.22.0+
---

> **Related skills:** Called from `/skill:anchorscope-decomposer`. When scope is established, proceed to `/skill:anchorscope-proposer`. If the Anchor Buffer needs reading first, use `/skill:anchorscope-buffer-reader`. Full workflow at `/skill:anchorscope-core`. Verify uniqueness at each step.

# Anchored Scope Anchoring

**Governing principle: The anchored scope MUST be unique within its parent scope.**

This is the hardest part of AnchorScope. A wrong anchor silently breaks determinism. Follow every step.

## Anchoring Algorithm

### Step 1 — Read the file

**Exploration phase:** Use standard `read` to understand the file structure and identify potential anchor candidates. This is exploratory and doesn't need hash verification yet.

**Deterministic phase:** When you've found a stable, unique anchor, use `as.read` to establish the Anchored Scope with `scope_hash` and `true_id`.

Do not use memory. Do not use partial reads.

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
# Result: true_id encodes file-level content
```

Level 2 (nested within function):
```
parent_scope_hash = <Level 1's scope_hash>
nested_hash       = xxh3_64("return a + b")
nested_true_id    = xxh3_64(hex(parent_scope_hash) || 0x5F || hex(nested_hash))
# Result: nested_true_id encodes both parent context and nested content
```

#### Real-world Use Case

When editing code inside a function:
1. **Level 1**: Anchor the entire function (file-level scope)
   - `scope_hash` = hash of function body
   - `true_id` = encodes file → function mapping

2. **Level 2**: Anchor specific code inside function (function-level scope)
   - `parent_scope_hash` = Level 1's `scope_hash`
   - `nested_true_id` = encodes file → function → code mapping

This enables multiple independent edits to the same file without conflict, as each edit uses a unique True ID.

⚠️ **Buffer Isolation**: Level 2+ anchoring reads from `{file_hash}/{true_id}/content`, NOT the original file.

This is the key reason why parent buffers become STALE after child writes:

| Level | Read Source | Write Effect |
|-------|-------------|--------------|
| 1 | `file.rs` | Creates `{file_hash}/{true_id_1}/content` |
| 2 | `{file_hash}/{true_id_1}/content` | Creates `{file_hash}/{true_id_1}/{true_id_2}/content` |
| 2 write | — | Deletes `{true_id_2}`, makes `{true_id_1}` STALE |

When a child level writes successfully, the parent's buffer content is no longer valid because the child's write operation deletes the child's buffer directory and invalidates the parent's cached content.

This is why the Stale Buffer Protocol requires re-reading from the original file before using a parent buffer again.

### Step 8 — Write to Anchor Buffer

Record all fields and advance state to SCOPED.

## Anchor Selection Strategy

### The "Start Wide, Then Narrow" Principle

**Level 1 (Wide):** Select a unique, stable parent scope → function, class, or module
**Level 2 (Narrow):** Read the buffer, select a specific pattern within it
**Level 3 (Precise):** If needed, anchor an even smaller pattern

**Why this works:**
- Level 1 needs uniqueness across the *entire file*
- Level 2+ only needs uniqueness within the *previous scope's buffer*

### When to Use Multi-Level Anchoring

| Scenario | Level 1 Anchor | Level 2 Anchor |
|----------|----------------|----------------|
| Multiple loops with same pattern | `def process_orders():` | `for i in range(10):` |
| Multiple similar functions | `class OrderProcessor:` | `def calculate():` |
| Multiple conditionals | `def handle_request():` | `if status == 200:` |

### Priority Order for Anchor Selection

1. **Function/method signatures** (highest priority)
   ```
   def calculate_total(items: list) -> int:
   fn main() {
   public function render() {
   ```

2. **Class definitions**
   ```
   class BillingService:
   class OrderProcessor {
   ```

3. **Unique configuration keys**
   ```
   "max_retries": 3,
   APP_ENV = "production"
   ```

4. **Character comments** (if present)
   ```
   // Production config
   // NOTE: This is the main entry point
   ```

### Avoid (lowest priority)

- Blank lines only
- Generic single-liners — `return result`, `pass`, `i += 1`, `}`
- Fragments that appear multiple times anywhere in the file
- Lines distinguished only by indentation level

### Anchor Expansion Pattern

When uniqueness fails, expand the anchor by adding context:

| Original | Expanded |
|----------|----------|
| `for i in range(10):` | `def process():\n    for i in range(10):` |
| `return result` | `def calculate():\n    total = 0\n    for item in items:\n        total += item\n    return result` |
| `}` | `def process():\n    for i in range(10):\n        print(i)\n}` |



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
ERROR: Anchor not unique within parent scope.
  Anchor: "<text>"
  Occurrences in <parent_scope>: <N>
  Action: Expanding anchor to include <description of added context>.
```

```
ERROR: Cannot establish unique anchor in <parent_scope> or any enclosing scope.
  Reason: <explanation>
  Action: Requesting guidance from your human partner.

Tip: Try expanding the parent scope to class/module level if function-level anchoring fails.
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
