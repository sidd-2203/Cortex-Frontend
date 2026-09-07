"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useAuth } from "@clerk/nextjs";
import { ArrowUp, Paperclip, Square, X, FileText } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useChatUiStore } from "@/stores/chat-ui-store";
import { useFileUpload } from "@/hooks/use-file-upload";
import { cancelRun } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// Keep in sync with the Textarea's max-h-48 below (12rem).
const MAX_TEXTAREA_PX = 192;

function AttachmentChip({
  file,
  status,
  progress,
  error,
  onRemove,
}: {
  file: File;
  status: "uploading" | "ready" | "error";
  progress: number;
  error?: string;
  onRemove: () => void;
}) {
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  const [previewUrl] = useState(() => (isImage || isVideo ? URL.createObjectURL(file) : null));

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div
      className="group relative size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary"
      title={error ?? file.name}
    >
      {isImage && previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="" className="size-full object-cover" />
      ) : isVideo && previewUrl ? (
        <video src={previewUrl} muted playsInline preload="metadata" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center">
          <FileText className="size-6 text-muted-foreground" />
        </div>
      )}

      {status === "uploading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-xs font-medium">
          {Math.round(progress * 100)}%
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-destructive/20 text-xs font-medium text-destructive">
          Failed
        </div>
      )}

      <button
        onClick={onRemove}
        aria-label="Remove attachment"
        className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-background/80 opacity-0 transition-opacity hover:bg-background group-hover:opacity-100"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

/**
 * A single seamless rounded box, icons flush inside it rather than a
 * bordered card with separate buttons beside it. Fixed-radius
 * (rounded-3xl), not rounded-full — this box's height grows with a
 * multi-line message, and a pill radius only looks right at one height.
 *
 * The reference uses the same tall shape everywhere — text on its own
 * line, icon row below it — for both the empty-chat landing screen and the
 * normal bottom-pinned composer; only the placeholder copy differs between
 * `hero` and `bar`. The caller picks via `variant` and controls outer
 * placement via `className`.
 */
