"use client";

import { useEffect, useRef } from "react";
import { UserButton } from "@clerk/nextjs";
import { useChats, useCreateChat, useMessages } from "@/hooks/use-chat-queries";
import { useSendTurn } from "@/hooks/use-send-turn";
import { useAgentRunSubscription } from "@/hooks/use-agent-run-subscription";
import { useChatUiStore } from "@/stores/chat-ui-store";
import { MessageList } from "./message-list";
import { Composer } from "./composer";
import { ChatSidebar } from "./chat-sidebar";

export function ChatWorkspace() {
  const activeChatId = useChatUiStore((s) => s.activeChatId);
  const setActiveChat = useChatUiStore((s) => s.setActiveChat);
  const { data: chatList, isLoading: chatsLoading } = useChats();
  const createChat = useCreateChat();
  // Guards against firing the create-or-select effect twice in dev's
  // StrictMode double-invoke, which would otherwise spin up two chats.
  const initialized = useRef(false);

  useEffect(() => {
    if (activeChatId || chatsLoading || initialized.current) return;
    initialized.current = true;

    if (chatList && chatList.items.length > 0) {
      // Most recently active chat first (backend orders by updatedAt desc) —
      // resuming where you left off beats always starting fresh.
      setActiveChat(chatList.items[0]!.id);
    } else {
      createChat.mutate(undefined, { onSuccess: (chat) => setActiveChat(chat.id) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatId, chatsLoading, chatList]);

  const { data, isLoading } = useMessages(activeChatId);
  const { send } = useSendTurn(activeChatId);
  useAgentRunSubscription(activeChatId);

  return (
    <div className="flex h-full">
      <ChatSidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h1 className="text-sm font-medium">Cortex</h1>
          <UserButton />
        </header>
        {isLoading || !activeChatId ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : (
          <MessageList messages={data?.items.slice().reverse() ?? []} />
        )}
        <Composer onSend={send} />
      </div>
    </div>
  );
}
