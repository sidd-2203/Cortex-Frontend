"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listChats, createChat, listMessages, updateChat, deleteChat } from "@/lib/api-client";
import { useChatUiStore } from "@/stores/chat-ui-store";

/**
 * Every query/mutation here fetches a fresh Clerk session token per call
 * rather than caching one, since Clerk rotates the JWT frequently — see
 * the api-client module comment on why this is a Bearer header at all.
 */
export function useChats(search?: string) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["chats", { search }],
    queryFn: async () => {
      const token = await getToken();
      return listChats(token, search ? { search } : {});
    },
  });
}

export function useCreateChat() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (title?: string) => {
      const token = await getToken();
      return createChat(token, title);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });
}

export function useTogglePinChat() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ chatId, pinned }: { chatId: string; pinned: boolean }) => {
      const token = await getToken();
      return updateChat(token, chatId, { pinned });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });
}

export function useDeleteChat() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const activeChatId = useChatUiStore((s) => s.activeChatId);
  const setActiveChat = useChatUiStore((s) => s.setActiveChat);
  return useMutation({
    mutationFn: async (chatId: string) => {
      const token = await getToken();
      await deleteChat(token, chatId);
      return chatId;
    },
    onSuccess: (deletedChatId) => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      // Deleting the chat you're currently looking at needs to also clear
      // it from the workspace — otherwise the composer keeps sending to a
      // chat that no longer exists.
      if (activeChatId === deletedChatId) setActiveChat(null);
    },
  });
}

export function useMessages(chatId: string | null) {
  const { getToken } = useAuth();
  const status = useChatUiStore((s) => s.status);
  return useQuery({
    queryKey: ["messages", chatId],
    queryFn: async () => {
      const token = await getToken();
      return listMessages(token, chatId!);
    },
    enabled: !!chatId,
    // Not staleTime: Infinity. That was justified by "messages are appended,
    // not edited, once persisted" — no longer true: a Trigger.dev retry
    // re-runs runTurn() for the same run, which resets the existing
    // assistant message row (status back to STREAMING, content cleared) and
    // rewrites it on the retry's success. Frozen-forever caching made the
    // UI depend on exactly one invalidation landing at exactly the right
    // moment, with no way to recover if it didn't — which is what left a
    // successful second attempt still showing the first attempt's failure.
    staleTime: 5_000,
    // Self-healing for the same reason the active-run query polls (see
    // use-agent-run-subscription): while a turn is in flight, the row can
    // change underneath us more than once, and the terminal notification
    // that would normally trigger a refetch is exactly the thing that can
    // go missing across a retry.
    refetchInterval: status === "streaming" ? 10_000 : false,
  });
}
