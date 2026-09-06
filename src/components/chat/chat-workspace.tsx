"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useChats, useMessages } from "@/hooks/use-chat-queries";
import { useSendTurn } from "@/hooks/use-send-turn";
import { useAgentRunSubscription } from "@/hooks/use-agent-run-subscription";
import { useChatUiStore } from "@/stores/chat-ui-store";
import { MessageList } from "./message-list";
import { Composer } from "./composer";
import { ChatSidebar } from "./chat-sidebar";
import { PromptSuggestions } from "./prompt-suggestions";

export function ChatWorkspace() {
  const activeChatId = useChatUiStore((s) => s.activeChatId);
  const setActiveChat = useChatUiStore((s) => s.setActiveChat);
  const status = useChatUiStore((s) => s.status);
  const { data: chatList, isLoading: chatsLoading } = useChats();
  // Only ever resumes a chat on first load. Deliberately one-shot: after
  // that, a null activeChatId means the user actually wants a blank draft
  // (clicked New chat, or deleted the one they were in), and re-selecting
  // something for them would fight that.
  const didInitialSelect = useRef(false);

  useEffect(() => {
    if (didInitialSelect.current || activeChatId || chatsLoading) return;
    if (chatList && chatList.items.length > 0) {
      // Most recently active chat first (backend orders by updatedAt desc) —
      // resuming where you left off beats always starting fresh. Nothing is
      // created here: an account with no chats yet just starts on the draft
      // screen, and the row gets created on first send.
      didInitialSelect.current = true;
      setActiveChat(chatList.items[0]!.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatId, chatsLoading, chatList]);

  const { data, isLoading } = useMessages(activeChatId);
  const { send } = useSendTurn(activeChatId);
  useAgentRunSubscription(activeChatId);
  // A suggestion click seeds the composer with this text.
  const [suggestion, setSuggestion] = useState<string | undefined>(undefined);

  const hasMessages = (data?.items.length ?? 0) > 0;
  // A brand-new draft (no chat row yet) and a selected-but-empty chat get
  // the same start screen.
  const showEmptyState = !isLoading && !hasMessages && status === "idle";

  return (
    <div className="flex h-screen overflow-hidden">
      <ChatSidebar />
      <div className="flex flex-1 flex-col min-w-0 min-h-0">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
        ) : showEmptyState ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <Sparkles className="size-6" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">What are we building today?</h1>
              <p className="text-sm text-muted-foreground">Ask anything, or attach a file to get started.</p>
            </div>
            <Composer onSend={send} className="w-full max-w-2xl" presetText={suggestion} />
            <PromptSuggestions onSelect={setSuggestion} />
          </div>
        ) : (
          <>
            <MessageList messages={data?.items.slice().reverse() ?? []} chatId={activeChatId} />
            {/* min-h-20 matches the sidebar footer's h-20 so the two
                border-t lines meet as one continuous rule across the app.
                min- rather than fixed so attachment chips can grow it. */}
            <div className="flex min-h-20 shrink-0 items-center border-t border-border bg-background px-4">
              <Composer onSend={send} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
