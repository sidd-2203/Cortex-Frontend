"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listApiKeys, createApiKey, revokeApiKey } from "@/lib/api-client";
import type { CreateApiKeyRequest } from "@/contracts/api-keys";

export function useApiKeys() {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const token = await getToken();
      return listApiKeys(token);
    },
  });
}

export function useCreateApiKey() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateApiKeyRequest) => {
      const token = await getToken();
      return createApiKey(token, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });
}

export function useRevokeApiKey() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      await revokeApiKey(token, id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });
}
