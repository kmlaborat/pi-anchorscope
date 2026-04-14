# AnchorScope Tutorial

A comprehensive guide to using pi-anchorscope skills with the AnchorScope protocol.

---

## 1. Quick Start

AnchorScope provides deterministic, verifiable code editing through:

1. **Anchored Scopes** - Exact byte-level matching with minimal context
2. **True IDs** - Content-derived identifiers for stable references
3. **Hash Verification** - Integrity checks before every write
4. **Buffer Management** - External state persistence via pipe/paths

**Governing principle: No Match, No Hash, No Write.**

**Important:** The `hash` returned by `read` is the **scope_hash** of the matched anchored scope. This exact value must be used as `--expected-hash` in `write` operations to verify the buffer (or file) state hasn't changed since reading.

---

## 2. Basic Read Operation

The `anchorscope read` command locates and hashes an anchored scope:

```bash
anchorscope read --file <path> --anchor "<string>"
```

### 2.1 Single-Line Anchor

```bash
anchorscope read --file docs/tutorials/sample.txt --anchor "// This is a comment"
```

Output:
```
start_line=4
end_line=4
hash=5d7008ad1b1478cb
content=/ This is a comment
true_id=445a9ef90dcde6a5
label=5d7008ad1b1478cb
true_id=445a9ef90dcde6a5
```

The output includes:
- `start_line`: 1-based line number of anchor start (based on normalized LF content)
- `end_line`: 1-based line number of anchor end
- `hash`: **scope_hash** - 16-char hex for hash verification in `--expected-hash`. This is the hash of the matched anchored scope, and **MUST** be used as `--expected-hash` in subsequent `write` operations.
- `true_id`: 16-char hex for buffer/pipeline operations. This is a content-derived identifier calculated as:
  ```
  true_id = xxh3_64(hex(parent_scope_hash) || "_" || hex(child_scope_hash))
  ```
  For Level 1 (direct file anchor), `parent_scope_hash` is the file_hash.
  See Section 10 for full details.
- `content`: The matched anchor text (normalized UTF-8 with LF line endings)
- `label`: Auto-generated label (same as hash)

**Conceptual distinction:**
- `hash` (scope_hash) = **Content verification** - "Is this code exactly the same as when I read it?" Used for safety in write operations. This is the hash of the matched anchored scope.
- `true_id` = **Buffer identification** - "Which buffer slot is this in my local temp directory?" Used for pipe/label operations. Deterministically encodes parent context.
- `label` = **Human-readable alias** for `true_id` convenience.

### 2.2 Multi-Line Anchor

```bash
anchorscope read --file docs/tutorials/sample.txt --anchor $'fn main() {\n    println!("Hello, World!");\n}'
```

Output:
```
start_line=5
end_line=7
hash=22e89e5c1ca0c55d
content=fn main() {
    println!("Hello, World!");
}
true_id=8db42edf7905d28f
label=22e89e5c1ca0c55d
true_id=8db42edf7905d28f
```

For multi-line anchors, consider using `--anchor-file` (see Section 9).

---

## 3. Basic Write Operation

The `anchorscope write` command replaces an anchored scope with verification:

```bash
anchorscope write \
  --file <path> \
  --anchor "<string>" \
  --expected-hash <hex> \
  --replacement "<string>"
```

The `--expected-hash` ensures the anchor hasn't changed since you read it.

### 3.1 Write with Inline Replacement

First, get the **scope_hash** from a read operation:

```bash
# Read to get the scope_hash
anchorscope read --file docs/tutorials/sample.txt --anchor "// This is a comment"
# hash=5d7008ad1b1478cb  ← This is the scope_hash
```

Then write using the scope_hash:

```bash
anchorscope write \
  --file docs/tutorials/sample.txt \
  --anchor "// This is a comment" \
  --expected-hash 5d7008ad1b1478cb \
  --replacement "// Modified: Comment updated via AnchorScope"
```

**Important:** `--expected-hash` must be the **scope_hash** from the *previous* `read` operation. This verifies that the buffer (or file) state hasn't changed since you read it.

Output:
```
OK: written 70 bytes
```

### 3.2 Verify the Write

```bash
cat docs/tutorials/sample.txt
```

