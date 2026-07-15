import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchOutbox,
  formatCountdown,
  msUntil,
  type MissionDelivery,
} from "@/lib/mission";

export const Route = createFileRoute("/_authenticated/outbox")({
  head: () => ({ meta: [{ title: "결과 — 플로티" }] }),
  component: OutboxPage,
});

function OutboxPage() {
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["mission-outbox", uid],
    enabled: !!uid,
    queryFn: () => fetchOutbox(uid!),
  });

  return (
    <main className="px-5 py-8">
      <header className="mb-8">
        <p className="text-xs tracking-widest text-muted-foreground uppercase">Floatie</p>
        <h1 className="font-serif text-3xl mt-1">결과</h1>
        <p className="text-[15px] text-muted-foreground mt-2">
          보낸 Floatie의 답장과 unlock을 확인해요.
        </p>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">불러오는 중…</p>}
      {!isLoading && (data?.length ?? 0) === 0 && (
        <p className="text-sm text-muted-foreground">아직 보낸 미션이 없어요.</p>
      )}

      <ul className="space-y-3">
        {data?.map((d) => (
          <OutboxCard key={d.id} delivery={d} />
        ))}
      </ul>
    </main>
  );
}

function statusLabel(d: MissionDelivery): string {
  if (d.unlocked_at) return "열림";
  if (d.sender_verdict === "pass" || d.receiver_verdict === "pass") return "패스";
  if (d.reply_body && d.sender_verdict === "pending") return "평가 대기";
  if (d.reply_body) return "답장 도착";
  if (d.status === "expired") return "무응답 만료";
  if (!d.accepted_at) return "표류 중";
  if (d.expires_at && msUntil(d.expires_at) <= 0) return "만료";
  return "답장 기다리는 중";
}

function OutboxCard({ delivery }: { delivery: MissionDelivery }) {
  const expiredNoReply = delivery.status === "expired" && !delivery.reply_body;

  return (
    <li>
      <Link
        to={expiredNoReply ? "/waiting/$deliveryId" : "/delivery/$deliveryId"}
        params={{ deliveryId: String(delivery.id) }}
        className="block rounded-2xl border border-border bg-surface px-4 py-4"
      >
        <div className="flex justify-between text-xs text-muted-foreground mb-2">
          <span>{statusLabel(delivery)}</span>
          <span>{new Date(delivery.created_at).toLocaleDateString("ko-KR")}</span>
        </div>
        <p className="font-serif text-lg leading-snug">
          {delivery.mission?.body ?? "미션"}
        </p>
        {!delivery.accepted_at && delivery.status !== "expired" && (
          <p className="mt-2 text-xs text-muted-foreground">🌊 바다 위 표류 중</p>
        )}
        {delivery.accepted_at && !delivery.reply_body && delivery.expires_at && (
          <p className="mt-2 text-xs text-muted-foreground tabular-nums">
            ⏱ {formatCountdown(delivery.expires_at)}
          </p>
        )}
        {delivery.reply_body && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
            답장: {delivery.reply_body}
          </p>
        )}
        {expiredNoReply && (
          <p className="mt-2 text-xs text-accent">같은 내용으로 다시 보내기 →</p>
        )}
      </Link>
    </li>
  );
}
