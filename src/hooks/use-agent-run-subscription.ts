"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeRun, useRealtimeStream } from "@trigger.dev/react-hooks";
import { getActiveRun } from "@/lib/api-client";
import { useChatUiStore } from "@/stores/chat-ui-store";
import {
  ToolStreamEventSchema,
  type ToolStreamEvent,
  type ApprovalRequiredEvent,
} from "@/contracts/tool-stream";
import type { ContentBlock } from "@/contracts/content-blocks";

/**
 * Reconstructs the live tool_use/tool_result blocks from every "tool"
 * stream part received so far — re-derived from scratch each time rather
 * than appended incrementally, since useRealtimeStream hands back the full
 * list of parts on every change anyway, and a turn only ever has a handful
 * of tool calls. A "finished" event replaces its matching "started" block
 * in place (now carrying validated input) and appends the result right
 * after it.
 */
function buildLiveToolBlocks(events: ToolStreamEvent[]): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const indexById = new Map<string, number>();
  for (const event of events) {
    if (event.kind === "started") {
      indexById.set(event.block.id, blocks.length);
      blocks.push(event.block);
    } else if (event.kind === "finished") {
      const idx = indexById.get(event.block.id);
      if (idx !== undefined) blocks[idx] = event.block;
      else blocks.push(event.block);
      blocks.push(event.result);
    }
  }
  return blocks;
}

/**
 * The approvals still waiting on an answer — every approval_required that
 * hasn't been retired by a matching approval_resolved. Derived from the
 * full replayed stream rather than tracked incrementally, so a reload
 * mid-approval rebuilds the card instead of leaving the run looking hung,
 * and an approval answered in another tab disappears here too.
 */
function buildPendingApprovals(events: ToolStreamEvent[]): ApprovalRequiredEvent[] {
  const pending = new Map<string, ApprovalRequiredEvent>();
  for (const event of events) {
    if (event.kind === "approval_required") pending.set(event.token, event);
    else if (event.kind === "approval_resolved") pending.delete(event.token);
  }
  return [...pending.values()];
}

/**
 * Two jobs, because they're really the same concern from different angles:
 *
 * 1. Reload recovery — on mount (or switching chats), ask the backend "is
 *    there an in-flight run here?" and resume watching it if so. Without
 *    this, refreshing the page mid-response would silently lose it — the
 *    Zustand store is only in-memory.
 * 2. The live subscription itself — once there's a triggerRunId (from a
 *    fresh send or from #1), read its Realtime streams directly from
 *    Trigger.dev and mirror progress into the store, which MessageList and
 *    Composer read from. Two separate streams: "delta" for text tokens,
 *    "tool" for tool-call start/finish events (see agent-turn.ts).
 */
export function useAgentRunSubscription(chatId: string | null) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const {
    status,
    triggerRunId,
    publicAccessToken,
    startRun,
    setStreamingText,
    setLiveToolBlocks,
    setPendingApprovals,
    finish,
    fail,
  } = useChatUiStore();

  // --- 1. Reload recovery -------------------------------------------------
  const { data: resumed } = useQuery({
    queryKey: ["active-run", chatId],
    queryFn: async () => {
      const token = await getToken();
      return getActiveRun(token, chatId!);
    },
    enabled: !!chatId,
    staleTime: 0,
  });

  useEffect(() => {
    // Only resume if we're not already tracking a run — don't clobber a
    // send that just happened locally in this same tab.
    if (resumed && status === "idle" && !triggerRunId) {
      startRun({ runId: resumed.runId, triggerRunId: resumed.triggerRunId, publicAccessToken: resumed.publicAccessToken });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumed]);

  // --- 2. Live subscription ------------------------------------------------
  const enabled = status === "streaming" && !!triggerRunId && !!publicAccessToken;

  const { parts } = useRealtimeStream<string>(triggerRunId ?? "", "delta", {
    accessToken: publicAccessToken ?? undefined,
    enabled,
  });

  useEffect(() => {
    if (enabled) setStreamingText(parts.join(""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, enabled]);

  const { parts: toolParts } = useRealtimeStream<string>(triggerRunId ?? "", "tool", {
    accessToken: publicAccessToken ?? undefined,
    enabled,
  });

  useEffect(() => {
    if (!enabled) return;
    // A malformed part would be a real bug (backend and frontend disagreeing
    // on the wire shape), but one bad part shouldn't take down the whole
    // live view — skip it and keep whatever parsed correctly.
    const events = toolParts
      .map((part) => {
        try {
          return ToolStreamEventSchema.parse(JSON.parse(part));
        } catch {
          return null;
        }
      })
      .filter((e): e is ToolStreamEvent => e !== null);
    setLiveToolBlocks(buildLiveToolBlocks(events));
    setPendingApprovals(buildPendingApprovals(events));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolParts, enabled]);

  useRealtimeRun(triggerRunId ?? undefined, {
    accessToken: publicAccessToken ?? undefined,
    enabled,
    onComplete: (run) => {
      if (run.status === "COMPLETED") {
        finish();
      } else {
        fail(`Run ended with status ${run.status}`);
      }
      if (chatId) {
        queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
        queryClient.invalidateQueries({ queryKey: ["chats"] });
      }
    },
  });
}
