import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Heart, Flag, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ReportDialog } from "@/components/report-dialog";
import { useBlockedIds } from "@/lib/blocks";


export const Route = createFileRoute("/_authenticated/answer-detail/$answerId")({
  head: () => ({ meta: [{ title: "결 — 결" }] }),
  component: AnswerDetailPage,
});

function AnswerDetailPage() {
  const { answerId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [idx, setIdx] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const { data: blockedIds } = useBlockedIds();

  const { data, isLoading } = useQuery({
    queryKey: ["answer-detail", answerId],
    queryFn: async () => {
      const { data: answer } = await supabase
        .from("answers")
        .select("id, photos, user_id, created_at, questions(text, category), profiles(handle, display_name)")
        .eq("id", Number(answerId))
        .maybeSingle();
      if (!answer) return null;
      const { data: comments } = await supabase
        .from("comments")
        .select("id, body, created_at, user_id, profiles(handle, display_name)")
        .eq("answer_id", Number(answerId))
        .order("created_at", { ascending: true });
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user?.id;
      const { count: likeCount } = await supabase
        .from("likes")
        .select("*", { count: "exact", head: true })
        .eq("answer_id", Number(answerId));
      let liked = false;
      if (me) {
        const { data: myLike } = await supabase
          .from("likes")
          .select("user_id")
          .eq("answer_id", Number(answerId))
          .eq("user_id", me)
          .maybeSingle();
        liked = !!myLike;
      }
      return { answer, comments: comments ?? [], me, likeCount: likeCount ?? 0, liked };
    },
  });

  const addComment = useMutation({
    mutationFn: async (text: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("comments").insert({
        answer_id: Number(answerId),
        user_id: userData.user!.id,
        body: text,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["answer-detail", answerId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "댓글을 남기지 못했어요."),
  });

  const delComment = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["answer-detail", answerId] }),
  });

  const toggleLike = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;
      if (data?.liked) {
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("answer_id", Number(answerId))
          .eq("user_id", uid);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("likes")
          .insert({ answer_id: Number(answerId), user_id: uid });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["answer-detail", answerId] }),
    onError: (e: any) => toast.error(e?.message ?? "잠시 후 다시 시도해 주세요."),
  });

  if (isLoading) {
    return <div className="p-10 text-center text-sm text-muted-foreground">불러오는 중...</div>;
  }
  if (!data?.answer) {
    return (
      <div className="p-10 text-center text-sm text-muted-foreground">
        없는 결이에요.
      </div>
    );
  }

  const a = data.answer as any;
  const photos: string[] = a.photos ?? [];
  const isBlockedAuthor = !!blockedIds?.has(a.user_id);
  const visibleComments = (data.comments as any[]).filter(
    (c) => !blockedIds?.has(c.user_id),
  );

  if (isBlockedAuthor) {
    return (
      <main className="p-10 text-center text-sm text-muted-foreground">
        차단한 사용자의 결이에요.
        <div>
          <button
            onClick={() => navigate({ to: "/feed" })}
            className="mt-4 text-xs text-accent underline underline-offset-4"
          >
            홈으로 돌아가기
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-5 border-b border-border flex items-center justify-between">
        <button onClick={() => navigate({ to: "/grid" })} className="text-sm text-muted-foreground">
          ← 뒤로
        </button>
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">결</span>
        {data.me === a.user_id ? (
          <span className="w-10" />
        ) : (
          <button
            onClick={() => setReportOpen(true)}
            aria-label="신고하기"
            className="text-muted-foreground hover:text-foreground"
          >
            <Flag className="size-4" strokeWidth={1.5} />
          </button>
        )}
      </header>

      <section className="px-6 py-6">
        <div className="mb-5">
          <span className="text-[11px] uppercase tracking-widest text-accent">
            {a.questions?.category}
          </span>
          <h2 className="font-serif text-2xl mt-1 leading-snug text-balance">
            {a.questions?.text}
          </h2>
          <p className="text-[12px] text-muted-foreground mt-2">
            @{a.profiles?.handle ?? "anon"}
          </p>
        </div>

        <div className="relative">
          <img
            src={photos[idx]}
            alt=""
            className="w-full aspect-square object-cover rounded-2xl border border-border"
          />
          {photos.length > 1 && (
            <>
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-2">
                <button
                  onClick={() => setIdx((i) => (i - 1 + photos.length) % photos.length)}
                  className="size-9 rounded-full bg-background/80 backdrop-blur grid place-items-center"
                >
                  ‹
                </button>
                <button
                  onClick={() => setIdx((i) => (i + 1) % photos.length)}
                  className="size-9 rounded-full bg-background/80 backdrop-blur grid place-items-center"
                >
                  ›
                </button>
              </div>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {photos.map((_, i) => (
                  <span
                    key={i}
                    className={
                      "size-1.5 rounded-full transition-colors " +
                      (i === idx ? "bg-foreground" : "bg-foreground/30")
                    }
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button
            onClick={() => toggleLike.mutate()}
            disabled={toggleLike.isPending}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            aria-label={data.liked ? "좋아요 취소" : "좋아요"}
          >
            <Heart
              size={20}
              className={data.liked ? "fill-accent text-accent" : ""}
            />
            <span className="tabular-nums">{data.likeCount}</span>
          </button>
        </div>
      </section>

      <section className="px-6 pb-10">
        <h3 className="text-[11px] uppercase tracking-widest text-muted-foreground mb-4">
          댓글 {visibleComments.length}
        </h3>


        <ul className="space-y-3 mb-5">
          {visibleComments.length === 0 && (
            <p className="text-sm text-muted-foreground">아직 댓글이 없어요. 첫 마음을 남겨보세요.</p>
          )}
          {visibleComments.map((c: any) => (
            <li key={c.id} className="flex gap-3">
              <div className="flex-1">
                <p className="text-[12px] text-muted-foreground">
                  @{c.profiles?.handle ?? "anon"}
                </p>
                <p className="text-[14px] text-foreground mt-0.5 whitespace-pre-wrap break-words">
                  {c.body}
                </p>
              </div>
              {data.me === c.user_id && (
                <button
                  onClick={() => delComment.mutate(c.id)}
                  className="text-[11px] text-muted-foreground self-start"
                >
                  삭제
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="flex gap-2 items-end border-t border-border pt-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 300))}
            rows={2}
            placeholder="마음을 한 줄로 남겨주세요"
            className="flex-1 bg-transparent outline-none resize-none text-[14px] placeholder:text-muted-foreground"
          />
          <button
            onClick={() => body.trim() && addComment.mutate(body.trim())}
            disabled={!body.trim() || addComment.isPending}
            className="text-xs bg-foreground text-background px-4 py-2 rounded-md disabled:opacity-40"
          >
            남기기
          </button>
        </div>
      </section>

      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        target={{ type: "answer", answerId: Number(answerId) }}
      />
    </main>
  );
}
