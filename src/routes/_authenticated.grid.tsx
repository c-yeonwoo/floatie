import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/grid")({
  head: () => ({ meta: [{ title: "탐색 — 결" }] }),
  component: GridPage,
});

function GridPage() {
  const today = new Date().toISOString().slice(0, 10);

  const { data: todayData, isLoading } = useQuery({
    queryKey: ["today-grid", today],
    queryFn: async () => {
      const { data: dq } = await supabase
        .from("daily_questions")
        .select("question_id, questions(id, text)")
        .eq("date", today)
        .maybeSingle();
      if (!dq) return null;
      const { data: answers } = await supabase
        .from("answers")
        .select("id, photos, profiles(handle, display_name)")
        .eq("question_id", dq.question_id)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(60);
      return { question: dq.questions as any, answers: answers ?? [] };
    },
  });

  const { data: similar } = useQuery({
    queryKey: ["similar-feed"],
    queryFn: async () => {
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
            overlap: (p.keywords ?? []).filter((k: string) => myKw.includes(k)).length,
          }))
          .filter((p) => p.overlap > 0)
          .sort((a, b) => b.overlap - a.overlap)
          .slice(0, 20)
          .map((p) => p.uid);
      }

      let query = supabase
        .from("answers")
        .select("id, photos, profiles(handle), questions(text)")
        .eq("visibility", "public")
        .neq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(24);
      if (similarUserIds.length > 0) query = query.in("user_id", similarUserIds);
      const { data: feed } = await query;
      return { hasPersona: !!mine, items: feed ?? [] };
    },
  });

  return (
    <main>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-5 border-b border-border">
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
          오늘의 그리드
        </span>
        <h2 className="font-serif text-xl mt-1 leading-snug">
          {todayData?.question?.text ?? "..."}
        </h2>
      </header>

      <section className="px-6 py-6">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-square bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !todayData || todayData.answers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            아직 아무도 답하지 않았어. 첫 결을 남겨봐.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {todayData.answers.map((a: any) => (
              <Link
                key={a.id}
                to="/answer-detail/$answerId"
                params={{ answerId: String(a.id) }}
                className="flex flex-col gap-2"
              >
                <div className="relative">
                  <img
                    src={a.photos?.[0]}
                    alt=""
                    className="w-full aspect-square object-cover rounded-xl border border-border"
                    loading="lazy"
                  />
                  {a.photos?.length > 1 && (
                    <span className="absolute top-2 right-2 text-[10px] bg-background/80 backdrop-blur rounded-full px-2 py-0.5">
                      +{a.photos.length - 1}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground px-1">
                  @{a.profiles?.handle ?? "anon"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="px-6 pb-10">
        <div className="border-t border-border pt-8 mb-5">
          <span className="text-[11px] uppercase tracking-widest text-accent">
            결이 비슷한 사람들
          </span>
          <p className="text-[13px] text-muted-foreground mt-1">
            {similar?.hasPersona
              ? "너와 결이 통할 것 같은 기록들이야."
              : "더 많이 기록할수록 결이 통하는 사람들이 모일 거야."}
          </p>
        </div>
        {!similar || similar.items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            아직 추천할 기록이 없어.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {similar.items.map((a: any) => (
              <Link
                key={a.id}
                to="/answer-detail/$answerId"
                params={{ answerId: String(a.id) }}
              >
                <img
                  src={a.photos?.[0]}
                  alt=""
                  className="w-full aspect-square object-cover rounded-sm border border-border"
                  loading="lazy"
                />
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
