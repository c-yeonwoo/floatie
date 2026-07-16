import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/empty-state";
import { Pill } from "@/components/status-pill";
import {
  fetchInbox,
  fetchMyMissionProfile,
  formatCountdown,
  msUntil,
  type MissionDelivery,
} from "@/lib/mission";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "받은 미션 — 플로티" }] }),
  component: InboxPage,
});

function InboxPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  // refresh countdown every 30s
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const { data: profile } = useQuery({
    queryKey: ["my-mission-profile"],
    queryFn: fetchMyMissionProfile,
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["mission-inbox", uid],
    enabled: !!uid,
    queryFn: () => fetchInbox(uid!),
  });

  const isMale = profile?.gender === "male";

  return (
    <main className="px-5 py-8">
      <header className="mb-8">
        <p className="text-xs tracking-widest text-muted-foreground uppercase">플로티</p>
        <h1 className="font-serif text-3xl mt-1">받은 미션</h1>
        <p className="text-[15px] text-muted-foreground mt-2 leading-relaxed">
          {isMale
            ? "도착한 미션을 수락하고 12시간 안에 답해 보세요. 서로 좋으면 그때 열려요."
            : "남성 회원에게 도착한 미션이 여기에 쌓여요. 보내기는 여성만 가능해요."}
        </p>
      </header>

      {!isMale && profile && (
        <div className="mb-6 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          수행(답장)은 남성 역할이에요.{" "}
          <Link to="/send" className="underline text-foreground">
            보내기
          </Link>
          로 가 보세요.
        </div>
      )}

      {isLoading && (
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      )}
      {error && (
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">
            잠깐 파도가 높네요. 잠시 뒤 다시 시도해 주세요.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 text-sm underline"
          >
            다시 시도
          </button>
        </div>
      )}
      {!isLoading && !error && (data?.length ?? 0) === 0 && (
        <EmptyState
          title="아직 도착한 미션이 없어요"
          description={
            isMale
              ? "누군가의 미션이 바다를 건너오면 여기에 조용히 닿아요."
              : "먼저 미션을 바다에 띄우면 루프가 시작돼요."
          }
          action={
            isMale ? undefined : (
              <Link
                to="/send"
                className="inline-flex rounded-full bg-warm text-warm-foreground px-6 py-3 text-sm font-bold"
              >
                미션 보내기
              </Link>
            )
          }
        />
      )}

      <ul className="space-y-3">
        {data?.map((d) => (
          <InboxCard key={d.id} delivery={d} />
        ))}
      </ul>
    </main>
  );
}

function InboxCard({ delivery }: { delivery: MissionDelivery }) {
  const body = delivery.mission?.body ?? "미션";
  const waiting = !delivery.reply_body;
  const needsAccept = waiting && !delivery.accepted_at && delivery.status !== "expired";
  const expired =
    waiting &&
    (delivery.status === "expired" ||
      (!!delivery.accepted_at && delivery.expires_at != null && msUntil(delivery.expires_at) <= 0));

  return (
    <li>
      <Link
        to="/delivery/$deliveryId"
        params={{ deliveryId: String(delivery.id) }}
        className="block rounded-2xl bg-surface px-4 py-4 transition-shadow duration-150 hover:shadow-[var(--shadow-md)]"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          {expired ? (
            <Pill tone="alert">만료</Pill>
          ) : needsAccept ? (
            <Pill tone="new" ping>새 미션 도착</Pill>
          ) : waiting ? (
            <Pill tone="tide">답장 대기</Pill>
          ) : (
            <Pill tone="tide">답장함</Pill>
          )}
          {waiting && !expired && delivery.accepted_at && delivery.expires_at && (
            <span className="text-xs font-bold tabular-nums text-warm-foreground">
              ⏱ {formatCountdown(delivery.expires_at)}
            </span>
          )}
        </div>
        <p className="font-serif text-lg leading-snug">{body}</p>
        {delivery.reply_body && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
            내 답: {delivery.reply_body}
          </p>
        )}
      </Link>
    </li>
  );
}