Output:
```
# Sample File for pi-anchorscope Tutorial

## Section 1
// Modified: Comment updated via AnchorScope
fn main() {
    println!("Hello, World!");
}

## Section 2
// Another comment
fn helper() {
    println!("Helper function");
}

```

**Important:** `write` succeeds only if the current scope_hash matches `--expected-hash`. If the file changed between `read` and `write`, you'll get `HASH_MISMATCH`.

### 3.3 Buffer-Based Write (using --true-id)

For more complex workflows, you can write to the buffer directly using `--true-id`:

```bash
# Get True ID and hash
anchorscope read --file docs/tutorials/sample.txt --anchor "fn main()"
# Copy the true_id and hash from output

# Pipe new content to buffer
anchorscope pipe --true-id <true_id> --out | transform-tool | anchorscope pipe --true-id <true_id> --in

# Write from buffer
anchorscope write --true-id <true_id> --expected-hash <hash> --from-replacement
```

This is useful when:
- You want to modify content before writing
- You need to inspect the buffer before committing
- You want to chain multiple buffer operations

**Note:** On Windows, ensure your shell preserves escape sequences in `--replacement` strings (e.g., `\n` becomes actual newlines). Use here-docs or anchor files for multiline content.

---

## 4. Label Management

Labels provide human-readable aliases for True IDs:

```bash
# Create a label
anchorscope label --name <name> --true-id <hash>

# Use label in read
anchorscope read --file <path> --label <name> --anchor "<string>"

# Use label in write
anchorscope write --label <name> --replacement "<string>"  # or --from-replacement
```

**Note:** When using `--label`, you cannot combine `--expected-hash`. Use `--replacement` or `--from-replacement` instead.

Labels are stored in `{TMPDIR}/anchorscope/labels/`.

### 4.1 Creating a Label

```bash
anchorscope label --name "main_function" --true-id 8db42edf7905d28f
```

Output:
```
OK: label "main_function" -> 8db42edf7905d28f
```

### 4.2 Reading with a Label

```bash
anchorscope read --file docs/tutorials/sample.txt --label "main_function" --anchor "fn main()"
```

Output:
```
start_line=5
end_line=7
hash=22e89e5c1ca0c55d
content=fn main() {
    println!("Hello, World!");
}
true_id=8db42edf7905d28f
label=main_function
```

### 4.3 Writing with a Label

```bash
anchorscope write \
  --file docs/tutorials/sample.txt \
  --label "main_function" \
  --replacement "fn main() {\n    println!(\"Hello, AnchorScope!\");\n}"
```

---

## 5. Pipe Mode - External Tool Integration

Pipe mode bridges AnchorScope with external tools:

```bash
# stdout mode (default)
anchorscope pipe --label <name> --out | external-tool | anchorscope pipe --label <name> --in

# file-io mode
anchorscope pipe --label <name> --tool <tool> --file-io --tool-args "<args>"
```

- `--out`: Streams `buffer/{true_id}/content` to stdout
- `--in`: Reads from stdin, writes to `buffer/{true_id}/replacement`
- `--file-io`: Passes content path to external tool
- `--tool`: External tool command to execute
- `--tool-args`: Arguments to pass to the tool (space-separated)

The `replacement` file is used by `anchorscope write --from-replacement.`

---

### 5.0.1 External Tool Boundary

When content returns from an external tool via `pipe --in`, AnchorScope performs:
1. **UTF-8 Validation** - Verifies the content is valid UTF-8
2. **CRLF → LF Normalization** - Converts all CRLF to LF
3. **Replacement Storage** - Writes validated, normalized content to `buffer/{true_id}/replacement`

If validation fails, AnchorScope terminates with `IO_ERROR: invalid UTF-8`.

**Note:** The `--tool` and `--tool-args` options may have limited support on Windows.

**Windows Users:** When `--tool` is not available, use manual pipe workflow:
```bash
# 1. Stream content to a file
anchorscope pipe --true-id <true_id> --out > temp_content.txt

# 2. Process with external tool
your-tool.exe temp_content.txt temp_output.txt

# 3. Write output back to buffer
cat temp_output.txt | anchorscope pipe --true-id <true_id> --in

# 4. Write to file
anchorscope write --true-id <true_id> --from-replacement
```

### 5.1 Pipe Content to External Tool

```bash
anchorscope pipe --label "main_function" --out
```

Output:
```
fn main() {
    println!("Hello, AnchorScope!");
}
```

