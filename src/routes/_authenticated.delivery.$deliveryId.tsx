import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  ageBand,
  fetchDelivery,
  fetchThreadByDelivery,
  fetchUnlockedPeer,
  formatCountdown,
  replyToDelivery,
  setVerdict,
} from "@/lib/mission";
import { StorageImg } from "@/components/storage-img";
import { ReportDialog } from "@/components/report-dialog";

export const Route = createFileRoute("/_authenticated/delivery/$deliveryId")({
  head: () => ({ meta: [{ title: "쪽지 — 쪽지" }] }),
  component: DeliveryPage,
});

function DeliveryPage() {
  const { deliveryId } = Route.useParams();
  const id = Number(deliveryId);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [uid, setUid] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [chip, setChip] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  const { data: delivery, isLoading, error } = useQuery({
    queryKey: ["mission-delivery", id],
    enabled: Number.isFinite(id),
    queryFn: () => fetchDelivery(id),
  });

  const role = useMemo(() => {
    if (!delivery || !uid) return null;
    if (delivery.sender_id === uid) return "sender" as const;
    if (delivery.receiver_id === uid) return "receiver" as const;
    return null;
  }, [delivery, uid]);

  const peerId =
    role === "sender" ? delivery?.receiver_id : delivery?.sender_id;

  const { data: peer } = useQuery({
    queryKey: ["unlocked-peer", peerId, delivery?.unlocked_at],
    enabled: !!peerId && !!delivery?.unlocked_at,
    queryFn: () => fetchUnlockedPeer(peerId!),
  });

  const { data: thread } = useQuery({
    queryKey: ["mission-thread", id, delivery?.unlocked_at],
    enabled: !!delivery?.unlocked_at,
    queryFn: () => fetchThreadByDelivery(id),
  });

  const replyMut = useMutation({
    mutationFn: async () => {
      const body = (chip ?? reply).trim();
      if (!body) throw new Error("답을 적어 주세요.");
      await replyToDelivery(id, body);
    },
    onSuccess: () => {
      toast.success("답장을 보냈어요.");
      qc.invalidateQueries({ queryKey: ["mission-delivery", id] });
      qc.invalidateQueries({ queryKey: ["mission-inbox"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "실패했어요."),
  });

  const verdictMut = useMutation({
    mutationFn: async (verdict: "ok" | "pass") => {
      if (!role) throw new Error("권한이 없어요.");
      await setVerdict(id, role, verdict);
    },
    onSuccess: (_, verdict) => {
      toast.success(verdict === "ok" ? "OK 했어요." : "패스했어요.");
      qc.invalidateQueries({ queryKey: ["mission-delivery", id] });
      qc.invalidateQueries({ queryKey: ["mission-inbox"] });
      qc.invalidateQueries({ queryKey: ["mission-outbox"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "실패했어요."),
  });

  if (isLoading) {
    return (
      <main className="px-5 py-8">
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      </main>
    );
  }
  if (error || !delivery || !role) {
    return (
      <main className="px-5 py-8">
        <p className="text-sm text-muted-foreground">쪽지를 찾을 수 없어요.</p>
        <button type="button" className="mt-4 text-sm underline" onClick={() => navigate({ to: "/home" })}>
          돌아가기
        </button>
      </main>
    );
  }

  const mission = delivery.mission;
  const chips = mission?.chips ?? [];
  const myVerdict = role === "sender" ? delivery.sender_verdict : delivery.receiver_verdict;
  const theirVerdict = role === "sender" ? delivery.receiver_verdict : delivery.sender_verdict;
  const canReply = role === "receiver" && !delivery.reply_body && new Date(delivery.expires_at) > new Date();
  const showVerdict =
    !!delivery.reply_body &&
    myVerdict === "pending" &&
    delivery.sender_verdict !== "pass" &&
    delivery.receiver_verdict !== "pass";

  return (
    <main className="px-5 py-8 pb-16">
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={() => navigate({ to: role === "sender" ? "/outbox" : "/home" })}
          className="text-sm text-muted-foreground"
        >
          ← 뒤로
        </button>
        {peerId && (
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="text-xs text-muted-foreground underline"
          >
            신고
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground mb-2">
        {role === "receiver" ? "받은 익명 미션" : "내가 보낸 미션"}
      </p>
      <h1 className="font-serif text-2xl leading-snug">{mission?.body}</h1>
      {!delivery.reply_body && delivery.status !== "expired" && (
        <p className="mt-2 text-xs tabular-nums text-muted-foreground">
          남은 시간 ⏱ {formatCountdown(delivery.expires_at)}
        </p>
      )}

      {!delivery.unlocked_at && (
        <p className="mt-3 text-sm text-muted-foreground">
          프로필은 서로 OK하기 전까지 비밀이에요.
          {theirVerdict === "ok" && myVerdict === "pending" && " · 상대는 OK했어요."}
        </p>
      )}

      {canReply && (
        <section className="mt-8 space-y-4">
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chips.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setChip(c);
                    setReply("");
                  }}
                  className={
                    "rounded-full border px-3 py-1.5 text-sm " +
                    (chip === c ? "border-foreground bg-foreground text-background" : "border-border")
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          <textarea
            value={reply}
            onChange={(e) => {
              setReply(e.target.value);
              setChip(null);
            }}
            rows={3}
            maxLength={200}
            placeholder="한 줄로 답해 보세요"
            className="w-full rounded-xl border border-border px-3 py-3 text-[15px] resize-none"
          />
          <button
            type="button"
            disabled={replyMut.isPending || (!(chip ?? reply).trim())}
            onClick={() => replyMut.mutate()}
            className="w-full rounded-full bg-foreground text-background py-3 text-sm disabled:opacity-40"
          >
            답장 보내기
          </button>
        </section>
      )}

      {delivery.reply_body && (
        <section className="mt-8 rounded-2xl border border-border px-4 py-4">
          <p className="text-xs text-muted-foreground mb-1">답장</p>
          <p className="text-[15px] leading-relaxed">{delivery.reply_body}</p>
        </section>
      )}

      {showVerdict && (
        <section className="mt-6 flex gap-2">
          <button
            type="button"
            disabled={verdictMut.isPending}
            onClick={() => verdictMut.mutate("ok")}
            className="flex-1 rounded-full bg-foreground text-background py-3 text-sm"
          >
            괜찮았어요 (OK)
          </button>
          <button
            type="button"
            disabled={verdictMut.isPending}
            onClick={() => verdictMut.mutate("pass")}
            className="flex-1 rounded-full border border-border py-3 text-sm"
          >
            패스
          </button>
        </section>
      )}

      {myVerdict !== "pending" && !delivery.unlocked_at && (
        <p className="mt-6 text-sm text-muted-foreground">
          내 선택: {myVerdict === "ok" ? "OK" : "패스"}
          {theirVerdict === "pending" ? " · 상대 기다리는 중" : ` · 상대: ${theirVerdict}`}
        </p>
      )}

      {delivery.unlocked_at && peer && (
        <section className="mt-8 rounded-2xl border border-foreground/20 bg-foreground/5 px-4 py-5">
          <p className="text-xs tracking-widest text-muted-foreground mb-3">UNLOCK</p>
          <div className="flex items-center gap-4">
            {peer.avatar_url ? (
              <StorageImg
                src={peer.avatar_url}
                alt=""
                className="size-14 rounded-full object-cover border border-border bg-surface"
              />
            ) : (
              <div className="size-14 rounded-full bg-surface border border-border grid place-items-center text-lg font-serif">
                {(peer.display_name ?? "?").slice(0, 1)}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="font-serif text-2xl truncate">{peer.display_name ?? "상대"}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {[
                  ageBand(peer.birth_year),
                  peer.region,
                  peer.height_cm ? `${peer.height_cm}cm` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          {peer.bio && (
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{peer.bio}</p>
          )}
          <p className="mt-4 text-[12px] text-muted-foreground">
            대화는 최대 20통 또는 7일 · 외부 연락은 서로 제안할 때만
          </p>
          {thread && (
            <Link
              to="/thread/$threadId"
              params={{ threadId: String(thread.id) }}
              className="mt-5 inline-flex rounded-full bg-foreground text-background px-5 py-2.5 text-sm"
            >
              대화 시작
            </Link>
          )}
        </section>
      )}

      {peerId && (
        <ReportDialog
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          target={{
            type: "delivery",
            deliveryId: id,
            userId: peerId,
          }}
        />
      )}
    </main>
  );
}
