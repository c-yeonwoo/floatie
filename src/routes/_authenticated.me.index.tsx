import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generatePersonaRead } from "@/lib/persona.functions";
import { toast } from "sonner";
import { StorageImg } from "@/components/storage-img";

export const Route = createFileRoute("/_authenticated/me/")({
  head: () => ({ meta: [{ title: "내 결 — 숨결" }] }),
  component: MePage,
});

function MePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["my-gyeol"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;
      const [profileRes, answersRes, personaRes, followersRes, followingRes] = await Promise.all([
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
        supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("following_id", uid),
        supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("follower_id", uid),
      ]);
      return {
        profile: profileRes.data,
        answers: answersRes.data ?? [],
        persona: personaRes.data,
        followers: followersRes.count ?? 0,
        following: followingRes.count ?? 0,
      };
    },
  });

  const genFn = useServerFn(generatePersonaRead);
  const generate = useMutation({
    mutationFn: () => genFn({ data: {} }),
    onSuccess: () => {
      toast.success("결을 새로 읽었어요.");
      qc.invalidateQueries({ queryKey: ["my-gyeol"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "다시 시도해 주세요."),
  });

  const answerCount = data?.answers.length ?? 0;
  const visibleAnswers = data?.answers.slice(0, 6) ?? [];
  const canGenerate = answerCount >= 3;
  const persona = data?.persona;
  const showRegenerate = persona && answerCount - persona.based_on_count >= 3;

  const onLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <main className="h-full overflow-hidden flex flex-col">
      <header className="shrink-0 z-10 bg-background/80 backdrop-blur-md px-6 py-4 border-b border-border flex justify-between items-center">
        <h1 className="font-serif text-2xl tracking-tight">내 결</h1>
        <button onClick={onLogout} className="text-[13px] text-muted-foreground hover:text-foreground">
          로그아웃
        </button>
      </header>

      <section className="shrink-0 px-6 py-5 text-center flex flex-col items-center">

        {data?.profile?.avatar_url ? (
          <StorageImg
            src={data.profile.avatar_url}
            alt=""
            className="size-16 rounded-full object-cover border border-border mb-3"
          />
        ) : (
          <div className="size-16 rounded-full bg-surface border border-border mb-3" />
        )}
        <h2 className="font-serif text-2xl">
          {data?.profile?.display_name ?? "..."}
        </h2>
        {data?.profile?.bio && (
          <p className="text-[13px] text-foreground/80 mt-2 max-w-sm text-pretty line-clamp-2">
            {data.profile.bio}
          </p>
        )}
        <div className="flex items-center gap-8 mt-4">
          <StatBlock label="기록" value={answerCount} />
          {data?.profile?.handle ? (
            <Link to="/u/$handle/followers" params={{ handle: data.profile.handle }}>
              <StatBlock label="팔로워" value={data?.followers ?? 0} />
            </Link>
          ) : (
            <StatBlock label="팔로워" value={data?.followers ?? 0} />
          )}
          {data?.profile?.handle ? (
            <Link to="/u/$handle/following" params={{ handle: data.profile.handle }}>
              <StatBlock label="팔로잉" value={data?.following ?? 0} />
            </Link>
          ) : (
            <StatBlock label="팔로잉" value={data?.following ?? 0} />
          )}
        </div>
        <Link
          to="/me/edit"
          className="mt-3 text-[11px] uppercase tracking-widest text-accent border border-accent/40 rounded-full px-4 py-1.5 hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          프로필 수정
        </Link>
      </section>

      <section className="shrink-0 px-6 mb-4">
        <div className="bg-surface border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="size-1.5 bg-accent rounded-full" />
            <span className="text-[10px] uppercase tracking-widest text-accent">AI 결 요약</span>
          </div>
          {persona ? (
            <>
              <p className="text-[14px] leading-relaxed text-foreground text-pretty line-clamp-3">
                {persona.summary}
              </p>
              {persona.keywords && persona.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 max-h-7 overflow-hidden">
                  {persona.keywords.slice(0, 4).map((k: string) => (
                    <span
                      key={k}
                      className="px-3 py-1 bg-muted rounded-full text-xs text-muted-foreground"
                    >
                      #{k}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-3">
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
                지금까지 모은 {answerCount}번의 숨으로 당신의 결을 읽어드릴게요.
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
              {3 - answerCount}번 더 숨을 남기시면 당신의 결을 읽어드릴게요.
            </p>
          )}
        </div>
      </section>

      <section className="flex-1 min-h-0 px-6 overflow-hidden">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square bg-muted animate-pulse rounded-sm" />
            ))}
          </div>
        ) : answerCount === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            <Link to="/home" className="underline underline-offset-4">
              새 질문
            </Link>
            에 첫 숨을 남겨보세요.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {visibleAnswers.map((a: any) => (
              <Link
                key={a.id}
                to="/answer-detail/$answerId"
                params={{ answerId: String(a.id) }}
              >
                <StorageImg
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

      <section className="shrink-0 px-6 py-3 text-center space-y-2">
        <Link
          to="/me/blocked"
          className="block text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          차단 목록 관리
        </Link>
        <p className="text-[10px] text-muted-foreground">
          <Link to="/terms" className="hover:text-foreground">이용약관</Link>
          {" · "}
          <Link to="/privacy" className="hover:text-foreground">개인정보 처리방침</Link>
        </p>
      </section>

    </main>
  );
}

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="font-serif text-lg">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
        {label}
      </div>
    </div>
  );
}
