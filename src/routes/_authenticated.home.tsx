import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "오늘 — Ditto" }] }),
  component: HomePage,
});

const SKIP_KEY = "gyul:skip";

function readSkip(today: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SKIP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { date: string; questionId: number };
    return parsed.date === today ? parsed.questionId : null;
  } catch {
    return null;
  }
}

function writeSkip(today: string, questionId: number) {
  localStorage.setItem(SKIP_KEY, JSON.stringify({ date: today, questionId }));
}

function HomePage() {
  const today = new Date().toISOString().slice(0, 10);
  const [skippedTo, setSkippedTo] = useState<number | null>(null);
  const [skipping, setSkipping] = useState(false);

  useEffect(() => {
    setSkippedTo(readSkip(today));
  }, [today]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["daily-question", today, skippedTo],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user!.id;

      let question: { id: number; text: string; category: string | null } | null = null;

      if (skippedTo) {
        const { data: q } = await supabase
          .from("questions")
          .select("id, text, category")
          .eq("id", skippedTo)
          .maybeSingle();
        question = q as any;
      } else {
        const { data: dq } = await supabase
          .from("daily_questions")
          .select("question_id, questions(id, text, category)")
          .eq("date", today)
          .maybeSingle();
        question = (dq?.questions as any) ?? null;
      }
      if (!question) return null;

      const { data: myAnswer } = await supabase
        .from("answers")
        .select("id, photos")
        .eq("user_id", userId)
        .eq("question_id", question.id)
        .maybeSingle();
      return { question, myAnswer };
    },
  });

  async function handleSkip() {
    if (skippedTo || skipping) return;
    setSkipping(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user!.id;
      const currentId = data?.question.id;

      const { data: answered } = await supabase
        .from("answers")
        .select("question_id")
        .eq("user_id", userId);
      const excluded = new Set<number>((answered ?? []).map((r: any) => r.question_id));
      if (currentId) excluded.add(currentId);

      const { data: candidates } = await supabase
        .from("questions")
        .select("id")
        .eq("is_active", true)
        .limit(200);
      const pool = (candidates ?? [])
        .map((r: any) => r.id as number)
        .filter((id) => !excluded.has(id));
      if (pool.length === 0) {
        setSkipping(false);
        return;
      }
      const next = pool[Math.floor(Math.random() * pool.length)];
      writeSkip(today, next);
      setSkippedTo(next);
      await refetch();
    } finally {
      setSkipping(false);
    }
  }

  const skipUsed = skippedTo !== null;

  return (
    <main>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-5 flex justify-between items-end border-b border-border">
        <h1 className="font-serif text-2xl tracking-tight">Ditto</h1>
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
          {today.replace(/-/g, ". ")}
        </span>
      </header>

      <section className="px-6 py-10">
        {isLoading ? (
          <div className="aspect-square bg-muted rounded-2xl animate-pulse" />
        ) : !data ? (
          <p className="text-sm text-muted-foreground text-center py-20">
            오늘의 질문이 아직 준비되지 않았어요.
          </p>
        ) : (
          <>
            <div className="mb-8">
              <span className="text-[11px] font-semibold text-accent uppercase tracking-widest">
                {skipUsed ? "다른 질문" : "오늘의 질문"}
              </span>
              <h2 className="font-serif text-3xl mt-2 leading-snug text-balance">
                {data.question.text}
              </h2>
            </div>
            {data.myAnswer && data.myAnswer.photos?.[0] ? (
              <div>
                <img
                  src={data.myAnswer.photos[0]}
                  alt=""
                  className="w-full aspect-square object-cover rounded-2xl"
                />
                {data.myAnswer.photos.length > 1 && (
                  <p className="mt-2 text-[11px] text-muted-foreground text-right">
                    +{data.myAnswer.photos.length - 1}장
                  </p>
                )}
                <p className="mt-6 text-xs text-muted-foreground text-center">
                  오늘의 결을 남기셨어요.{" "}
                  <Link to="/grid" className="underline underline-offset-4">
                    다른 분들의 결 보러가기
                  </Link>
                </p>
              </div>
            ) : (
              <>
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
                <div className="mt-4 flex flex-col items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSkip}
                    disabled={skipUsed || skipping}
                    className="text-xs text-muted-foreground underline underline-offset-4 disabled:no-underline disabled:opacity-50"
                  >
                    {skipUsed
                      ? "오늘의 스킵을 사용하셨어요"
                      : skipping
                        ? "다른 질문을 찾는 중…"
                        : "이 질문은 다음에 답할게요 →"}
                  </button>
                  {!skipUsed && (
                    <span className="text-[10px] text-muted-foreground/70 uppercase tracking-widest">
                      스킵은 하루에 한 번
                    </span>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </section>

      <section className="px-6 pb-8">
        <Link
          to="/backlog"
          className="block text-center text-sm text-muted-foreground underline underline-offset-4"
        >
          다른 질문에도 답하기
        </Link>
      </section>
    </main>
  );
}
