"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Download, ImageOff, Brain, Zap, Wrench, Loader2, Check, X, ChevronDown } from "lucide-react";
import type { Message } from "@/contracts/chat";
import type { ContentBlock, ToolUseBlock, ToolResultBlock, AttachmentBlock } from "@/contracts/content-blocks";
import { useChatUiStore } from "@/stores/chat-ui-store";
import { Markdown } from "./markdown";
import { CopyButton } from "./copy-button";
import { KeyValueList } from "./key-value-list";
import { ApprovalCard } from "./approval-card";
import { cn } from "@/lib/utils";

/** The copyable text of a message — its text blocks joined, everything else (tool calls, attachments) omitted. */
function plainTextOf(blocks: ContentBlock[]): string {
  return blocks
    .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("\n\n");
}

/** "12:39 PM" — local wall-clock time, no date (matches the reference; messages older than today still just show a time). */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * Matches the reference: user turns are a right-aligned bubble, assistant
 * turns render straight onto the page background — no card, no border, no
 * avatar — so tool activity and text read as one continuous trace rather
 * than being boxed in.
 */
function Bubble({
  role,
  copyText,
  timestamp,
  children,
}: {
  role: "user" | "assistant";
  /** Omitted when there's nothing worth copying (e.g. a failed turn). */
  copyText?: string;
  /**
   * When this message actually happened, straight from its own row — a
   * user message's `createdAt` (set the moment it's persisted, before
   * dispatch) for "sent," an assistant message's `updatedAt` (only touched
   * once by the final $transaction in run-turn.ts) for "received back."
   * Not shown while a message is still failed/pending — there's nothing
   * true to say yet.
   */
  timestamp?: string;
  children: React.ReactNode;
}) {
  if (role === "user") {
    return (
      <div className="group/msg flex flex-col items-end gap-1">
        <div className="max-w-[70%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm flex flex-col gap-1.5">
          {children}
        </div>
        <div className="mr-1 flex items-center gap-2">
          {copyText && (
            <CopyButton text={copyText} className="opacity-0 transition-opacity group-hover/msg:opacity-100" />
          )}
          {timestamp && <span className="text-[0.7rem] text-muted-foreground">{formatTime(timestamp)}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="group/msg flex flex-col items-start gap-1.5">
      <div className="flex w-full flex-col gap-2 text-sm text-foreground">{children}</div>
      <div className="flex items-center gap-2">
        {copyText && (
          <CopyButton text={copyText} className="opacity-0 transition-opacity group-hover/msg:opacity-100" />
        )}
        {timestamp && <span className="text-[0.7rem] text-muted-foreground">{formatTime(timestamp)}</span>}
      </div>
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

/** Best-effort filename for the download attribute — falls back to a generic name if the URL has no obvious one. */
function filenameFor(url: string, type: "image" | "video"): string {
  try {
    const last = new URL(url).pathname.split("/").pop();
    if (last) return last;
  } catch {
    // not a parseable URL — fall through to the generic name
  }
  return type === "image" ? "image.png" : "video.mp4";
}

/**
 * Every image/video we render is a link to a third party (Transloadit's
 * temporary storage for user uploads — confirmed 24h/~10-retrieval expiry —
 * and Magica's own CDN for generated results, whose retention we don't
 * actually know). Rather than guess at a time-based warning, this reacts to
 * the real thing: if the link has actually gone dead by the time it's
 * rendered (a chat reopened days later, say), onError swaps in a plain
 * explanation instead of a broken-image icon. The download button is the
 * actual mitigation — encourages saving a copy before that happens.
 */
function MediaThumbnail({ type, url, downloadName }: { type: "image" | "video"; url: string; downloadName: string }) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <div className="flex h-32 w-48 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-secondary p-3 text-center">
        <ImageOff className="size-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          This {type} is no longer available — its link may have expired.
        </span>
      </div>
    );
  }

  return (
    <div className="group/media relative">
      {type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="max-h-64 rounded-lg" onError={() => setBroken(true)} />
      ) : (
        <video src={url} controls className="max-h-64 rounded-lg" onError={() => setBroken(true)} />
      )}
      <a
        href={url}
        download={downloadName}
        target="_blank"
        rel="noreferrer"
        aria-label="Download"
        title="Download"
        className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-background/80 opacity-0 transition-opacity hover:bg-background group-hover/media:opacity-100"
      >
        <Download className="size-3.5" />
      </a>
    </div>
  );
}

