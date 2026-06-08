import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";

type SeedProfile = {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

/**
 * 온보딩 넛지 카드.
 * - 첫 3숨까지의 진행도(answeredCount < 3일 때)
 * - 결을 나눌 시드 친구 추천(following === 0이고, 최소 1숨 이상 남겼을 때)
 * 둘 다 끝났으면 아무것도 렌더하지 않는다.
 */
export function OnboardingNudge() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["onboarding-nudge"],
    queryFn: async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) return null;

      const [answersRes, followingRes] = await Promise.all([
        supabase
          .from("answers")
          .select("id", { count: "exact", head: true })
          .eq("user_id", uid),
        supabase
          .from("follows")
          .select("following_id", { count: "exact", head: true })
          .eq("follower_id", uid),
      ]);

      const answeredCount = answersRes.count ?? 0;
      const followingCount = followingRes.count ?? 0;

      // 시드 친구는 첫 1숨을 남긴 뒤에만 노출
      let seeds: SeedProfile[] = [];
      if (followingCount === 0 && answeredCount >= 1) {
        // 최근 공개 답을 남긴 활발한 사용자들 중 자신과 차단 관계가 아닌 사람
        const { data: recentAnswers } = await supabase
          .from("answers")
          .select("user_id, created_at")
          .eq("visibility", "public")
          .neq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(60);

        const seenIds = new Set<string>();
        const orderedIds: string[] = [];
        for (const row of recentAnswers ?? []) {
          if (seenIds.has(row.user_id)) continue;
          seenIds.add(row.user_id);
          orderedIds.push(row.user_id);
          if (orderedIds.length >= 5) break;
        }

        if (orderedIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, handle, display_name, avatar_url")
            .in("id", orderedIds);
          const byId = new Map((profs ?? []).map((p) => [p.id, p]));
          seeds = orderedIds
            .map((id) => byId.get(id))
            .filter(Boolean) as SeedProfile[];
        }
      }

      return { answeredCount, followingCount, seeds, uid };
    },
    staleTime: 30_000,
  });

  if (isLoading || !data) return null;
  const { answeredCount, followingCount, seeds, uid } = data;

  // 둘 다 끝났으면 숨김
  if (answeredCount >= 3 && (followingCount > 0 || seeds.length === 0)) return null;

  return (
    <div className="px-6 pt-4 space-y-3">
      {answeredCount < 3 && (
        <FirstBreathsCard count={answeredCount} />
      )}
      {followingCount === 0 && seeds.length > 0 && answeredCount >= 1 && (
        <SeedFriendsCard seeds={seeds} uid={uid} onChanged={refetch} />
      )}
    </div>
  );
}

function FirstBreathsCard({ count }: { count: number }) {
  const total = 3;
  const remain = Math.max(0, total - count);
  return (
    <div className="rounded-2xl border border-border bg-surface px-5 py-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          첫 3숨
        </span>
        <span className="font-serif text-base text-foreground">
          {count}<span className="text-muted-foreground"> / {total}</span>
        </span>
      </div>
      <div className="mt-3 flex gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={
              "h-1 flex-1 rounded-full transition-colors " +
              (i < count ? "bg-foreground" : "bg-border")
            }
          />
        ))}
      </div>
      <p className="mt-3 text-[13px] text-muted-foreground leading-relaxed break-keep">
        {remain === 0
          ? "결의 첫 무늬가 만들어지고 있어요."
          : `${remain}번의 숨이면 당신의 결이 보이기 시작해요.`}
      </p>
    </div>
  );
}

function SeedFriendsCard({
  seeds,
  uid,
  onChanged,
}: {
  seeds: SeedProfile[];
  uid: string;
  onChanged: () => void;
}) {
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<string | null>(null);

  const follow = async (targetId: string) => {
    if (pending || followed.has(targetId)) return;
    setPending(targetId);
    try {
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: uid, following_id: targetId });
      if (error) throw error;
      haptic("light");
      setFollowed((s) => new Set(s).add(targetId));
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface px-5 py-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          결을 나눌 첫 사람들
        </span>
      </div>
      <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed break-keep">
        먼저 숨을 남긴 사람들이에요. 한두 명만 따라가 봐도 좋아요.
      </p>
      <ul className="mt-4 space-y-3">
        {seeds.map((p) => {
          const name = p.display_name || p.handle || "익명의 숨";
          const handle = p.handle ? `@${p.handle}` : "";
          const isFollowed = followed.has(p.id);
          return (
            <li key={p.id} className="flex items-center gap-3">
              <Link
                to="/u/$handle"
                params={{ handle: p.handle ?? p.id }}
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                <div className="h-9 w-9 rounded-full bg-muted overflow-hidden grid place-items-center text-xs text-muted-foreground">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (name[0] ?? "·").toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{name}</p>
                  {handle && (
                    <p className="text-[11px] text-muted-foreground truncate">{handle}</p>
                  )}
                </div>
              </Link>
              <button
                type="button"
                onClick={() => follow(p.id)}
                disabled={isFollowed || pending === p.id}
                className={
                  "shrink-0 text-[12px] rounded-full px-3 py-1.5 border transition-colors " +
                  (isFollowed
                    ? "border-border text-muted-foreground"
                    : "border-foreground bg-foreground text-background")
                }
              >
                {isFollowed ? "팔로잉" : pending === p.id ? "..." : "팔로우"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
