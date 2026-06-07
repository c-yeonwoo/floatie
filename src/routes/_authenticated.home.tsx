import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CategoryBadge, CategoryFilterChip } from "@/components/category-badge";

type Search = { category?: string };

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "오늘의 숨 — 숨결" }] }),
  validateSearch: (search: Record<string, unknown>): Search => {
    const c = typeof search.category === "string" ? search.category.trim() : "";
    return c ? { category: c } : {};
  },
  component: HomePage,
});

function HomePage() {
  const { category } = Route.useSearch();
  const navigate = useNavigate({ from: "/home" });
  const [skipSeed, setSkipSeed] = useState(0);
  const [skipping, setSkipping] = useState(false);
  

  const { data, isLoading } = useQuery({
    queryKey: ["current-question", skipSeed, category ?? ""],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) return null;

      let qBuilder = supabase
        .from("questions")
        .select("id, text, category, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(200);
      if (category) qBuilder = qBuilder.eq("category", category);

      const [answeredRes, candidatesRes] = await Promise.all([
        supabase.from("answers").select("question_id").eq("user_id", userId),
        qBuilder,
      ]);

      const answeredIds = new Set<number>(
        (answeredRes.data ?? []).map((r: any) => r.question_id),
      );

      const pool = (candidatesRes.data ?? []).filter(
        (q: any) => !answeredIds.has(q.id),
      );
      if (pool.length === 0) return null;

      const question = skipSeed > 0
        ? pool[Math.floor(Math.random() * pool.length)]
        : pool[0];

      return { question, answeredCount: answeredIds.size };
    },
  });

  function handleSkip() {
    if (skipping) return;
    setSkipping(true);
    // setSkipSeed changes the query key, which triggers a fresh fetch.
    setSkipSeed((s) => s + 1);
    // brief debounce so the button shows feedback
    setTimeout(() => setSkipping(false), 300);
  }


  const onBadgeClick = (c: string) => {
    navigate({ search: category === c ? {} : { category: c } });
    setSkipSeed(0);
  };

  return (
    <main>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-4 border-b border-border">
        <h1 className="font-serif text-2xl tracking-tight">오늘의 숨</h1>
      </header>

      {category && (
        <div className="px-6 pt-4">
          <CategoryFilterChip
            category={category}
            onClear={() => {
              navigate({ search: {} });
              setSkipSeed(0);
            }}
          />
        </div>
      )}

      <section className="px-6 py-8">
        {isLoading ? (
          <div className="aspect-square bg-muted rounded-2xl animate-pulse" />
        ) : !data ? (
          <div className="text-center py-20">
            <p className="text-sm text-muted-foreground">
              {category
                ? `‘${category}’ 카테고리에 남은 질문이 없어요.`
                : "모든 질문에 답하셨어요."}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-2">
              {category ? "필터를 해제해 보세요." : "새 질문이 곧 더해질 거예요."}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-7 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CategoryBadge
                  category={data.question.category}
                  onClick={onBadgeClick}
                  active={category === data.question.category}
                />
                <h2 className="font-serif text-[26px] mt-2.5 leading-snug text-balance break-keep [word-break:keep-all]">
                  {data.question.text}
                </h2>
              </div>
              <Link
                to="/backlog"
                className="shrink-0 mt-1 text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-4"
              >
                질문 전체 보기
              </Link>
            </div>

            <Link
              to="/answer/$questionId"
              params={{ questionId: String(data.question.id) }}
              className="block"
            >
              <div className="w-full aspect-square bg-surface rounded-2xl border border-border grid place-items-center hover:bg-secondary transition-colors">
                <div className="text-center">
                  <div className="text-2xl mb-2">＋</div>
                  <span className="text-[13px] uppercase tracking-widest text-muted-foreground">
                    사진으로 답하기
                  </span>
                </div>
              </div>
            </Link>
            <div className="mt-5 flex flex-col items-center gap-3">
              <Link
                to="/question/$questionId"
                params={{ questionId: String(data.question.id) }}
                className="text-sm text-foreground underline underline-offset-4"
              >
                다른 사람들의 숨 먼저 보기 →
              </Link>
            </div>
          </>
        )}
      </section>

      <section className="px-6 pb-8">
        <button
          type="button"
          onClick={handleSkip}
          disabled={skipping || !data?.question}
          className="block w-full text-center text-sm text-muted-foreground underline underline-offset-4 disabled:opacity-50"
        >
          {skipping ? "찾는 중…" : "이 질문 skip"}
        </button>
      </section>
    </main>
  );
}
