// TEMPORARY DUPLICATE — source of truth is cortex-backend/src/contracts/.
// See content-blocks.ts for why this is copied verbatim rather than shared.

import { z } from "zod";

export const ApiKeySummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  keyPrefix: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
});
export type ApiKeySummary = z.infer<typeof ApiKeySummarySchema>;

export const ListApiKeysResponseSchema = z.object({
  items: z.array(ApiKeySummarySchema),
});
export type ListApiKeysResponse = z.infer<typeof ListApiKeysResponseSchema>;

export const CreateApiKeyRequestSchema = z.object({
  name: z.string().min(1).max(100),
});
export type CreateApiKeyRequest = z.infer<typeof CreateApiKeyRequestSchema>;

/** `key` is the full secret — present only in this one response, never again after it. */
export const CreateApiKeyResponseSchema = ApiKeySummarySchema.extend({
  key: z.string(),
});
export type CreateApiKeyResponse = z.infer<typeof CreateApiKeyResponseSchema>;
