# AnchorScope Specification v1.3.0

## Deterministic Scoped Editing Protocol

**AnchorScope is a deterministic code editing protocol based on Scope Anchoring.**
It treats code as **immutable UTF-8 byte sequences**, not as text or syntax.

All operations are strictly **byte-level, deterministic, and single-location**.

The key words "MUST", "MUST NOT", "SHOULD", and "MAY" in this document are to
be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

AnchorScope v1.3.0 extends v1.2.0 by introducing:

* **Anchored Scope**: renamed from "region" for clarity and consistency with the tool name
* **External Tool Pipeline**: `pipe` and `paths` commands enabling integration with external tools
* **Replacement Buffer**: `replacement` file in the Anchor Buffer for pipeline workflows

---

## 1. Concept: Scoped Editing (Informative)

### 1.1 Problem: Fragility of Global Edits

Full-file rewrites are high-risk, and diff-based patching is fragile.
Even minor contextual changes can invalidate patches.

### 1.2 Solution: Anchor and Scope

AnchorScope defines a precise **editing scope** using an exact byte sequence ("Anchor"),
combined with **hash-based state verification**.

This enables edits that are:

* Safe (fail-fast)
* Precise (single-location)
* Idempotent (state-verified)

### 1.3 Multi-Level Anchoring

Uniqueness of an anchor is required within its source scope.
When a target anchored scope is large, uniqueness is harder to achieve.

Multi-level anchoring solves this:

1. Set a broad outer anchor (easy to make unique in the full file)
2. Set an inner anchor within the outer anchor's copy (easy to make unique in the smaller scope)
3. Edit the innermost target

Each level operates on a **buffer copy** of the parent's matched anchored scope,
not on the original file. This prevents a write at any level from invalidating
anchors at other levels.

After a child `write` succeeds, the parent buffer's `content` is **not** automatically
updated. It reflects the state at the time of the parent's `read`. Any subsequent
operation on the parent buffer **MUST** treat it as stale and re-read from the
original file if an up-to-date view is required.

### 1.4 External Tool Pipeline

AnchorScope is designed to integrate with external tools (e.g., translation engines,
fast-apply models) via the `pipe` and `paths` commands.

The boundary is explicit:

* **Inside AnchorScope**: strict byte-level management, normalization, hash verification
* **Outside AnchorScope**: external tools operate freely on content passed to them
* **Re-entry**: content returned from external tools is immediately subject to
  AnchorScope's validation and normalization pipeline

AnchorScope does not prescribe what external tools do. It only guarantees the
integrity of content before and after the boundary.

### 1.5 Layered Model

| Layer              | Name            | Role                                                              |
| :----------------- | :-------------- | :---------------------------------------------------------------- |
| **Concept**        | Scoped Editing  | Philosophy of local, verifiable mutation                          |
| **Protocol**       | Scope Anchoring | Deterministic matching & hashing rules                            |
| **Implementation** | AnchorScope     | Reference CLI (`read` / `write` / `label` / `tree` / `pipe` / `paths`) |

---

## 2. Protocol: Scope Anchoring (Normative)

### 2.1 Invariants

The following invariants **MUST** hold:

1. Matching **MUST** be exact byte equality after normalization.
2. Matching **MUST** evaluate all possible byte offsets.
3. Exactly one match **MUST** exist to proceed.
4. All operations **MUST** be deterministic.
5. No implicit interpretation (syntax, encoding heuristics) is allowed.
6. Multi-level anchors **MUST NOT** operate directly on the original file after the first level.
   Subsequent levels operate on **buffer copies** only.

---

### 2.2 Encoding & Validation

All inputs **MUST** be valid UTF-8.

* File content **MUST** be validated immediately after reading.
* `--anchor-file` content **MUST** be validated.
* Inline arguments (`--anchor`, `--replacement`) are assumed valid.
* Content received from external tools via `pipe` **MUST** be validated before
  being written to the replacement buffer.

#### Error

If invalid UTF-8 is detected:

```
IO_ERROR: invalid UTF-8
```

#### Constraints

* No partial decoding
* No lossy conversion
* Validation **MUST** occur before normalization

---

### 2.3 Normalization

```
CRLF (\r\n) → LF (\n)
```

Normalization **MUST** be applied:

* After validation (before matching)
* Before hashing
* Before writing
* Before storing content received from external tools into the replacement buffer

Normalization applies identically to file content, anchor, and replacement.

Normalization is **irreversible**: files written by AnchorScope are always LF-only,
regardless of the original line endings. AnchorScope does not restore CRLF on output.

