# pi-anchorscope

**Skills for [pi](https://github.com/badlogic/pi-mono) to use the [AnchorScope](https://github.com/kmlaborat/AnchorScope) protocol.**

This project provides the skill implementation that brings the AnchorScope protocol to the pi coding agent. It enables deterministic, safe, and reproducible code editing by enforcing anchored scopes, true IDs, and hash verification.

> **Note:** This is the **pi skill implementation** of the AnchorScope protocol. For the protocol specification, see [kmlaborat/AnchorScope](https://github.com/kmlaborat/AnchorScope).

## Documentation

This package includes the following skills:

| Skill | Purpose |
|-------|---------|
| `/skill:anchorscope-core` | Main workflow coordinator |
| `/skill:anchorscope-anchoring-guide` | Practical anchoring strategies |
| `/skill:anchorscope-tutorial` | Full CLI protocol reference |
| `/skill:anchorscope-scope-anchoring` | Step-by-step anchoring algorithm |
| `/skill:anchorscope-decomposer` | Single-phase SCOPED workflow |
| `/skill:anchorscope-proposer` | Single-phase DRAFTED workflow |
| `/skill:anchorscope-validator` | Single-phase REVIEWING workflow |
| `/skill:anchorscope-integrator` | Single-phase COMMITTED workflow |
| `/skill:anchorscope-buffer-reader` | Read Anchor Buffer state |

For detailed anchoring guidance, see `/skill:anchorscope-anchoring-guide`.

## Extensions

This project includes the `anchorscope-tools` extension that registers the following tools for use with pi:

| Tool | Purpose |
|------|---------|
| `as_read` | Execute `anchorscope read` for deterministic code reading |
| `as_write` | Execute `anchorscope write` for deterministic code writing |
| `as_pipe` | Execute `anchorscope pipe` for external tool integration |
| `as_paths` | Execute `anchorscope paths` for buffer path debugging |
| `as_label` | Execute `anchorscope label` for human-readable aliases |

**Important:** The extension uses `pi.exec()` from ExtensionAPI (NOT `ctx.exec()` from ExtensionContext). See `docs/IMPLEMENTATION-GUIDE.md` for details.

## Install

```bash
pi install git:github.com/kmlaborat/pi-anchorscope
```

## Usage

Activate AnchorScope with one slash command:

```
/skill:anchorscope-core
```

Once loaded, all code edits in the session follow the AnchorScope protocol. To stop, clear the context.

### Tool Selection Strategy

| Purpose | Recommended Tool | Reason |
|---------|------------------|--------|
| Quick file structure check | `read` | Fast, no anchoring overhead |
| Finding anchor candidates | `read` | Exploratory, not yet deterministic |
| Setting anchors | `as_read` | Deterministic, with `scope_hash`/`true_id` |
| Actual edits | `as_write` | Hash-verified, atomic |
| Debugging buffers | `as_paths` | Inspect buffer locations |

**Rule of thumb:**
- Use `read` when you just need to **look around** (exploration phase)
- Use `as_read` when you need to **set an anchor and start editing** (deterministic phase)
- Use `as_write` for any actual code modification

## Why AnchorScope

LLM code editors have four systemic failure modes:

| Failure | AnchorScope solution |
|---|---|
| Context loss | Anchored Scope — minimal, precise context only |
| Wrong edits | True ID — uniquely identifies the target region |
| Lost state | Anchor Buffer — persists task state externally |
| Non-determinism | Hash Verification — integrity check before every write |

**Governing principle: No Match, No Hash, No Write.**

## Skills

| Skill | Role | Invoke |
|---|---|---|
| **anchorscope-core** | Entry point. Runs full workflow in single-agent mode | `/skill:anchorscope-core` |
| **anchorscope-scope-anchoring** | Step-by-step algorithm for extracting a unique Anchored Scope | `/skill:anchorscope-scope-anchoring` |
| **anchorscope-buffer-reader** | Read and interpret an Anchor Buffer to resume or continue a task | `/skill:anchorscope-buffer-reader` |
| **anchorscope-decomposer** | SCOPED phase — extract anchored scope and compute True ID | `/skill:anchorscope-decomposer` |
| **anchorscope-proposer** | DRAFTED phase — generate minimal code modification | `/skill:anchorscope-proposer` |
| **anchorscope-validator** | REVIEWING phase — validate and approve or reject | `/skill:anchorscope-validator` |
| **anchorscope-integrator** | COMMITTED phase — final hash check and atomic write | `/skill:anchorscope-integrator` |

## State Machine

```
DISCOVERED → SCOPED → DRAFTED → REVIEWING → APPROVED → COMMITTED
                                     ↓
                                 REJECTED → DRAFTED (retry)
```

## Single-Agent vs Multi-Agent

`anchorscope-core` runs the full workflow by itself. When your coding agent supports subagent dispatch, individual phases can be delegated to their dedicated skills. The protocol is the same either way — the agent decides how to execute it.

## Context Persistence

Each skill cross-references the next via `/skill:name`. After context compaction, any reference to an anchorscope skill keeps the chain alive. Clearing context ends the session.

---

## Attribution
Skill format and structure adapted from [pi-superpowers](https://github.com/coctostan/pi-superpowers) by coctostan, itself adapted from [Superpowers](https://github.com/obra/superpowers) by Jesse Vincent, licensed under MIT.

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for the full text.

---

### Disclaimer

**THE SOFTWARE IS PROVIDED "AS IS"**, without warranty of any kind. As this is a reference implementation of a file-editing protocol, the author is not responsible for any data loss or unintended file modifications resulting from its use. Always use version control and test in a safe environment.

Copyright (c) 2026 kmlaborat
