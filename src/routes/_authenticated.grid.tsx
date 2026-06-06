import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBlockedIds } from "@/lib/blocks";
import { StorageImg } from "@/components/storage-img";

export const Route = createFileRoute("/_authenticated/grid")({
  head: () => ({ meta: [{ title: "탐색 — 숨결" }] }),
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
  const [query, setQuery] = useState("");
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

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (item) =>
        item.text.toLowerCase().includes(q) ||
        (item.category ?? "").toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <main>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-4 border-b border-border space-y-3">
        <h1 className="font-serif text-2xl tracking-tight">탐색</h1>

        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
            strokeWidth={1.5}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="예: 커피, 계절, 책..."
            className="w-full bg-muted/50 border border-border rounded-full pl-9 pr-9 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-foreground/30"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="지우기"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </header>

      <section className="px-4 py-6 space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-44 bg-muted rounded-2xl animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">
            {query ? `"${query}"에 맞는 질문이 없어요.` : "아직 모인 숨이 없어요."}
          </p>
        ) : (
          filtered.map((q) => (
            <Link
              key={q.id}
              to="/question/$questionId"
              params={{ questionId: String(q.id) }}
              className="block border border-border rounded-2xl overflow-hidden hover:border-foreground/30 transition-colors"
            >
              <div className="px-5 pt-5 pb-3">
                <CategoryBadge category={q.category} />
                <p className="font-serif text-[16px] mt-2 leading-snug">
                  {q.text}
                </p>
                <span className="text-[11px] text-muted-foreground">
                  숨 {q.count}개
                </span>
              </div>

              <div className="grid grid-cols-4 gap-px bg-border">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-background">
                    {q.covers[i] ? (
                      <StorageImg
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
