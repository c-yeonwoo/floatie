import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CategoryBadge } from "@/components/category-badge";
import logoSymbol from "@/assets/logo-icon.png";

export const Route = createFileRoute("/invite/$questionId")({
  head: () => ({
    meta: [
      { title: "숨결 — 오늘의 질문에 답해보세요" },
      {
        name: "description",
        content: "숨 쉬듯 가볍게, 하루 한 장. 친구가 보낸 질문에 답하고 결을 쌓아보세요.",
      },
      { property: "og:title", content: "숨결 — 오늘의 질문에 답해보세요" },
      {
        property: "og:description",
        content: "친구가 보낸 질문에 답하고 결을 쌓아보세요.",
      },
    ],
  }),
  beforeLoad: async ({ params }) => {
    if (typeof window === "undefined") return;
    // If already logged in, send straight to the answer composer
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      throw redirect({ to: "/answer/$questionId", params: { questionId: params.questionId } });
    }
  },
  component: InvitePage,
});

function InvitePage() {
  const { questionId } = Route.useParams();
  const { data: question, isLoading } = useQuery({
    queryKey: ["invite-question", questionId],
    queryFn: async () => {
      const { data } = await supabase
        .from("questions")
        .select("id, text, category")
        .eq("id", Number(questionId))
        .maybeSingle();
      return data;
    },
  });

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <div className="max-w-md mx-auto min-h-[100dvh] flex flex-col px-6 py-10">
        <header className="flex items-center gap-2">
          <img src={logoSymbol} alt="" className="size-6" />
          <span className="font-serif text-lg">숨결</span>
        </header>

        <section className="flex-1 flex flex-col justify-center py-10">
          <p className="text-[12px] tracking-widest uppercase text-muted-foreground mb-3">
            친구가 보낸 질문
          </p>
          <div className="rounded-2xl border border-border bg-card/40 p-6">
            {isLoading ? (
              <div className="h-24 animate-pulse rounded bg-muted/40" />
            ) : !question ? (
              <p className="text-sm text-muted-foreground">없는 질문이에요.</p>
            ) : (
              <>
                <CategoryBadge category={question.category} />
                <h1 className="font-serif text-2xl mt-3 leading-snug text-balance break-keep [word-break:keep-all]">
                  {question.text}
                </h1>
              </>
            )}
          </div>

          <p className="mt-8 text-sm text-muted-foreground leading-relaxed">
            숨 쉬듯 가볍게, 하루 한 장.
            <br />
            당신의 숨이 모여 결이 됩니다.
          </p>
        </section>

        <footer className="space-y-3">
          <Link
            to="/login"
            search={{ invite: questionId } as any}
            className="block w-full text-center bg-foreground text-background rounded-md py-3.5 text-sm font-medium"
          >
            가입하고 답해보기
          </Link>
          <Link
            to="/login"
            className="block w-full text-center text-xs text-muted-foreground py-2"
          >
            이미 계정이 있어요
          </Link>
        </footer>
      </div>
    </main>
  );
}
