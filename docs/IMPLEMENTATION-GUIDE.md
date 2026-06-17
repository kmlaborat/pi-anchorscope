# pi-anchorscope Extension Implementation Guide

## Overview

This guide explains how to implement custom tools for pi that execute external CLI commands (like `anchorscope`) using the pi Extension API.

## Core Principle

**Use `pi.exec()` from ExtensionAPI, NOT `ctx.exec()` from ExtensionContext.**

The `exec` method is available on `pi` (ExtensionAPI), not on `ctx` (ExtensionContext).

### Why This Matters

| Location | Available Method | Purpose |
|----------|-----------------|---------|
| Extension constructor (`pi: ExtensionAPI`) | `pi.exec(command, args, options)` | Execute external commands |
| Event handlers (`ctx: ExtensionContext`) | NO `exec` method | Access session state, UI, control flow |

## Tool Naming Convention

### ✅ Accepted Formats

| Format | Example | Status |
|--------|---------|--------|
| Snake case | `as_read`, `as_write` | ✅ Recommended |
| Hyphen case | `as-read`, `as-write` | ⚠️ Possible |
| Dot notation | `as.read` | ❌ Avoid |

### Why Avoid Dots?

1. **Property access confusion**: `object.as.read` could be misinterpreted
2. **Tool name collision**: May conflict with nested tool calls in some contexts
3. **Inconsistent with built-ins**: pi's built-in tools use snake_case (`read`, `bash`, `edit`, `write`)

### Current Implementation

```typescript
// ✅ CORRECT - Using snake_case
pi.registerTool({ name: "as_read", ... });
pi.registerTool({ name: "as_write", ... });
pi.registerTool({ name: "as_pipe", ... });
pi.registerTool({ name: "as_paths", ... });
pi.registerTool({ name: "as_label", ... });
```
```

## Key Implementation Details

### 1. ExtensionAPI exec() Signature

```typescript
pi.exec(command: string, args: string[], options?: ExecOptions): Promise<ExecResult>
```

- `command`: The executable name (e.g., `"anchorscope"`)
- `args`: Array of arguments (e.g., `["read", "--file", "path.ts"]`)
- `options`: 
  - `signal`: AbortSignal for cancellation
  - `cwd`: Current working directory
  - `timeout?`: Optional timeout in milliseconds

### 2. Result Object Structure

```typescript
interface ExecResult {
  stdout: string;    // Standard output
  stderr: string;    // Standard error
  code: number;      // Exit code
  killed: boolean;   // Whether process was killed
}
```

### 3. Windows Native Compatibility

✅ **Works on Windows natively** - no `bash -c` wrapper needed

```typescript
// ❌ DON'T DO THIS (bash-specific, Windows incompatible)
const result = await pi.exec("bash", ["-c", "anchorscope read ..."], { ... });

// ✅ DO THIS (cross-platform)
const result = await pi.exec("anchorscope", ["read", ...args], { ... });
```

### 4. Argument Passing Pattern

When registering a tool for `anchorscope read`:

```typescript
// Tool parameter
args: ["--file", "src/main.ts", "--anchor", "fn main()"]

// pi.exec call
pi.exec("anchorscope", ["read", ...args], { ... })

// Actual command executed
// anchorscope read --file src/main.ts --anchor "fn main()"
```

## Complete Example: Multiple Tools

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default function (pi: ExtensionAPI) {
  // as_read tool
  pi.registerTool({
    name: "as_read",
    label: "AnchorScope Read",
    description: "Execute 'anchorscope read' for deterministic code reading.",
    parameters: Type.Object({
      args: Type.Array(Type.String(), {
        description: "Arguments for anchorscope read"
      }),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const result = await pi.exec("anchorscope", ["read", ...params.args], {
        signal,
        cwd: ctx.cwd,
      });

      return {
        content: [{ type: "text", text: result.stdout || "" }],
        details: {
          exitCode: result.code,
          stderr: result.stderr || "",
          stdout: result.stdout || "",
        },
      };
    },
  });

  // as_write tool
  pi.registerTool({
    name: "as_write",
    label: "AnchorScope Write",
    description: "Execute 'anchorscope write' for deterministic code writing.",
    parameters: Type.Object({
      args: Type.Array(Type.String(), {
        description: "Arguments for anchorscope write"
      }),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const result = await pi.exec("anchorscope", ["write", ...params.args], {
        signal,
        cwd: ctx.cwd,
      });

      return {
        content: [{ type: "text", text: result.stdout || "" }],
        details: {
          exitCode: result.code,
          stderr: result.stderr || "",
          stdout: result.stdout || "",
        },
      };
    },
  });

  // ... additional tools (as_pipe, as_paths, as_label)
}
```

## Troubleshooting

### Problem: "Unknown tool" error

**Cause:** Extension not loaded or failed to load

**Solution:**
1. Check extension is in correct location (`~/.pi/agent/extensions/` or `.pi/extensions/`)
2. Verify syntax with `pi -e ./your-extension.ts`
3. Check console for error messages

### Problem: "Command not found" error

**Cause:** External executable not in PATH

**Solution:**
1. Verify `anchorscope` is installed and in PATH
2. Test: `which anchorscope` (Linux/macOS) or `where anchorscope` (Windows)
3. Use absolute path if needed: `pi.exec("C:/path/to/anchorscope", [...])`

### Problem: Cross-platform issues

**Cause:** Assuming bash shell is available

**Solution:** 
- Use `pi.exec()` directly - it handles platform differences
- Don't wrap with `bash -c` or `cmd /c`
- The pi runtime handles shell invocation

## Testing

### Test Extension Loading

```bash
# Test with explicit extension path
pi -e ./extensions/anchorscope-tools.ts

# Test with print mode
pi -p -e ./extensions/anchorscope-tools.ts "Test prompt"
```

### Test Tool Execution

```bash
# Check available tools
pi --help  # Should show your tools in the description

# Verify extension loads
pi -e ./extensions/anchorscope-tools.ts
# Then check: /reload to reload extensions
```

## File Structure

```
project/
├── .pi/
│   └── extensions/
│       └── anchorscope-tools.ts    # Main extension file
├── extensions/
│   └── anchorscope-tools.ts        # Alternative location (project-local)
└── docs/
    └── IMPLEMENTATION-GUIDE.md     # This file
```

## References

- [pi Extensions Documentation](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md)
- [Extension API Types](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/dist/core/extensions/types.d.ts)
- [Example Extensions](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions)

## Key Takeaways

1. ✅ Use `pi.exec()` from ExtensionAPI constructor
2. ✅ No `bash -c` wrapper needed - Windows native
3. ✅ Arguments passed as array: `["command", ...args]`
4. ✅ `ctx` doesn't have `exec` - only `pi` does
5. ✅ Result has `stdout`, `stderr`, `code`, `killed`
