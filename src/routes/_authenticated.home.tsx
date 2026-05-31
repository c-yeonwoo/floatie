import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "오늘 — 결" }] }),
  component: HomePage,
});

function HomePage() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, isLoading } = useQuery({
    queryKey: ["daily-question", today],
    queryFn: async () => {
      const { data: dq } = await supabase
        .from("daily_questions")
        .select("question_id, questions(id, text, category)")
        .eq("date", today)
        .maybeSingle();
      if (!dq?.questions) return null;
      const { data: userData } = await supabase.auth.getUser();
      const { data: myAnswer } = await supabase
        .from("answers")
        .select("id, photos")
        .eq("user_id", userData.user!.id)
        .eq("question_id", dq.question_id)
        .maybeSingle();
      return { question: dq.questions as any, myAnswer };
    },
  });

  return (
    <main>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-5 flex justify-between items-end border-b border-border">
        <h1 className="font-serif text-2xl tracking-tighter">결</h1>
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
          {today.replace(/-/g, ". ")}
        </span>
      </header>

      <section className="px-6 py-10">
        {isLoading ? (
          <div className="aspect-square bg-muted rounded-2xl animate-pulse" />
        ) : !data ? (
          <p className="text-sm text-muted-foreground text-center py-20">
            오늘의 질문이 아직 준비되지 않았어.
          </p>
        ) : (
          <>
            <div className="mb-8">
              <span className="text-[11px] font-semibold text-accent uppercase tracking-widest">
                오늘의 질문
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
                  오늘의 결을 남겼어.{" "}
                  <Link to="/grid" className="underline underline-offset-4">
                    다른 이들의 결 보러가기
                  </Link>
                </p>
              </div>
            ) : (
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
            )}
          </>
        )}
      </section>

      <section className="px-6 pb-8">
        <Link
          to="/backlog"
          className="block text-center text-sm text-muted-foreground underline underline-offset-4"
        >
          다른 질문도 답하기
        </Link>
      </section>
    </main>
  );
}
