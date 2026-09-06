"use client";

import { useState, type KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useChatUiStore } from "@/stores/chat-ui-store";

export function Composer({ onSend }: { onSend: (text: string) => Promise<void> }) {
  const [value, setValue] = useState("");
  const status = useChatUiStore((s) => s.status);
  const isStreaming = status === "streaming";

  async function submit() {
    const text = value.trim();
    if (!text || isStreaming) return;
    setValue("");
    await onSend(text);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <div className="border-t border-border/60 bg-background/70 p-4 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/40">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Cortex…"
          rows={1}
          disabled={isStreaming}
          className="min-h-9 resize-none border-none bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
          aria-label="Message composer"
        />
        <Button
          onClick={() => void submit()}
          disabled={isStreaming || !value.trim()}
          size="icon"
          className="size-9 shrink-0 rounded-xl"
          aria-label={isStreaming ? "Sending" : "Send"}
        >
          <ArrowUp className="size-4" />
        </Button>
      </div>
    </div>
  );
}
