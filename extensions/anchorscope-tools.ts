import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default function (pi: ExtensionAPI) {
  // Register as_read tool
  pi.registerTool({
    name: "as_read",
    label: "AnchorScope Read",
    description: "Execute 'anchorscope read' for deterministic code reading with True ID verification. Reads code with anchored scope and True ID hash verification - use this instead of standard read.",
    promptSnippet: "AnchorScope read tool",
    promptGuidelines: [
      "Use as_read for ALL code reading when AnchorScope protocol is active.",
      "Do NOT use standard 'read' tool - it doesn't provide anchored scope or True ID hash verification.",
      "as_read outputs scope_hash and ture_id in the console - these markers distinguish it from standard read."
    ],
    parameters: Type.Object({
      args: Type.Array(Type.String(), {
        description: "Arguments for anchorscope read command (e.g., ['--file', 'path.ts', '--anchor', 'pattern'])"
      }),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const fullCommand = `anchorscope read ${params.args.join(" ")}`;

      if (onUpdate) {
        onUpdate({ content: [{ type: "text", text: `Executing: ${fullCommand}` }] });
      }

      const result = await ctx.exec("anchorscope", ["read", ...params.args], {
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

  // Register as_write tool
  pi.registerTool({
    name: "as_write",
    label: "AnchorScope Write",
    description: "Execute 'anchorscope write' for deterministic code writing with hash verification. Writes code with anchored scope and hash verification - use this instead of standard write.",
    promptSnippet: "AnchorScope write tool",
    promptGuidelines: [
      "Use as_write for ALL code writing when AnchorScope protocol is active.",
      "Do NOT use standard 'write' tool - it doesn't provide anchored scope or hash verification.",
      "as_write requires --expected-hash parameter - this ensures deterministic, reproducible edits."
    ],
    parameters: Type.Object({
      args: Type.Array(Type.String(), {
        description: "Arguments for anchorscope write command (e.g., ['--file', 'path.ts', '--anchor', 'pattern', '--expected-hash', 'hash', '--replacement', 'new_content'])"
      }),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const fullCommand = `anchorscope write ${params.args.join(" ")}`;

      if (onUpdate) {
        onUpdate({ content: [{ type: "text", text: `Executing: ${fullCommand}` }] });
      }

      const result = await ctx.exec("anchorscope", ["write", ...params.args], {
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

  // Register as_pipe tool
  pi.registerTool({
    name: "as_pipe",
    label: "AnchorScope Pipe",
    description: "Execute 'anchorscope pipe' for integrating external tools with anchored scope. Pipes anchored code to external tools and receives processed output.",
    promptSnippet: "AnchorScope pipe tool",
    promptGuidelines: [
      "Use as_pipe when integrating external tools with AnchorScope protocol.",
      "as_pipe enables the pipe mode - use --true-id with external tool processing."
    ],
    parameters: Type.Object({
      args: Type.Array(Type.String(), {
        description: "Arguments for anchorscope pipe command (e.g., ['--true-id', 'id', '--out'] or ['--true-id', 'id', '--in'])"
      }),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const fullCommand = `anchorscope pipe ${params.args.join(" ")}`;

      if (onUpdate) {
        onUpdate({ content: [{ type: "text", text: `Executing: ${fullCommand}` }] });
      }

      const result = await ctx.exec("anchorscope", ["pipe", ...params.args], {
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

  // Register as_paths tool
  pi.registerTool({
    name: "as_paths",
    label: "AnchorScope Paths",
    description: "Execute 'anchorscope paths' for getting buffer file paths. Returns absolute paths of content and replacement for debugging.",
    promptSnippet: "AnchorScope paths tool",
    promptGuidelines: [
      "Use as_paths to get buffer file paths for debugging or external tool integration.",
      "as_paths helps you understand where AnchorScope stores its state."
    ],
    parameters: Type.Object({
      args: Type.Array(Type.String(), {
        description: "Arguments for anchorscope paths command (e.g., ['--true-id', 'id'])"
      }),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const fullCommand = `anchorscope paths ${params.args.join(" ")}`;

      if (onUpdate) {
        onUpdate({ content: [{ type: "text", text: `Executing: ${fullCommand}` }] });
      }

      const result = await ctx.exec("anchorscope", ["paths", ...params.args], {
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

  // Register as_label tool
  pi.registerTool({
    name: "as_label",
    label: "AnchorScope Label",
    description: "Execute 'anchorscope label' for assigning human-readable aliases to True IDs. Creates memorable names for Easy reference.",
    promptSnippet: "AnchorScope label tool",
    promptGuidelines: [
      "Use as_label to assign human-readable aliases to True IDs for easier reference.",
      "as_label helps you use memorable names instead of hex hashes."
    ],
    parameters: Type.Object({
      args: Type.Array(Type.String(), {
        description: "Arguments for anchorscope label command (e.g., ['--name', 'alias', '--true-id', 'id'])"
      }),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const fullCommand = `anchorscope label ${params.args.join(" ")}`;

      if (onUpdate) {
        onUpdate({ content: [{ type: "text", text: `Executing: ${fullCommand}` }] });
      }

      const result = await ctx.exec("anchorscope", ["label", ...params.args], {
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
}
