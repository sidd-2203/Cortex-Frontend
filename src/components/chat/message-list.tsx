"use client";

import { useEffect, useRef } from "react";
import { Sparkles, FileText } from "lucide-react";
import type { Message } from "@/contracts/chat";
import type { ContentBlock, ToolUseBlock, ToolResultBlock, AttachmentBlock } from "@/contracts/content-blocks";
import { useChatUiStore } from "@/stores/chat-ui-store";
import { Markdown } from "./markdown";
import { CopyButton } from "./copy-button";
import { cn } from "@/lib/utils";

/** The copyable text of a message — its text blocks joined, everything else (tool calls, attachments) omitted. */
function plainTextOf(blocks: ContentBlock[]): string {
  return blocks
    .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("\n\n");
}

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

function Bubble({
  role,
  copyText,
  children,
}: {
  role: "user" | "assistant";
  /** Omitted when there's nothing worth copying (e.g. a failed turn). */
  copyText?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("group/msg flex flex-col gap-1", role === "user" ? "items-end" : "items-start")}>
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
      {copyText && (
        <CopyButton
          text={copyText}
          className={cn(
            "opacity-0 transition-opacity group-hover/msg:opacity-100",
            role === "user" ? "mr-9" : "ml-9",
          )}
        />
      )}
    </div>
  );
}

type MediaItem = { type: "image" | "video"; url: string };

/**
 * Pulls image/video URLs out of a tool call's input or output, generically —
 * every Magica-backed tool's schema (see contracts/tools.ts) shapes media as
 * one of these fields, whether it's the source you fed in (imageUrl on
 * crop_image, imageUrls/maskUrl on edit_image, videoUrls on merge_videos) or
 * the result you got back (imageUrl/videoUrl/imageUrls). Covers all four
 * tools' both directions without naming any of them individually, and keeps
 * working if a future tool follows the same field-naming convention.
 */
function extractMedia(value: unknown): MediaItem[] {
  if (!value || typeof value !== "object") return [];
  const o = value as Record<string, unknown>;
  const media: MediaItem[] = [];
  if (typeof o.imageUrl === "string") media.push({ type: "image", url: o.imageUrl });
  if (typeof o.videoUrl === "string") media.push({ type: "video", url: o.videoUrl });
  if (typeof o.maskUrl === "string") media.push({ type: "image", url: o.maskUrl });
  if (Array.isArray(o.imageUrls)) {
    for (const url of o.imageUrls) if (typeof url === "string") media.push({ type: "image", url });
  }
  if (Array.isArray(o.videoUrls)) {
    for (const url of o.videoUrls) if (typeof url === "string") media.push({ type: "video", url });
  }
  return media;
}

function MediaRow({ label, items }: { label?: string; items: MediaItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-[0.7rem] font-medium text-muted-foreground">{label}</span>}
      <div className="flex flex-wrap gap-2">
        {items.map((m, i) =>
          m.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={m.url} alt="" className="max-h-64 rounded-lg" />
          ) : (
            <video key={i} src={m.url} controls className="max-h-64 rounded-lg" />
          ),
        )}
      </div>
    </div>
  );
}

/** A tool_use paired with its tool_result (matched by id) — a compact status pill, plus inline previews for any image/video the tool was given and/or produced. */
function ToolCallPill({ toolUse, result }: { toolUse: ToolUseBlock; result?: ToolResultBlock }) {
  const isError = result?.isError;
  const inputMedia = extractMedia(toolUse.input);
  const outputMedia = result && !isError ? extractMedia(result.output) : [];
  // Only label them when both are present — otherwise which is which is
  // unambiguous and a label is just noise.
  const showLabels = inputMedia.length > 0 && outputMedia.length > 0;

  return (
    <div className="flex flex-col gap-2">
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
      <MediaRow label={showLabels ? "Input" : undefined} items={inputMedia} />
      <MediaRow label={showLabels ? "Result" : undefined} items={outputMedia} />
    </div>
  );
}

/** A user-uploaded file — image/video preview inline, other types as a link. */
function AttachmentPreview({ block }: { block: AttachmentBlock }) {
  if (block.attachmentType === "IMAGE") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={block.url} alt={block.filename ?? "attachment"} className="max-h-64 rounded-lg" />;
  }
  if (block.attachmentType === "VIDEO") {
    return <video src={block.url} controls className="max-h-64 rounded-lg" />;
  }
  return (
    <a
      href={block.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs underline"
    >
      <FileText className="size-3.5" />
      {block.filename ?? "attachment"}
    </a>
  );
}

/**
 * Renders ordered content blocks as-is — text, thinking (dimmed, since it's
 * not meant to read as the final answer), tool calls (paired with their
 * result and collapsed into one pill rather than shown as two separate
 * blocks), and citations. tool_result blocks are skipped on their own;
 * they're folded into the tool_use pill they answer.
 */
function ContentBlocks({ blocks, role }: { blocks: ContentBlock[]; role: "user" | "assistant" }) {
  const resultByToolUseId = new Map<string, ToolResultBlock>();
  for (const b of blocks) if (b.type === "tool_result") resultByToolUseId.set(b.toolUseId, b);

  const rendered = blocks
    .map((block, i) => {
      switch (block.type) {
        case "text":
          // Only the assistant writes markdown; a user's own text is shown
          // exactly as they typed it rather than being reinterpreted.
          return role === "assistant" ? (
            <Markdown key={i}>{block.text}</Markdown>
          ) : (
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
        case "attachment":
          return <AttachmentPreview key={i} block={block} />;
        case "tool_result":
          return null; // folded into its tool_use pill above
        default:
          return null;
      }
    })
    .filter(Boolean);

  return rendered.length > 0 ? <>{rendered}</> : <span className="text-muted-foreground italic">…</span>;
}

export function MessageList({ messages, chatId }: { messages: Message[]; chatId: string | null }) {
  const { status, streamingText, error } = useChatUiStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Jump straight to the bottom when a chat is opened or switched — you
  // want the latest message, not the top of the history.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatId]);

  // Then follow along as content arrives. Scrolling the container directly
  // (rather than scrollIntoView on a sentinel) keeps this contained to the
  // message list instead of nudging the whole page.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, streamingText]);

  return (
    <div ref={scrollRef} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
      {messages.map((m) => {
        if (m.role !== "USER" && m.role !== "ASSISTANT") return null;
        const role = m.role === "USER" ? "user" : "assistant";
        return (
          <Bubble key={m.id} role={role} copyText={m.status === "FAILED" ? undefined : plainTextOf(m.content)}>
            {m.status === "FAILED" ? (
              <span className="text-destructive">This turn failed. Try sending again.</span>
            ) : (
              <ContentBlocks blocks={m.content} role={role} />
            )}
          </Bubble>
        );
      })}
      {status === "streaming" && (
        <Bubble role="assistant" copyText={streamingText || undefined}>
          {streamingText ? (
            <Markdown>{streamingText}</Markdown>
          ) : (
            <span className="animate-pulse">thinking…</span>
          )}
        </Bubble>
      )}
      {status === "error" && error && <p className="text-center text-sm text-destructive">{error}</p>}
    </div>
  );
}
