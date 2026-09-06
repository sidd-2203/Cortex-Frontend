// TEMPORARY DUPLICATE — source of truth is cortex-backend/src/contracts/.
// See content-blocks.ts for why this is copied verbatim rather than shared.

import { z } from "zod";
import { AttachmentTypeSchema } from "./content-blocks";

export const CreateUploadRequestSchema = z.object({
  type: AttachmentTypeSchema,
  filename: z.string().min(1).max(255),
});
export type CreateUploadRequest = z.infer<typeof CreateUploadRequestSchema>;

export const CreateUploadResponseSchema = z.object({
  attachmentId: z.string(),
  tusEndpoint: z.string(),
  assemblyUrl: z.string(),
});
export type CreateUploadResponse = z.infer<typeof CreateUploadResponseSchema>;

export const AttachmentStatusSchema = z.enum(["UPLOADING", "READY", "FAILED"]);

export const AttachmentSchema = z.object({
  id: z.string(),
  type: AttachmentTypeSchema,
  status: AttachmentStatusSchema,
  url: z.string().nullable(),
  error: z.string().nullable(),
});
export type Attachment = z.infer<typeof AttachmentSchema>;
