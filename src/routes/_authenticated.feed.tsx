import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBlockedIds } from "@/lib/blocks";
import { StorageImg } from "@/components/storage-img";
import { CategoryBadge } from "@/components/category-badge";


export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({ meta: [{ title: "홈 — 숨결" }] }),
  component: FeedPage,
});

type AnswerItem = {
  kind: "answer";
  id: number;
  photos: string[];
  created_at: string;
  questions: { id: number; text: string; category: string | null } | null;
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
  category: string | null;
};


type FeedItem = AnswerItem | PromptItem;

function NotificationsBell() {
  const { data: unread } = useQuery({
    queryKey: ["nudges-unread-count"],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const me = sessionData.session?.user?.id;
      if (!me) return 0;
      const { count } = await supabase
        .from("nudges")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", me)
        .eq("status", "pending");
      return count ?? 0;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  return (
    <Link
      to="/notifications"
      aria-label="알림"
      className="relative p-2 -mr-2 text-muted-foreground hover:text-foreground"
    >
      <Bell className="size-5" strokeWidth={1.5} />
      {!!unread && unread > 0 && (
        <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-accent" />
      )}
    </Link>
  );
}

function FeedPage() {
  const { data: blockedIds } = useBlockedIds();
  const { data, isLoading } = useQuery({
    queryKey: ["home-feed", Array.from(blockedIds ?? []).sort().join(",")],
    queryFn: async (): Promise<FeedItem[]> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid) return [];

      const [followsRes, mineRes, answersRes, qsRes] = await Promise.all([
        supabase.from("follows").select("following_id").eq("follower_id", uid),
        supabase.from("answers").select("question_id").eq("user_id", uid),
        supabase
          .from("answers")
          .select(
            "id, user_id, photos, created_at, questions(id, text, category), profiles(handle, display_name, avatar_url)",
          )
          .eq("visibility", "public")
          .neq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(80),


        supabase
          .from("questions")
          .select("id, text, category")
          .eq("is_active", true)
          .limit(60),
      ]);

      const followedSet = new Set(
        (followsRes.data ?? []).map((f: any) => f.following_id as string),
      );
      const answeredQs = new Set(
        (mineRes.data ?? []).map((a: any) => a.question_id as number),
      );

      const blocked = blockedIds ?? new Set<string>();
      const now = Date.now();
      const scored = (answersRes.data ?? [])
        .filter((a: any) => !blocked.has(a.user_id) && Array.isArray(a.photos) && a.photos.length > 0)
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

      const unanswered = (qsRes.data ?? [])
        .filter((q: any) => !answeredQs.has(q.id))
        .slice(0, 12);


      const items: FeedItem[] = [];
      let promptIdx = 0;
      scored.forEach((s, i) => {
        items.push(s.item);
        if ((i + 1) % 6 === 0 && promptIdx < unanswered.length) {
          const q: any = unanswered[promptIdx++];
          items.push({ kind: "prompt", id: q.id, text: q.text, category: q.category });
        }
      });

      // If no scored answers, still surface prompts so the page isn't empty.
      if (items.length === 0 && unanswered.length > 0) {
        for (const q of unanswered as any[]) {
          items.push({ kind: "prompt", id: q.id, text: q.text, category: q.category });
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
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-4 border-b border-border flex items-center justify-between gap-3">
        <h1 className="font-serif text-2xl tracking-tight">피드</h1>
        <NotificationsBell />
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
              아직 보여드릴 숨이 없어요.
            </p>
            <p className="text-[12px] text-muted-foreground mt-2">
              질문에 먼저 답하면, 결이 닿는 사람들이 모입니다.
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
                <div className="flex items-center justify-center gap-2">
                  <CategoryBadge category={it.category} />
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    아직 답하지 않은 질문
                  </span>
                </div>
                <p className="font-serif text-lg mt-3 leading-snug">
                  {it.text}
                </p>
                <span className="inline-block mt-4 text-[11px] uppercase tracking-widest">
                  숨 남기러 가기 →
                </span>
              </Link>

            ) : (
              <article key={`a-${it.id}`} className="space-y-3">
                <div className="flex items-center justify-between gap-3 px-2">
                  <div className="flex items-center gap-3">
                    {it.profiles?.avatar_url ? (
                      <StorageImg
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
                </div>

                {it.questions && (
                  <Link
                    to="/question/$questionId"
                    params={{ questionId: String(it.questions.id) }}
                    className="block px-2"
                  >
                    <div className="mb-1">
                      <CategoryBadge category={it.questions.category} />
                    </div>
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
                    <StorageImg
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
