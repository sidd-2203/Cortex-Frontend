"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Paperclip, X, FileText } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useChatUiStore } from "@/stores/chat-ui-store";
import { useFileUpload } from "@/hooks/use-file-upload";
import { cn } from "@/lib/utils";

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
 * A single seamless rounded-full pill with the attach/send icons flush
 * inside it, rather than a bordered card with separate buttons beside it.
 * The caller controls placement (bottom-pinned bar vs. centered on an empty
 * chat) via `className` on the outer wrapper — this component only owns the
 * pill and the attachment chips above it.
 */
export function Composer({
  onSend,
  className,
  presetText,
}: {
  onSend: (text: string, attachmentIds: string[]) => Promise<void>;
  className?: string;
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
  const isStreaming = status === "streaming";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { pending, addFile, removeAttachment, clear, readyAttachmentIds, isUploading } = useFileUpload();

  // Focusing is a real imperative DOM action, so this part does belong in
  // an effect — it only runs when a new preset actually got applied above.
  useEffect(() => {
    if (appliedPreset !== undefined) textareaRef.current?.focus();
  }, [appliedPreset]);

  async function submit() {
    const text = value.trim();
    if (!text || isStreaming || isUploading) return;
    setValue("");
    const attachmentIds = readyAttachmentIds;
    clear();
    await onSend(text, attachmentIds);
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
      <div className="flex items-end gap-1 rounded-full border border-border bg-card py-1.5 pl-2 pr-1.5 shadow-sm focus-within:ring-2 focus-within:ring-ring/30">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming}
          aria-label="Attach a file"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
        >
          <Paperclip className="size-4" />
        </button>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Cortex…"
          rows={1}
          disabled={isStreaming}
          className="min-h-8 max-h-48 resize-none overflow-y-auto border-none bg-transparent px-0 py-1.5 shadow-none focus-visible:ring-0 dark:bg-transparent"
          aria-label="Message composer"
        />
        <button
          onClick={() => void submit()}
          disabled={isStreaming || isUploading || !value.trim()}
          aria-label={isStreaming ? "Sending" : "Send"}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <ArrowUp className="size-4" />
        </button>
      </div>
    </div>
  );
}
