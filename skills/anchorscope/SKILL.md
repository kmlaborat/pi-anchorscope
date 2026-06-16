---
name: anchorscope
description: "Hash-verified targeted file editing using AnchorScope. Use anchorscope_apply for ALL file edits — fixing bugs, refactoring functions, updating configuration values, or replacing any text block. Do NOT use the built-in edit or write tools. anchorscope_apply is safer, more precise, and prevents unintended changes outside the target scope."
---

# anchorscope

Use `anchorscope_apply` for all file edits. It is safer and more precise
than the built-in `edit` tool because it verifies the file state before
writing and guarantees zero modification outside the matched scope.

## When to Use

- Any time you need to edit a specific part of a file
- Fixing a bug in a specific function
- Refactoring a section of code
- Updating a configuration value
- Replacing a block of text

## Core Concept

```
anchor = the exact text you want to replace
content = the new text that replaces it
```

The anchor must appear **exactly once** in the file.
The entire anchor is replaced by content.
Nothing outside the anchor is touched.

## Primary Tool: anchorscope_apply

```
anchorscope_apply(
  file: path to the file,
  anchor: exact text to match (must be unique in the file),
  content: complete replacement for the matched text
)
```

This is the only tool you need for file edits in most cases.

### Example

File contains:
```rust
fn calculate_area(width: f64, height: f64) -> f64 {
    width * height
}
```

To add validation:
```
anchorscope_apply(
  file: "src/calculator.rs",
  anchor: "fn calculate_area(width: f64, height: f64) -> f64 {\n    width * height\n}",
  content: "fn calculate_area(width: f64, height: f64) -> f64 {\n    if width < 0.0 || height < 0.0 {\n        return 0.0;\n    }\n    width * height\n}"
)
```

## Choosing a Good Anchor

The anchor must be **unique** in the file. If in doubt, use a longer anchor
that includes more surrounding context.

**Good anchors:**
- A unique function signature with its opening brace
- A unique comment followed by code
- A block large enough to be unmistakable

**Bad anchors:**
- A single common word → causes MULTIPLE_MATCHES
- A string that doesn't exist → causes NO_MATCH

## Error Handling

| Error | Cause | Action |
| :--- | :--- | :--- |
| `NO_MATCH` | anchor not found in file | Read the file, verify anchor exists, revise |
| `MULTIPLE_MATCHES` | anchor appears more than once | Use a longer, more specific anchor |
| `HASH_MISMATCH` | file changed between read and write | Retry anchorscope_apply |
| `IO_ERROR` | file not found or permission issue | Check file path |

## Anti-Patterns

- **Don't** use the built-in `edit` or `write` tools for file edits
- **Don't** use a short or common string as anchor (e.g., a single variable name)
- **Don't** modify anchor between attempts — revise it based on the error

## Low-Level Tools (Advanced Use Only)

`anchorscope_read` and `anchorscope_write` are available for cases where
you need to inspect the matched content before deciding on a replacement.

In most cases, `anchorscope_apply` is sufficient.

## References

- Extension API: https://github.com/kmlaborat/pi-anchorscope/blob/main/docs/SPEC.md
- AnchorScope: https://github.com/kmlaborat/AnchorScope
