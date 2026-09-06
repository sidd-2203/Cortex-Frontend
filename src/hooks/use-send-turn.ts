"use client";

import { useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { sendTurn } from "@/lib/api-client";
import { useChatUiStore } from "@/stores/chat-ui-store";

/**
 * Dispatches a turn and hands the resulting subscription to the store —
 * that's it. The actual token stream is read by useAgentRunSubscription,
 * which talks to Trigger.dev Realtime directly rather than through this
 * request (see api-client's sendTurn for why: this call returns almost
 * immediately instead of waiting on the full LLM completion).
 */
export function useSendTurn(chatId: string | null) {
  const { getToken } = useAuth();
  const { startRun, fail } = useChatUiStore();

  const send = useCallback(
    async (text: string) => {
      if (!chatId) return;
      const token = await getToken();
      const idempotencyKey = crypto.randomUUID();

      try {
        const envelope = await sendTurn(token, chatId, {
          idempotencyKey,
          content: [{ type: "text", text }],
          attachmentIds: [],
        });
        startRun(envelope);
      } catch (err) {
        fail(err instanceof Error ? err.message : "Failed to send message");
      }
    },
    [chatId, getToken, startRun, fail],
  );

  return { send };
}
