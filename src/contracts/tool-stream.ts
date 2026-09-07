// TEMPORARY DUPLICATE — source of truth is cortex-backend/src/contracts/.
// See content-blocks.ts for why this is copied verbatim rather than shared.

import { z } from "zod";
import { ToolUseBlockSchema, ToolResultBlockSchema } from "./content-blocks";

// The wire shape read off Trigger.dev's "tool" Realtime stream (see
// agent-turn.ts on the backend) — transport-only, never persisted. Reuses
// ToolUseBlock/ToolResultBlock rather than a parallel shape, so a live tool
// call renders with the exact same component a persisted one does.
export const ToolStreamEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("started"), block: ToolUseBlockSchema }),
  z.object({ kind: z.literal("finished"), block: ToolUseBlockSchema, result: ToolResultBlockSchema }),
  // The run has parked on an approval waitpoint and is going nowhere until
  // someone answers. `token` is what gets POSTed back to
  // /api/waitpoints/[token]/resolve.
  z.object({
    kind: z.literal("approval_required"),
    token: z.string(),
    toolUseId: z.string(),
    toolName: z.string(),
    input: z.unknown(),
    cost: z.number(),
    expiresAt: z.string(),
  }),
  // The same waitpoint stopped being pending — answered here, answered in
  // another tab, denied by a cancellation, or expired.
  z.object({
    kind: z.literal("approval_resolved"),
    token: z.string(),
    approved: z.boolean(),
  }),
]);
export type ToolStreamEvent = z.infer<typeof ToolStreamEventSchema>;

export type ApprovalRequiredEvent = Extract<ToolStreamEvent, { kind: "approval_required" }>;
