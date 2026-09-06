"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeRun, useRealtimeStream } from "@trigger.dev/react-hooks";
import { getActiveRun } from "@/lib/api-client";
import { useChatUiStore } from "@/stores/chat-ui-store";

/**
 * Two jobs, because they're really the same concern from different angles:
 *
 * 1. Reload recovery — on mount (or switching chats), ask the backend "is
 *    there an in-flight run here?" and resume watching it if so. Without
 *    this, refreshing the page mid-response would silently lose it — the
 *    Zustand store is only in-memory.
 * 2. The live subscription itself — once there's a triggerRunId (from a
 *    fresh send or from #1), read its Realtime stream directly from
 *    Trigger.dev and mirror progress into the store, which MessageList and
 *    Composer read from.
 */
export function useAgentRunSubscription(chatId: string | null) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { status, triggerRunId, publicAccessToken, startRun, setStreamingText, finish, fail } = useChatUiStore();

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
