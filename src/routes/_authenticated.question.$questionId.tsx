import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StorageImg } from "@/components/storage-img";

export const Route = createFileRoute("/_authenticated/question/$questionId")({
  head: () => ({ meta: [{ title: "질문 — 숨결" }] }),
  component: QuestionPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-muted-foreground">
      불러오지 못했어요: {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-sm text-muted-foreground">
      질문을 찾을 수 없어요.
    </div>
  ),
});

function QuestionPage() {
  const { questionId } = Route.useParams();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["question-grid", questionId],
    queryFn: async () => {
      const qid = Number(questionId);
      const { data: q } = await supabase
        .from("questions")
        .select("id, text, category")
        .eq("id", qid)
        .maybeSingle();
      const { data: answers } = await supabase
        .from("answers")
        .select("id, photos, profiles(handle)")
        .eq("question_id", qid)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(120);
      return { question: q, answers: (answers ?? []) as any[] };
    },
  });

  return (
    <main>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => router.history.back()}
            aria-label="뒤로"
            className="p-2 -ml-2 text-foreground hover:bg-secondary rounded-full transition-colors"
          >
            <ChevronLeft className="size-5" strokeWidth={1.5} />
          </button>
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
            탐색으로
          </span>
        </div>
        <div className="px-2">
          <span className="text-[10px] uppercase tracking-widest text-accent">
            질문
          </span>
          <h1 className="font-serif text-2xl mt-1 leading-snug text-balance break-keep [word-break:keep-all]">
            {data?.question?.text ?? "..."}
          </h1>
          {data?.answers && (
            <p className="text-[11px] text-muted-foreground mt-3">
              {data.answers.length}개의 숨
            </p>
          )}
        </div>
      </header>

      <section className="px-4 py-6">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square bg-muted rounded-sm animate-pulse"
              />
            ))}
          </div>
        ) : !data?.answers.length ? (
          <div className="text-center py-16 space-y-4">
            <p className="text-sm text-muted-foreground">
              아직 아무도 답하지 않았어요.
            </p>
            <Link
              to="/answer/$questionId"
              params={{ questionId }}
              className="inline-block text-xs underline underline-offset-4"
            >
              첫 숨을 남겨보세요 →
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-1.5">
              {data.answers.map((a) => (
                <Link
                  key={a.id}
                  to="/answer-detail/$answerId"
                  params={{ answerId: String(a.id) }}
                  className="relative"
                >
                  <StorageImg
                    src={a.photos?.[0]}
                    alt=""
                    className="w-full aspect-square object-cover rounded-sm border border-border"
                    loading="lazy"
                  />
                  {a.photos?.length > 1 && (
                    <span className="absolute top-1.5 right-1.5 text-[9px] bg-background/80 backdrop-blur rounded-full px-1.5 py-0.5">
                      +{a.photos.length - 1}
                    </span>
                  )}
                </Link>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link
                to="/answer/$questionId"
                params={{ questionId }}
                className="text-xs underline underline-offset-4 text-muted-foreground"
              >
                이 질문에 답하기 →
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
