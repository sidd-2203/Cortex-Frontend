"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@/contracts/chat";
import { useChatUiStore } from "@/stores/chat-ui-store";
import { cn } from "@/lib/utils";

function textOf(message: Message): string {
  return message.content
    .filter((b): b is Extract<Message["content"][number], { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  return (
    <div className={cn("flex", role === "user" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap",
          role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function MessageList({ messages }: { messages: Message[] }) {
  const { status, streamingText, error } = useChatUiStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingText]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">
      {messages.length === 0 && status === "idle" && (
        <p className="text-center text-sm text-muted-foreground mt-12">
          Send a message to start the conversation.
        </p>
      )}
      {messages.map((m) => {
        if (m.role !== "USER" && m.role !== "ASSISTANT") return null;
        return (
          <Bubble key={m.id} role={m.role === "USER" ? "user" : "assistant"}>
            {m.status === "FAILED" ? (
              <span className="text-destructive">This turn failed. Try sending again.</span>
            ) : (
              textOf(m) || <span className="text-muted-foreground italic">…</span>
            )}
          </Bubble>
        );
      })}
      {status === "streaming" && (
        <Bubble role="assistant">{streamingText || <span className="animate-pulse">thinking…</span>}</Bubble>
      )}
      {status === "error" && error && (
        <p className="text-center text-sm text-destructive">{error}</p>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
