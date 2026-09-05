"use client";

import { useEffect } from "react";
import { UserButton } from "@clerk/nextjs";
import { useCreateChat, useMessages } from "@/hooks/use-chat-queries";
import { useSendTurn } from "@/hooks/use-send-turn";
import { useChatUiStore } from "@/stores/chat-ui-store";
import { MessageList } from "./message-list";
import { Composer } from "./composer";

/**
 * Day-1 shape: one implicit chat per visit, created lazily on first load.
 * Chat list / switching / pin / search (the full chat-management surface)
 * comes later — this just proves the send -> stream -> persist loop works.
 */
export function ChatWorkspace() {
  const activeChatId = useChatUiStore((s) => s.activeChatId);
  const setActiveChat = useChatUiStore((s) => s.setActiveChat);
  const createChat = useCreateChat();

  useEffect(() => {
    if (!activeChatId && createChat.isIdle) {
      createChat.mutate(undefined, {
        onSuccess: (chat) => setActiveChat(chat.id),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatId, createChat.isIdle]);

  const { data, isLoading } = useMessages(activeChatId);
  const { send } = useSendTurn(activeChatId);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-sm font-medium">Cortex</h1>
        <UserButton />
      </header>
      {isLoading || !activeChatId ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Starting a new chat…
        </div>
      ) : (
        <MessageList messages={data?.items.slice().reverse() ?? []} />
      )}
      <Composer onSend={send} />
    </div>
  );
}
