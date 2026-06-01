import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/backlog")({
  head: () => ({ meta: [{ title: "백로그 — 결" }] }),
  component: BacklogPage,
});

function BacklogPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["backlog"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;
      const { data: answered } = await supabase
        .from("answers")
        .select("question_id")
        .eq("user_id", uid);
      const answeredIds = new Set((answered ?? []).map((a) => a.question_id));
      const { data: questions } = await supabase
        .from("questions")
        .select("id, text, category")
        .eq("is_active", true)
        .order("sort_order");
      return (questions ?? []).filter((q) => !answeredIds.has(q.id));
    },
  });

  return (
    <main>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-5 border-b border-border flex items-center justify-between">
        <Link to="/home" className="text-sm text-muted-foreground">← 뒤로</Link>
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
          남은 질문
        </span>
        <span className="w-10" />
      </header>

      <section className="px-6 py-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-20">
            모든 질문에 답하셨어요. 대단하세요.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.map((q) => (
              <li key={q.id}>
                <button
                  onClick={() =>
                    navigate({ to: "/answer/$questionId", params: { questionId: String(q.id) } })
                  }
                  className="w-full text-left p-5 bg-surface border border-border rounded-xl hover:bg-secondary transition-colors"
                >
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {q.category}
                  </span>
                  <p className="font-serif text-lg mt-1">{q.text}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
