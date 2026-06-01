import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "오늘의 숨 — 숨결" }] }),
  component: HomePage,
});

function HomePage() {
  const [skipSeed, setSkipSeed] = useState(0);
  const [skipping, setSkipping] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["current-question", skipSeed],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user!.id;

      const { data: answered } = await supabase
        .from("answers")
        .select("question_id")
        .eq("user_id", userId);
      const answeredIds = new Set<number>((answered ?? []).map((r: any) => r.question_id));

      const { data: candidates } = await supabase
        .from("questions")
        .select("id, text, category, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(500);

      const pool = (candidates ?? []).filter((q: any) => !answeredIds.has(q.id));
      if (pool.length === 0) return null;

      // Deterministic-ish pick: first unanswered, or random if skipped
      const question = skipSeed > 0
        ? pool[Math.floor(Math.random() * pool.length)]
        : pool[0];

      return { question, answeredCount: answeredIds.size };
    },
  });

  async function handleSkip() {
    if (skipping) return;
    setSkipping(true);
    try {
      setSkipSeed((s) => s + 1);
      await refetch();
    } finally {
      setSkipping(false);
    }
  }

  return (
    <main>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-5 border-b border-border">
        <h1 className="font-serif text-2xl tracking-tight">기록</h1>
      </header>

      <section className="px-6 py-10">
        {isLoading ? (
          <div className="aspect-square bg-muted rounded-2xl animate-pulse" />
        ) : !data ? (
          <div className="text-center py-20">
            <p className="text-sm text-muted-foreground">
              모든 질문에 답하셨어요.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-2">
              새 질문이 곧 더해질 거예요.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <span className="text-[11px] font-semibold text-accent uppercase tracking-widest">
                질문
              </span>
              <h2 className="font-serif text-3xl mt-2 leading-snug text-balance break-keep [word-break:keep-all]">
                {data.question.text}
              </h2>
            </div>
            <Link
              to="/answer/$questionId"
              params={{ questionId: String(data.question.id) }}
              className="block"
            >
              <div className="w-full aspect-square bg-surface rounded-2xl border border-border grid place-items-center hover:bg-secondary transition-colors">
                <div className="text-center">
                  <div className="text-2xl mb-2">＋</div>
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">
                    사진으로 답하기
                  </span>
                </div>
              </div>
            </Link>
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={handleSkip}
                disabled={skipping}
                className="text-xs text-muted-foreground underline underline-offset-4 disabled:opacity-50"
              >
                {skipping ? "다른 질문을 찾는 중…" : "이 질문은 다음에 답할게요 →"}
              </button>
            </div>
          </>
        )}
      </section>

      <section className="px-6 pb-8">
        <Link
          to="/backlog"
          className="block text-center text-sm text-muted-foreground underline underline-offset-4"
        >
          질문 전체 보기
        </Link>
      </section>
    </main>
  );
}
