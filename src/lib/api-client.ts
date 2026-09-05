import {
  ChatSummarySchema,
  MessageSchema,
  SendTurnRequestSchema,
  SendTurnResponseSchema,
  cursorPageResponseSchema,
  type ChatSummary,
  type Message,
  type SendTurnRequest,
} from "@/contracts/chat";
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

  if (!res.ok && !res.headers.get("content-type")?.includes("text/event-stream")) {
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
 * Send-turn returns a streaming SSE response — the caller reads it directly
 * (see useSendTurn) rather than getting a parsed body back, since the whole
 * point is to forward `delta` events to the UI as they arrive.
 */
export function sendTurn(token: string | null, chatId: string, body: SendTurnRequest, signal?: AbortSignal) {
  SendTurnRequestSchema.parse(body); // fail fast on a malformed request, before it leaves the browser
  return apiFetch(`/api/chats/${chatId}/messages`, token, {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  });
}

export { SendTurnResponseSchema };
export type { Message, ChatSummary };
