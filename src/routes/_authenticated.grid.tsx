import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBlockedIds } from "@/lib/blocks";

export const Route = createFileRoute("/_authenticated/grid")({
  head: () => ({ meta: [{ title: "탐색 — 결" }] }),
  component: GridPage,
});

type QCard = {
  id: number;
  text: string;
  category: string | null;
  count: number;
  covers: string[];
};

function GridPage() {
  const { data: blockedIds } = useBlockedIds();
  const { data, isLoading } = useQuery({
    queryKey: ["explore-questions", Array.from(blockedIds ?? []).sort().join(",")],
    queryFn: async (): Promise<QCard[]> => {
      const { data: answers } = await supabase
        .from("answers")
        .select("question_id, user_id, photos, created_at, questions(id, text, category)")
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(500);

      const blocked = blockedIds ?? new Set<string>();
      const map = new Map<number, QCard>();
      for (const a of (answers ?? []) as any[]) {
        if (!a.questions) continue;
        if (blocked.has(a.user_id)) continue;
        const qid = a.questions.id as number;
        const existing = map.get(qid);
        const cover: string | undefined = a.photos?.[0];
        if (!existing) {
          map.set(qid, {
            id: qid,
            text: a.questions.text,
            category: a.questions.category,
            count: 1,
            covers: cover ? [cover] : [],
          });
        } else {
          existing.count += 1;
          if (existing.covers.length < 4 && cover) existing.covers.push(cover);
        }
      }
      return Array.from(map.values()).sort((a, b) => b.count - a.count);
    },
  });

  return (
    <main>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-5 border-b border-border flex items-end justify-between gap-3">
        <div>
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
            탐색
          </span>
          <h2 className="font-serif text-xl mt-1 leading-snug">
            질문별로 모아보기
          </h2>
        </div>
        <Link
          to="/notifications"
          aria-label="알림"
          className="p-2 -m-2 text-muted-foreground hover:text-foreground"
        >
          <Bell className="size-5" strokeWidth={1.5} />
        </Link>
      </header>

      <section className="px-4 py-6 space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-44 bg-muted rounded-2xl animate-pulse" />
          ))
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">
            아직 모인 결이 없어요.
          </p>
        ) : (
          data.map((q) => (
            <Link
              key={q.id}
              to="/question/$questionId"
              params={{ questionId: String(q.id) }}
              className="block border border-border rounded-2xl overflow-hidden hover:border-foreground/30 transition-colors"
            >
              <div className="px-5 pt-5 pb-3">
                {q.category && (
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {q.category}
                  </span>
                )}
                <p className="font-serif text-[16px] mt-1 leading-snug">
                  {q.text}
                </p>
                <span className="text-[11px] text-muted-foreground">
                  결 {q.count}개
                </span>
              </div>
              <div className="grid grid-cols-4 gap-px bg-border">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-background">
                    {q.covers[i] ? (
                      <img
                        src={q.covers[i]}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            </Link>
          ))
        )}
      </section>
    </main>
  );
}
