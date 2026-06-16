# pi-anchorscope

Hash-verified targeted file editing for [pi coding agent](https://pi.dev),
powered by [AnchorScope v2.0.0](https://github.com/kmlaborat/AnchorScope).

## What it does

Replaces the built-in `edit` tool with `anchorscope_apply` — a safer,
more precise editing tool that:

- Matches an exact byte sequence (anchor) in a file
- Verifies file state before writing (hash verification)
- Guarantees zero modification outside the matched scope

## Prerequisites

[AnchorScope v2.0.0](https://github.com/kmlaborat/AnchorScope) must be
installed and available as `anchorscope` in your PATH:

```bash
git clone https://github.com/kmlaborat/AnchorScope
cd AnchorScope && cargo install --path .
```

Optional: set a custom binary path via environment variable:

```bash
export ANCHORSCOPE_BIN=/path/to/anchorscope
```

## Installation

```bash
pi install git:github.com/kmlaborat/pi-anchorscope
```

## Tools

### anchorscope_apply (Recommended)

The primary tool for all file edits.

```
anchorscope_apply(
  file: "src/main.rs",
  anchor: "fn hello() {\n    println!(\"hello\");\n}",
  content: "fn hello() {\n    println!(\"hi\");\n}"
)
```

Internally performs `read` (to get scope_hash) then `write`
(with hash verification). The LLM does not need to manage `scope_hash`.

### anchorscope_read (Low-level)

Read a scope and return its `scope_hash` and matched content.
Use when you need to inspect content before deciding on a replacement.

### anchorscope_write (Low-level)

Write a replacement with hash verification.
Requires `scope_hash` from a prior `anchorscope_read` call.

## How it Works

```
LLM calls anchorscope_apply(file, anchor, content)
  ↓
Extension: anchorscope read → scope_hash
  ↓
Extension: anchorscope write (hash-verified)
  ↓
File updated — only the matched scope changed
```

## Documents

| Document | Description |
| :--- | :--- |
| [docs/SPEC.md](docs/SPEC.md) | Extension and Skill specification |
| [skills/anchorscope/SKILL.md](skills/anchorscope/SKILL.md) | LLM-facing usage guide |

## Legacy (v1.x)

The previous version of this package (based on AnchorScope v1.x concepts
including Anchor Buffer, True ID, and multi-level anchoring) is archived
in the [v1/](v1/) directory.

## Status

v2.0.0 — Active development.

## License

MIT License