### 5.2 Pipe with Transformation

```bash
# First read to get the true_id and hash
anchorscope read --file docs/tutorials/sample.txt --anchor $'fn main() {\n    println!("Hello, World!");\n}'

# Pipe with transformation
anchorscope pipe --true-id <true_id> --out | sed 's/Hello World/Hello World Updated/' | anchorscope pipe --true-id <true_id> --in

# Write from buffer to file
anchorscope write --true-id <true_id> --expected-hash <hash> --from-replacement
```

---

## 6. Paths Mode

Get absolute paths to buffer files for debugging:

```bash
anchorscope paths --label <name>
anchorscope paths --true-id <hash>
```

Output:
- `content`: Path to the anchored scope content
- `replacement`: Path to the proposed replacement (created by pipe)

This is useful for inspecting what AnchorScope has buffered.

### 6.1 Get Buffer Paths

```bash
anchorscope paths --label "main_function"
```

Output:
```
content:     C:\Users\MURAMATSU\AppData\Local\Temp\anchorscope\8db42edf7905d28f\content
replacement: C:\Users\MURAMATSU\AppData\Local\Temp\anchorscope\8db42edf7905d28f\replacement
```

### 6.2 Inspect Buffer Files

```bash
# Show content
cat "C:\Users\MURAMATSU\AppData\Local\Temp\anchorscope\8db42edf7905d28f\content"

# Show replacement
cat "C:\Users\MURAMATSU\AppData\Local\Temp\anchorscope\8db42edf7905d28f\replacement"
```

---

## 7. Tree Visualization

Display the current Anchor Buffer structure:

```bash
# Show all buffers (requires --file argument)
anchorscope tree --file <path>

# Filter by file
anchorscope tree --file <path>
```

Output shows:
- True IDs
- Aliases (if any)
- Presence of `replacement` files (✓)

This helps you understand the buffer state and debug issues.

### 7.1 Display Buffer Tree

```bash
anchorscope tree --file docs/tutorials/sample.txt
```

Output shows the current buffer structure. When a label is created, it appears in the tree:
```
099375c8a05dbedb  (\?\C:\path\to\file.rs)
├── 445a9ef90dcde6a5  [main_function]
└── 8db42edf7905d28f  [helper]
```

### 7.2 Filter by File

```bash
anchorscope tree --file docs/tutorials/sample.txt
```

Output:
```
8db42edf7905d28f  (docs/tutorials/sample.txt)
└── 445a9ef90dcde6a5  [main_function]
```

---

## 8. Error Conditions

AnchorScope returns specific error conditions:

| Error | Description | Example |
|-------|-------------|---------|
| `NO_MATCH` | Zero occurrences of anchor found | Read with non-existent anchor |
| `MULTIPLE_MATCHES (N)` | Anchor appears N>1 times | Ambiguous anchor in file |
| `HASH_MISMATCH` | Matched scope differs from expected | Wrong `--expected-hash` |
| `DUPLICATE_TRUE_ID` | Same True ID at multiple buffer locations | Buffer corruption |
| `LABEL_EXISTS` | Alias already points to different True ID | Duplicate label |
| `AMBIGUOUS_REPLACEMENT` | Both `--replacement` and `--from-replacement` provided | Using both flags |
| `NO_REPLACEMENT` | Neither `--replacement` nor `--from-replacement` given | Missing replacement |
| `IO_ERROR: ...` | File I/O or UTF-8 validation failure | Permission denied, invalid UTF-8 |

All errors print to stderr and exit with code 1.

### 8.1 NO_MATCH Error

```bash
anchorscope read --file docs/tutorials/sample.txt --anchor "nonexistent anchor"
```

Output:
```
NO_MATCH
```

### 8.2 HASH_MISMATCH Error

```bash
anchorscope write \
  --file docs/tutorials/sample.txt \
  --anchor "// Modified: Comment updated via AnchorScope" \
  --expected-hash 0000000000000000 \
  --replacement "New content"
```

Output:
```
HASH_MISMATCH: expected=0000000000000000 actual=5d7008ad1b1478cb
```

### 8.3 NO_REPLACEMENT Error

```bash
anchorscope write \
  --file docs/tutorials/sample.txt \
  --anchor "// This is a comment" \
  --expected-hash 5d7008ad1b1478cb
```

Output:
```
NO_REPLACEMENT
```