export function Composer({
  onSend,
  className,
  variant = "bar",
  presetText,
}: {
  onSend: (text: string, attachmentIds: string[]) => Promise<void>;
  className?: string;
  variant?: "hero" | "bar";
  /** Set from outside (e.g. a suggestion card) to seed the composer and focus it. */
  presetText?: string;
}) {
  const [value, setValue] = useState("");
  // Tracks the last presetText applied so a new one can be detected and
  // applied during render (React's documented pattern for "adjust state
  // when a prop changes") instead of round-tripping through an effect.
  const [appliedPreset, setAppliedPreset] = useState(presetText);
  if (presetText !== undefined && presetText !== appliedPreset) {
    setAppliedPreset(presetText);
    setValue(presetText);
  }
  const status = useChatUiStore((s) => s.status);
  const runId = useChatUiStore((s) => s.runId);
  const stopping = useChatUiStore((s) => s.stopping);
  const setStopping = useChatUiStore((s) => s.setStopping);
  // status only flips to "streaming" once sendTurn's response comes back
  // and startRun() fires — there's a real gap before that (create-chat +
  // dispatch round trip) where the store still says "idle". `dispatching`
  // covers exactly that gap, so the stop icon appears the instant Send is
  // pressed rather than only once the network round trip finishes.
  const [dispatching, setDispatching] = useState(false);
  const isStreaming = status === "streaming" || dispatching;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { getToken } = useAuth();
  const { pending, addFile, removeAttachment, clear, readyAttachmentIds, isUploading } = useFileUpload();

  // Focusing is a real imperative DOM action, so this part does belong in
  // an effect — it only runs when a new preset actually got applied above.
  useEffect(() => {
    if (appliedPreset !== undefined) textareaRef.current?.focus();
  }, [appliedPreset]);

  // Driven in JS rather than the Textarea base component's own
  // field-sizing-content (which auto-sizes to content and, per spec,
  // ignores an author-set height while doing it — fighting any max-height
  // cap instead of respecting it). scrollHeight clamped to MAX_TEXTAREA_PX
  // is what actually guarantees "grow, then stop and let the user scroll,"
  // regardless of that CSS feature's quirks in any given browser.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
  }, [value]);

  async function submit() {
    const text = value.trim();
    if (!text || isStreaming || isUploading) return;
    setValue("");
    const attachmentIds = readyAttachmentIds;
    clear();
    setDispatching(true);
    try {
      await onSend(text, attachmentIds);
    } finally {
      // A no-op once the real run has started (status is "streaming" by
      // then regardless), and what actually resets this on a dispatch
      // failure — onSend's own catch calls fail(), which sets status to
      // "error", not "streaming", so isStreaming needs this flag cleared
      // or the button would be stuck showing Stop for a run that never started.
      setDispatching(false);
    }
  }

  async function stop() {
    if (!runId || stopping) return;
    // Optimistic: the button and the thread both need to say "winding
    // down" immediately, and the run's own terminal status is what
    // ultimately clears this (finish/fail reset the store).
    setStopping(true);
    try {
      const token = await getToken();
      await cancelRun(token, runId);
    } catch {
      // The run may have finished on its own in the same moment — either
      // way there's nothing left to stop, so drop back rather than
      // stranding the button in a permanent "stopping" state.
      setStopping(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  function handleFilesSelected(files: FileList | null) {
    if (!files) return;
    for (const file of files) void addFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const fileInput = (
    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFilesSelected(e.target.files)} />
  );

  const attachButton = (
    <button
      onClick={() => fileInputRef.current?.click()}
      disabled={isStreaming}
      aria-label="Attach a file"
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
    >
      <Paperclip className="size-4" />
    </button>
  );

  // One button, two jobs: send when idle, stop the run while it's
  // streaming. The stop is cooperative — the backend flips the run to
  // STOPPING and the task winds down at its next checkpoint — so this
  // returns immediately while the turn takes a moment to actually end,
  // which is what `stopping` communicates.
  const sendButton = (
    <button
      onClick={() => (isStreaming ? void stop() : void submit())}
      disabled={isStreaming ? !runId || stopping : isUploading || !value.trim()}
      aria-label={isStreaming ? "Stop" : "Send"}
      title={isStreaming ? "Stop after the current step" : undefined}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-40",
        isStreaming ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground hover:opacity-90",
      )}
    >
      {isStreaming ? <Square className="size-3 fill-current" /> : <ArrowUp className="size-4" />}
    </button>
  );

  const textarea = (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={variant === "hero" ? "Assign a task or ask anything…" : "Message Cortex…"}
      rows={1}
      disabled={isStreaming}
      className="field-sizing-fixed scrollbar-thin min-h-8 max-h-48 resize-none overflow-y-auto border-none bg-transparent px-0 py-1.5 shadow-none focus-visible:ring-0 dark:bg-transparent"
      aria-label="Message composer"
    />
  );

  return (
    <div className={cn("mx-auto flex w-full max-w-2xl flex-col gap-2", className)}>
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pending.map((p) => (
            <AttachmentChip
              key={p.id}
              file={p.file}
              status={p.status}
              progress={p.progress}
              error={p.error}
              onRemove={() => removeAttachment(p.id)}
            />
          ))}
        </div>
      )}
      {fileInput}
      {/* rounded-3xl, not rounded-full: this box's height isn't fixed (a
          multi-line paste grows it up to MAX_TEXTAREA_PX) — a proportional
          "always fully round" radius looks like a pill at ~44px but turns
          into an exaggerated oval once it's ~190px tall. A fixed radius
          reads as a pill when short and a properly rounded box when tall.
          Same tall shape in both variants — text on its own line, icon row
          below — matching the reference's active-chat composer, which is
          just as big as the landing one rather than a compact single row. */}
      <div
        className={cn(
          "flex flex-col gap-2 rounded-3xl border border-border px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-ring/30",
          variant === "hero" ? "bg-secondary" : "bg-card",
        )}
      >
        {textarea}
        <div className="flex items-center justify-between">
          {attachButton}
          {sendButton}
        </div>
      </div>
    </div>
  );
}
