"use client";

import { useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { sendTurn } from "@/lib/api-client";
import { useCreateChat } from "@/hooks/use-chat-queries";
import { useChatUiStore } from "@/stores/chat-ui-store";

/**
 * Dispatches a turn and hands the resulting subscription to the store —
 * that's it. The actual token stream is read by useAgentRunSubscription,
 * which talks to Trigger.dev Realtime directly rather than through this
 * request (see api-client's sendTurn for why: this call returns almost
 * immediately instead of waiting on the full LLM completion).
 *
 * A null chatId means "draft" — the chat row is created here, on the first
 * send, rather than when the user clicks New chat. Clicking New chat and
 * then wandering off shouldn't leave an empty chat behind.
 */
export function useSendTurn(chatId: string | null) {
  const { getToken } = useAuth();
  const { startRun, fail } = useChatUiStore();
  const setActiveChat = useChatUiStore((s) => s.setActiveChat);
  const createChat = useCreateChat();
  const queryClient = useQueryClient();

  const send = useCallback(
    async (text: string, attachmentIds: string[] = []) => {
      const idempotencyKey = crypto.randomUUID();
      // Declared outside the try so the catch block knows which chat's
      // message list to refresh even when the failure happens after a
      // draft chat was just created.
      let targetChatId = chatId;

      try {
        if (!targetChatId) {
          const chat = await createChat.mutateAsync(undefined);
          targetChatId = chat.id;
          // Before startRun below, since selecting a chat resets the
          // store's in-flight run fields back to idle.
          setActiveChat(chat.id);
        }

        const token = await getToken();
        const envelope = await sendTurn(token, targetChatId, {
          idempotencyKey,
          content: [{ type: "text", text }],
          attachmentIds,
        });
        startRun(envelope);
      } catch (err) {
        fail(err instanceof Error ? err.message : "Failed to send message");
        // A dispatch failure persists a real FAILED assistant message
        // server-side (see the messages route) so it survives a reload —
        // this is what makes it show up right now too, instead of only
        // after the next manual refresh.
        if (targetChatId) {
          void queryClient.invalidateQueries({ queryKey: ["messages", targetChatId] });
        }
      }
    },
    [chatId, getToken, startRun, fail, createChat, setActiveChat, queryClient],
  );

  return { send };
}
