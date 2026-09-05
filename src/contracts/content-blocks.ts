// TEMPORARY DUPLICATE — source of truth is cortex-backend/src/contracts/.
// Two separate repos, no monorepo, so there's no shared workspace package
// yet. Copied verbatim rather than hand-retyped so it can't drift silently;
// to be replaced by a published/generated client once core flows are proven.
// If you're editing this file, edit the backend copy first and re-copy.

import { z } from "zod";

// Ordered content blocks that make up a Message.content array. This is the
// single shape both persistence (JSONB) and realtime streaming speak — the
// frontend never redefines this, it imports the inferred types below.

export const TextBlockSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

export const ThinkingBlockSchema = z.object({
  type: z.literal("thinking"),
  text: z.string(),
});

export const ToolUseBlockSchema = z.object({
  type: z.literal("tool_use"),
  id: z.string(), // stable id, referenced by the matching tool_result block
  toolName: z.string(),
  input: z.unknown(),
});

export const ToolResultBlockSchema = z.object({
  type: z.literal("tool_result"),
  toolUseId: z.string(),
  output: z.unknown(),
  isError: z.boolean().default(false),
});

export const CitationBlockSchema = z.object({
  type: z.literal("citation"),
  text: z.string(),
  source: z.string(),
});

export const ContentBlockSchema = z.discriminatedUnion("type", [
  TextBlockSchema,
  ThinkingBlockSchema,
  ToolUseBlockSchema,
  ToolResultBlockSchema,
  CitationBlockSchema,
]);

export const MessageContentSchema = z.array(ContentBlockSchema);

export type TextBlock = z.infer<typeof TextBlockSchema>;
export type ThinkingBlock = z.infer<typeof ThinkingBlockSchema>;
export type ToolUseBlock = z.infer<typeof ToolUseBlockSchema>;
export type ToolResultBlock = z.infer<typeof ToolResultBlockSchema>;
export type CitationBlock = z.infer<typeof CitationBlockSchema>;
export type ContentBlock = z.infer<typeof ContentBlockSchema>;
export type MessageContent = z.infer<typeof MessageContentSchema>;
