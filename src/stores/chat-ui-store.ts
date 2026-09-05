import { create } from "zustand";

// Ephemeral, client-only UI state for the turn currently in flight. This is
// deliberately separate from the message history (which lives in TanStack
// Query's cache, backed by the server) — this store only tracks the token
// stream while it's arriving, so the composer and message list can both
// react to it without prop drilling. Once a turn completes, the persisted
// message from the server is the source of truth and this resets.
interface ChatUiState {
  activeChatId: string | null;
  runId: string | null;
  status: "idle" | "streaming" | "error";
  streamingText: string;
  error: string | null;
  setActiveChat: (chatId: string | null) => void;
  startRun: (runId: string) => void;
  appendDelta: (text: string) => void;
  finish: () => void;
  fail: (message: string) => void;
}

export const useChatUiStore = create<ChatUiState>((set) => ({
  activeChatId: null,
  runId: null,
  status: "idle",
  streamingText: "",
  error: null,
  setActiveChat: (chatId) => set({ activeChatId: chatId, runId: null, status: "idle", streamingText: "", error: null }),
  startRun: (runId) => set({ runId, status: "streaming", streamingText: "", error: null }),
  appendDelta: (text) => set((s) => ({ streamingText: s.streamingText + text })),
  finish: () => set({ status: "idle", runId: null, streamingText: "" }),
  fail: (message) => set({ status: "error", error: message }),
}));
