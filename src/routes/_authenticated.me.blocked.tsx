import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/me/blocked")({
  head: () => ({ meta: [{ title: "차단 목록 — Ditto" }] }),
  component: BlockedListPage,
});

function BlockedListPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["blocked-list"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;
      const { data: rows } = await supabase
        .from("blocks")
        .select("blocked_id, created_at")
        .eq("blocker_id", uid)
        .order("created_at", { ascending: false });
      const ids = (rows ?? []).map((r: any) => r.blocked_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, handle, display_name, avatar_url")
        .in("id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return (rows ?? []).map((r: any) => ({
        ...r,
        profile: map.get(r.blocked_id) ?? null,
      }));
    },
  });

  const unblock = useMutation({
    mutationFn: async (blockedId: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("blocks")
        .delete()
        .eq("blocker_id", userData.user!.id)
        .eq("blocked_id", blockedId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("차단을 해제했어요.");
      qc.invalidateQueries({ queryKey: ["blocked-list"] });
      qc.invalidateQueries({ queryKey: ["blocked-ids"] });
      qc.invalidateQueries({ queryKey: ["home-feed"] });
      qc.invalidateQueries({ queryKey: ["explore-questions"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "다시 시도해 주세요."),
  });

  return (
    <main>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-5 border-b border-border">
        <Link to="/me" className="text-[11px] uppercase tracking-widest text-muted-foreground">
          ← 내 결
        </Link>
        <h2 className="font-serif text-xl mt-1 leading-snug">차단 목록</h2>
      </header>

      <section className="px-6 py-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-10">불러오는 중...</p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">
            차단한 사용자가 없어요.
          </p>
        ) : (
          <ul className="space-y-3">
            {data.map((b: any) => (
              <li
                key={b.blocked_id}
                className="flex items-center justify-between gap-3 border border-border rounded-xl px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {b.profile?.avatar_url ? (
                    <img
                      src={b.profile.avatar_url}
                      alt=""
                      className="size-9 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <div className="size-9 rounded-full bg-muted border border-border" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium truncate">
                      {b.profile?.display_name ?? "알 수 없는 사용자"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      @{b.profile?.handle ?? "anon"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => unblock.mutate(b.blocked_id)}
                  disabled={unblock.isPending}
                  className="text-[11px] uppercase tracking-widest border border-border rounded-full px-3 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  해제
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
