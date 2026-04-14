# AnchorScope Anchoring Guide for LLM Agents

> **Purpose:** Practical guidance for selecting and using anchors in multi-level anchoring workflows

---

## The Anchor Selection Philosophy

### Core Principle: Start Wide, Then Narrow

```
Level 1 (Wide):  Select a unique, stable parent scope → function, class, or module
Level 2 (Narrow): Read the buffer, select a specific pattern within it
Level 3 (Precise): If needed, anchor an even smaller pattern
```

**Why this works:**
1. **Level 1** needs uniqueness across the *entire file*
2. **Level 2+** only needs uniqueness within the *previous scope's buffer*

---

## Strategy 1: Single-Level Anchoring (Simple Edits)

### When to Use
- One-time edits within a well-defined scope
- No risk of duplicate patterns

### Example: Modify a function body

```python
# File: calculator.py

def calculate_area(width, height):
    return width * height  # ← Target this line

def calculate_perimeter(width, height):
    return 2 * (width + height)
```

**Anchor selection:**
```bash
# Level 1: Anchor the entire function
anchorscope read --file calculator.py --anchor 'def calculate_area(width, height):'
```

**Why this works:**
- Function signature is unique in the file
- No need for nested anchoring

---

## Strategy 2: Multi-Level Anchoring (Complex Edits)

### When to Use
- Multiple similar patterns exist in the file
- Need to target a specific occurrence
- Working with code that has repetitive structures

### Example: Multiple loops with same pattern

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

**Solution:** Two-level anchoring

### Step-by-Step

#### Step 1: Level 1 - Anchor the function (wide)

```bash
anchorscope read --file processor.py --anchor "def process_orders():"
# Returns: true_id = a1b2c3d4e5f6g7h8
```

#### Step 2: Level 2 - Anchor the loop (narrow)

```bash
anchorscope read --true-id a1b2c3d4e5f6g7h8 --anchor "for i in range(10):"
# Reads from buffer/a1b2c3d4e5f6g7h8/content
# Returns: true_id = i9j0k1l2m3n4o5p6
```

**Key insight:** Now `for i in range(10):` is UNIQUE because we're only searching within the `process_orders()` buffer!

---

## Strategy 3: The "Signatures First" Approach

### Priority Order for Anchor Selection

1. **Function/method signatures** (highest priority)
   ```
   def process_data(self, config: Config) -> Result:
   fn main() {
   public function render() {
   ```

2. **Class definitions**
   ```
   class BillingService:
   class OrderProcessor {
   class PaymentGateway {
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
```
return result          # Too generic
i += 1                 # Too generic
}                      # Brackets appear everywhere
                       # Blank lines
```

---

## Strategy 4: The Anchor Expansion Pattern

### When Uniqueness Fails

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

**Problem:** `for item in items:` appears TWICE

**Solution: Expand the anchor**

```bash
# Bad: Not unique
anchorscope read --file utils.py --anchor "for item in items:"

# Good: Unique (includes function signature)
anchorscope read --file utils.py --anchor $'def calculate_total(items):\n    total = 0\n    for item in items:'
```

---

## Strategy 5: Using Labels for Readability

### When to Use Labels

- Long-lived workflows
- Multiple team members
- Debugging sessions

### Example

```bash
# Create human-readable labels
anchorscope label --name "process_orders_loop" --true-id i9j0k1l2m3n4o5p6
anchorscope label --name "process_users_loop" --true-id q7r8s9t0u1v2w3x4

# Later, use labels instead of hashes
anchorscope read --true-id i9j0k1l2m3n4o5p6 --anchor "print(f\"Processing"
anchorscope pipe --label "process_orders_loop" --out | transform | anchorscope pipe --label "process_orders_loop" --in
```

---

## Strategy 6: The Stale Buffer Checklist

### When Re-anchoring, Always Verify

```
[ ] Was the parent buffer made STALE by a child write?
[ ] Is the buffer I'm trying to read from fresh?
[ ] Should I re-read from the original file instead?
```

### Red Flag: "Reusing a True ID"

If you find yourself thinking "I already used this True ID before", STOP.

**Ask:** Was this True ID the parent of any successful `write`?

- **Yes** → Re-read from original file
- **No** → Safe to reuse

---

## Complete Example: Multi-Step Workflow

### Scenario: Update a calculation formula in a specific function

```python
# File: geometry.py