---

## 9. File-Based Anchors (Recommended for Multi-Line)

For multi-line anchors, use `--anchor-file`:

```bash
# Create anchor file (no escaping needed)
echo 'fn main() {
    println!("Hello");
}' > anchor.txt

# Use anchor file
anchorscope read --file <path> --anchor-file anchor.txt
anchorscope write --file <path> --anchor-file anchor.txt --expected-hash <hash> --replacement "<new_content>"
```

File-based anchors:
- Preserve exact byte content including newlines
- No shell escaping required
- Ideal for agent-generated workflows

### 9.1 Create Multi-Line Anchor File

```bash
cat > docs/tutorials/anchor.txt << 'EOF'
fn helper() {
    println!("Helper function");
}
EOF
```

### 9.2 Read Using Anchor File

```bash
anchorscope read --file docs/tutorials/sample.txt --anchor-file docs/tutorials/anchor.txt
```

Output:
```
start_line=13
end_line=15
hash=f8e7d6c5b4a39281
content=fn helper() {
    println!("Helper function");
}
true_id=7c6b5a4938271605
label=f8e7d6c5b4a39281
true_id=7c6b5a4938271605
```

### 9.3 Write Using Anchor File

```bash
anchorscope write \
  --file docs/tutorials/sample.txt \
  --anchor-file docs/tutorials/anchor.txt \
  --expected-hash f8e7d6c5b4a39281 \
  --replacement "fn helper() {\n    println!(\"Helper function updated!\");\n}"
```

Output:
```
OK: written 68 bytes
```

---

## 10. Multi-Level Anchoring

Nested anchoring allows you to target specific patterns within larger scopes. The True ID encodes parent context, making nested anchors uniquely identifiable.

### 10.1 The Protocol Behind Multi-Level Anchoring

AnchorScope v1.3.0 implements **buffer isolation** at each level:

| Level | Target | Operation | Buffer State |
|-------|--------|-----------|--------------|
| 1 | Original file | `anchorscope read --file <path> --anchor "..."` | Creates `{file_hash}/content` |
| 2 | Buffer copy (from Level 1) | `anchorscope read --true-id <true_id> --anchor "..."` | Creates `{file_hash}/{true_id}/content` |
| 3+ | Buffer copy (from previous level) | `anchorscope read --true-id <true_id> --anchor "..."` | Creates nested `{file_hash}/{true_id}/{true_id}/content` |

**Crucial:** Level 2+ operations read from the **buffer copy**, NOT from the original file.

### 10.2 True ID Calculation

The True ID is deterministically computed from parent and child scope hashes:

```
true_id = xxh3_64(hex(parent_scope_hash) || "_" || hex(child_scope_hash))
```

Where `||` denotes byte concatenation and `0x5F` is the underscore character.

For Level 1 (anchored directly to file):
```
file_hash = xxh3_64(normalized_full_file_bytes)
true_id = xxh3_64(hex(file_hash) || "_" || hex(scope_hash))
```

**Properties:**
- Always 16 lowercase hex characters
- Same content at different nesting levels gets different True IDs
- Deterministic - same inputs always produce same output

### 10.3 Level 1: Anchor the Outer Scope

```bash
anchorscope read --file demo_target.rs --anchor "fn calculate_area(width: f64, height: f64) -> f64 {\n    // Calculate the area of a rectangle\n    // Formula: width * height\n    width * height\n}"
# Note: On Windows, use here-docs or anchor files for multiline anchors to avoid shell escaping issues
```

### 10.4 Level 2: Nested Anchor Inside the Buffer

```bash
# Get the True ID from Level 1
TRUE_ID=$(anchorscope read --file demo_target.rs --anchor "fn calculate_area(width: f64, height: f64) -> f64 {\n    // Calculate the area of a rectangle\n    // Formula: width * height\n    width * height\n}" | grep "^true_id=" | cut -d= -f2)

# Anchor a pattern inside the function buffer (reads from buffer copy, NOT original file)
anchorscope read --true-id $TRUE_ID --anchor "// Formula: width * height"
# Note: Ensure the variable does not contain spaces or special characters that break the shell command
```

### 10.5 Level 3: Deeper Nesting

You can continue nesting to target even more specific patterns. The True ID from Level 2 becomes the parent context for Level 3:

