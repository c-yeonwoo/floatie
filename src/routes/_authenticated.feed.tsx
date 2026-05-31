import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({ meta: [{ title: "홈 — 결" }] }),
  component: FeedPage,
});

function FeedPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["follow-feed"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;

      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", uid);

      const ids = (follows ?? []).map((f: any) => f.following_id);
      if (ids.length === 0) return { hasFollows: false, items: [] };

      const { data: answers } = await supabase
        .from("answers")
        .select(
          "id, photos, created_at, questions(id, text), profiles(handle, display_name, avatar_url)",
        )
        .in("user_id", ids)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(60);

      return { hasFollows: true, items: (answers ?? []) as any[] };
    },
  });

  return (
    <main>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-5 border-b border-border">
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
          홈
        </span>
        <h2 className="font-serif text-xl mt-1 leading-snug">
          팔로우하는 분들의 결
        </h2>
      </header>

      <section className="px-4 py-6 space-y-10">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
              <div className="aspect-square bg-muted rounded-2xl animate-pulse" />
            </div>
          ))
        ) : !data?.hasFollows ? (
          <div className="text-center py-16 px-4">
            <p className="text-sm text-muted-foreground mb-4">
              아직 팔로우하는 분이 없어요.
            </p>
            <Link
              to="/grid"
              className="text-[11px] uppercase tracking-widest text-accent border border-accent/40 rounded-full px-5 py-2"
            >
              탐색에서 만나보기
            </Link>
          </div>
        ) : data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">
            팔로우한 분들이 아직 기록을 남기지 않았어요.
          </p>
        ) : (
          data.items.map((a) => (
            <article key={a.id} className="space-y-3">
              <div className="flex items-center gap-3 px-2">
                {a.profiles?.avatar_url ? (
                  <img
                    src={a.profiles.avatar_url}
                    alt=""
                    className="size-8 rounded-full object-cover border border-border"
                  />
                ) : (
                  <div className="size-8 rounded-full bg-surface border border-border" />
                )}
                {a.profiles?.handle ? (
                  <Link
                    to="/u/$handle"
                    params={{ handle: a.profiles.handle }}
                    className="text-[13px] font-medium hover:underline underline-offset-4"
                  >
                    @{a.profiles.handle}
                  </Link>
                ) : (
                  <span className="text-[13px] text-muted-foreground">@anon</span>
                )}
              </div>

              {a.questions && (
                <Link
                  to="/question/$questionId"
                  params={{ questionId: String(a.questions.id) }}
                  className="block px-2"
                >
                  <p className="font-serif text-[15px] leading-snug text-muted-foreground hover:text-foreground">
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
            </article>
          ))
        )}
      </section>
    </main>
  );
}
