"use client";

import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { Pin, PinOff, Trash2, SquarePen, Search, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { useChats, useTogglePinChat, useDeleteChat } from "@/hooks/use-chat-queries";
import { useCreditBalance } from "@/hooks/use-credits";
import { useChatUiStore } from "@/stores/chat-ui-store";
import type { ChatSummary } from "@/contracts/chat";

function ChatRow({ chat, isActive, onSelect }: { chat: ChatSummary; isActive: boolean; onSelect: () => void }) {
  const togglePin = useTogglePinChat();
  const deleteChat = useDeleteChat();

  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm transition-colors",
        isActive ? "bg-accent font-medium text-accent-foreground" : "text-foreground/80 hover:bg-secondary",
      )}
    >
      <button onClick={onSelect} className="min-w-0 flex-1 truncate text-left" title={chat.title}>
        {chat.title}
      </button>
      <button
        onClick={() => togglePin.mutate({ chatId: chat.id, pinned: !chat.pinned })}
        className={cn(
          "shrink-0 rounded-md p-1 hover:bg-foreground/10",
          chat.pinned ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
        aria-label={chat.pinned ? "Unpin chat" : "Pin chat"}
        title={chat.pinned ? "Unpin" : "Pin"}
      >
        {chat.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
      </button>
      <button
        onClick={() => {
          if (confirm(`Delete "${chat.title}"? This can't be undone.`)) {
            deleteChat.mutate(chat.id);
          }
        }}
        className="shrink-0 rounded-md p-1 opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        aria-label="Delete chat"
        title="Delete"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

export function ChatSidebar() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useChats(search || undefined);
  const { data: credits } = useCreditBalance();
  const activeChatId = useChatUiStore((s) => s.activeChatId);
  const setActiveChat = useChatUiStore((s) => s.setActiveChat);

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex size-6 items-center justify-center rounded-md bg-brand text-brand-foreground text-xs font-bold">
          C
        </div>
        <span className="text-sm font-semibold tracking-tight">Cortex</span>
      </div>

      <nav className="flex flex-col gap-0.5 px-2">
        {/* Opens a blank draft — the chat row isn't created until the first
            message is actually sent (see useSendTurn), so clicking this and
            walking away doesn't leave an empty "New chat" behind. */}
        <button
          onClick={() => setActiveChat(null)}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium hover:bg-secondary"
        >
          <SquarePen className="size-4" />
          New chat
        </button>
      </nav>

      <div className="px-2 pt-2 pb-1">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats…"
            aria-label="Search chats"
            className="h-8 rounded-lg border-transparent bg-secondary pl-8 text-sm shadow-none"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-0.5 p-2">
          {isLoading && <p className="text-xs text-muted-foreground px-2 py-1.5">Loading…</p>}
          {!isLoading && data?.items.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-1.5">
              {search ? "No matching chats." : "No chats yet."}
            </p>
          )}
          {data?.items.map((chat) => (
            <ChatRow
              key={chat.id}
              chat={chat}
              isActive={chat.id === activeChatId}
              onSelect={() => setActiveChat(chat.id)}
            />
          ))}
        </nav>
      </ScrollArea>

      {/* h-20 is shared with the composer bar next to it so both border-t
          lines sit at exactly the same height — see chat-workspace.tsx. */}
      <div className="flex h-20 shrink-0 flex-col justify-center gap-2 border-t border-border px-3">
        {credits && (
          <div className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium">
            <Zap className="size-3.5 text-brand" />
            {credits.balance.toLocaleString()} credits
          </div>
        )}
        <div className="flex items-center justify-between">
          <ThemeToggle />
          <UserButton />
        </div>
      </div>
    </aside>
  );
}