```bash
# Get the True ID from Level 2
TRUE_ID_LEVEL2=$(anchorscope read --true-id $TRUE_ID --anchor "// Formula: width * height" | grep "^true_id=" | cut -d= -f2)

# Anchor a more specific pattern inside the Level 2 buffer (reads from Level 2 buffer copy)
anchorscope read --true-id $TRUE_ID_LEVEL2 --anchor "width * height"
# Note: Shell variables must not contain spaces or special characters that break the command
```

### 10.4 Why Multi-Level Anchoring?

When the same pattern appears multiple times in a file, nested anchoring makes it uniquely targetable:

```bash
# File has TWO 'for i in range(10):' loops
# Level 1: Anchor the specific function
anchorscope read --file demo_target.py --anchor "def process_data():"

# Level 2: Anchor the loop inside the function buffer (reads from buffer copy)
anchorscope read --true-id <true_id_from_level_1> --anchor "for i in range(10):"

# Level 3: If the loop contains another repeating pattern, anchor it inside the loop buffer
anchorscope read --true-id <true_id_from_level_2> --anchor "print(f"Processing {i}")"
```

---

### 10.6 Using Labels with Multi-Level Anchoring

Labels can be used at any level to simplify workflow:

```bash
# Level 1: Read and create label
anchorscope read --file demo.rs --anchor "fn calculate_area()"
anchorscope label --name "func_area" --true-id <true_id_from_level_1>

# Level 2: Use label to anchor in buffer
anchorscope read --file demo.rs --label "func_area" --anchor "width * height"
anchorscope label --name "formula" --true-id <true_id_from_level_2>

# Level 2: Write using label
anchorscope write --label "formula" --from-replacement
```

**Note:** When using `--label` for multi-level anchoring, AnchorScope internally:
1. Resolves the label to True ID
2. Reads from the buffer copy at that True ID path
3. Returns the matched anchored scope with its own new True ID

---

### 10.7 ⚠️ The Stale Buffer Warning

**Critical Protocol Requirement for LLM Safety:** When a child level performs `write`, the parent buffer's `content` becomes **stale** (outdated).

| Level | Operation | Buffer State | Result |
|-------|-----------|--------------|--------|
| 1 | `read --file file.rs --anchor "fn foo()"` | Creates `{file_hash}/{true_id_1}/content` | Buffer 1 is fresh |
| 2 | `read --true-id <true_id_1> --anchor "..."` | Creates `{file_hash}/{true_id_1}/{true_id_2}/content` | Buffer 2 is fresh |
| 2 | `write --true-id <true_id_2> --from-replacement` | Deletes `{true_id_2}` directory | Buffer 2 deleted, Buffer 1 **stale** |

---

### ⚠️ LLM Safety Instruction (CRITICAL)

**Before each `read` operation, you MUST verify that the target buffer is fresh:**

1. **If the buffer was created or modified by a previous `write` at any child level → RE-READ**
2. **Never reuse a True ID if it was parent to any successful `write` operation**
3. **When in doubt, re-read from the original file**

**Example workflow that avoids stale buffers:**
```bash
# Level 1: Read function (creates buffer)
anchorscope read --file demo.rs --anchor "fn calculate_area()"
TRUE_ID_1=<result>

# Level 2: Read pattern inside function (reads from buffer 1)
anchorscope read --true-id $TRUE_ID_1 --anchor "width * height"
TRUE_ID_2=<result>

# Level 2: Write replacement (deletes buffer 2, makes buffer 1 STALE)
anchorscope write --true-id $TRUE_ID_2 --from-replacement
# ✅ SUCCESS

# ❌ WRONG: Do NOT use TRUE_ID_1 now - it's stale!
# anchorscope read --true-id $TRUE_ID_1 --anchor "other pattern"

# ✅ CORRECT: Re-read the parent from original file to refresh
anchorscope read --file demo.rs --anchor "fn calculate_area()"
TRUE_ID_1_FRESH=<new_result>
```

---

## 11. Safety Mechanisms

AnchorScope provides several safety mechanisms to prevent unsafe edits:

### 11.1 HASH_MISMATCH

Prevents writes if the file has changed since the read operation.

```bash
# Read with hash
anchorscope read --file demo_target.rs --anchor "fn demo() {"
# Get the hash value

# Modify the file
echo "fn demo() { modified }" > demo_target.rs

# Try to write with old hash
anchorscope write --file demo_target.rs --anchor "fn demo() {" --expected-hash <old_hash> --replacement "new content"
# Output: HASH_MISMATCH
```

