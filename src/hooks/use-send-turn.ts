"use client";

import { useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { sendTurn, SendTurnResponseSchema } from "@/lib/api-client";
import { useChatUiStore } from "@/stores/chat-ui-store";

/**
 * Parses the send-turn SSE response as it arrives. `EventSource` can't be
 * used here — it's GET-only and can't carry an Authorization header — so
 * this reads the fetch() body stream directly and splits on the same
 * "event: ...\ndata: ...\n\n" framing the backend writes.
 */
async function consumeEventStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: unknown) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      let event = "message";
      let data = "";
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data = line.slice(5).trim();
      }
      if (data) {
        try {
          onEvent(event, JSON.parse(data));
        } catch {
          // ignore malformed chunk rather than aborting the whole stream
        }
      }
    }
  }
}

export function useSendTurn(chatId: string | null) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { startRun, appendDelta, finish, fail } = useChatUiStore();

  const send = useCallback(
    async (text: string) => {
      if (!chatId) return;
      const token = await getToken();
      const idempotencyKey = crypto.randomUUID();

      const res = await sendTurn(token, chatId, {
        idempotencyKey,
        content: [{ type: "text", text }],
        attachmentIds: [],
      });

      if (!res.body) {
        fail("No response stream from server");
        return;
      }

      await consumeEventStream(res.body, (event, data) => {
        if (event === "dispatched") {
          const envelope = SendTurnResponseSchema.parse(data);
          startRun(envelope.runId);
        } else if (event === "delta") {
          appendDelta((data as { text: string }).text);
        } else if (event === "done") {
          finish();
          queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
        } else if (event === "error") {
          fail((data as { message: string }).message);
          queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
        }
      });
    },
    [chatId, getToken, startRun, appendDelta, finish, fail, queryClient],
  );

  return { send };
}
