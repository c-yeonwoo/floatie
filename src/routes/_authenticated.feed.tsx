import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBlockedIds } from "@/lib/blocks";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({ meta: [{ title: "홈 — 결" }] }),
  component: FeedPage,
});

type AnswerItem = {
  kind: "answer";
  id: number;
  photos: string[];
  created_at: string;
  questions: { id: number; text: string } | null;
  profiles: {
    handle: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  reason: "follow" | "recent";
};

type PromptItem = {
  kind: "prompt";
  id: number;
  text: string;
};

type FeedItem = AnswerItem | PromptItem;

function FeedPage() {
  const { data: blockedIds } = useBlockedIds();
  const { data, isLoading } = useQuery({
    queryKey: ["home-feed", Array.from(blockedIds ?? []).sort().join(",")],
    queryFn: async (): Promise<FeedItem[]> => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return [];

      const [followsRes, mineRes] = await Promise.all([
        supabase.from("follows").select("following_id").eq("follower_id", uid),
        supabase.from("answers").select("question_id").eq("user_id", uid),
      ]);

      const followedSet = new Set(
        (followsRes.data ?? []).map((f: any) => f.following_id as string),
      );
      const answeredQs = new Set(
        (mineRes.data ?? []).map((a: any) => a.question_id as number),
      );

      const { data: answers } = await supabase
        .from("answers")
        .select(
          "id, user_id, photos, created_at, questions(id, text), profiles(handle, display_name, avatar_url)",
        )
        .eq("visibility", "public")
        .neq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(200);

      const blocked = blockedIds ?? new Set<string>();
      const now = Date.now();
      const scored = (answers ?? [])
        .filter((a: any) => !blocked.has(a.user_id))
        .map((a: any) => {
        const isFollow = followedSet.has(a.user_id);
        const ageHours = (now - new Date(a.created_at).getTime()) / 36e5;
        const recency = Math.max(0, 120 - ageHours);
        const score = (isFollow ? 1000 : 0) + recency;
        const item: AnswerItem = {
          kind: "answer",
          id: a.id,
          photos: a.photos ?? [],
          created_at: a.created_at,
          questions: a.questions,
          profiles: a.profiles,
          reason: isFollow ? "follow" : "recent",
        };
        return { item, score };
      });

      scored.sort((a, b) => b.score - a.score);

      const { data: qs } = await supabase
        .from("questions")
        .select("id, text")
        .eq("is_active", true)
        .limit(60);
      const unanswered = (qs ?? [])
        .filter((q: any) => !answeredQs.has(q.id))
        .slice(0, 12);

      const items: FeedItem[] = [];
      let promptIdx = 0;
      scored.forEach((s, i) => {
        items.push(s.item);
        if ((i + 1) % 6 === 0 && promptIdx < unanswered.length) {
          const q: any = unanswered[promptIdx++];
          items.push({ kind: "prompt", id: q.id, text: q.text });
        }
      });

      // If no scored answers, still surface prompts so the page isn't empty.
      if (items.length === 0 && unanswered.length > 0) {
        for (const q of unanswered as any[]) {
          items.push({ kind: "prompt", id: q.id, text: q.text });
        }
      }

      return items;
    },
  });

  const [visible, setVisible] = useState(12);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setVisible((v) => v + 12);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [data]);

  const items = (data ?? []).slice(0, visible);
  const hasMore = (data?.length ?? 0) > visible;

  return (
    <main>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-5 border-b border-border flex items-end justify-between gap-3">
        <div>
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
            피드
          </span>
          <h2 className="font-serif text-xl mt-1 leading-snug">새로운 결</h2>
        </div>
        <Link
          to="/notifications"
          aria-label="알림"
          className="p-2 -m-2 text-muted-foreground hover:text-foreground"
        >
          <Bell className="size-5" strokeWidth={1.5} />
        </Link>
      </header>

      <section className="px-4 py-6 space-y-10">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
              <div className="aspect-square bg-muted rounded-2xl animate-pulse" />
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="border border-dashed border-border rounded-2xl p-8 text-center">
            <p className="text-sm text-muted-foreground">
              아직 보여드릴 결이 없어요.
            </p>
            <p className="text-[12px] text-muted-foreground mt-2">
              질문에 먼저 답하면, 비슷한 결의 사람들이 모입니다.
            </p>
            <Link
              to="/home"
              className="inline-block mt-5 text-[11px] uppercase tracking-widest bg-foreground text-background rounded-full px-4 py-2"
            >
              질문 보러가기 →
            </Link>
          </div>
        ) : (
          items.map((it, idx) =>
            it.kind === "prompt" ? (
              <Link
                key={`p-${it.id}-${idx}`}
                to="/answer/$questionId"
                params={{ questionId: String(it.id) }}
                className="block border border-dashed border-border rounded-2xl p-6 text-center hover:border-foreground/40 transition-colors"
              >
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  아직 답하지 않은 질문
                </span>
                <p className="font-serif text-lg mt-2 leading-snug">
                  {it.text}
                </p>
                <span className="inline-block mt-4 text-[11px] uppercase tracking-widest">
                  결 남기러 가기 →
                </span>
              </Link>
            ) : (
              <article key={`a-${it.id}`} className="space-y-3">
                <div className="flex items-center justify-between gap-3 px-2">
                  <div className="flex items-center gap-3">
                    {it.profiles?.avatar_url ? (
                      <img
                        src={it.profiles.avatar_url}
                        alt=""
                        className="size-8 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <div className="size-8 rounded-full bg-muted border border-border" />
                    )}
                    {it.profiles?.handle ? (
                      <Link
                        to="/u/$handle"
                        params={{ handle: it.profiles.handle }}
                        className="text-[13px] font-medium hover:underline underline-offset-4"
                      >
                        @{it.profiles.handle}
                      </Link>
                    ) : (
                      <span className="text-[13px] text-muted-foreground">
                        @anon
                      </span>
                    )}
                  </div>
                  {it.reason !== "recent" && (
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {it.reason === "follow" ? "팔로잉" : "결이 닿아요"}
                    </span>
                  )}
                </div>

                {it.questions && (
                  <Link
                    to="/question/$questionId"
                    params={{ questionId: String(it.questions.id) }}
                    className="block px-2"
                  >
                    <p className="font-serif text-[15px] leading-snug text-muted-foreground hover:text-foreground transition-colors">
                      {it.questions.text}
                    </p>
                  </Link>
                )}

                {it.photos[0] && (
                  <Link
                    to="/answer-detail/$answerId"
                    params={{ answerId: String(it.id) }}
                    className="block relative"
                  >
                    <img
                      src={it.photos[0]}
                      alt=""
                      className="w-full aspect-square object-cover rounded-2xl border border-border"
                      loading="lazy"
                    />
                    {it.photos.length > 1 && (
                      <span className="absolute top-3 right-3 text-[10px] bg-background/80 backdrop-blur rounded-full px-2.5 py-0.5">
                        +{it.photos.length - 1}
                      </span>
                    )}
                  </Link>
                )}
              </article>
            ),
          )
        )}
        {hasMore && <div ref={sentinelRef} className="h-10" />}
      </section>
    </main>
  );
}
