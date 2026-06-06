import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StorageImg } from "@/components/storage-img";
import { CategoryBadge } from "@/components/category-badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "알림 — 숨결" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["received-nudges"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user?.id;
      if (!me) return [];
      const { data: rows } = await supabase
        .from("nudges")
        .select(
          "id, status, created_at, question_id, sender_id, questions(id, text, category), sender:profiles!nudges_sender_id_fkey(handle, display_name, avatar_url)",
        )
        .eq("receiver_id", me)
        .order("created_at", { ascending: false })
        .limit(50);

      // Fallback: foreign key alias may not be set up; load senders separately
      if (rows && rows.length && !(rows as any)[0].sender) {
        const ids = Array.from(new Set(rows.map((r: any) => r.sender_id)));
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, handle, display_name, avatar_url")
          .in("id", ids);
        const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
        return rows.map((r: any) => ({ ...r, sender: map.get(r.sender_id) }));
      }

      return rows ?? [];
    },
  });

  const dismiss = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from("nudges")
        .update({ status: "dismissed" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["received-nudges"] }),
    onError: (e: any) => toast.error(e?.message ?? "다시 시도해 주세요."),
  });

  const items = (data ?? []).filter((n: any) => n.status !== "dismissed");

  return (
    <main>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-4 border-b border-border flex items-center justify-between gap-3">
        <Link to="/feed" className="text-sm text-muted-foreground">
          ← 뒤로
        </Link>
        <h1 className="font-serif text-lg tracking-tight">알림</h1>
        <span className="w-10" />
      </header>

      {isLoading ? (
        <section className="px-6 py-8 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
          ))}
        </section>
      ) : items.length === 0 ? (
        <section className="px-6 py-20 text-center">
          <p className="text-sm text-muted-foreground">아직 알림이 없어요.</p>
          <p className="text-[12px] text-muted-foreground mt-2">
            누군가 당신의 결이 궁금하면 여기에 모일 거예요.
          </p>
        </section>
      ) : (
        <section className="px-6 py-6 space-y-3">
          {items.map((n: any) => {
            const s = n.sender ?? {};
            const q = n.questions;
            const answered = n.status === "answered";
            return (
              <article
                key={n.id}
                className={
                  "border border-border rounded-xl p-4 " +
                  (answered ? "opacity-60" : "")
                }
              >
                <div className="flex items-start gap-3">
                  {s.avatar_url ? (
                    <StorageImg
                      src={s.avatar_url}
                      alt=""
                      className="size-9 rounded-full object-cover border border-border shrink-0"
                    />
                  ) : (
                    <div className="size-9 rounded-full bg-surface border border-border shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-muted-foreground">
                      <Link
                        to="/u/$handle"
                        params={{ handle: s.handle ?? "" }}
                        className="text-foreground"
                      >
                        {s.display_name ?? s.handle ?? "친구"}
                      </Link>
                      <span>님이 너의 결이 궁금해해요</span>
                    </p>
                    {q && (
                      <div className="mt-2">
                        <CategoryBadge category={q.category} />
                        <p className="font-serif text-[16px] mt-1.5 leading-snug break-keep [word-break:keep-all]">
                          {q.text}
                        </p>
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-4">
                      {answered ? (
                        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                          답변 완료
                        </span>
                      ) : (
                        q && (
                          <Link
                            to="/answer/$questionId"
                            params={{ questionId: String(q.id) }}
                            className="text-[12px] underline underline-offset-4"
                          >
                            지금 답하기 →
                          </Link>
                        )
                      )}
                      {!answered && (
                        <button
                          type="button"
                          onClick={() => dismiss.mutate(n.id)}
                          className="text-[12px] text-muted-foreground underline underline-offset-4"
                        >
                          숨기기
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
