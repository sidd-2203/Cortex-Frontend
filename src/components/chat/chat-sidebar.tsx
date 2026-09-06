"use client";

import { useState } from "react";
import { Pin, PinOff, Trash2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useChats, useCreateChat, useTogglePinChat, useDeleteChat } from "@/hooks/use-chat-queries";
import { useChatUiStore } from "@/stores/chat-ui-store";
import type { ChatSummary } from "@/contracts/chat";

function ChatRow({ chat, isActive, onSelect }: { chat: ChatSummary; isActive: boolean; onSelect: () => void }) {
  const togglePin = useTogglePinChat();
  const deleteChat = useDeleteChat();

  return (
    <div
      className={cn(
        "group relative flex items-center gap-1 rounded-xl px-2.5 py-2 text-sm transition-colors",
        isActive
          ? "bg-accent text-accent-foreground font-medium"
          : "text-foreground/80 hover:bg-secondary",
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
      )}
      <button onClick={onSelect} className="min-w-0 flex-1 truncate text-left" title={chat.title}>
        {chat.title}
      </button>
      <button
        onClick={() => togglePin.mutate({ chatId: chat.id, pinned: !chat.pinned })}
        className={cn(
          "shrink-0 rounded-md p-1 hover:bg-foreground/10",
          chat.pinned ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-100",
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
  const createChat = useCreateChat();
  const activeChatId = useChatUiStore((s) => s.activeChatId);
  const setActiveChat = useChatUiStore((s) => s.setActiveChat);

  return (
    <aside className="w-64 shrink-0 border-r border-border/60 bg-sidebar flex flex-col h-full">
      <div className="p-3 flex flex-col gap-2.5">
        <Button
          className="w-full justify-start gap-2 rounded-xl shadow-sm"
          disabled={createChat.isPending}
          onClick={() =>
            createChat.mutate(undefined, {
              onSuccess: (chat) => setActiveChat(chat.id),
            })
          }
        >
          <Plus className="size-4" />
          New chat
        </Button>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats…"
            aria-label="Search chats"
            className="h-8 rounded-lg pl-8 text-sm"
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
    </aside>
  );
}
