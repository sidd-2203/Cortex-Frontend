// TEMPORARY DUPLICATE — source of truth is cortex-backend/src/contracts/.
// See content-blocks.ts for why this is copied verbatim rather than shared.

import { z } from "zod";

export const ResolveWaitpointRequestSchema = z.object({
  approved: z.boolean(),
  /**
   * "Approve this and stop asking for the rest of this turn." Only
   * meaningful alongside approved: true — the run carries it as in-memory
   * state for the remainder of its own loop, so it never outlives the turn
   * it was granted in.
   */
  approveAll: z.boolean().optional(),
  comment: z.string().max(500).optional(),
});
export type ResolveWaitpointRequest = z.infer<typeof ResolveWaitpointRequestSchema>;

export const WaitpointStatusSchema = z.enum(["PENDING", "RESOLVED", "EXPIRED"]);

export const ResolveWaitpointResponseSchema = z.object({
  status: WaitpointStatusSchema,
});
export type ResolveWaitpointResponse = z.infer<typeof ResolveWaitpointResponseSchema>;
