"use client";

import { useState, type KeyboardEvent } from "react";
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
    <div className="border-t p-4 flex gap-2 items-end">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Message Cortex…"
        rows={2}
        disabled={isStreaming}
        className="resize-none"
        aria-label="Message composer"
      />
      <Button onClick={() => void submit()} disabled={isStreaming || !value.trim()}>
        {isStreaming ? "Sending…" : "Send"}
      </Button>
    </div>
  );
}