No other transformations are allowed:

* ❌ Trimming
* ❌ Unicode normalization
* ❌ Whitespace changes

---

### 2.4 Equality Definition

Two byte sequences are equal **if and only if**:

1. Both are valid UTF-8
2. Both are normalized using the same rule
3. Their byte sequences are identical

No other notion of equality is permitted.

---

### 2.5 Matching & Identification

* Evaluate **every possible starting byte position** (increment by 1 byte)
* Perform exact byte comparison
* Regex, fuzzy matching, heuristics **MUST NOT** be used
* Empty anchors are invalid and treated as `NO_MATCH`

#### Outcomes

| Match Count | Result             |
| ----------- | ------------------ |
| 0           | `NO_MATCH`         |
| 1           | Success            |
| >1          | `MULTIPLE_MATCHES` |

---

### 2.6 Hashing

* Algorithm: `xxh3_64`
* Input: normalized matched byte sequence of the anchored scope
* Output: lowercase 16-character hex string
* Executed only if exactly one match exists, **before write**

---

### 2.7 Line Numbering

* 1-based
* Based on normalized content (LF only)
* Inclusive range `[start, end]`

---

## 3. Anchor Identity (Normative)

### 3.1 Scope Hash

The **scope hash** is computed from the matched byte sequence of the anchored scope:

```
scope_hash = xxh3_64(normalized matched bytes)
```

This is the hash returned by `read` and used as `expected_hash` in `write`.

---

### 3.2 True ID

The **True ID** uniquely identifies an anchor within its parent scope.

```
true_id = xxh3_64(hex(parent_scope_hash) || 0x5F || hex(child_scope_hash))
```

where `||` denotes byte concatenation and `0x5F` is the ASCII code for `_`.

For the first level (anchored directly into the original file):

```
true_id = xxh3_64(hex(file_hash) || 0x5F || hex(scope_hash))
```

where `file_hash = xxh3_64(normalized full file bytes)`.

Properties:

* Always 16 lowercase hex characters
* Encodes both parent context and matched anchored scope
* Two anchors with identical content but different parents have different True IDs
* Determined solely by hash values; no file path or anchor string is included

#### Duplicate True ID

Although True ID collisions are statistically rare (xxh3_64 is 64-bit), they are
theoretically possible. If the same True ID is found at multiple locations within
the **same `{file_hash}` directory**, the system **MUST** terminate immediately with:

```
DUPLICATE_TRUE_ID
```

Detection scope is limited to the `{file_hash}` directory of the current operation.
True IDs under different `{file_hash}` directories are independent and do not
conflict with each other.

This prevents non-deterministic behavior where operations might resolve to the
wrong buffer location.

---

### 3.3 Alias

An **alias** is an optional human-readable name assigned to a True ID via the `label` command.

* Multiple aliases may point to the same True ID
* Aliases do not replace True IDs; they coexist
* An alias is a convenience reference only; all protocol operations use True IDs

---

## 4. Anchor Buffer (Normative)

### 4.1 Purpose

The **Anchor Buffer** is a structured temporary directory that stores:

* A copy of the original file (root)
* Copies of each matched anchored scope (one per `read`)
* Replacement content prepared by external tools (one per `pipe`, if used)

Buffer copies serve as the source for multi-level anchoring and external tool integration.
They are **not** a snapshot or version history. They exist solely to enable
recursive editing without modifying the original file.

---

### 4.2 Directory Structure

```
{TMPDIR}/anchorscope/
└── {file_hash}/
    ├── content          ← normalized copy of the original file
    ├── source_path      ← absolute path to the original file (plain text)
    └── {true_id}/
        ├── content      ← normalized copy of the matched anchored scope
        ├── replacement  ← output from external tool (created by `pipe`, consumed by `write`)
        └── {true_id}/
            ├── content
            ├── replacement
            └── {true_id}/
                ├── content
                └── replacement

{TMPDIR}/anchorscope/labels/
└── {alias}.json         ← alias → true_id mapping
```

* `{TMPDIR}` is the OS temporary directory (`$TMPDIR` on Unix/macOS, `%TEMP%` on Windows)
* `file_hash` identifies the root (original file)
* `true_id` identifies each anchor level
* `source_path` is stored **only at the root level**
* `content` files contain normalized UTF-8 text
* `replacement` files are created only when `pipe` is used; absent otherwise

> **Note:** Deeply nested anchor structures may encounter platform-specific path
> length limits (e.g., Windows MAX_PATH of 260 characters). Implementations
> should document any such constraints.

---

### 4.3 Lifecycle

