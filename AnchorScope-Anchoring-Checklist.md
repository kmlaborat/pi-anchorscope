# AnchorScope Anchoring Checklist

> **For LLM Agents: A decision tree for selecting anchors**

---

## Step 1: Identify the Target

**Q:** What code do I need to modify?

- [ ] Function/method body
- [ ] Class definition
- [ ] Module-level code
- [ ] Specific line/statement

---

## Step 2: Assess Uniqueness at File Level

**Q:** Will this anchor be unique across the ENTIRE file?

### If YES → Use Single-Level Anchoring
```
✅ Anchor the target directly at Level 1
✅ No nested anchoring needed
```

### If NO → Continue to Step 3
```
❌ Multiple occurrences exist
Need to narrow the scope
```

---

## Step 3: Identify the Parent Scope

**Q:** What's the smallest enclosing scope that makes the target unique?

1. **Function/method body**
   - Pros: Small, easy to verify uniqueness
   - Cons: Must include distinguishing context

2. **Class definition**
   - Pros: More context available
   - Cons: Larger scope, more potential for false matches

3. **Module level**
   - Pros: Maximum context
   - Cons: Largest scope, least precise

### Select parent scope
- [ ] Function/method
- [ ] Class
- [ ] Module

---

## Step 4: Build the Level 1 Anchor

**Q:** Does this anchor appear exactly once in the parent scope?

### Test by searching within the parent scope

**If UNIQUE:**
```
✅ Proceed to Level 1 read
```

**If NOT UNIQUE: Expand the anchor**
```
❌ Add preceding context (decorators, comments, signatures)
❌ Add following context (adjacent unique lines)
✅ Re-test until uniqueness is confirmed
```

### Common expansion patterns

| Original | Expanded |
|----------|----------|
| `for i in range(10):` | `def process():\n    for i in range(10):` |
| `return result` | `def calculate():\n    total = 0\n    for item in items:\n        total += item\n    return result` |
| `}` | `def process():\n    for i in range(10):\n        print(i)\n}` |

---

## Step 5: Level 1 Read

```bash
anchorscope read --file <path> --anchor "<your_unique_anchor>"
```

**Verify output:**
- [ ] `hash=` value recorded (this is the **scope_hash**)
- [ ] `true_id=` value recorded
- [ ] `content=` matches expected text
- [ ] No errors (NO_MATCH, MULTIPLE_MATCHES)

---

## Step 6: Determine if Nested Anchoring Needed

**Q:** Do I need to target something INSIDE the current scope?

### If NO → Done!
```
✅ Single-level anchoring sufficient
✅ Proceed with write
```

### If YES → Level 2 Anchoring
```
✅ Read from buffer using Level 1's true_id
```

---

## Step 7: Level 2 Anchor Selection

**Q:** What's unique within the Level 1 buffer?

### Key insight:
The Level 2 anchor only needs to be unique **within the buffer**, not the entire file!

### Process:
1. Read Level 1 buffer content
2. Identify pattern that appears exactly once in buffer
3. Build Level 2 anchor

### Example:
```python
# Level 1 buffer (from process_orders function)
for i in range(10):
    print(f"Processing {i}")

# Level 2 anchor: "print(f"Processing {i}")"
# This would be DUPLICATE in the file, but UNIQUE in the function buffer!
```

---

## Step 8: Level 2 Read

```bash
anchorscope read --true-id <level1_true_id> --anchor "<level2_anchor>"
```

**Verify output:**
- [ ] `hash=` value recorded (this is the **scope_hash** for Level 2)
- [ ] `true_id=` value recorded
- [ ] `content=` matches expected text

**Important:** Use this `hash` as `--expected-hash` in the final write!

---

## Step 9: Write with Verification

### Option A: Write from buffer (with external tool)
```bash
anchorscope pipe --true-id <level2_true_id> --out | transform | anchorscope pipe --true-id <level2_true_id> --in
anchorscope write --true-id <level2_true_id> --expected-hash <level2_scope_hash> --from-replacement
```

### Option B: Write directly
```bash
anchorscope write --true-id <level2_true_id> --expected-hash <level2_scope_hash> --replacement "new_content"
```

**Key:** The `--expected-hash` must be the **scope_hash** from the Level 2 read, NOT the file_hash!

---

## Step 10: Verify Staleness (If Re-anchoring)

**Before re-reading any buffer:**

- [ ] Was this buffer's parent made STALE by a child write?
- [ ] Should I re-read from the original file instead?

### If uncertain → Re-read from original file
```bash
anchorscope read --file <path> --anchor "<parent_anchor>"
```

---

## Decision Tree Summary

```
Start
  |
  v
What to modify?
  |
  ├─ Single line/statement → Check file-level uniqueness
  |
  └─ Function/class/module → Use as parent scope
  |
  v
Unique at file level?
  |
  ├─ YES → Single-level anchoring → DONE
  |
  └─ NO → Identify parent scope → Build Level 1 anchor
  |
  v
Level 1 anchor unique?
  |
  ├─ YES → Level 1 read → Done or Level 2?
  |
  └─ NO → Expand anchor → Re-test
  |
  v
Level 2 needed?
  |
  ├─ YES → Read Level 1 buffer → Build Level 2 anchor → Level 2 read
  |
  └─ NO → Write with Level 1 hash
  |
  v
Write with correct scope_hash
  |
  v
Done!
```

---

## Quick Reference Card

### Level 1 Anchor Selection
1. Prefer function/method signatures
2. Include distinguishing context (comments, decorators)
3. Verify uniqueness within parent scope
4. Expand until exactly 1 match

### Level 2 Anchor Selection
1. Read from Level 1's buffer (not original file!)
2. Look for patterns unique within that buffer
3. Can reuse patterns that would be duplicate at file level

### Hash Usage
- `--expected-hash` = **scope_hash** from read (NOT file_hash)
- Level 2 uses its own scope_hash, not Level 1's

### Buffer Management
- Level 2+ reads from `{file_hash}/{true_id}/content`
- Child write makes parent buffer STALE
- When uncertain, re-read from original file
