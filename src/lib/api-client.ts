import {
  ChatSummarySchema,
  MessageSchema,
  SendTurnRequestSchema,
  SendTurnResponseSchema,
  ActiveRunResponseSchema,
  UpdateChatRequestSchema,
  cursorPageResponseSchema,
  type ChatSummary,
  type Message,
  type SendTurnRequest,
  type SendTurnResponse,
  type ActiveRunResponse,
  type UpdateChatRequest,
} from "@/contracts/chat";
import {
  CreateUploadRequestSchema,
  CreateUploadResponseSchema,
  AttachmentSchema,
  type CreateUploadRequest,
  type CreateUploadResponse,
  type Attachment,
} from "@/contracts/uploads";
import { z } from "zod";

// cortex-backend is a separate Next.js app on its own origin — there's no
// shared cookie jar between the two, so every call here authenticates with
// a Clerk session token as a Bearer header (see useApiToken()) rather than
// relying on cookies. `getToken` is passed in by the caller (a component
// holding Clerk's useAuth()) so this module stays framework-agnostic.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function apiFetch(path: string, token: string | null, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body?.error?.message ?? `Request failed with status ${res.status}`;
    const code = body?.error?.code ?? "unknown_error";
    throw new ApiClientError(res.status, code, message);
  }
  return res;
}

async function apiFetchJson<T>(path: string, token: string | null, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, token, init);
  const json = await res.json();
  return schema.parse(json);
}

export const ChatListResponseSchema = cursorPageResponseSchema(ChatSummarySchema);
export const MessageListResponseSchema = cursorPageResponseSchema(MessageSchema);

export function listChats(token: string | null, params: { cursor?: string; search?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.cursor) qs.set("cursor", params.cursor);
  if (params.search) qs.set("search", params.search);
  return apiFetchJson(`/api/chats?${qs}`, token, ChatListResponseSchema);
}

export function createChat(token: string | null, title?: string): Promise<ChatSummary> {
  return apiFetchJson("/api/chats", token, ChatSummarySchema, {
    method: "POST",
    body: JSON.stringify(title ? { title } : {}),
  });
}

export function listMessages(token: string | null, chatId: string, params: { cursor?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.cursor) qs.set("cursor", params.cursor);
  return apiFetchJson(`/api/chats/${chatId}/messages?${qs}`, token, MessageListResponseSchema);
}

/**
 * Send-turn dispatches the turn and returns almost immediately with a
 * subscription (runId/triggerRunId/publicAccessToken) — it does NOT wait on
 * the LLM completion. The caller subscribes to Trigger.dev Realtime
 * directly with that subscription (see useAgentRunSubscription) to get the
 * actual token stream.
 */
export function sendTurn(
  token: string | null,
  chatId: string,
  body: SendTurnRequest,
  signal?: AbortSignal,
): Promise<SendTurnResponse> {
  SendTurnRequestSchema.parse(body); // fail fast on a malformed request, before it leaves the browser
  return apiFetchJson(`/api/chats/${chatId}/messages`, token, SendTurnResponseSchema, {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  });
}

/** Reload recovery: is there an in-flight run on this chat to resume watching? */
export function getActiveRun(token: string | null, chatId: string): Promise<ActiveRunResponse> {
  return apiFetchJson(`/api/chats/${chatId}/active-run`, token, ActiveRunResponseSchema);
}

export function updateChat(token: string | null, chatId: string, body: UpdateChatRequest): Promise<ChatSummary> {
  UpdateChatRequestSchema.parse(body);
  return apiFetchJson(`/api/chats/${chatId}`, token, ChatSummarySchema, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteChat(token: string | null, chatId: string): Promise<void> {
  await apiFetch(`/api/chats/${chatId}`, token, { method: "DELETE" });
}

/**
 * Stage 1 of an upload: ask the backend to create a Transloadit Assembly.
 * The file's bytes are never sent here — the caller uses the returned
 * tusEndpoint/assemblyUrl to upload directly to Transloadit (see
 * use-file-upload.ts), which is what keeps large files off this backend
 * entirely.
 */
export function createUpload(token: string | null, body: CreateUploadRequest): Promise<CreateUploadResponse> {
  CreateUploadRequestSchema.parse(body);
  return apiFetchJson("/api/uploads", token, CreateUploadResponseSchema, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Stage 2: poll until the attachment's Transloadit assembly settles. */
export function getUploadStatus(token: string | null, attachmentId: string): Promise<Attachment> {
  return apiFetchJson(`/api/uploads/${attachmentId}`, token, AttachmentSchema);
}

const CreditBalanceResponseSchema = z.object({ balance: z.number().int() });

export function getCreditBalance(token: string | null): Promise<{ balance: number }> {
  return apiFetchJson("/api/credits", token, CreditBalanceResponseSchema);
}

export type { Message, ChatSummary, SendTurnResponse, ActiveRunResponse, Attachment };
