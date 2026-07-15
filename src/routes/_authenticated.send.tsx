import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AGE_BAND_OPTIONS,
  HEIGHT_OPTIONS,
  countSendsToday,
  createAndDeliverMission,
  fetchMyMissionProfile,
  fetchPresets,
  type IdealFilter,
  type MissionPreset,
} from "@/lib/mission";
import { BRAND_KO } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/send")({
  head: () => ({ meta: [{ title: "보내기 — 플로티" }] }),
  component: SendPage,
});

type FilterKind = "none" | "age_band" | "region" | "height";

function SendPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [custom, setCustom] = useState("");
  const [selected, setSelected] = useState<MissionPreset | null>(null);
  const [filterKind, setFilterKind] = useState<FilterKind>("none");
  const [filterValue, setFilterValue] = useState("");
  const [regionInput, setRegionInput] = useState("");

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["my-mission-profile"],
    queryFn: fetchMyMissionProfile,
  });

  const { data: presets = [], isLoading } = useQuery({
    queryKey: ["mission-presets"],
    queryFn: fetchPresets,
  });

  const { data: sendsToday = 0 } = useQuery({
    queryKey: ["sends-today", profile?.id],
    enabled: !!profile?.id,
    queryFn: () => countSendsToday(profile!.id),
  });

  const isFemale = profile?.gender === "female";
  const freeLeft = Math.max(0, 1 - sendsToday);
  const needsTicket = sendsToday >= 1;
  const tickets = profile?.ticket_balance ?? 0;

  const filter: IdealFilter | null = useMemo(() => {
    if (filterKind === "none") return null;
    if (filterKind === "region") {
      const v = regionInput.trim();
      if (!v) return null;
      return { kind: "region", value: v };
    }
    if (!filterValue) return null;
    return { kind: filterKind, value: filterValue };
  }, [filterKind, filterValue, regionInput]);

  const send = useMutation({
    mutationFn: async () => {
      if (!isFemale) throw new Error("only female can send");
      if (needsTicket && tickets < 1) throw new Error("ticket required");

      const payload = {
        useTicket: needsTicket,
        filter,
      };

      if (selected) {
        return createAndDeliverMission({
          presetId: selected.id,
          kind: selected.kind,
          body: selected.body,
          chips: selected.chips,
          ...payload,
        });
      }
      const body = custom.trim();
      if (body.length < 2) throw new Error("미션을 두 글자 이상 적어 주세요.");
      if (body.length > 40) throw new Error("커스텀 미션은 40자까지예요.");
      return createAndDeliverMission({
        kind: "question",
        body,
        ...payload,
      });
    },
    onSuccess: (result) => {
        toast.success(
        needsTicket
          ? `티켓으로 ${BRAND_KO}를 보냈어요.`
          : "바다 위로 보냈어요. 누군가 받으면 알려드릴게요.",
      );
      qc.invalidateQueries({ queryKey: ["mission-outbox"] });
      qc.invalidateQueries({ queryKey: ["sends-today"] });
      qc.invalidateQueries({ queryKey: ["my-mission-profile"] });
      navigate({
        to: "/waiting/$deliveryId",
        params: { deliveryId: String(result.deliveryId) },
      });
    },
    onError: (err) => {
      const msg =
        (err as { message?: string })?.message ||
        (err instanceof Error ? err.message : "보내지 못했어요.");
      if (msg.includes("only female")) {
        toast.error("미션은 여성 회원만 보낼 수 있어요.");
      } else if (msg.includes("no eligible recipient")) {
        toast.error("지금 받을 수 있는 사람이 없어요. 조건을 낮추거나 잠시 뒤 다시 시도해 주세요.");
      } else if (msg.includes("ticket required") || msg.includes("daily send cap")) {
        toast.error("오늘 무료 발송을 썼어요. 티켓이 필요해요.");
      } else {
        toast.error(msg);
      }
    },
  });

  if (profileLoading) {
    return (
      <main className="px-5 py-8">
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      </main>
    );
  }

  if (!isFemale) {
    return (
      <main className="px-5 py-8">
        <h1 className="font-serif text-3xl">보내기</h1>
        <p className="mt-4 text-[15px] text-muted-foreground leading-relaxed">
          지금은 <strong className="text-foreground">여성 회원만</strong> 미션을 보낼 수
          있어요. 남성 회원은 받은 미션에 답하는 역할이에요.
        </p>
        <Link
          to="/home"
          className="mt-8 inline-flex rounded-full bg-foreground text-background px-5 py-2.5 text-sm"
        >
          받은 미션 보기
        </Link>
      </main>
    );
  }

  const canSubmit =
    (!!selected || custom.trim().length >= 2) &&
    !(needsTicket && tickets < 1) &&
    (filterKind === "none" || !!filter);

  return (
    <main className="px-5 py-8 pb-28">
      <header className="mb-6">
        <p className="text-xs tracking-widest text-muted-foreground uppercase">Floatie</p>
        <h1 className="font-serif text-3xl mt-1">보내기</h1>
        <p className="text-[15px] text-muted-foreground mt-2">
          미션을 바다 위로. 하루 1회 무료 · 추가 발송은 티켓 · 이상형 조건 1개까지 무료
          <span className="block text-xs mt-1 opacity-80">조건 2개 이상은 티켓 상품 연동 후 개방</span>
        </p>
        <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
          <span>오늘 무료 {freeLeft}/1</span>
          <span>티켓 {tickets}</span>
        </div>
      </header>

      {needsTicket && (
        <div className="mb-6 rounded-xl border border-border bg-foreground/5 px-4 py-3 text-sm">
          {tickets > 0
            ? "오늘 무료분을 썼어요. 보내면 티켓 1장이 차감돼요."
            : "오늘 무료분을 썼어요. 티켓이 생기면 추가로 보낼 수 있어요."}
        </div>
      )}

      <section className="mb-8">
        <h2 className="text-sm font-medium mb-3">이상형 조건 (선택 · 1개)</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {(
            [
              ["none", "없음"],
              ["age_band", "나이"],
              ["region", "지역"],
              ["height", "키"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setFilterKind(k);
                setFilterValue("");
              }}
              className={
                "rounded-full border px-3 py-1.5 text-sm " +
                (filterKind === k
                  ? "border-foreground bg-foreground text-background"
                  : "border-border")
              }
            >
              {label}
            </button>
          ))}
        </div>
        {filterKind === "age_band" && (
          <div className="flex flex-wrap gap-2">
            {AGE_BAND_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setFilterValue(o.value)}
                className={
                  "rounded-full border px-3 py-1.5 text-sm " +
                  (filterValue === o.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border")
                }
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
        {filterKind === "height" && (
          <div className="flex flex-wrap gap-2">
            {HEIGHT_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setFilterValue(o.value)}
                className={
                  "rounded-full border px-3 py-1.5 text-sm " +
                  (filterValue === o.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border")
                }
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
        {filterKind === "region" && (
          <input
            value={regionInput}
            onChange={(e) => setRegionInput(e.target.value)}
            placeholder="예: 서울"
            className="w-full rounded-xl border border-border px-3 py-2.5 text-[15px]"
          />
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-medium mb-3">직접 쓰기</h2>
        <textarea
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value);
            setSelected(null);
          }}
          rows={3}
          maxLength={40}
          placeholder="예: 오늘 기분 한 단어는?"
          className="w-full rounded-xl border border-border bg-background px-3 py-3 text-[15px] resize-none focus:outline-none focus:ring-1 focus:ring-foreground/30"
        />
        <p className="text-xs text-muted-foreground mt-1 text-right">
          {custom.trim().length}/40
        </p>
      </section>

      <section>
        <h2 className="text-sm font-medium mb-3">프리셋</h2>
        {isLoading && <p className="text-sm text-muted-foreground">불러오는 중…</p>}
        <ul className="space-y-2">
          {presets.map((p) => {
            const active = selected?.id === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(p);
                    setCustom("");
                  }}
                  className={
                    "w-full text-left rounded-xl border px-4 py-3 transition-colors " +
                    (active
                      ? "border-foreground bg-foreground/5"
                      : "border-border hover:border-foreground/30")
                  }
                >
                  <span className="text-[11px] text-muted-foreground">
                    {p.kind === "question" ? "질문" : "행동 인증"}
                  </span>
                  <p className="font-serif text-[17px] mt-0.5 leading-snug">{p.body}</p>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 px-5 pb-[calc(var(--safe-bottom)+var(--tabbar-height)+12px)] pt-3 bg-gradient-to-t from-background via-background to-transparent">
        <button
          type="button"
          disabled={send.isPending || !canSubmit}
          onClick={() => send.mutate()}
          className="w-full rounded-full bg-foreground text-background py-3.5 text-sm font-medium disabled:opacity-40"
        >
          {send.isPending
            ? "보내는 중…"
            : needsTicket
              ? "티켓으로 보내기"
              : "바다 위로 보내기"}
        </button>
      </div>
    </main>
  );
}
