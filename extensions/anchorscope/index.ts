/**
 * AnchorScope Extension for pi
 *
 * Registers anchorscope_read, anchorscope_write, and anchorscope_apply tools
 * that call the anchorscope CLI binary for hash-verified scoped file editing.
 *
 * anchorscope_apply is the recommended high-level API — it combines read + write
 * internally so the LLM only needs to specify anchor and content.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { resolve, isAbsolute as pathIsAbsolute } from "node:path";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";

// Resolve the anchorscope binary path
function getAnchorscopeBin(): string {
  return process.env.ANCHORSCOPE_BIN ?? "anchorscope";
}

/**
 * Normalize a file path for the native anchorscope binary.
 *
 * On Windows, paths like "/tmp/file.rs" (Git Bash / Cygwin / MSYS2 mount style)
 * are not understood by native Windows binaries. Node.js treats "/tmp/..."
 * as "C:\\tmp\\..." which is a different location from the bash-mount temp dir.
 *
 * Strategy:
 * 1. If it looks like a Windows absolute path (C:\\...), pass through.
 * 2. If it starts with "/", try `cygpath -w` to translate the mount prefix
 *    (e.g. /tmp → C:\Users\...\AppData\Local\Temp).
 * 3. Otherwise treat it as a relative path and resolve against cwd.
 * 4. In all cases verify with existsSync; fall back to the original path
 *    so anchorscope can surface its own error message.
 */
function resolveFilePath(filePath: string, cwd: string): string {
  // Windows absolute path (e.g. C:\foo\bar.rs) — pass through
  if (pathIsAbsolute(filePath) && /^[a-zA-Z]:\\/.test(filePath)) {
    return filePath;
  }

  let resolved: string;

  // Looks like a Unix-style absolute path (/tmp/..., /home/..., etc.)
  if (filePath.startsWith("/")) {
    try {
      // Use cygpath -w to translate mount-aware paths to Windows native format.
      // Available in Git Bash, MSYS2, Cygwin environments on Windows.
      resolved = execSync("cygpath -w '" + filePath.replace(/'/g, "'\"'\"'") + "'", {
        shell: true,
      })
        .toString()
        .trim();
    } catch {
      // cygpath not available — fall through to relative resolution
      resolved = resolve(cwd, filePath);
    }
  } else {
    // Relative path — resolve against cwd
    resolved = resolve(cwd, filePath);
  }

  // Verify the file exists at the resolved location
  if (existsSync(resolved)) {
    return resolved;
  }

  // Fall back to the original path so anchorscope can report its own error
  return filePath;
}

// Parse "scope_hash=<hex>\ncontent=<text>" from stdout
function parseReadOutput(stdout: string): { scopeHash: string; content: string } {
  const hashMatch = stdout.match(/^scope_hash=(.+)$/m);
  const contentMatch = stdout.match(/^content=(.*)$/m);

  if (!hashMatch) {
    throw new Error(`anchorscope_read: could not parse scope_hash from output`);
  }
  if (!contentMatch) {
    throw new Error(`anchorscope_read: could not parse content from output`);
  }

  return {
    scopeHash: hashMatch[1].trim(),
    content: contentMatch[1],
  };
}

