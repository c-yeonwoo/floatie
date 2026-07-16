import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BottleDriftScene } from "@/components/bottle-drift-scene";
import {
  countSendsToday,
  fetchDelivery,
  fetchMyMissionProfile,
  formatCountdown,
  msUntil,
  resendExpiredMission,
} from "@/lib/mission";

export const Route = createFileRoute("/_authenticated/waiting/$deliveryId")({
  head: () => ({ meta: [{ title: "바다 위 — 플로티" }] }),
  component: WaitingPage,
});

function WaitingPage() {
  const { deliveryId } = Route.useParams();
  const id = Number(deliveryId);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [, setTick] = useState(0);

  const { data: delivery, isLoading } = useQuery({
    queryKey: ["mission-delivery", id],
    enabled: Number.isFinite(id),
    queryFn: () => fetchDelivery(id),
    refetchInterval: 8_000,
  });

  const { data: profile } = useQuery({
    queryKey: ["my-mission-profile"],
    queryFn: fetchMyMissionProfile,
  });

  const { data: sendsToday = 0 } = useQuery({
    queryKey: ["sends-today", profile?.id],
    enabled: !!profile?.id,
    queryFn: () => countSendsToday(profile!.id),
  });

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const phase = useMemo(() => {
    if (!delivery) return "drifting" as const;
    if (delivery.reply_body) return "replied" as const;
    if (delivery.status === "expired") return "expired" as const;
    if (delivery.accepted_at) return "accepted" as const;
    return "drifting" as const;
  }, [delivery]);

  const resend = useMutation({
    mutationFn: () => {
      const needsTicket = sendsToday >= 1;
      return resendExpiredMission(id, needsTicket);
    },
    onSuccess: (newId) => {
      toast.success("같은 내용으로 플로티를 다시 보냈어요.");
      qc.invalidateQueries({ queryKey: ["mission-outbox"] });
      navigate({ to: "/waiting/$deliveryId", params: { deliveryId: String(newId) } });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "다시 보내지 못했어요.";
      if (msg.includes("ticket")) toast.error("티켓이 필요해요.");
      else toast.error(msg);
    },
  });

  if (isLoading || !delivery) {
    return (
      <main className="px-5 py-8 min-h-full flex items-center justify-center">
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      </main>
    );
  }

  const missionBody = delivery.mission?.body ?? "";
  const countdown =
    phase === "accepted" && delivery.expires_at
      ? `답장까지 ${formatCountdown(delivery.expires_at)}`
      : null;

  const headline =
    phase === "drifting"
      ? "바다 위를 표류하고 있어요"
      : phase === "accepted"
        ? "누군가 받았어요"
        : phase === "replied"
          ? "답장이 도착했어요"
          : "미션에 응하지 않았어요";

  const subcopy =
    phase === "drifting"
      ? "누군가 발견할 때까지 조용히 떠다녀요. 도착하면 알려드릴게요."
      : phase === "accepted"
        ? "수락 후 12시간 안에 답장이 오면 알려드릴게요."
        : phase === "replied"
          ? "결과에서 답장을 확인하고 평가해 주세요."
          : "이 미션, 다른 사람에게 다시 띄워 볼까요?";

  return (
    <main className="px-5 py-8 pb-16 min-h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={() => navigate({ to: "/outbox" })}
          className="text-sm text-muted-foreground"
        >
          ← 결과
        </button>
        <span className="text-xs tracking-widest uppercase text-muted-foreground">Floatie</span>
      </div>

      <header className="mb-6 text-center">
        <h1 className="font-serif text-2xl leading-snug">{headline}</h1>
        <p className="mt-3 text-[15px] text-muted-foreground leading-relaxed max-w-xs mx-auto">
          {subcopy}
        </p>
      </header>

      <BottleDriftScene
        missionBody={missionBody}
        phase={phase}
        countdown={countdown}
        className="mx-auto w-full max-w-sm shadow-md"
      />

      {phase === "drifting" && (
        <p className="mt-8 text-center text-xs text-muted-foreground animate-pulse">
          🌊 표류 중…
        </p>
      )}

      {phase === "accepted" && delivery.expires_at && msUntil(delivery.expires_at) > 0 && (
        <p className="mt-6 text-center font-serif text-lg tabular-nums">
          {formatCountdown(delivery.expires_at)}
        </p>
      )}

      {phase === "expired" && (
        <div className="mt-8 space-y-3">
          <button
            type="button"
            disabled={resend.isPending || (sendsToday >= 1 && (profile?.ticket_balance ?? 0) < 1)}
            onClick={() => resend.mutate()}
            className="w-full rounded-full bg-foreground text-background py-3.5 text-sm font-medium disabled:opacity-40"
          >
            {resend.isPending
              ? "보내는 중…"
              : sendsToday >= 1
                ? "티켓으로 다시 보내기"
                : "같은 내용으로 다시 보내기"}
          </button>
          <Link
            to="/send"
            className="block text-center text-sm text-muted-foreground underline"
          >
            새 미션 작성하기
          </Link>
        </div>
      )}

      {phase === "replied" && (
        <Link
          to="/delivery/$deliveryId"
          params={{ deliveryId: String(id) }}
          className="mt-8 block w-full rounded-full bg-foreground text-background py-3.5 text-sm font-medium text-center"
        >
          답장 확인하기
        </Link>
      )}

      <Link
        to="/outbox"
        className="mt-auto pt-10 text-center text-xs text-muted-foreground underline"
      >
        결과 목록 보기
      </Link>
    </main>
  );
}
