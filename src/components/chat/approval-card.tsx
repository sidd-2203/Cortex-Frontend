"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useMutation } from "@tanstack/react-query";
import { ShieldQuestion, Loader2 } from "lucide-react";
import { resolveWaitpoint } from "@/lib/api-client";
import { useChatUiStore } from "@/stores/chat-ui-store";
import type { ApprovalRequiredEvent } from "@/contracts/tool-stream";
import { KeyValueList } from "./key-value-list";

/** Seconds until `iso`, floored at 0. */
function secondsUntil(iso: string): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * The human gate in front of a paid tool call: the run is genuinely parked
 * on a Trigger.dev waitpoint until this is answered, so this card is the
 * only thing that lets it continue.
 *
 * Expiry is handled here rather than left to hang — when the countdown
 * reaches zero the buttons are replaced with what actually happened and
 * what to do about it, which is the brief's "expire safely, clear stale
 * overlays, and tell the user how to continue later." The card is removed
 * outright once the backend's approval_resolved event lands (answered here,
 * answered in another tab, or released by a Stop).
 */
export function ApprovalCard({ approval }: { approval: ApprovalRequiredEvent }) {
  const { getToken } = useAuth();
  const stopping = useChatUiStore((s) => s.stopping);
  const [remaining, setRemaining] = useState(() => secondsUntil(approval.expiresAt));

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining(secondsUntil(approval.expiresAt)), 1000);
    return () => clearInterval(id);
  }, [approval.expiresAt, remaining]);

  const resolve = useMutation({
    mutationFn: async (decision: { approved: boolean; approveAll?: boolean }) => {
      const token = await getToken();
      return resolveWaitpoint(token, approval.token, decision);
    },
    // No cache to invalidate and nothing to clear locally — the card goes
    // away when the run's own approval_resolved event arrives, so what's
    // shown always reflects the run's real state rather than this tab's
    // optimism.
  });

  const expired = remaining <= 0;
  const busy = resolve.isPending;

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-activity-skill/40 bg-activity-skill/5 p-3 text-xs">
      <div className="flex items-center gap-2">
        <ShieldQuestion className="size-4 shrink-0 text-activity-skill" />
        <span className="font-medium text-foreground">Approval needed</span>
        <span className="ml-auto tabular-nums text-muted-foreground">
          {expired ? "expired" : `expires in ${formatCountdown(remaining)}`}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-muted-foreground">
          Run <span className="font-mono text-foreground">{approval.toolName}</span> for{" "}
          <span className="font-medium text-foreground">
            {approval.cost} credit{approval.cost === 1 ? "" : "s"}
          </span>
          ?
        </p>
        <KeyValueList data={approval.input} />
      </div>

      {expired ? (
        <p className="text-muted-foreground">
          This request timed out waiting for an answer, so the tool never ran and nothing was charged. Send the message
          again to retry it.
        </p>
      ) : resolve.isError ? (
        <p className="text-destructive">
          Couldn&apos;t submit that decision — {resolve.error instanceof Error ? resolve.error.message : "try again"}.
        </p>
      ) : null}

      {!expired && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => resolve.mutate({ approved: true })}
            disabled={busy || stopping}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 className="size-3 animate-spin" />}
            Approve
          </button>
          <button
            onClick={() => resolve.mutate({ approved: true, approveAll: true })}
            disabled={busy || stopping}
            className="rounded-lg border border-border px-3 py-1.5 font-medium hover:bg-secondary disabled:opacity-50"
          >
            Approve all this turn
          </button>
          <button
            onClick={() => resolve.mutate({ approved: false })}
            disabled={busy || stopping}
            className="rounded-lg px-3 py-1.5 font-medium text-muted-foreground hover:bg-secondary hover:text-destructive disabled:opacity-50"
          >
            Deny
          </button>
        </div>
      )}
    </div>
  );
}