### 11.2 AMBIGUOUS_REPLACEMENT

Requires explicit replacement source (`--replacement` or `--from-replacement`).

```bash
# Using both flags causes error
anchorscope write --file demo_target.rs --anchor "fn demo() {" --replacement "new" --from-replacement
# Output: AMBIGUOUS_REPLACEMENT
```

### 11.3 NO_REPLACEMENT

Fails if no replacement is specified.

```bash
anchorscope write --file demo_target.rs --anchor "fn demo() {" --from-replacement
# Output: NO_REPLACEMENT
```

### 11.4 MULTIPLE_MATCHES

Fails if anchor appears multiple times.

```bash
echo -e "// First\n// First" > demo_multi.rs
anchorscope read --file demo_multi.rs --anchor "// First"
# Output: MULTIPLE_MATCHES (2)
```

---

## 12. Complete Showcase: Multi-Step Workflow

This section demonstrates a complete workflow combining all features, similar to the v1.3.0 showcase:

### 12.1 Setup: Create a Working Copy

```bash
# Create demo file
# Note: On Windows, use 'type con' or a text editor for multiline strings
# For shell scripts, single quotes preserve \n as literal characters
cat > demo_target.rs << 'RUST_CODE'
// Geometry calculator
// This module provides functions for calculating area and perimeter

fn calculate_area(width: f64, height: f64) -> f64 {
    // Calculate the area of a rectangle
    // Formula: width * height
    width * height
}

fn calculate_perimeter(width: f64, height: f64) -> f64 {
    // Calculate the perimeter of a rectangle
    // Formula: 2 * (width + height)
    2.0 * (width + height)
}

fn main() {
    let w = 5.0;
    let h = 3.0;
    println!("Area: {}", calculate_area(w, h));
    println!("Perimeter: {}", calculate_perimeter(w, h));
}
RUST_CODE
```

### 12.2 Step 1: Level 1 - Anchor the Outer Function

```bash
ANCHOR_FUNC='fn calculate_area(width: f64, height: f64) -> f64 {
    // Calculate the area of a rectangle
    // Formula: width * height
    width * height
}'

anchorscope read --file demo_target.rs --anchor "$ANCHOR_FUNC"
# Note: Ensure the variable does not contain spaces or special characters that break the shell command
```

### 12.3 Step 2: Create a Human-Readable Label

```bash
TRUE_ID_FUNC=$(anchorscope read --file demo_target.rs --anchor "$ANCHOR_FUNC" | grep "^true_id=" | head -1 | cut -d= -f2)
anchorscope label --name "func_area" --true-id "$TRUE_ID_FUNC"
```

### 12.4 Step 3: Level 2 - Nested Anchor

```bash
ANCHOR_FORMULA="// Formula: width * height"

# Get both the scope_hash AND true_id from Level 2 read
anchorscope read --true-id "$TRUE_ID_FUNC" --anchor "$ANCHOR_FORMULA"

# Parse the scope_hash (for --expected-hash in write) and true_id (for labeling)
TRUE_ID_NESTED=$(anchorscope read --true-id "$TRUE_ID_FUNC" --anchor "$ANCHOR_FORMULA" | grep "^true_id=" | head -1 | cut -d= -f2)
SCOPE_HASH_NESTED=$(anchorscope read --true-id "$TRUE_ID_FUNC" --anchor "$ANCHOR_FORMULA" | grep "^hash=" | head -1 | cut -d= -f2)

# Important: SCOPE_HASH_NESTED is the scope_hash from the nested read, which must be used in write
# This verifies the buffer state hasn't changed since reading
```

### 12.5 Step 4: Create Label for Nested Anchor

```bash
anchorscope label --name "area_formula" --true-id "$TRUE_ID_NESTED"
```

**Note:** The label "area_formula" points to the nested anchor (Level 2). This is the True ID you'll use for subsequent operations.

### 12.6 Step 5: Pipe Command - stdout Mode

```bash
anchorscope pipe --true-id "$TRUE_ID_NESTED" --out
```

### 12.7 Step 6: Pipe Command - Write Replacement via stdin

