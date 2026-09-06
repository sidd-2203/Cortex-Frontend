"use client";

import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import type { Message } from "@/contracts/chat";
import type { ContentBlock, ToolUseBlock, ToolResultBlock } from "@/contracts/content-blocks";
import { useChatUiStore } from "@/stores/chat-ui-store";
import { cn } from "@/lib/utils";

function Avatar({ role }: { role: "user" | "assistant" }) {
  if (role === "assistant") {
    return (
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Sparkles className="size-3.5" />
      </div>
    );
  }
  return <div className="size-7 shrink-0 rounded-full bg-secondary" />;
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  return (
    <div className={cn("flex items-start gap-2.5", role === "user" ? "flex-row-reverse" : "flex-row")}>
      <Avatar role={role} />
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-4 py-2.5 text-sm flex flex-col gap-1.5 shadow-sm",
          role === "user"
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-card border border-border/60 text-foreground rounded-tl-sm",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** A tool_use paired with its tool_result (matched by id), rendered as one compact pill. */
function ToolCallPill({ toolUse, result }: { toolUse: ToolUseBlock; result?: ToolResultBlock }) {
  const isError = result?.isError;
  return (
    <div
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs",
        isError ? "bg-destructive/10 text-destructive" : "bg-foreground/5 text-muted-foreground",
      )}
      title={result ? JSON.stringify(result.output) : "running…"}
    >
      <span aria-hidden>{isError ? "✗" : result ? "✓" : "⋯"}</span>
      <span className="font-mono">{toolUse.toolName}</span>
    </div>
  );
}

/**
 * Renders ordered content blocks as-is — text, thinking (dimmed, since it's
 * not meant to read as the final answer), tool calls (paired with their
 * result and collapsed into one pill rather than shown as two separate
 * blocks), and citations. tool_result blocks are skipped on their own;
 * they're folded into the tool_use pill they answer.
 */
function ContentBlocks({ blocks }: { blocks: ContentBlock[] }) {
  const resultByToolUseId = new Map<string, ToolResultBlock>();
  for (const b of blocks) if (b.type === "tool_result") resultByToolUseId.set(b.toolUseId, b);

  const rendered = blocks
    .map((block, i) => {
      switch (block.type) {
        case "text":
          return (
            <p key={i} className="whitespace-pre-wrap">
              {block.text}
            </p>
          );
        case "thinking":
          return (
            <p key={i} className="whitespace-pre-wrap text-xs italic text-muted-foreground">
              {block.text}
            </p>
          );
        case "tool_use":
          return <ToolCallPill key={i} toolUse={block} result={resultByToolUseId.get(block.id)} />;
        case "citation":
          return (
            <a key={i} href={block.source} className="text-xs text-muted-foreground underline w-fit">
              {block.text}
            </a>
          );
        case "tool_result":
          return null; // folded into its tool_use pill above
        default:
          return null;
      }
    })
    .filter(Boolean);

  return rendered.length > 0 ? <>{rendered}</> : <span className="text-muted-foreground italic">…</span>;
}

export function MessageList({ messages }: { messages: Message[] }) {
  const { status, streamingText, error } = useChatUiStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingText]);

  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
      {messages.length === 0 && status === "idle" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Sparkles className="size-6" />
          </div>
          <p className="text-sm text-muted-foreground">Send a message to start the conversation.</p>
        </div>
      )}
      {messages.map((m) => {
        if (m.role !== "USER" && m.role !== "ASSISTANT") return null;
        return (
          <Bubble key={m.id} role={m.role === "USER" ? "user" : "assistant"}>
            {m.status === "FAILED" ? (
              <span className="text-destructive">This turn failed. Try sending again.</span>
            ) : (
              <ContentBlocks blocks={m.content} />
            )}
          </Bubble>
        );
      })}
      {status === "streaming" && (
        <Bubble role="assistant">
          <p className="whitespace-pre-wrap">
            {streamingText || <span className="animate-pulse">thinking…</span>}
          </p>
        </Bubble>
      )}
      {status === "error" && error && <p className="text-center text-sm text-destructive">{error}</p>}
      <div ref={bottomRef} />
    </div>
  );
}
