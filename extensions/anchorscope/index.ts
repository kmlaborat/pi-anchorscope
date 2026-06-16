/**
 * AnchorScope Extension for pi
 *
 * Registers anchorscope_read and anchorscope_write tools that call the
 * anchorscope CLI binary for hash-verified scoped file editing.
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
      "Use anchorscope_read when you need to read a specific part of a file before editing it.",
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
      "Use anchorscope_write after anchorscope_read to apply a targeted edit.",
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
}
