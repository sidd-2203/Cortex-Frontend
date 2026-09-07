import { create } from "zustand";
import type { ContentBlock } from "@/contracts/content-blocks";
import type { ApprovalRequiredEvent } from "@/contracts/tool-stream";

// Ephemeral, client-only UI state for the turn currently in flight. This is
// deliberately separate from the message history (which lives in TanStack
// Query's cache, backed by the server) — this store only tracks the token
// stream while it's arriving, so the composer and message list can both
// react to it without prop drilling. Once a turn completes, the persisted
// message from the server is the source of truth and this resets.
//
// `triggerRunId` + `publicAccessToken` are what let a subscribing component
// (useAgentRunSubscription) talk to Trigger.dev Realtime directly, rather
// than proxying the stream through our own backend.
interface ChatUiState {
  activeChatId: string | null;
  runId: string | null;
  triggerRunId: string | null;
  publicAccessToken: string | null;
  status: "idle" | "streaming" | "error";
  streamingText: string;
  /**
   * tool_use/tool_result blocks reconstructed live from the "tool" Realtime
   * stream — same shape a persisted message's content array has, so
   * MessageList renders these with the exact same component. Without this,
   * a tool call was invisible until the whole turn finished; now it shows
   * up (and updates to its result) as it actually happens.
   */
  liveToolBlocks: ContentBlock[];
  /**
   * Approval waitpoints the run is currently parked on, newest last —
   * derived from the same "tool" stream, so a reload replays them and the
   * card comes back rather than the run looking mysteriously stuck. An
   * entry is removed the moment its approval_resolved event arrives
   * (answered here, answered in another tab, denied by a Stop, or expired),
   * which is what keeps a stale overlay from lingering.
   */
  pendingApprovals: ApprovalRequiredEvent[];
  /** Set once Stop has been accepted, until the run actually ends — the turn is winding down, not still working. */
  stopping: boolean;
  error: string | null;
  setActiveChat: (chatId: string | null) => void;
  /**
   * `initialStopping` covers reload-recovery specifically — resuming a run
   * that's already in the backend's STOPPING state (see getActiveRun) needs
   * to render as "stopping," not as a fresh, freely-running turn, so the
   * button and banner are honest immediately rather than only catching up
   * once the next stream part arrives.
   */
  startRun: (sub: { runId: string; triggerRunId: string; publicAccessToken: string; initialStopping?: boolean }) => void;
  setStreamingText: (text: string) => void;
  setLiveToolBlocks: (blocks: ContentBlock[]) => void;
  setPendingApprovals: (approvals: ApprovalRequiredEvent[]) => void;
  setStopping: (stopping: boolean) => void;
  finish: () => void;
  fail: (message: string) => void;
}

const idleFields = {
  runId: null,
  triggerRunId: null,
  publicAccessToken: null,
  status: "idle" as const,
  streamingText: "",
  liveToolBlocks: [] as ContentBlock[],
  pendingApprovals: [] as ApprovalRequiredEvent[],
  stopping: false,
  error: null,
};

export const useChatUiStore = create<ChatUiState>((set) => ({
  activeChatId: null,
  ...idleFields,
  setActiveChat: (chatId) => set({ activeChatId: chatId, ...idleFields }),
  startRun: (sub) =>
    set({
      runId: sub.runId,
      triggerRunId: sub.triggerRunId,
      publicAccessToken: sub.publicAccessToken,
      status: "streaming",
      streamingText: "",
      liveToolBlocks: [],
      pendingApprovals: [],
      stopping: sub.initialStopping ?? false,
      error: null,
    }),
  setStreamingText: (text) => set({ streamingText: text }),
  setLiveToolBlocks: (blocks) => set({ liveToolBlocks: blocks }),
  setPendingApprovals: (approvals) => set({ pendingApprovals: approvals }),
  setStopping: (stopping) => set({ stopping }),
  finish: () => set({ ...idleFields }),
  // Spreads idleFields rather than just { status, error } so `stopping`
  // (and every other in-flight field) can't outlive the run that set it —
  // a run that fails while winding down from Stop must not leave the
  // button stuck showing Stop for a turn that's already gone.
  fail: (message) => set({ ...idleFields, status: "error", error: message }),
}));
