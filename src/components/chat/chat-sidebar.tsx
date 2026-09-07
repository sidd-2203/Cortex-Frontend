"use client";

import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { Pin, PinOff, Trash2, CirclePlus, Search, MessageSquare, Zap, KeyRound, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeToggle } from "@/components/theme-toggle";
import { ApiKeysDialog } from "./api-keys-dialog";
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
        aria-label={chat.pinned ? "Unpin task" : "Pin task"}
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
        aria-label="Delete task"
        title="Delete"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

/**
 * Quick-find modal, opened from the header's search icon — a separate,
 * throwaway query from the sidebar's own always-visible chat list, closed
 * (and cleared) on select or Escape (the dialog primitive already closes on
 * Escape itself, so the "esc" badge is never a lie).
 */
function SearchDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (chatId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const { data } = useChats(query || undefined);

  function handleOpenChange(next: boolean) {
    if (!next) setQuery("");
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className="top-[22%] max-w-lg translate-y-0 gap-0 p-0">
        <div className="flex items-center gap-2 border-b border-border px-3.5 py-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search tasks"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">
            esc
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {data && data.items.length > 0 && (
            <p className="px-2 pt-1 pb-1.5 text-xs font-medium text-muted-foreground">Tasks</p>
          )}
          {data?.items.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">No matching tasks.</p>
          )}
          {data?.items.map((chat) => (
            <button
              key={chat.id}
              onClick={() => {
                onSelect(chat.id);
                handleOpenChange(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-foreground/80 hover:bg-secondary hover:text-foreground"
            >
              <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{chat.title}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ChatSidebar({
  collapsed,
  onCollapsedChange,
}: {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [apiKeysOpen, setApiKeysOpen] = useState(false);
  const { data, isLoading } = useChats();
  const { data: credits } = useCreditBalance();
  const activeChatId = useChatUiStore((s) => s.activeChatId);
  const setActiveChat = useChatUiStore((s) => s.setActiveChat);

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar transition-[width] duration-200 ease-out",
        collapsed ? "w-13" : "w-72",
      )}
    >
      <div className={cn("flex h-13 shrink-0 items-center gap-2", collapsed ? "justify-center px-2" : "px-4")}>
        <div className="flex size-6 items-center justify-center rounded-md bg-brand text-brand-foreground text-xs font-bold">
          C
        </div>
        {!collapsed && (
          <>
            <span className="flex-1 text-sm font-semibold tracking-tight">Cortex</span>
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search tasks"
              className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Search className="size-4" />
            </button>
          </>
        )}
        <button
          onClick={() => onCollapsedChange(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} onSelect={setActiveChat} />

      {collapsed ? (
        <nav className="flex flex-col items-center gap-1 px-2 pt-2">
          <button
            onClick={() => setActiveChat(null)}
            aria-label="New task"
            title="New task"
            className="flex size-8 items-center justify-center rounded-lg text-foreground/80 hover:bg-secondary hover:text-foreground"
          >
            <CirclePlus className="size-4" />
          </button>
        </nav>
      ) : (
        <>
      <nav className="flex flex-col gap-0.5 px-2 pt-2">
        {/* Opens a blank draft — the chat row isn't created until the first
            message is actually sent (see useSendTurn), so clicking this and
            walking away doesn't leave an empty "New task" behind. */}
        <button
          onClick={() => setActiveChat(null)}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary hover:text-foreground"
        >
          <CirclePlus className="size-4" />
          New task
        </button>
      </nav>

      <ScrollArea className="flex-1 mt-1">
        <nav className="flex flex-col gap-0.5 p-2">
          {isLoading && <p className="text-xs text-muted-foreground px-2 py-1.5">Loading…</p>}
          {!isLoading && data?.items.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-1.5">No tasks yet.</p>
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
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              onClick={() => setApiKeysOpen(true)}
              aria-label="API keys"
              title="API keys"
              className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <KeyRound className="size-3.5" />
            </button>
          </div>
          <UserButton />
        </div>
      </div>
        </>
      )}

      <ApiKeysDialog open={apiKeysOpen} onOpenChange={setApiKeysOpen} />
    </aside>
  );
}