| Event | Effect on Buffer |
| :---- | :--------------- |
| `read` on original file | Creates `{file_hash}/content`, `{file_hash}/source_path`, `{file_hash}/{true_id}/content` |
| `read` on buffer copy | Creates `{file_hash}/{true_id}/{true_id}/content` (nested) |
| `pipe` (stdout mode) | Streams `content` to stdout; writes validated stdin to `replacement` |
| `pipe` (file-io mode) | Passes `content` path to external tool; validates and stores output as `replacement` |
| `write` success | Deletes the written anchor's True ID directory and all its descendants |
| `write` failure | Buffer is retained for retry or inspection |
| Process exit / error | Buffer is retained (OS temp cleanup handles eventual removal) |

---

### 4.4 Labels File

```json
{ "true_id": "a1b2c3d4e5f6a7b8" }
```

* Stored at `{TMPDIR}/anchorscope/labels/{alias}.json`
* Deleted when the referenced True ID's directory is deleted

---

## 5. Execution Model (Normative)

### 5.1 Read Pipeline

```
READ → VALIDATE → NORMALIZE → MATCH → HASH → BUFFER_WRITE
```

* Any stage failure **MUST terminate immediately**
* No stage may be skipped or reordered

---

### 5.2 Write Phase

```
HASH_VERIFIED → WRITE → BUFFER_INVALIDATE → COMPLETE
```

* Compare current content hash with `expected_hash`
* If mismatch:

```
HASH_MISMATCH
```

* WRITE **MUST**:
  * Replace only the matched anchored scope
  * Succeed or terminate with:

```
IO_ERROR: write failure
```

* On success, delete the anchor's buffer directory and all descendants

---

### 5.3 Pipe Phase

```
BUFFER_READ → [EXTERNAL TOOL] → VALIDATE → NORMALIZE → REPLACEMENT_WRITE
```

* `BUFFER_READ`: read `content` from buffer
* `[EXTERNAL TOOL]`: AnchorScope yields control; external tool operates freely
* `VALIDATE`: content returned from external tool **MUST** be validated as UTF-8
* `NORMALIZE`: CRLF normalization applied
* `REPLACEMENT_WRITE`: validated, normalized content written to `replacement`

Any failure at VALIDATE or NORMALIZE **MUST terminate immediately**.
The external tool's behavior between BUFFER_READ and VALIDATE is outside
AnchorScope's scope.

---

## 6. Implementation: AnchorScope CLI (Normative)

### 6.1 Commands

* `read` – match anchor, compute scope hash and True ID, write buffer copy
* `write` – verify hash, apply replacement, invalidate buffer
* `label` – assign alias to a True ID
* `tree` – display current buffer structure
* `pipe` – bridge between Anchor Buffer and external tools via stdout/stdin
* `paths` – return file paths of `content` and `replacement` for a given True ID

---

### 6.2 Read Contract

The `read` command **MUST**:

1. Execute the full pipeline through BUFFER_WRITE
2. Return:
   * Line range (1-based, inclusive)
   * Scope hash
   * True ID
   * Matched content (normalized UTF-8)
3. **NOT** modify the source file or any parent buffer

Target of `read` is either:

* The original file (level 1)
* A buffer `content` file referenced by True ID or alias (level 2+)

---

### 6.3 Write Contract

The `write` command **MUST**:

1. Compute hash from current content of the target (file or buffer)
2. Compare with `expected_hash`
3. Perform replacement **only if equal**
4. On success, delete the anchor's buffer directory and all descendants
5. Otherwise return `HASH_MISMATCH`

#### Replacement Source

The replacement content **MUST** be specified explicitly. Two mutually exclusive options:

* `--replacement "..."`: use the inline string as replacement content
* `--from-replacement`: use `buffer/{true_id}/replacement` as replacement content

If both are specified:

```
AMBIGUOUS_REPLACEMENT
```

If neither is specified:

```
NO_REPLACEMENT
```

The `replacement` file in the buffer is **never used implicitly**. Its existence
alone has no effect on `write` behavior.

---

### 6.4 Label Contract

The `label` command **MUST**:

* Accept a True ID and a human-readable alias
* Create `labels/{alias}.json` mapping alias to True ID
* Verify the True ID exists in the buffer before creating the alias
* Allow multiple aliases per True ID
* Reject alias reuse pointing to a different True ID:

```
LABEL_EXISTS
```

---

### 6.5 Tree Contract

The `tree` command **MUST**:

* Display the current buffer structure rooted at `{file_hash}`
* Show True IDs, aliases (if any), and nesting depth
* Indicate presence of `replacement` file where applicable
* Reflect the actual state of the buffer directory

