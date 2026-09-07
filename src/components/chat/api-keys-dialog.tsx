"use client";

import { useState } from "react";
import { KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopyButton } from "./copy-button";
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from "@/hooks/use-api-keys";
import type { ApiKeySummary } from "@/contracts/api-keys";
import { cn } from "@/lib/utils";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * The full secret, shown exactly once — same convention as the backend's
 * scripts/mint-api-key.ts and the public docs: it's never retrievable
 * again after this, so the only way off this screen is acknowledging that.
 */
function RevealedKey({ name, apiKey, onDone }: { name: string; apiKey: string; onDone: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2 rounded-lg border border-activity-skill/40 bg-activity-skill/5 p-3 text-xs">
        <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-activity-skill" />
        <p className="text-muted-foreground">
          This is the only time <span className="font-medium text-foreground">{name}</span>&apos;s full key is shown.
          Copy it now — it can&apos;t be retrieved again after you close this.
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2">
        <code className="min-w-0 flex-1 truncate font-mono text-sm">{apiKey}</code>
        <CopyButton text={apiKey} />
      </div>
      <Button onClick={onDone} className="self-end">
        Done — I&apos;ve saved it
      </Button>
    </div>
  );
}

function ApiKeyRow({ apiKey }: { apiKey: ApiKeySummary }) {
  const revoke = useRevokeApiKey();
  const revoked = !!apiKey.revokedAt;

  return (
    <div className={cn("flex items-center gap-3 rounded-lg border border-border px-3 py-2.5", revoked && "opacity-50")}>
      <KeyRound className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{apiKey.name}</span>
          {revoked && (
            <span className="shrink-0 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[0.65rem] font-medium text-destructive">
              Revoked
            </span>
          )}
        </div>
        <p className="truncate font-mono text-xs text-muted-foreground">{apiKey.keyPrefix}…</p>
        <p className="text-[0.7rem] text-muted-foreground">
          Created {formatDate(apiKey.createdAt)} · Last used {apiKey.lastUsedAt ? formatDate(apiKey.lastUsedAt) : "never"}
        </p>
      </div>
      {!revoked && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm(`Revoke "${apiKey.name}"? Anything using this key will stop working immediately.`)) {
              revoke.mutate(apiKey.id);
            }
          }}
          disabled={revoke.isPending}
          className="shrink-0 text-muted-foreground hover:text-destructive"
        >
          Revoke
        </Button>
      )}
    </div>
  );
}

function CreateKeyForm({ onCreated }: { onCreated: (name: string, key: string) => void }) {
  const [name, setName] = useState("");
  const create = useCreateApiKey();

  function submit() {
    const trimmed = name.trim();
    if (!trimmed || create.isPending) return;
    create.mutate(
      { name: trimmed },
      {
        onSuccess: (result) => {
          setName("");
          onCreated(result.name, result.key);
        },
      },
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Key name, e.g. local dev"
        aria-label="New key name"
        disabled={create.isPending}
      />
      <Button onClick={submit} disabled={!name.trim() || create.isPending} className="shrink-0">
        {create.isPending && <Loader2 className="size-3.5 animate-spin" />}
        Create
      </Button>
    </div>
  );
}

export function ApiKeysDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data, isLoading } = useApiKeys();
  const [revealed, setRevealed] = useState<{ name: string; key: string } | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) setRevealed(null); // never carry a shown secret across a reopen
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>API Keys</DialogTitle>
          <DialogDescription>
            Credentials for the public REST API (<code className="text-xs">/api/v1</code>) — see the API docs for how
            to use one.
          </DialogDescription>
        </DialogHeader>

        {revealed ? (
          <RevealedKey name={revealed.name} apiKey={revealed.key} onDone={() => setRevealed(null)} />
        ) : (
          <div className="flex flex-col gap-4">
            <CreateKeyForm onCreated={(name, key) => setRevealed({ name, key })} />
            <div className="flex flex-col gap-2">
              {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!isLoading && data?.items.length === 0 && (
                <p className="text-sm text-muted-foreground">No keys yet — create one above.</p>
              )}
              {data?.items.map((apiKey) => (
                <ApiKeyRow key={apiKey.id} apiKey={apiKey} />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
