import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchInbox, type MissionDelivery } from "@/lib/mission";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "받은 쪽지 — 쪽지" }] }),
  component: InboxPage,
});

function InboxPage() {
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["mission-inbox", uid],
    enabled: !!uid,
    queryFn: () => fetchInbox(uid!),
  });

  return (
    <main className="px-5 py-8">
      <header className="mb-8">
        <p className="text-xs tracking-widest text-muted-foreground uppercase">쪽지</p>
        <h1 className="font-serif text-3xl mt-1">받은 쪽지</h1>
        <p className="text-[15px] text-muted-foreground mt-2 leading-relaxed">
          익명으로 도착한 미션에 답해 보세요. 서로 OK면 그때 열려요.
        </p>
      </header>

      {isLoading && (
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      )}
      {error && (
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">
            받은 쪽지를 불러오지 못했어요. DB 마이그레이션이 적용됐는지 확인해 주세요.
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
        <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center">
          <p className="font-serif text-xl">아직 도착한 쪽지가 없어요</p>
          <p className="text-sm text-muted-foreground mt-2">
            먼저 하나를 보내 보면, 누군가에게도 닿을 거예요.
          </p>
          <Link
            to="/send"
            className="mt-6 inline-flex rounded-full bg-foreground text-background px-5 py-2.5 text-sm"
          >
            쪽지 보내기
          </Link>
        </div>
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
  const expired = new Date(delivery.expires_at) < new Date() && waiting;

  return (
    <li>
      <Link
        to="/delivery/$deliveryId"
        params={{ deliveryId: String(delivery.id) }}
        className="block rounded-2xl border border-border bg-surface px-4 py-4 hover:border-foreground/30 transition-colors"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs text-muted-foreground">
            {expired ? "만료" : waiting ? "답장 대기" : "답장함"}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(delivery.created_at).toLocaleDateString("ko-KR")}
          </span>
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