```bash
PIPE_OUT=$(anchorscope pipe --true-id "$TRUE_ID_NESTED" --out)
echo "$PIPE_OUT" | sed 's/width \* height/(width * height) + 1/' | anchorscope pipe --true-id "$TRUE_ID_NESTED" --in
```

### 12.8 Step 7: Write from Replacement to File

```bash
anchorscope write --true-id "$TRUE_ID_NESTED" --anchor "$ANCHOR_FORMULA" --expected-hash "$SCOPE_HASH_NESTED" --from-replacement
```

### 12.9 Step 8: Verify the Change

```bash
cat demo_target.rs
```

---

## 13. Common Workflow

```bash
# 1. Read to get True ID and hash
anchorscope read --file file.rs --anchor "fn main()"

# 2. (Optional) Create label for easier reference
anchorscope label --name "main" --true-id <true_id>

# 3. Prepare replacement via pipe
anchorscope pipe --label "main" --out | transform-tool | anchorscope pipe --label "main" --in

# 4. Write with hash verification
anchorscope write --label "main" --from-replacement
```

**⚠️ Multi-Level Workflow Safety:**

```bash
# Level 1: Read outer scope
anchorscope read --file file.rs --anchor "fn process_data()"
TRUE_ID_LEVEL1=<result>

# Level 2: Read inner scope
anchorscope read --true-id $TRUE_ID_LEVEL1 --anchor "for i in range(10):"
TRUE_ID_LEVEL2=<result>

# Level 2: Write inner scope
anchorscope write --true-id $TRUE_ID_LEVEL2 --from-replacement

# ⚠️ CRITICAL: TRUE_ID_LEVEL1 is now STALE!

# If you need to work with Level 1 buffer again, RE-READ from original file:
anchorscope read --file file.rs --anchor "fn process_data()"
TRUE_ID_LEVEL1_FRESH=<new_result>
```

---

## 14. Key Commands Reference

| Command | Purpose |
|---------|---------|
| `read` | Locate and hash an anchored scope |
| `write` | Replace scope with hash verification |
| `label` | Assign human-readable alias to True ID |
| `tree` | Visualize buffer structure |
| `pipe` | Bridge with external tools |
| `paths` | Get buffer file paths for debugging |

---

## 15. Summary

AnchorScope provides deterministic, verifiable code editing through:

1. **Anchored Scopes** - Exact byte-level matching with minimal context
2. **True IDs** - Content-derived identifiers for stable references (calculated as `xxh3_64(hex(parent_hash) || "_" || hex(child_hash))`)
3. **Hash Verification** - Integrity checks before every write (using **scope_hash** from previous `read`)
4. **Buffer Management** - External state persistence via pipe/paths

**Governing principle: No Match, No Hash, No Write.**

**Key Protocol Points:**

1. `--expected-hash` in `write` must use the **scope_hash** from the *previous* `read` operation
2. Multi-level anchoring reads from **buffer copies**, not the original file
3. **⚠️ CRITICAL**: Child `write` success makes parent buffer **stale** - you MUST re-read from original file before using parent buffer again
4. External tools return content is validated (UTF-8) and normalized (LF) before storage

**LLM Safety Checklist:**
- [ ] Before each `read`, verify the target buffer is fresh (not made stale by a child `write`)
- [ ] Never reuse a True ID if it was parent to any successful `write`
- [ ] When uncertain, re-read from the original file

### When to Use

- LLM-driven code editing where determinism is critical
- Multi-step edits requiring state persistence
- External tool integration with content transformation
- Debugging buffer state with tree/paths commands
- Multi-line anchor matching with exact byte preservation

### Key Commands

| Command | Purpose |
|---------|---------|
| `read` | Locate and hash an anchored scope |
| `write` | Replace scope with hash verification |
| `label` | Assign human-readable alias to True ID |
| `tree` | Visualize buffer structure |
| `pipe` | Bridge with external tools |
| `paths` | Get buffer file paths for debugging |

### Common Workflow

```bash
# 1. Read to get True ID and hash
anchorscope read --file file.rs --anchor "fn main()"

# 2. (Optional) Create label for easier reference
anchorscope label --name "main" --true-id <true_id>

# 3. Prepare replacement via pipe
anchorscope pipe --label "main" --out | transform-tool | anchorscope pipe --label "main" --in

# 4. Write with hash verification
anchorscope write --label "main" --from-replacement
```

---