function MediaRow({ label, items }: { label?: string; items: MediaItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-[0.7rem] font-medium text-muted-foreground">{label}</span>}
      <div className="flex flex-wrap gap-2">
        {items.map((m, i) => (
          <MediaThumbnail key={i} type={m.type} url={m.url} downloadName={filenameFor(m.url, m.type)} />
        ))}
      </div>
    </div>
  );
}

/** "812" -> "812ms", "1830" -> "1.8s" — matches the compact duration badges in the reference ("11ms"). */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

type ActivityKind = "thinking" | "skill" | "tool";

const ACTIVITY_ICON: Record<ActivityKind, typeof Brain> = { thinking: Brain, skill: Zap, tool: Wrench };
const ACTIVITY_COLOR: Record<ActivityKind, string> = {
  thinking: "text-activity-thinking",
  skill: "text-activity-skill",
  tool: "text-activity-tool",
};

/**
 * One collapsible row in the agent's activity trace — thinking, a skill
 * load, or a generic tool call — icon-coded and colored per kind, with a
 * status glyph (spinner while running, check/x once settled) and a duration
 * badge, expanding to a detail card. Mirrors the "Reasoned" / "Skill" /
 * "Model schema" rows from the reference screenshots.
 */
function ActivityRow({
  kind,
  label,
  status,
  durationMs,
  children,
}: {
  kind: ActivityKind;
  label: string;
  status: "running" | "success" | "error";
  durationMs?: number;
  children?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  const Icon = ACTIVITY_ICON[kind];

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-fit items-center gap-1.5 rounded-md px-1 py-0.5 text-xs text-muted-foreground hover:bg-secondary/60"
      >
        <Icon className={cn("size-3.5", ACTIVITY_COLOR[kind])} />
        <span className="font-medium text-foreground/80">{label}</span>
        {status === "running" && <Loader2 className="size-3 animate-spin" />}
        {status === "success" && <Check className="size-3 text-activity-success" />}
        {status === "error" && <X className="size-3 text-destructive" />}
        {durationMs !== undefined && <span className="tabular-nums">{formatDuration(durationMs)}</span>}
        {children && <ChevronDown className={cn("size-3 transition-transform", expanded && "rotate-180")} />}
      </button>
      {expanded && children && (
        <div className="ml-1.5 rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs">{children}</div>
      )}
    </div>
  );
}

/** load_skill / read_skill_asset get the amber "Skill" treatment from the reference; everything else is a generic tool row. */
function activityKindForTool(toolName: string): ActivityKind {
  return toolName === "load_skill" || toolName === "read_skill_asset" ? "skill" : "tool";
}

function ToolActivity({ toolUse, result }: { toolUse: ToolUseBlock; result?: ToolResultBlock }) {
  const kind = activityKindForTool(toolUse.toolName);
  const status = !result ? "running" : result.isError ? "error" : "success";
  const inputMedia = extractMedia(toolUse.input);
  const outputMedia = result && !result.isError ? extractMedia(result.output) : [];
  const showLabels = inputMedia.length > 0 && outputMedia.length > 0;

  const detail = (
    <div className="flex flex-col gap-2">
      <KeyValueList data={toolUse.input} />
      {result && (result.isError ? <span className="text-destructive">{String((result.output as { error?: string })?.error ?? "Failed")}</span> : <KeyValueList data={result.output} />)}
      <MediaRow label={showLabels ? "Input" : undefined} items={inputMedia} />
      <MediaRow label={showLabels ? "Result" : undefined} items={outputMedia} />
    </div>
  );

  return (
    <ActivityRow kind={kind} label={kind === "skill" ? "Skill" : toolUse.toolName} status={status} durationMs={result?.durationMs}>
      {detail}
    </ActivityRow>
  );
}

