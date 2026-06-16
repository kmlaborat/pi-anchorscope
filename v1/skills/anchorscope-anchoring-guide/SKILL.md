---
name: anchorscope-anchoring-guide
description: Use when learning about selecting and using anchors for AnchorScope - provides practical strategies and decision trees for effective anchoring
compatibility: pi-v0.22.0+
---

> **Related skills:** Core workflow? `/skill:anchorscope-core`. Single-phase tasks? `/skill:anchorscope-decomposer`. For detailed technical spec, see `AnchorScope-tutorial.md`.

# AnchorScope Anchoring Guide

**When to use this skill:**
- You need to learn how to select effective anchors
- You're encountering uniqueness issues with anchors
- You want to understand multi-level anchoring strategies
- You're debugging anchor matching problems

## Core Principles

### The "Start Wide, Then Narrow" Strategy

```
Level 1 (Wide):  Anchor the function/class/module (file-level uniqueness)
Level 2 (Narrow): Read the buffer, anchor specific pattern (buffer-level uniqueness)
```

**Why this works:**
- Level 1 needs uniqueness across the *entire file*
- Level 2+ only needs uniqueness within the *previous scope's buffer*

### Priority Order for Anchors

1. **Function/method signatures** (highest)
   ```
   def calculate_total(items: list) -> int:
   fn main() {
   public function render() {
   ```

2. **Class definitions**
   ```
   class BillingService:
   ```

3. **Unique configuration keys**
   ```
   "max_retries": 3,
   APP_ENV = "production"
   ```

4. **Character comments** (if present)
   ```
   // Production config
   ```

### Avoid (lowest priority)
- Blank lines only
- Generic single-liners — `return result`, `pass`, `i += 1`, `}`
- Fragments that appear multiple times
- Lines distinguished only by indentation

---

## Multi-Level Anchoring Scenarios

### Scenario 1: Multiple Loops with Same Pattern

```python
# File: processor.py

def process_orders():
    for i in range(10):
        print(f"Processing {i}")
    
def process_users():
    for i in range(10):
        print(f"User {i}")
```

**Problem:** `for i in range(10):` appears TWICE

**Solution:**
1. **Level 1:** `anchorscope read --file processor.py --anchor "def process_orders():"`
2. **Level 2:** `anchorscope read --true-id <level1_id> --anchor "for i in range(10):"`
   - Now it's UNIQUE because we're only searching within the `process_orders()` buffer!

---

### Scenario 2: Multiple Functions with Similar Code

```python
# File: utils.py

def calculate_total(items):
    total = 0
    for item in items:
        total += item
    return total

def calculate_average(items):
    total = 0
    for item in items:
        total += item
    return total / len(items)
```

**Problem:** Similar patterns in both functions

**Solution:**
1. **Level 1:** Anchor the specific function signature
2. **Level 2:** Anchor the pattern inside that function's buffer

---

## Anchor Expansion Pattern

### When Uniqueness Fails

If your anchor appears multiple times, expand it by adding context:

| Original | Expanded |
|----------|----------|
| `for i in range(10):` | `def process():\n    for i in range(10):` |
| `return result` | `def calculate():\n    total = 0\n    for item in items:\n        total += item\n    return result` |
| `}` | `def process():\n    for i in range(10):\n        print(i)\n}` |

---

## Quick Reference Checklist

### Before Selecting an Anchor
- [ ] Is the anchor unique in the target scope?
- [ ] Does it include distinguishing context?
- [ ] Will it remain stable (not change frequently)?

### For Multi-Level Anchoring
- [ ] Level 1: Is the parent scope unique in the file?
- [ ] Level 2: Does the inner pattern exist in the Level 1 buffer?
- [ ] Are you reading from the buffer, not the original file?

---

## Common Pitfalls

### Pitfall 1: Too Narrow at Level 1

```python
def process():
    for i in range(10):
        print(i)

def another():
    for i in range(10):
        print(i)
```

**Fix:** Include more context in Level 1
```bash
anchorscope read --file app.py --anchor $'def process():\n    for i in range(10):'
```

### Pitfall 2: Reusing Stale True IDs

```bash
# Wrong: Reusing stale True ID
anchorscope read --file file.py --anchor "fn foo()"  # true_id = AAA
anchorscope read --true-id AAA --anchor "x = 1"     # true_id = BBB
anchorscope write --true-id BBB --from-replacement   # BBB deleted, AAA stale!

anchorscope read --true-id AAA --anchor "y = 2"      # WRONG! AAA is stale!
```

**Correct:** Re-read from file
```bash
anchorscope read --file file.py --anchor "fn foo()"  # true_id = AAA_NEW (fresh!)
```

### Pitfall 3: Using Wrong Hash

- **`--expected-hash`** must use the **scope_hash** from read (NOT file_hash!)
- Level 2 uses its own scope_hash, not Level 1's

---

## When to Use Each Approach

| Situation | Approach |
|-----------|----------|
| Simple one-time edit | Single-level anchoring |
| Multiple similar patterns | Multi-level anchoring |
| Team collaboration | Use labels with True IDs |
| Debugging issues | Use `anchorscope paths` to inspect buffers |
| Long workflows | Use labels instead of raw True IDs |

---

## Related Resources

- **Technical tutorial:** `AnchorScope-tutorial.md` (full CLI spec)
- **AnchorScope protocol:** `/skill:anchorscope-core`
- **Single-phase tasks:** `/skill:anchorscope-decomposer`

---

## Key Commands Reference

| Command | Purpose |
|---------|---------|
| `read --file <path> --anchor "<text>"` | Anchor scope at file level |
| `read --true-id <id> --anchor "<text>"` | Anchor scope within buffer |
| `label --name <name> --true-id <id>` | Create human-readable alias |
| `paths --true-id <id>` | Inspect buffer locations |
| `tree --file <path>` | Visualize buffer structure |

---

## Summary

1. **Start wide, then narrow**: Level 1 = file uniqueness, Level 2+ = buffer uniqueness
2. **Prioritize signatures**: Function/class definitions > comments > generic code
3. **Expand when needed**: Add context until uniqueness is guaranteed
4. **Labels help**: Human-readable names for long workflows
5. **Beware stale buffers**: Always verify freshness before re-reading
6. **Use scope_hash**: Never use file_hash for `--expected-hash`