def calculate_area(width: float, height: float) -> float:
    # Calculate the area of a rectangle
    # Formula: width * height
    return width * height

def calculate_perimeter(width: float, height: float) -> float:
    # Calculate the perimeter of a rectangle
    # Formula: 2 * (width + height)
    return 2.0 * (width + height)
```

### Step 1: Level 1 - Anchor the function

```bash
ANCHOR_FUNC='fn calculate_area(width: f64, height: f64) -> f64 {
    // Calculate the area of a rectangle
    // Formula: width * height
    width * height
}'

anchorscope read --file geometry.py --anchor "$ANCHOR_FUNC"
# Returns: true_id = abc123def456ghi7, scope_hash = aaa111bbb222ccc3
anchorscope label --name "area_func" --true-id abc123def456ghi7
```

### Step 2: Level 2 - Anchor the formula comment

```bash
ANCHOR_COMMENT="// Formula: width * height"

anchorscope read --true-id abc123def456ghi7 --anchor "$ANCHOR_COMMENT"
# Reads from buffer/abc123def456ghi7/content
# Returns: true_id = xyz789uvw012rst3, scope_hash = ddd444eee555fff6
anchorscope label --name "formula_comment" --true-id xyz789uvw012rst3
```

### Step 3: Update the comment

```bash
# Pipe to external tool or generate replacement
echo "// Formula: width * height (updated)" | \
  anchorscope pipe --label "formula_comment" --in

# Write with hash verification
anchorscope write --label "formula_comment" --from-replacement
```

**Important:** The write only affects the buffer. To commit to file:
```bash
anchorscope write --label "formula_comment" --from-replacement
```

---

## Quick Reference: When to Use Multi-Level Anchoring

| Scenario | Level 1 | Level 2 |
|----------|---------|---------|
| Multiple similar functions | Function signature | Specific code inside |
| Multiple loops | Function signature | Loop pattern |
| Multiple conditionals | Function signature | Conditional pattern |
| Class with duplicate methods | Class definition | Specific method |
| Module with duplicate imports | Module top | Specific import |

---

## Common Pitfalls

### Pitfall 1: Too Narrow at Level 1

```python
def process():
    for i in range(10):
        print(i)  # ← Too narrow, will be duplicated

def another():
    for i in range(10):
        print(i)  # ← Same pattern!
```

**Fix:** Include more context in Level 1
```bash
# Bad
anchorscope read --file app.py --anchor "for i in range(10):"

# Good
anchorscope read --file app.py --anchor $'def process():\n    for i in range(10):'
```

### Pitfall 2: Forgetting scope_hash

```bash
# Wrong: Using file_hash instead of scope_hash
anchorscope read --file file.py --anchor "fn foo()"
# hash = FILE_HASH (wrong for --expected-hash)

anchorscope write --file file.py --anchor "fn foo()" --expected-hash <file_hash>
# This will fail with HASH_MISMATCH!

# Correct: Use scope_hash from read
anchorscope read --file file.py --anchor "fn foo()"
# hash = SCOPE_HASH (correct for --expected-hash)

anchorscope write --file file.py --anchor "fn foo()" --expected-hash <scope_hash>
# This will succeed!
```

### Pitfall 3: Reusing Stale True IDs

```bash
# Wrong: Reusing stale True ID
anchorscope read --file file.py --anchor "fn foo()"  # true_id = AAA
anchorscope read --true-id AAA --anchor "x = 1"     # true_id = BBB
anchorscope write --true-id BBB --from-replacement   # BBB deleted, AAA stale!

anchorscope read --true-id AAA --anchor "y = 2"      # WRONG! AAA is stale!
# This will read stale content!

# Correct: Re-read from file
anchorscope read --file file.py --anchor "fn foo()"  # true_id = AAA_NEW (fresh!)
```

---

## Summary

1. **Start wide, then narrow**: Level 1 = file-level uniqueness, Level 2+ = buffer-level uniqueness
2. **Prioritize signatures**: Function/class definitions > comments > generic code
3. **Expand when needed**: Add context until uniqueness is guaranteed
4. **Labels help**: Human-readable names for long workflows
5. **Beware stale buffers**: Always verify freshness before re-reading
6. **Use scope_hash**: Never use file_hash for `--expected-hash`

**Golden Rule:** If you're ever unsure, re-read from the original file. It's safer than guessing.