export default function (pi: ExtensionAPI) {
  const bin = getAnchorscopeBin();

  // ---------------------------------------------------------------------------
  // Tool 1: anchorscope_read
  // ---------------------------------------------------------------------------
  pi.registerTool({
    name: "anchorscope_read",
    label: "AnchorScope Read",
    description:
      "Read a file scope using an exact anchor string. Returns scope_hash and matched content. Use this instead of the built-in read tool when you need hash-verified targeted reading.",
    promptSnippet:
      "Read a targeted scope from a file with hash verification",
    promptGuidelines: [
      "This is a low-level API. Use anchorscope_apply instead for most file edits.",
      "Use anchorscope_read only when you need to inspect a scope before deciding what to change.",
      "anchorscope_read returns scope_hash which is required for anchorscope_write.",
    ],
    parameters: Type.Object({
      file: Type.String({
        description: "Absolute or relative path to the file",
      }),
      anchor: Type.String({
        description:
          "Exact byte sequence to match in the file. Must be unique within the file.",
      }),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const filePath = resolveFilePath(params.file, ctx.cwd);

      const result = await pi.exec(bin, ["read", "--file", filePath, "--anchor", params.anchor], {
        signal,
      });

      // Check for error output
      if (result.code !== 0) {
        const output = result.stderr || result.stdout || "";
        if (output.includes("NO_MATCH")) {
          throw new Error(`anchorscope_read: NO_MATCH — the anchor was not found in the file`);
        }
        if (output.includes("MULTIPLE_MATCHES")) {
          throw new Error(
            `anchorscope_read: MULTIPLE_MATCHES — the anchor matched more than once. Use a more specific anchor.`,
          );
        }
        throw new Error(
          `anchorscope_read failed (exit ${result.code}): ${output.trim()}`,
        );
      }

      const parsed = parseReadOutput(result.stdout);

      return {
        content: [
          {
            type: "text",
            text: [
              `scope_hash: ${parsed.scopeHash}`,
              ``,
              `Matched content:`,
              "```",
              parsed.content,
              "```",
            ].join("\n"),
          },
        ],
        details: {
          scopeHash: parsed.scopeHash,
          file: filePath,
          anchor: params.anchor,
        },
      };
    },
  });

  // ---------------------------------------------------------------------------
  // Tool 2: anchorscope_write
  // ---------------------------------------------------------------------------
  pi.registerTool({
    name: "anchorscope_write",
    label: "AnchorScope Write",
    description:
      "Write a replacement to a file scope identified by an anchor string. Requires scope_hash from a prior anchorscope_read call. Use this instead of the built-in edit/write tools for hash-verified targeted edits.",
    promptSnippet:
      "Write a targeted replacement to a file with hash verification",
    promptGuidelines: [
      "This is a low-level API. Use anchorscope_apply instead for most file edits.",
      "Use anchorscope_write only when you already have a scope_hash from a prior anchorscope_read.",
      "Always use the scope_hash returned by anchorscope_read as expected_hash.",
      "Never invent or guess scope_hash. It must come from anchorscope_read.",
    ],
    parameters: Type.Object({
      file: Type.String({
        description: "Absolute or relative path to the file",
      }),
      anchor: Type.String({
        description: "The same anchor string used in anchorscope_read",
      }),
      expected_hash: Type.String({
        description: "scope_hash returned by anchorscope_read",
      }),
      replacement: Type.String({
        description: "New content to replace the matched scope",
      }),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const filePath = resolveFilePath(params.file, ctx.cwd);

      return withFileMutationQueue(filePath, async () => {
        const result = await pi.exec(
          bin,
          [
            "write",
            "--file",
            filePath,
            "--anchor",
            params.anchor,
            "--expected-hash",
            params.expected_hash,
            "--replacement",
            params.replacement,
          ],
          { signal },
        );

        // Check for error output
        if (result.code !== 0) {
          const output = result.stderr || result.stdout || "";
          if (output.includes("HASH_MISMATCH")) {
            throw new Error(
              `anchorscope_write: HASH_MISMATCH — the file content has changed since the last anchorscope_read. Re-read the file to get a fresh scope_hash.`,
            );
          }
          if (output.includes("NO_MATCH")) {
            throw new Error(
              `anchorscope_write: NO_MATCH — the anchor was not found in the file`,
            );
          }
          throw new Error(
            `anchorscope_write failed (exit ${result.code}): ${output.trim()}`,
          );
        }

        return {
          content: [
            {
              type: "text",
              text: `Successfully wrote to ${params.file} (${result.stdout.trim()})`,
            },
          ],
          details: {
            file: filePath,
            expectedHash: params.expected_hash,
          },
        };
      });
    },
  });

  // ---------------------------------------------------------------------------
  // Tool 3: anchorscope_apply (high-level API)
  // ---------------------------------------------------------------------------
  pi.registerTool({
    name: "anchorscope_apply",
    label: "AnchorScope Apply",
    description:
      "Apply a targeted edit to a file using an exact anchor string. Internally performs read (to get scope_hash) then write (with hash verification). Use this as the primary tool for all file edits.",
    promptSnippet:
      "Apply a targeted, hash-verified edit to a specific scope in a file",
    promptGuidelines: [
      "Use anchorscope_apply for ALL file edits instead of the built-in edit or write tools.",
      "anchor must be an exact byte sequence that appears exactly once in the file.",
      "content is the complete replacement for the matched anchor scope.",
      "If NO_MATCH is returned, the anchor does not exist — check the file and revise the anchor.",
      "If MULTIPLE_MATCHES is returned, the anchor is not unique — use a longer anchor string.",
    ],
    parameters: Type.Object({
      file: Type.String({
        description: "Path to the file to edit",
      }),
      anchor: Type.String({
        description:
          "Exact text to match in the file. Must appear exactly once.",
      }),
      content: Type.String({
        description: "Complete replacement for the matched anchor scope.",
      }),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const filePath = resolve(ctx.cwd, params.file);

      // Step 1: read → get scope_hash
      const readResult = await pi.exec(
        bin,
        ["read", "--file", filePath, "--anchor", params.anchor],
        { signal },
      );

      if (readResult.code !== 0) {
        const output = readResult.stderr || readResult.stdout || "";
        if (output.includes("NO_MATCH")) {
          throw new Error(
            `anchorscope_apply: NO_MATCH — the anchor was not found in the file. Check the file contents and revise the anchor.`,
          );
        }
        if (output.includes("MULTIPLE_MATCHES")) {
          throw new Error(
            `anchorscope_apply: MULTIPLE_MATCHES — the anchor matched more than once. Use a longer, more specific anchor string.`,
          );
        }
        throw new Error(
          `anchorscope_apply read failed (exit ${readResult.code}): ${output.trim()}`,
        );
      }

      const parsed = parseReadOutput(readResult.stdout);
      const scopeHash = parsed.scopeHash;

      // Step 2: write → hash-verified write
      return withFileMutationQueue(filePath, async () => {
        const writeResult = await pi.exec(
          bin,
          [
            "write",
            "--file",
            filePath,
            "--anchor",
            params.anchor,
            "--expected-hash",
            scopeHash,
            "--replacement",
            params.content,
          ],
          { signal },
        );

        if (writeResult.code !== 0) {
          const output = writeResult.stderr || writeResult.stdout || "";
          if (output.includes("HASH_MISMATCH")) {
            throw new Error(
              `anchorscope_apply: HASH_MISMATCH — the file content has changed since the read step. Retry the apply.`
            );
          }
          if (output.includes("NO_MATCH")) {
            throw new Error(
              `anchorscope_apply: NO_MATCH — the anchor was not found during write`,
            );
          }
          throw new Error(
            `anchorscope_apply write failed (exit ${writeResult.code}): ${output.trim()}`,
          );
        }

        return {
          content: [
            {
              type: "text",
              text: `Successfully applied edit to ${params.file}\n${writeResult.stdout.trim()}`,
            },
          ],
          details: {
            file: filePath,
            scope_hash: scopeHash,
          },
        };
      });
    },
  });
}
