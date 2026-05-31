import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generatePersonaRead } from "@/lib/persona.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/me")({
  head: () => ({ meta: [{ title: "내 결" }] }),
  component: MePage,
});

function MePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["my-gyeol"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;
      const [profileRes, answersRes, personaRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase
          .from("answers")
          .select("id, photos, created_at, questions(text)")
          .eq("user_id", uid)
          .order("created_at", { ascending: false }),
        supabase
          .from("persona_reads")
          .select("*")
          .eq("user_id", uid)
          .order("generated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return {
        profile: profileRes.data,
        answers: answersRes.data ?? [],
        persona: personaRes.data,
      };
    },
  });

  const genFn = useServerFn(generatePersonaRead);
  const generate = useMutation({
    mutationFn: () => genFn({ data: {} }),
    onSuccess: () => {
      toast.success("너의 결을 새로 읽었어.");
      qc.invalidateQueries({ queryKey: ["my-gyeol"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "다시 시도해줘"),
  });

  const answerCount = data?.answers.length ?? 0;
  const canGenerate = answerCount >= 3;
  const persona = data?.persona;
  const showRegenerate = persona && answerCount - persona.based_on_count >= 3;

  const onLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <main>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-5 border-b border-border flex justify-between items-center">
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">내 결</span>
        <button onClick={onLogout} className="text-[11px] text-muted-foreground hover:text-foreground">
          로그아웃
        </button>
      </header>

      <section className="px-6 py-10 text-center">
        <h2 className="font-serif text-2xl">
          {data?.profile?.display_name ?? "..."}의 결
        </h2>
        <p className="text-[13px] text-muted-foreground mt-2">
          {answerCount}개의 조각을 모았어
        </p>
      </section>

      <section className="px-6 mb-10">
        <div className="bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-1.5 bg-accent rounded-full" />
            <span className="text-[10px] uppercase tracking-widest text-accent">AI 결 요약</span>
          </div>
          {persona ? (
            <>
              <p className="text-[15px] leading-relaxed text-foreground text-pretty">
                {persona.summary}
              </p>
              {persona.keywords && persona.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {persona.keywords.map((k: string) => (
                    <span
                      key={k}
                      className="px-3 py-1 bg-muted rounded-full text-xs text-muted-foreground"
                    >
                      #{k}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-4">
                {persona.based_on_count}개 기록 기준
              </p>
              {showRegenerate && (
                <button
                  onClick={() => generate.mutate()}
                  disabled={generate.isPending}
                  className="mt-4 text-xs text-accent underline underline-offset-4 disabled:opacity-50"
                >
                  {generate.isPending ? "읽는 중..." : "다시 읽어보기"}
                </button>
              )}
            </>
          ) : canGenerate ? (
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                지금까지 모은 {answerCount}개의 결로 너를 읽어줄게.
              </p>
              <button
                onClick={() => generate.mutate()}
                disabled={generate.isPending}
                className="w-full bg-foreground text-background py-3 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {generate.isPending ? "읽는 중..." : "내 결 읽어보기"}
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {3 - answerCount}개 더 답하면 너의 결을 읽어줄게.
            </p>
          )}
        </div>
      </section>

      <section className="px-6">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-square bg-muted animate-pulse rounded-sm" />
            ))}
          </div>
        ) : answerCount === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            <Link to="/home" className="underline underline-offset-4">
              오늘의 질문
            </Link>
            에 첫 결을 남겨봐.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {data!.answers.map((a: any) => (
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
