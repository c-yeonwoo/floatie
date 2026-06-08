import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";

type Match = {
  userId: string;
  score: number;
  shared: string[];
  profile: {
    id: string;
    handle: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
};

const SCORE_THRESHOLD = 0.45;
const MAX_ITEMS = 5;

/**
 * 결 매칭 카드. persona_similarity_cache에서 임계점을 넘는 매칭을
 * 알림 화면 상단에 부드럽게 노출한다. 이미 팔로우한 사람은 제외.
 */
export function SimilarityMatches() {
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["similarity-matches"],
    queryFn: async (): Promise<Match[]> => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return [];

      const [aRes, bRes, followingRes] = await Promise.all([
        supabase
          .from("persona_similarity_cache")
          .select("user_a, user_b, score, shared_keywords")
          .eq("user_a", uid)
          .gte("score", SCORE_THRESHOLD)
          .order("score", { ascending: false })
          .limit(20),
        supabase
          .from("persona_similarity_cache")
          .select("user_a, user_b, score, shared_keywords")
          .eq("user_b", uid)
          .gte("score", SCORE_THRESHOLD)
          .order("score", { ascending: false })
          .limit(20),
        supabase.from("follows").select("following_id").eq("follower_id", uid),
      ]);

      const followingIds = new Set((followingRes.data ?? []).map((r: any) => r.following_id));

      const pairs = [
        ...(aRes.data ?? []).map((r: any) => ({
          userId: r.user_b as string,
          score: r.score as number,
          shared: (r.shared_keywords ?? []) as string[],
        })),
        ...(bRes.data ?? []).map((r: any) => ({
          userId: r.user_a as string,
          score: r.score as number,
          shared: (r.shared_keywords ?? []) as string[],
        })),
      ]
        .filter((p) => p.userId !== uid && !followingIds.has(p.userId))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_ITEMS);

      if (pairs.length === 0) return [];

      const ids = Array.from(new Set(pairs.map((p) => p.userId)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, handle, display_name, avatar_url")
        .in("id", ids);
      const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));

      return pairs
        .map((p) => {
          const profile = byId.get(p.userId);
          if (!profile) return null;
          return { ...p, profile } as Match;
        })
        .filter(Boolean) as Match[];
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading || !data || data.length === 0) return null;

  return (
    <section className="px-6 pt-6">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          결이 닿는 사람들
        </h2>
        <span className="text-[10px] text-muted-foreground/70">
          {data.length}명
        </span>
      </div>
      <ul className="space-y-3">
        {data.map((m) => (
          <MatchItem key={m.userId} match={m} onChanged={refetch} />
        ))}
      </ul>
    </section>
  );
}

function MatchItem({ match, onChanged }: { match: Match; onChanged: () => void }) {
  const [followed, setFollowed] = useState(false);
  const [pending, setPending] = useState(false);
  const name = match.profile.display_name || match.profile.handle || "익명의 숨";
  const pct = Math.round(match.score * 100);

  const follow = async () => {
    if (pending || followed) return;
    setPending(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: uid, following_id: match.userId });
      if (error) throw error;
      haptic("light");
      setFollowed(true);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  };

  return (
    <li className="border border-border rounded-xl p-4 bg-surface">
      <div className="flex items-center gap-3">
        <Link
          to="/u/$handle"
          params={{ handle: match.profile.handle ?? match.profile.id }}
          className="flex items-center gap-3 flex-1 min-w-0"
        >
          <div className="size-10 rounded-full bg-muted overflow-hidden grid place-items-center text-xs text-muted-foreground">
            {match.profile.avatar_url ? (
              <img src={match.profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              (name[0] ?? "·").toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[14px] text-foreground truncate">{name}</p>
            <p className="text-[11px] text-muted-foreground">결 닿음 {pct}%</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={follow}
          disabled={followed || pending}
          className={
            "shrink-0 text-[12px] rounded-full px-3 py-1.5 border transition-colors " +
            (followed
              ? "border-border text-muted-foreground"
              : "border-foreground bg-foreground text-background")
          }
        >
          {followed ? "팔로잉" : pending ? "..." : "팔로우"}
        </button>
      </div>
      {match.shared.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {match.shared.slice(0, 4).map((k) => (
            <span
              key={k}
              className="text-[11px] text-muted-foreground bg-muted rounded-full px-2.5 py-0.5"
            >
              #{k}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}
