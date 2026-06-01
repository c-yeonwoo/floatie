import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Flag, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ReportDialog } from "@/components/report-dialog";
import { StorageImg } from "@/components/storage-img";

export const Route = createFileRoute("/_authenticated/u/$handle")({
  head: ({ params }) => ({ meta: [{ title: `@${params.handle} — 결` }] }),
  component: UserProfilePage,
});

function UserProfilePage() {
  const { handle } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [reportOpen, setReportOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["user-profile", handle],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user?.id ?? null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("handle", handle)
        .maybeSingle();
      if (!profile) return { me, profile: null, answers: [], counts: { followers: 0, following: 0 }, isFollowing: false, isMe: false };

      const [{ data: answers }, { count: followers }, { count: following }, { data: myFollow }, { data: myBlock }] =
        await Promise.all([
          supabase
            .from("answers")
            .select("id, photos, created_at")
            .eq("user_id", profile.id)
            .eq("visibility", "public")
            .order("created_at", { ascending: false }),
          supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("following_id", profile.id),
          supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("follower_id", profile.id),
          me
            ? supabase
                .from("follows")
                .select("follower_id")
                .eq("follower_id", me)
                .eq("following_id", profile.id)
                .maybeSingle()
            : Promise.resolve({ data: null } as any),
          me
            ? supabase
                .from("blocks")
                .select("blocked_id")
                .eq("blocker_id", me)
                .eq("blocked_id", profile.id)
                .maybeSingle()
            : Promise.resolve({ data: null } as any),
        ]);

      return {
        me,
        profile,
        answers: answers ?? [],
        counts: { followers: followers ?? 0, following: following ?? 0 },
        isFollowing: !!myFollow,
        isBlocked: !!myBlock,
        isMe: me === profile.id,
      };
    },
  });

  const toggleFollow = useMutation({
    mutationFn: async () => {
      if (!data?.me || !data.profile) throw new Error("로그인이 필요해요.");
      if (data.isFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", data.me)
          .eq("following_id", data.profile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({ follower_id: data.me, following_id: data.profile.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-profile", handle] });
      qc.invalidateQueries({ queryKey: ["my-gyeol"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "다시 시도해 주세요."),
  });

  const toggleBlock = useMutation({
    mutationFn: async () => {
      if (!data?.me || !data.profile) throw new Error("로그인이 필요해요.");
      if (data.isBlocked) {
        const { error } = await supabase
          .from("blocks")
          .delete()
          .eq("blocker_id", data.me)
          .eq("blocked_id", data.profile.id);
        if (error) throw error;
      } else {
        // Unfollow both directions on block
        await supabase
          .from("follows")
          .delete()
          .or(
            `and(follower_id.eq.${data.me},following_id.eq.${data.profile.id}),and(follower_id.eq.${data.profile.id},following_id.eq.${data.me})`,
          );
        const { error } = await supabase
          .from("blocks")
          .insert({ blocker_id: data.me, blocked_id: data.profile.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(data?.isBlocked ? "차단을 해제했어요." : "차단했어요.");
      qc.invalidateQueries({ queryKey: ["user-profile", handle] });
      qc.invalidateQueries({ queryKey: ["blocked-ids"] });
      qc.invalidateQueries({ queryKey: ["home-feed"] });
      qc.invalidateQueries({ queryKey: ["explore-questions"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "다시 시도해 주세요."),
  });

  if (isLoading) {
    return (
      <main className="px-6 py-12">
        <div className="h-20 bg-muted rounded animate-pulse" />
      </main>
    );
  }

  if (!data?.profile) {
    return (
      <main className="px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">사용자를 찾을 수 없어요.</p>
        <button
          onClick={() => navigate({ to: "/grid" })}
          className="mt-4 text-xs text-accent underline underline-offset-4"
        >
          탐색으로 돌아가기
        </button>
      </main>
    );
  }

  const p = data.profile;

  return (
    <main className="pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-5 border-b border-border flex items-center justify-between">
        <button onClick={() => window.history.back()} className="text-sm text-muted-foreground">
          ←
        </button>
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
          @{p.handle}
        </span>
        {data.isMe ? (
          <span className="w-6" />
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setReportOpen(true)}
              aria-label="신고하기"
              className="text-muted-foreground hover:text-foreground"
            >
              <Flag className="size-4" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => toggleBlock.mutate()}
              disabled={toggleBlock.isPending}
              aria-label={data.isBlocked ? "차단 해제" : "차단"}
              className={
                "hover:text-foreground " +
                (data.isBlocked ? "text-destructive" : "text-muted-foreground")
              }
            >
              <Ban className="size-4" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </header>

      <section className="px-6 py-10 flex flex-col items-center text-center">
        {p.avatar_url ? (
          <img
            src={p.avatar_url}
            alt=""
            className="size-20 rounded-full object-cover border border-border mb-4"
          />
        ) : (
          <div className="size-20 rounded-full bg-surface border border-border mb-4" />
        )}
        <h2 className="font-serif text-2xl">{p.display_name ?? p.handle}의 결</h2>
        {p.bio && (
          <p className="text-[14px] text-foreground/80 mt-3 max-w-sm text-pretty">
            {p.bio}
          </p>
        )}

        <div className="flex items-center gap-8 mt-6">
          <StatBlock label="기록" value={data.answers.length} />
          <Link to="/u/$handle/followers" params={{ handle: p.handle ?? "" }}>
            <StatBlock label="팔로워" value={data.counts.followers} />
          </Link>
          <Link to="/u/$handle/following" params={{ handle: p.handle ?? "" }}>
            <StatBlock label="팔로잉" value={data.counts.following} />
          </Link>
        </div>

        {data.isMe ? (
          <Link
            to="/me/edit"
            className="mt-6 text-[11px] uppercase tracking-widest text-accent border border-accent/40 rounded-full px-5 py-2"
          >
            프로필 수정
          </Link>
        ) : (
          <button
            onClick={() => toggleFollow.mutate()}
            disabled={toggleFollow.isPending}
            className={
              "mt-6 text-xs uppercase tracking-widest rounded-full px-6 py-2 transition-colors disabled:opacity-50 " +
              (data.isFollowing
                ? "border border-border text-muted-foreground"
                : "bg-foreground text-background")
            }
          >
            {toggleFollow.isPending
              ? "..."
              : data.isFollowing
                ? "팔로잉"
                : "팔로우"}
          </button>
        )}
      </section>

      <section className="px-6">
        {data.isBlocked ? (
          <div className="text-center py-10">
            <p className="text-sm text-muted-foreground">
              차단한 사용자예요. 결을 보지 않으려면 차단을 유지하세요.
            </p>
            <button
              onClick={() => toggleBlock.mutate()}
              className="mt-3 text-xs text-accent underline underline-offset-4"
            >
              차단 해제
            </button>
          </div>
        ) : data.answers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            아직 공개된 기록이 없어요.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {data.answers.map((a: any) => (
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

      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        target={{ type: "user", userId: p.id }}
      />
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
