"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useChats, useCreateChat } from "@/hooks/use-chat-queries";
import { useChatUiStore } from "@/stores/chat-ui-store";

export function ChatSidebar() {
  const { data, isLoading } = useChats();
  const createChat = useCreateChat();
  const activeChatId = useChatUiStore((s) => s.activeChatId);
  const setActiveChat = useChatUiStore((s) => s.setActiveChat);

  return (
    <aside className="w-64 shrink-0 border-r flex flex-col h-full">
      <div className="p-3 border-b">
        <Button
          className="w-full"
          variant="outline"
          disabled={createChat.isPending}
          onClick={() =>
            createChat.mutate(undefined, {
              onSuccess: (chat) => setActiveChat(chat.id),
            })
          }
        >
          + New chat
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-0.5 p-2">
          {isLoading && <p className="text-xs text-muted-foreground px-2 py-1.5">Loading…</p>}
          {!isLoading && data?.items.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-1.5">No chats yet.</p>
          )}
          {data?.items.map((chat) => (
            <button
              key={chat.id}
              onClick={() => setActiveChat(chat.id)}
              className={cn(
                "text-left text-sm rounded-md px-2 py-1.5 truncate transition-colors",
                chat.id === activeChatId ? "bg-muted font-medium" : "hover:bg-muted/50",
              )}
              title={chat.title}
            >
              {chat.title}
            </button>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}
