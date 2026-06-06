import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CategoryBadge, CategoryFilterChip } from "@/components/category-badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Search = { category?: string };

export const Route = createFileRoute("/_authenticated/backlog")({
  head: () => ({ meta: [{ title: "백로그 — 숨결" }] }),
  validateSearch: (search: Record<string, unknown>): Search => {
    const c = typeof search.category === "string" ? search.category.trim() : "";
    return c ? { category: c } : {};
  },
  component: BacklogPage,
});

function BacklogPage() {
  const { category } = Route.useSearch();
  const navigate = useNavigate({ from: "/backlog" });

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

  const filtered = (data ?? []).filter(
    (q) => !category || q.category === category,
  );

  const onBadgeClick = (c: string) => {
    navigate({ search: category === c ? {} : { category: c } });
  };

  return (
    <main>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-4 border-b border-border flex items-center justify-between gap-3">
        <Link to="/home" className="text-sm text-muted-foreground">← 뒤로</Link>
        <h1 className="font-serif text-lg tracking-tight">남은 질문</h1>
        <span className="w-10" />
      </header>

      {category && (
        <div className="px-6 pt-4">
          <CategoryFilterChip
            category={category}
            onClear={() => navigate({ search: {} })}
          />
        </div>
      )}

      <section className="px-6 py-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-20">
            {category
              ? `‘${category}’에 남은 질문이 없어요.`
              : "모든 질문에 답하셨어요. 대단하세요."}
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((q) => (
              <li key={q.id}>
                <button
                  onClick={() =>
                    navigate({
                      to: "/answer/$questionId",
                      params: { questionId: String(q.id) },
                      search: {} as any,
                    })
                  }
                  className="w-full text-left p-5 bg-surface border border-border rounded-xl hover:bg-secondary transition-colors"
                >
                  <CategoryBadge
                    category={q.category}
                    onClick={onBadgeClick}
                    active={category === q.category}
                  />
                  <p className="font-serif text-lg mt-2">{q.text}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