Example output:

```
{file_hash}  (/path/to/original.rs)
└── {true_id}  [my_function]
    ├── replacement ✓
    └── {true_id}
        └── {true_id}  [inner_loop]
```

---

### 6.6 Pipe Contract

The `pipe` command bridges the Anchor Buffer and external tools.

It operates in two modes:

#### stdout mode (default)

```bash
as.pipe --true-id {true_id} --out | external-tool | as.pipe --true-id {true_id} --in
```

* `--out`: streams `buffer/{true_id}/content` to stdout
* `--in`: reads from stdin, validates and normalizes, writes to `buffer/{true_id}/replacement`

`as.read` and `as.write` **MUST NOT** be used for stdout/stdin I/O directly.
All standard I/O at the AnchorScope boundary **MUST** go through `pipe`.

> **Note:** stdout mode delegates encoding handling to the external tool and the
> OS pipe. For guaranteed byte-level integrity, `--file-io` mode is recommended.

#### file-io mode

```bash
as.pipe --true-id {true_id} --tool external-tool --file-io
```

* Passes `buffer/{true_id}/content` path to the external tool
* External tool reads `content` and writes output to a path provided by `pipe`
* `pipe` validates and normalizes the output, then stores it as `replacement`

In file-io mode, `pipe` controls the file path passed to the external tool
and **MUST** validate all content upon re-entry.

---

### 6.7 Paths Contract

The `paths` command **MUST**:

* Accept a True ID or alias
* Return the absolute paths of `content` and `replacement` for that True ID
* Return `replacement` path regardless of whether the file currently exists

Example output:

```
content:     /tmp/anchorscope/{file_hash}/{true_id}/content
replacement: /tmp/anchorscope/{file_hash}/{true_id}/replacement
```

This enables external tools or agents to access buffer files directly
without going through `pipe`.

If an external tool writes directly to the `replacement` path obtained via `paths`,
AnchorScope **MUST** validate and normalize the content of `replacement` at the
time `write --from-replacement` is executed. The tool is responsible for writing
valid UTF-8; AnchorScope will reject invalid content with `IO_ERROR: invalid UTF-8`.

---

### 6.8 Deterministic Error Handling

Allowed outputs:

```
NO_MATCH
MULTIPLE_MATCHES
HASH_MISMATCH
DUPLICATE_TRUE_ID
LABEL_EXISTS
AMBIGUOUS_REPLACEMENT
NO_REPLACEMENT
IO_ERROR: file not found
IO_ERROR: permission denied
IO_ERROR: invalid UTF-8
IO_ERROR: read failure
IO_ERROR: write failure
```

---

## 7. Non-Goals

* Snapshot or version history (that is git's responsibility)
* Multi-file operations
* AST parsing or language awareness
* Regex or fuzzy matching
* Encoding detection or conversion
* Any modification outside the matched anchored scope
* Prescribing the behavior of external tools
* Sequential chaining of multiple read/write operations (that is the external tool or agent's responsibility)
* Concurrent execution safety (AnchorScope is designed for single-process use; concurrent access to the same buffer is undefined behavior)

---

## 8. Guarantees

1. Every edit targets exactly one uniquely identified anchored scope
2. No edit is applied if the content state has changed
3. All operations are deterministic and reproducible
4. Equality is strictly defined at the byte level
5. True IDs are derived solely from hash values; no path or string metadata is included
6. Buffer copies isolate levels; a write at any level does not invalidate unrelated anchors
7. The system is fail-fast by design
8. Zero modification occurs outside the matched anchored scope
9. Normalization is irreversible; all output files are LF-only
10. Duplicate True IDs within the same file_hash directory trigger immediate failure
11. Content re-entering AnchorScope from external tools is always validated and normalized
12. Replacement source for `write` is always explicit; `replacement` file is never used implicitly

---

## 9. Summary

AnchorScope v1.3.0 defines **atomic, deterministic, multi-level file editing
with external tool integration**:

* Hash-verified consistency at every level
* True IDs derived from `xxh3_64(hex(parent_scope_hash) || 0x5F || hex(child_scope_hash))`
* Optional human-readable aliases via `label`
* A structured Anchor Buffer with `content` and `replacement` per anchored scope
* `pipe` command for stdout/stdin integration with external tools
* `paths` command for direct buffer file access
* Strict validation and normalization on all content re-entering AnchorScope
* No snapshot, no mutable state, no version history

> **Correctness over convenience
> Determinism over mutability
> Hash as the sole source of truth**
