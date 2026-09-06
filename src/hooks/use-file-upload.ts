"use client";

import { useCallback, useRef, useState } from "react";
import { Upload as TusUpload } from "tus-js-client";
import { useAuth } from "@clerk/nextjs";
import { createUpload, getUploadStatus } from "@/lib/api-client";
import type { AttachmentType } from "@/contracts/content-blocks";

export interface PendingAttachment {
  /** Local-only id until the attachment record exists; then the real attachmentId. */
  id: string;
  file: File;
  status: "uploading" | "ready" | "error";
  progress: number; // 0-1
  error?: string;
}

const STATUS_POLL_INTERVAL_MS = 1500;

function attachmentTypeFor(file: File): AttachmentType {
  if (file.type.startsWith("image/")) return "IMAGE";
  if (file.type.startsWith("video/")) return "VIDEO";
  if (file.type.startsWith("audio/")) return "AUDIO";
  if (file.type === "application/pdf" || file.type.startsWith("text/")) return "DOCUMENT";
  return "OTHER";
}

/**
 * Drives a direct-to-Transloadit upload for one file: create an Assembly via
 * our backend, tus-upload the bytes straight to Transloadit (never through
 * our backend — that's what keeps large files off Vercel's function
 * limits), then poll our backend until Transloadit's processing settles.
 */
export function useFileUpload() {
  const { getToken } = useAuth();
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  // Keyed by the local pending id, so removeAttachment can abort an
  // in-flight tus upload rather than leaving it running unobserved.
  const uploadsRef = useRef(new Map<string, TusUpload>());

  const updatePending = useCallback((id: string, patch: Partial<PendingAttachment>) => {
    setPending((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const pollUntilSettled = useCallback(
    async (localId: string, attachmentId: string) => {
      const token = await getToken();
      for (;;) {
        const attachment = await getUploadStatus(token, attachmentId);
        if (attachment.status === "READY") {
          updatePending(localId, { status: "ready", progress: 1 });
          return;
        }
        if (attachment.status === "FAILED") {
          updatePending(localId, { status: "error", error: attachment.error ?? "Upload processing failed" });
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_INTERVAL_MS));
      }
    },
    [getToken, updatePending],
  );

  const addFile = useCallback(
    async (file: File) => {
      const localId = crypto.randomUUID();
      setPending((prev) => [...prev, { id: localId, file, status: "uploading", progress: 0 }]);

      try {
        const token = await getToken();
        const { attachmentId, tusEndpoint, assemblyUrl } = await createUpload(token, {
          type: attachmentTypeFor(file),
          filename: file.name,
        });
        // From here on, the pending entry's `id` tracks the real
        // attachmentId — that's what send-turn needs to reference it.
        setPending((prev) => prev.map((p) => (p.id === localId ? { ...p, id: attachmentId } : p)));

        const upload = new TusUpload(file, {
          endpoint: tusEndpoint,
          metadata: { assembly_url: assemblyUrl, filename: file.name, fieldname: "file" },
          onError: (err) => updatePending(attachmentId, { status: "error", error: err.message }),
          onProgress: (bytesSent, bytesTotal) => updatePending(attachmentId, { progress: bytesSent / bytesTotal }),
          onSuccess: () => void pollUntilSettled(attachmentId, attachmentId),
        });
        uploadsRef.current.set(attachmentId, upload);
        upload.start();
      } catch (err) {
        updatePending(localId, { status: "error", error: err instanceof Error ? err.message : "Upload failed to start" });
      }
    },
    [getToken, pollUntilSettled, updatePending],
  );

  const removeAttachment = useCallback((id: string) => {
    uploadsRef.current.get(id)?.abort();
    uploadsRef.current.delete(id);
    setPending((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clear = useCallback(() => {
    setPending([]);
  }, []);

  const readyAttachmentIds = pending.filter((p) => p.status === "ready").map((p) => p.id);
  const isUploading = pending.some((p) => p.status === "uploading");

  return { pending, addFile, removeAttachment, clear, readyAttachmentIds, isUploading };
}
