"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { getCreditBalance } from "@/lib/api-client";

export function useCreditBalance() {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["credits", "balance"],
    queryFn: async () => {
      const token = await getToken();
      return getCreditBalance(token);
    },
    // A tool call spends credits mid-run with nothing here to invalidate
    // this on completion yet — refetch periodically so the sidebar number
    // doesn't go stale for the rest of the session.
    refetchInterval: 30_000,
  });
}
