# pi-anchorscope Specification

Version: 2.0.0
Status: Draft

The key words "MUST", "MUST NOT", "SHOULD", and "MAY" in this document are to
be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

---

## 1. Overview

**pi-anchorscope** is a pi coding agent extension that provides hash-verified,
targeted file editing via [AnchorScope v2.0.0](https://github.com/kmlaborat/AnchorScope).

It exposes three tools to the LLM:

| Tool | Level | Use |
| :--- | :--- | :--- |
| `anchorscope_apply` | High-level | Primary tool for all file edits |
| `anchorscope_read` | Low-level | Read a scope and get scope_hash |
| `anchorscope_write` | Low-level | Write with hash verification |

**Recommended workflow:** Use `anchorscope_apply` for all edits.
Use `anchorscope_read` and `anchorscope_write` only when fine-grained
control over the read/write cycle is needed.

---

## 2. Architecture

```
LLM Agent
  ↓ anchorscope_apply(file, anchor, content)
pi-anchorscope Extension
  ↓ anchorscope read  →  scope_hash
  ↓ anchorscope write →  hash-verified replacement
AnchorScope v2.0.0
  ↓
Source File
```

pi-anchorscope is a thin wrapper. All byte-level matching, hashing, and
writing is performed by the AnchorScope binary. The extension handles:

- Path resolution (including Windows/Unix path conversion)
- Chaining `read` and `write` in `anchorscope_apply`
- File mutation queuing (`withFileMutationQueue`) to prevent race conditions
- Structured error reporting to the LLM

---

## 3. Extension API (Normative)

### 3.1 anchorscope_apply (Recommended)

The primary tool for all file edits. Internally performs `read` then `write`.
The LLM does not need to manage `scope_hash`.

**Parameters:**

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `file` | string | Path to the file to edit |
| `anchor` | string | Exact byte sequence to match. Must appear exactly once in the file. |
| `content` | string | Complete replacement for the matched anchor scope. |

**Internal flow:**

```
1. Resolve file path
2. anchorscope read --file <file> --anchor <anchor>
   → scope_hash
3. anchorscope write --file <file> --anchor <anchor>
               --expected-hash <scope_hash>
               --replacement <content>
   → OK: written N bytes
```

**Output on success:**

```
OK: written N bytes
```

**Error conditions:**

| Error | Cause | Agent action |
| :--- | :--- | :--- |
| `NO_MATCH` | anchor not found in file | Revise anchor string |
| `MULTIPLE_MATCHES` | anchor not unique | Use a longer anchor |
| `HASH_MISMATCH` | file changed between read and write | Retry anchorscope_apply |
| `IO_ERROR` | file not found or permission denied | Check file path |

---

### 3.2 anchorscope_read (Low-level)

Read a scope from a file and return its `scope_hash` and matched content.

> **Note:** In most cases, use `anchorscope_apply` instead.
> Use `anchorscope_read` only when you need to inspect content before
> deciding on a replacement.

**Parameters:**

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `file` | string | Path to the file |
| `anchor` | string | Exact byte sequence to match |

**Output on success:**

```
scope_hash: <16-char hex>
content:
<matched bytes>
```

**Error conditions:** Same as `anchorscope_apply`.

---

### 3.3 anchorscope_write (Low-level)

Write a replacement to a file scope with hash verification.

> **Note:** In most cases, use `anchorscope_apply` instead.
> Use `anchorscope_write` only after a prior `anchorscope_read` call.
> Never invent or guess `scope_hash`.

**Parameters:**

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `file` | string | Path to the file |
| `anchor` | string | Exact byte sequence to match |
| `expected_hash` | string | `scope_hash` from a prior `anchorscope_read` call |
| `replacement` | string | New content to replace the matched scope |

**Output on success:**

```
OK: written N bytes
```

**Error conditions:** Same as `anchorscope_apply`.

---

### 3.4 Path Resolution

On Windows, Unix-style paths (e.g., `/tmp/file.rs`) are resolved via
`cygpath -w` when available (Git Bash / MSYS2 environments).
If `cygpath` is not available, the original path is passed to AnchorScope,
which will return `IO_ERROR: file not found` for unresolvable paths.

Relative paths are resolved against the agent's current working directory (`ctx.cwd`).

---

### 3.5 File Mutation Safety

`anchorscope_apply` and `anchorscope_write` use `withFileMutationQueue`
to serialize concurrent writes to the same file. This prevents data loss
when multiple tool calls target the same file in the same agent turn.

---

## 4. Skill (Informative)

The `skills/anchorscope/SKILL.md` file provides LLM-facing guidance for
using this extension. It is loaded automatically by pi when the package
is installed.

### 4.1 When to Use anchorscope_apply

Use `anchorscope_apply` for **all file edits**, including small files.
Do not use the built-in `edit` or `write` tools.

`anchorscope_apply` provides:
- Hash verification (detects concurrent modifications)
- Exact byte-level matching (no fuzzy replacement)
- Zero modification outside the matched scope

### 4.2 Choosing an Anchor

The anchor must be an exact byte sequence that appears **exactly once**
in the file.

Good anchors:
- A unique function signature with its opening brace
- A unique comment followed by the code below it
- A block of code that includes enough context to be unique

Bad anchors:
- A single common word (e.g., `width`) — causes `MULTIPLE_MATCHES`
- An empty string — causes `NO_MATCH`
- A string that does not exist in the file — causes `NO_MATCH`

If `MULTIPLE_MATCHES` is returned, widen the anchor to include more
surrounding context.

### 4.3 Constructing content

`content` is the **complete replacement** for the matched anchor scope.

- The entire anchor scope is replaced by `content`
- Content outside the anchor scope is never modified
- The agent is responsible for correctness of the replacement

### 4.4 Error Handling

| Error | Action |
| :--- | :--- |
| `NO_MATCH` | Read the file, verify the anchor exists, revise |
| `MULTIPLE_MATCHES` | Add more surrounding context to the anchor |
| `HASH_MISMATCH` | File was modified concurrently — retry |
| `IO_ERROR` | Check file path and permissions |

---

## 5. Non-Goals

- Anchor discovery or scope localization (see AnchorEdit)
- Multi-file operations
- Version history or snapshots
- Semantic understanding of file content
- AST parsing or language awareness

---

## 6. Guarantees

1. Every edit targets exactly one uniquely identified scope
2. No edit is applied if the file state changed between read and write
3. Zero modification occurs outside the matched anchor scope
4. File mutation is serialized per file path within a single agent turn
5. All byte-level guarantees from AnchorScope v2.0.0 apply

---

## 7. References

- AnchorScope v2.0.0: https://github.com/kmlaborat/AnchorScope
- AnchorScope SPEC: https://github.com/kmlaborat/AnchorScope/blob/main/docs/SPEC.md
