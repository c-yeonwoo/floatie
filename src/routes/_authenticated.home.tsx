import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  countSendsToday,
  createAndDeliverMission,
  fetchInbox,
  fetchOutbox,
  fetchPresets,
  type MissionDelivery,
} from "@/lib/mission";
import { SeaWaves } from "@/components/sea/waves";
import { ParchmentNote, type NoteContent } from "@/components/sea/parchment-note";
import { AvatarMenu } from "@/components/sea/avatar-menu";
import { BottleGlyph } from "@/components/bottle-glyph";
import {
  bottlePos,
  isGlow,
  manState,
  womanState,
  MISSION_PRESETS_FALLBACK,
  type FloatieState,
} from "@/lib/sea";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "플로티" }] }),
  component: SeaHome,
});

function floatieSubtitle(s: FloatieState): string {
  return (
    {
      drift: "아직 표류 중이에요",
      replied: "답장이 도착했어요",
      opened: "프로필이 열린 플로티",
      match: "매칭된 플로티",
      arrived: "발견한 플로티",
      answered: "내가 답장했어요",
      expired: "표류가 끝났어요",
      done: "종료된 플로티",
    } as Record<FloatieState, string>
  )[s];
}

function SeaHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [note, setNote] = useState<null | { kind: "compose" } | { kind: "floatie"; d: MissionDelivery }>(null);

  const { data: me } = useQuery({
    queryKey: ["sea-me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("profiles")
        .select("id, gender, display_name, ticket_balance, photos")
        .eq("id", uid)
        .maybeSingle();
      return data as
        | { id: string; gender: string; display_name: string; ticket_balance: number; photos: string[] }
        | null;
    },
  });

  const uid = me?.id ?? null;
  const isWoman = me?.gender === "female";

  const { data: floaties = [] } = useQuery({
    queryKey: ["sea-floaties", uid, isWoman],
    enabled: !!uid,
    queryFn: () => (isWoman ? fetchOutbox(uid!) : fetchInbox(uid!)),
  });

  const { data: sendsToday = 0 } = useQuery({
    queryKey: ["sends-today", uid],
    enabled: !!uid && isWoman,
    queryFn: () => countSendsToday(uid!),
  });
  const canFree = sendsToday < 1;

  const { data: presetRows = [] } = useQuery({ queryKey: ["presets"], queryFn: fetchPresets });
  const presetBodies = useMemo(() => {
    const bodies = presetRows.map((p) => p.body).filter(Boolean);
    return (bodies.length ? bodies : MISSION_PRESETS_FALLBACK).slice(0, 5);
  }, [presetRows]);

  const send = useMutation({
    mutationFn: (body: string) => createAndDeliverMission({ kind: "question", body, useTicket: !canFree }),
    onSuccess: () => {
      setNote(null);
      toast.success("플로티를 바다 위로 띄웠어요", { description: "어떤 멋진 분께 닿을지 행운을 빌어요 🍀" });
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "티켓이 필요해요."),
  });

  const states = useMemo(
    () => floaties.map((d) => ({ d, s: isWoman ? womanState(d) : manState(d) })),
    [floaties, isWoman],
  );

  const mood = useMemo(() => {
    if (isWoman) {
      const replied = states.filter((x) => x.s === "replied").length;
      const drift = states.filter((x) => x.s === "drift").length;
      if (replied) return "답장이 도착했어요. 확인해볼까요?";
      if (drift) return "띄운 플로티가 누군가에게 닿는 중…";
      return "오늘은 어떤 답장이 올까요?";
    }
    const arrived = states.filter((x) => x.s === "arrived").length;
    return arrived ? "플로티를 발견했어요. 확인해볼까요?" : "오늘은 어떤 안부가 닿을까요?";
  }, [states, isWoman]);

  const content: NoteContent | null = useMemo(() => {
    if (!note) return null;
    if (note.kind === "compose") {
      return { kind: "compose", presets: presetBodies, canFree, sending: send.isPending, onSend: (b) => send.mutate(b) };
    }
    const d = note.d;
    const s = isWoman ? womanState(d) : manState(d);
    return { kind: "floatie", question: d.mission?.body ?? "플로티", subtitle: floatieSubtitle(s), reply: d.reply_body };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note, presetBodies, canFree, send.isPending, isWoman]);

  const menuItems = [
    { key: "profile", label: "내 프로필", onClick: () => navigate({ to: "/me" }) },
    { key: "history", label: "플로티 이력", onClick: () => navigate({ to: "/outbox" }) },
    { key: "shop", label: "티켓 상점", onClick: () => toast("티켓 상점", { description: "곧 만나요 🎟️" }) },
    { key: "settings", label: "설정", onClick: () => navigate({ to: "/me" }) },
    {
      key: "logout",
      label: "로그아웃",
      onClick: async () => {
        await supabase.auth.signOut();
        window.location.href = "/login";
      },
    },
  ];

  const empty =
    states.length === 0
      ? isWoman
        ? { b: "바다가 고요해요", s: "플로티를 하나 띄워 볼까요?" }
        : { b: "잔잔한 바다예요", s: "곧 누군가의 플로티가 떠오를지 몰라요" }
      : null;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <SeaWaves />

      {empty && (
        <div className="fl-empty">
          <b>{empty.b}</b>
          <span>{empty.s}</span>
        </div>
      )}

      <div className="fl-bottles">
        {states.map(({ d, s }) => {
          const pos = bottlePos(d.id);
          return (
            <button
              key={d.id}
              className={"fl-bottle" + (isGlow(s) ? " glow" : "")}
              style={{ left: pos.left, top: pos.top, animationDelay: `${-(d.id % 5) * 0.8}s` }}
              onClick={() => setNote({ kind: "floatie", d })}
              aria-label="플로티"
            >
              <BottleGlyph state="drift" className="w-full h-auto" />
            </button>
          );
        })}
      </div>

      <div className="fl-top">
        <button className="fl-icn" aria-label="알림" onClick={() => navigate({ to: "/notifications" })}>
          <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 01-3.4 0" />
          </svg>
        </button>
        <AvatarMenu avatar={me?.photos?.[0]} initial={(me?.display_name ?? "나").slice(0, 1)} items={menuItems} />
      </div>

      <div className="fl-mood">
        <span>{mood}</span>
      </div>

      {isWoman && (
        <button className="fl-fab" onClick={() => setNote({ kind: "compose" })}>
          <span style={{ width: 20, display: "inline-flex", marginBottom: -3 }}>
            <BottleGlyph state="drift" className="w-full h-auto" />
          </span>
          플로티 띄우기 <span className="sub">· {canFree ? "무료 1개" : "티켓 필요"}</span>
        </button>
      )}

      <ParchmentNote content={content} onClose={() => setNote(null)} />
    </div>
  );
}
