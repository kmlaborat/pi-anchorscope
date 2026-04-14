import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default function (pi: ExtensionAPI) {
  // Register the anchorscope tool
  pi.registerTool({
    name: "anchorscope",
    label: "AnchorScope",
    description: "Execute AnchorScope commands to manage anchored code edits. Supports read, write, pipe, paths, and label subcommands.",
    promptSnippet: "Execute AnchorScope commands for deterministic code edits",
    promptGuidelines: [
      "Use this tool when you need to perform anchored code edits following the AnchorScope protocol.",
      "This tool provides subcommands: read, write, pipe, paths, label for managing anchor buffers.",
      "Always use this tool instead of manually simulating anchor operations with bash or other tools."
    ],
    parameters: Type.Object({
      command: Type.String({
        description: "AnchorScope command: 'read', 'write', 'pipe', 'paths', or 'label'"
      }),
      args: Type.Array(Type.String(), {
        description: "Command arguments (e.g., ['--true-id', 'abc123...'])"
      }),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const { command, args } = params;
      const fullCommand = `anchorscope ${command} ${args.join(" ")}`;

      if (onUpdate) {
        onUpdate({ content: [{ type: "text", text: `Executing: ${fullCommand}` }] });
      }

      // Execute the command
      const result = await ctx.exec("anchorscope", [command, ...args], {
        signal,
        cwd: ctx.cwd,
      });

      if (result.killed) {
        return {
          content: [{ type: "text", text: "Command was cancelled" }],
          details: { exitCode: null, cancelled: true },
        };
      }

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
