# anchorscope-skills

Deterministic code editing skills for [pi](https://github.com/badlogic/pi-mono), implementing the AnchorScope protocol.

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

## License

MIT
