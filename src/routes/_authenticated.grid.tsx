import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/grid")({
  head: () => ({ meta: [{ title: "탐색 — 결" }] }),
  component: GridPage,
});

type FeedItem = {
  id: number;
  photos: string[];
  question_id: number;
  questions: { id: number; text: string } | null;
  profiles: { handle: string | null; display_name: string | null } | null;
  similar: boolean;
};

function GridPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["explore-feed"],
    queryFn: async (): Promise<{ hasPersona: boolean; items: FeedItem[] }> => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;

      const { data: mine } = await supabase
        .from("persona_reads")
        .select("keywords")
        .eq("user_id", uid)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const myKw: string[] = mine?.keywords ?? [];

      let similarUserIds: string[] = [];
      if (myKw.length > 0) {
        const { data: others } = await supabase
          .from("persona_reads")
          .select("user_id, keywords")
          .neq("user_id", uid)
          .limit(200);
        similarUserIds = (others ?? [])
          .map((p: any) => ({
            uid: p.user_id,
            overlap: (p.keywords ?? []).filter((k: string) => myKw.includes(k))
              .length,
          }))
          .filter((p) => p.overlap > 0)
          .sort((a, b) => b.overlap - a.overlap)
          .slice(0, 30)
          .map((p) => p.uid);
      }

      const { data: recent } = await supabase
        .from("answers")
        .select(
          "id, photos, question_id, questions(id, text), profiles(handle, display_name), user_id",
        )
        .eq("visibility", "public")
        .neq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(40);

      const all = (recent ?? []) as any[];
      const similarSet = new Set(similarUserIds);
      const similarItems: FeedItem[] = [];
      const otherItems: FeedItem[] = [];
      for (const a of all) {
        const item: FeedItem = {
          id: a.id,
          photos: a.photos ?? [],
          question_id: a.question_id,
          questions: a.questions,
          profiles: a.profiles,
          similar: similarSet.has(a.user_id),
        };
        if (item.similar) similarItems.push(item);
        else otherItems.push(item);
      }

      return {
        hasPersona: !!mine,
        items: [...similarItems, ...otherItems],
      };
    },
  });

  return (
    <main>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-5 border-b border-border">
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
          탐색
        </span>
        <h2 className="font-serif text-xl mt-1 leading-snug">
          {data?.hasPersona
            ? "결이 닿는 기록들"
            : "다른 분들의 결을 만나보세요"}
        </h2>
      </header>

      <section className="px-4 py-6 space-y-10">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
              <div className="aspect-square bg-muted rounded-2xl animate-pulse" />
            </div>
          ))
        ) : !data || data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">
            아직 보여드릴 기록이 없어요.
          </p>
        ) : (
          data.items.map((a) => (
            <article key={a.id} className="space-y-3">
              {a.questions && (
                <Link
                  to="/question/$questionId"
                  params={{ questionId: String(a.questions.id) }}
                  className="block px-2"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-widest text-accent">
                      질문
                    </span>
                    {a.similar && (
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        · 결이 닿아요
                      </span>
                    )}
                  </div>
                  <p className="font-serif text-lg leading-snug mt-1 hover:underline underline-offset-4">
                    {a.questions.text}
                  </p>
                </Link>
              )}
              <Link
                to="/answer-detail/$answerId"
                params={{ answerId: String(a.id) }}
                className="block relative"
              >
                <img
                  src={a.photos[0]}
                  alt=""
                  className="w-full aspect-square object-cover rounded-2xl border border-border"
                  loading="lazy"
                />
                {a.photos.length > 1 && (
                  <span className="absolute top-3 right-3 text-[10px] bg-background/80 backdrop-blur rounded-full px-2.5 py-0.5">
                    +{a.photos.length - 1}
                  </span>
                )}
              </Link>
              <div className="flex items-center justify-between px-2">
                <p className="text-[11px] text-muted-foreground">
                  @{a.profiles?.handle ?? "anon"}
                </p>
                <Link
                  to="/answer-detail/$answerId"
                  params={{ answerId: String(a.id) }}
                  className="text-[11px] text-muted-foreground underline underline-offset-4"
                >
                  댓글 남기기
                </Link>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