/** A user-uploaded file — image/video preview inline, other types as a link. */
function AttachmentPreview({ block }: { block: AttachmentBlock }) {
  if (block.attachmentType === "IMAGE" || block.attachmentType === "VIDEO") {
    return (
      <MediaThumbnail
        type={block.attachmentType === "IMAGE" ? "image" : "video"}
        url={block.url}
        downloadName={block.filename ?? filenameFor(block.url, block.attachmentType === "IMAGE" ? "image" : "video")}
      />
    );
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
 * Renders ordered content blocks as-is — text, thinking and tool calls as
 * collapsible activity rows, citations as links. tool_result blocks are
 * skipped on their own; they're folded into the tool_use row they answer.
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
            <ActivityRow key={i} kind="thinking" label="Thinking" status="success">
              <p className="whitespace-pre-wrap text-foreground/80">{block.text}</p>
            </ActivityRow>
          );
        case "tool_use":
          return <ToolActivity key={i} toolUse={block} result={resultByToolUseId.get(block.id)} />;
        case "citation":
          return (
            <a key={i} href={block.source} className="text-xs text-muted-foreground underline w-fit">
              {block.text}
            </a>
          );
        case "attachment":
          return <AttachmentPreview key={i} block={block} />;
        case "tool_result":
          return null; // folded into its tool_use row above
        default:
          return null;
      }
    })
    .filter(Boolean);

  return rendered.length > 0 ? <>{rendered}</> : <span className="text-muted-foreground italic">…</span>;
}

export function MessageList({ messages, chatId }: { messages: Message[]; chatId: string | null }) {
  const { status, streamingText, liveToolBlocks, pendingApprovals, stopping, error } = useChatUiStore();
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
  }, [messages.length, streamingText, liveToolBlocks, pendingApprovals]);

  return (
    <div ref={scrollRef} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 py-6">
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      {messages.map((m) => {
        if (m.role !== "USER" && m.role !== "ASSISTANT") return null;
        const role = m.role === "USER" ? "user" : "assistant";
        return (
          <Bubble
            key={m.id}
            role={role}
            copyText={m.status === "FAILED" ? undefined : plainTextOf(m.content)}
            timestamp={m.status === "FAILED" ? undefined : role === "user" ? m.createdAt : m.updatedAt}
          >
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
          {/* Live tool activity — reconstructed from the "tool" Realtime
              stream (see useAgentRunSubscription), rendered with the exact
              same component a persisted message's tool calls use. This is
              what makes a slow tool call (a couple of minutes for some
              Magica generations) visible as it happens, instead of only
              once the entire turn finishes and this bubble gets replaced
              by the real persisted message. */}
          {liveToolBlocks.length > 0 && <ContentBlocks blocks={liveToolBlocks} role="assistant" />}
          {streamingText ? (
            <Markdown>{streamingText}</Markdown>
          ) : liveToolBlocks.length === 0 && pendingApprovals.length === 0 ? (
            <span className="animate-pulse text-muted-foreground">thinking…</span>
          ) : null}
          {/* The run is genuinely parked on each of these — nothing else
              moves until they're answered, so they render last, where the
              next thing to happen would be. */}
          {pendingApprovals.map((approval) => (
            <ApprovalCard key={approval.token} approval={approval} />
          ))}
          {stopping && (
            <span className="text-xs text-muted-foreground">
              Stopping after the current step…
            </span>
          )}
        </Bubble>
      )}
      {status === "error" && error && <p className="text-center text-sm text-destructive">{error}</p>}
    </div>
    </div>
  );
}
