"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Paperclip, X, FileText } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
  const [previewUrl] = useState(() => (isImage ? URL.createObjectURL(file) : null));

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs",
        status === "error" ? "border-destructive/40 bg-destructive/10" : "border-border bg-secondary",
      )}
      title={error}
    >
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="" className="size-6 rounded object-cover" />
      ) : (
        <FileText className="size-4 text-muted-foreground" />
      )}
      <span className="max-w-32 truncate">{file.name}</span>
      {status === "uploading" && <span className="text-muted-foreground">{Math.round(progress * 100)}%</span>}
      {status === "error" && <span className="text-destructive">failed</span>}
      <button
        onClick={onRemove}
        className="rounded p-0.5 opacity-0 hover:bg-foreground/10 group-hover:opacity-100"
        aria-label="Remove attachment"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

export function Composer({ onSend }: { onSend: (text: string, attachmentIds: string[]) => Promise<void> }) {
  const [value, setValue] = useState("");
  const status = useChatUiStore((s) => s.status);
  const isStreaming = status === "streaming";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { pending, addFile, removeAttachment, clear, readyAttachmentIds, isUploading } = useFileUpload();

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
    <div className="border-t border-border/60 bg-background/70 p-4 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
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
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/40">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            size="icon"
            variant="ghost"
            className="size-9 shrink-0 rounded-xl"
            aria-label="Attach a file"
          >
            <Paperclip className="size-4" />
          </Button>
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
            disabled={isStreaming || isUploading || !value.trim()}
            size="icon"
            className="size-9 shrink-0 rounded-xl"
            aria-label={isStreaming ? "Sending" : "Send"}
          >
            <ArrowUp className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
