import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useBlockedIds() {
  return useQuery({
    queryKey: ["blocked-ids"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return new Set<string>();
      const { data } = await supabase
        .from("blocks")
        .select("blocked_id")
        .eq("blocker_id", uid);
      return new Set<string>((data ?? []).map((b: any) => b.blocked_id));
    },
    staleTime: 60_000,
  });
}

/** Block a user and close any open match threads with them. */
export async function blockUser(blockedId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("block_user", {
    p_blocked_id: blockedId,
  });
  if (error) throw error;
}
