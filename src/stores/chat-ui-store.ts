import { create } from "zustand";

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
  error: string | null;
  setActiveChat: (chatId: string | null) => void;
  startRun: (sub: { runId: string; triggerRunId: string; publicAccessToken: string }) => void;
  setStreamingText: (text: string) => void;
  finish: () => void;
  fail: (message: string) => void;
}

const idleFields = {
  runId: null,
  triggerRunId: null,
  publicAccessToken: null,
  status: "idle" as const,
  streamingText: "",
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
      error: null,
    }),
  setStreamingText: (text) => set({ streamingText: text }),
  finish: () => set({ ...idleFields }),
  fail: (message) => set({ status: "error", error: message }),
}));
