import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  acceptDelivery,
  ageBand,
  countSendsToday,
  createAndDeliverMission,
  declineDelivery,
  fetchInbox,
  fetchOutbox,
  fetchPresets,
  fetchReceiverCard,
  fetchSenderCard,
  fetchUnlockedPeer,
  forfeitDelivery,
  formatCountdown,
  hasActiveChat,
  mapMissionError,
  recallDelivery,
  replyToDelivery,
  setReplyPhoto,
  setVerdict,
  startMatch,
  type MissionDelivery,
  type PersonCard,
  type UnlockedPeer,
} from "@/lib/mission";
import { uploadReplyPhoto } from "@/lib/profile-ai";
import { profileMetaLine } from "@/lib/interview-chips";
import { SeaWaves } from "@/components/sea/waves";
import { ParchmentNote, type NoteContent } from "@/components/sea/parchment-note";
import { ConfirmModal, type ConfirmOpts } from "@/components/sea/confirm-modal";
import { ProfileOverlay, type ProfileCardData } from "@/components/sea/profile-overlay";
import { SubPageOverlay } from "@/components/sea/sub-page";
import { AvatarMenu } from "@/components/sea/avatar-menu";
import { BottleGlyph } from "@/components/bottle-glyph";
import { ReportDialog } from "@/components/report-dialog";
import {
  bottlePos,
  isGlow,
  manState,
  womanState,
  stateLabel,
  MISSION_PRESETS_FALLBACK,
  type FloatieState,
} from "@/lib/sea";
import { pageTitle } from "@/lib/brand";
import { track } from "@/lib/analytics";
import { getProfileNudge } from "@/lib/profile-nudge";

type HomeSearch = { d?: number; me?: boolean; compose?: boolean };

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: pageTitle() }] }),
  validateSearch: (raw: Record<string, unknown>): HomeSearch => {
    const n = raw.d != null ? Number(raw.d) : NaN;
    const out: HomeSearch = {};
    if (Number.isFinite(n)) out.d = n;
    if (raw.me === true || raw.me === "1" || raw.me === "true") out.me = true;
    if (raw.compose === true || raw.compose === "1" || raw.compose === "true") out.compose = true;
    return out;
  },
  component: SeaHome,
});

const SUBTITLE: Record<FloatieState, string> = {
  drift: "아직 표류 중이에요",
  replied: "답장이 도착했어요",
  opened: "프로필이 열린 플로티",
  match: "매칭된 플로티",
  arrived: "발견한 플로티",
  answered: "내가 답장했어요",
  expired: "표류가 끝났어요",
  done: "종료된 플로티",
};

type MeProfile = {
  id: string;
  gender: string;
  display_name: string;
  ticket_balance: number;
  photos: string[] | null;
  birth_year: number | null;
  region: string | null;
  height_cm: number | null;
  job_chip: string | null;
  smoke: string | null;
  drink: string | null;
  tattoo: string | null;
  ai_intro: string | null;
  ai_ideal_line: string | null;
  ai_tags: string[] | null;
  intro_answers: unknown;
};

type NoteState =
  | null
  | { kind: "compose" }
  | { kind: "floatie"; d: MissionDelivery; from?: PersonCard | null; act?: "like" | "recall" | "profile" }
  | { kind: "read"; d: MissionDelivery }
  | { kind: "reply"; d: MissionDelivery };

function peerCard(p: UnlockedPeer, ageOf: (y: number | null) => string): ProfileCardData {
  return {
    name: p.display_name ?? "상대",
    age: ageOf(p.birth_year),
    region: p.region ?? "",
    meta: profileMetaLine(p),
    photos: p.photos ?? undefined,
    photo: p.photos?.[0] ?? p.avatar_url,
    intro: p.ai_intro ?? p.bio ?? "",
    idealLine: p.ai_ideal_line ?? "",
    tags: p.ai_tags ?? [],
  };
}

function SeaHome() {
  const navigate = useNavigate();
  const { d: deepLinkId, me: openMeProfile, compose: openCompose } = Route.useSearch();
  const qc = useQueryClient();
  const [note, setNote] = useState<NoteState>(null);
  const [composeDraft, setComposeDraft] = useState<string | undefined>();
  const [confirm, setConfirm] = useState<ConfirmOpts | null>(null);
  const [profile, setProfile] = useState<{ data: ProfileCardData; delivery: MissionDelivery | null } | null>(null);
  const [page, setPage] = useState<null | "history" | "shop">(null);
  const [report, setReport] = useState<{ deliveryId: number; userId: string } | null>(null);
  const [tick, setTick] = useState(0);
  const ageOf = (y: number | null) => (y ? ageBand(y) : "") ?? "";

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const { data: me } = useQuery({
    queryKey: ["sea-me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("profiles")
        .select(
          "id, gender, display_name, ticket_balance, photos, birth_year, region, height_cm, job_chip, smoke, drink, tattoo, ai_intro, ai_ideal_line, ai_tags, intro_answers",
        )
        .eq("id", uid)
        .maybeSingle();
      return data as MeProfile | null;
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

  const { data: chatActive = false } = useQuery({
    queryKey: ["has-active-chat", uid],
    enabled: !!uid && isWoman,
    queryFn: hasActiveChat,
    refetchInterval: 60_000,
  });
  const sendLocked = isWoman && chatActive;

  const { data: presetRows = [] } = useQuery({ queryKey: ["presets"], queryFn: fetchPresets });
  const presetBodies = useMemo(() => {
    const bodies = presetRows.map((p) => p.body).filter(Boolean);
    return (bodies.length ? bodies : MISSION_PRESETS_FALLBACK).slice(0, 8);
  }, [presetRows]);

  const refresh = () => qc.invalidateQueries();
  const peerIdOf = (d: MissionDelivery) => (isWoman ? d.receiver_id : d.sender_id);
  const openReport = (d: MissionDelivery) =>
    setReport({ deliveryId: d.id, userId: peerIdOf(d) });

  const send = useMutation({
    mutationFn: ({ body, askPhoto }: { body: string; askPhoto: boolean }) =>
      createAndDeliverMission({ kind: "question", body, useTicket: !canFree, photoAnswer: askPhoto }),
    onSuccess: () => {
      track("send", { ticket: !canFree });
      track("deliver_ok");
      setNote(null);
      toast.success("플로티를 바다 위로 띄웠어요", {
        description: "표류 중이에요. 답장이 오면 바다에 반짝일 거예요.",
      });
      refresh();
    },
    onError: (e) => toast.error(mapMissionError(e, "보내지 못했어요.")),
  });

  const accept = useMutation({
    mutationFn: async (d: MissionDelivery) => {
      if (!d.accepted_at) await acceptDelivery(d.id);
      return d;
    },
    onSuccess: (d) => {
      track("open_accept", { deliveryId: d.id });
      setNote({ kind: "reply", d });
    },
    onError: (e) => toast.error(mapMissionError(e, "열지 못했어요.")),
  });

  const reply = useMutation({
    mutationFn: async ({ d, body, photo }: { d: MissionDelivery; body: string; photo: File | null }) => {
      await replyToDelivery(d.id, body);
      if (photo && uid) {
        const path = await uploadReplyPhoto(uid, d.id, photo);
        await setReplyPhoto(d.id, path);
      }
    },
    onSuccess: (_r, { d }) => {
      track("reply", { deliveryId: d.id });
      setNote(null);
      toast.success("답장을 병에 담아 보냈어요", {
        description: "답장했다는 건 관심이 있다는 신호예요. 상대가 마음에 들면 프로필이 열려요.",
      });
      refresh();
    },
    onError: (e) => toast.error(mapMissionError(e, "답장을 보내지 못했어요.")),
  });

  const openPeer = async (d: MissionDelivery) => {
    const peerId = peerIdOf(d);
    const p = await fetchUnlockedPeer(peerId).catch(() => null);
    if (!p) return toast.error("프로필을 열 수 없어요.");
    setNote(null);
    setProfile({ data: peerCard(p, ageOf), delivery: d });
  };

  const verdict = useMutation({
    mutationFn: ({ d, v }: { d: MissionDelivery; v: "ok" | "pass" }) =>
      setVerdict(d.id, "sender", v),
    onSuccess: (_res, { d, v }) => {
      if (v === "ok") {
        track("unlock", { deliveryId: d.id });
        toast.success("마음을 전했어요", { description: "내 프로필이 상대에게 열렸어요." });
        refresh();
        openPeer(d);
      } else {
        track("pass_post", { deliveryId: d.id });
        toast("패스했어요", { description: "같은 분과는 잠시 다시 만나지 않아요." });
        setNote(null);
        refresh();
      }
    },
    onError: (e) => toast.error(mapMissionError(e, "실패했어요.")),
  });

  const decline = useMutation({
    mutationFn: (d: MissionDelivery) => declineDelivery(d.id),
    onSuccess: (_r, d) => {
      track("pass_preopen", { deliveryId: d.id });
      toast("패스했어요", { description: "페널티는 없어요. 같은 분과는 잠시 다시 만나지 않아요." });
      setNote(null);
      refresh();
    },
    onError: (e) => toast.error(mapMissionError(e, "패스하지 못했어요.")),
  });

  const forfeit = useMutation({
    mutationFn: (d: MissionDelivery) => forfeitDelivery(d.id),
    onSuccess: (_r, d) => {
      track("forfeit", { deliveryId: d.id });
      setNote(null);
      toast("답장을 포기했어요", { description: "하루 동안 새 플로티를 받지 못해요." });
      refresh();
    },
    onError: (e) => toast.error(mapMissionError(e, "포기하지 못했어요.")),
  });

  const match = useMutation({
    mutationFn: (d: MissionDelivery) => startMatch(d.id),
    onSuccess: (threadId, d) => {
      track("match", { deliveryId: d.id, threadId });
      setProfile(null);
      toast.success("매칭됐어요! 대화방이 열렸어요", {
        description: "7일 안에 연락처를 나눠 보세요. 메시지는 무제한이에요.",
      });
      void qc.invalidateQueries({ queryKey: ["has-active-chat"] });
      refresh();
      navigate({ to: "/thread/$threadId", params: { threadId: String(threadId) } });
    },
    onError: (e) => toast.error(mapMissionError(e, "매칭하지 못했어요.")),
  });

  const openMyProfile = () => {
    if (!me) return;
    setProfile({
      data: {
        name: me.display_name,
        age: ageOf(me.birth_year),
        region: me.region ?? "",
        meta: profileMetaLine(me),
        photos: me.photos ?? undefined,
        photo: me.photos?.[0],
        intro: me.ai_intro ?? "",
        idealLine: me.ai_ideal_line ?? "",
        tags: me.ai_tags ?? [],
      },
      delivery: null,
    });
  };

  // After /me/edit save → land on "내 프로필" overlay
  useEffect(() => {
    if (!openMeProfile || !me) return;
    openMyProfile();
    navigate({ to: "/home", search: {}, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openMeProfile, me?.id]);

  const recall = useMutation({
    mutationFn: (id: number) => recallDelivery(id),
    onSuccess: () => {
      setNote(null);
      toast("플로티를 회수했어요", { description: "다시 새로 띄울 수 있어요" });
      refresh();
    },
    onError: (e) => toast.error(mapMissionError(e, "회수하지 못했어요.")),
  });

  const all = useMemo(
    () => floaties.map((d) => ({ d, s: isWoman ? womanState(d) : manState(d) })),
    [floaties, isWoman],
  );
  const bottles = useMemo(() => all.filter((x) => x.s !== "done" && x.s !== "expired"), [all]);

  useEffect(() => {
    if (!deepLinkId || !floaties.length) return;
    const hit = floaties.find((x) => x.id === deepLinkId);
    if (!hit) return;
    const s = isWoman ? womanState(hit) : manState(hit);
    void tapBottle(hit, s);
    navigate({ to: "/home", search: {}, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkId, floaties.length, isWoman]);

  useEffect(() => {
    if (!openCompose || !isWoman) return;
    if (sendLocked) {
      toast("대화 중에는 새 플로티를 띄울 수 없어요");
      navigate({ to: "/home", search: {}, replace: true });
      return;
    }
    let draft: string | undefined;
    try {
      draft = sessionStorage.getItem("floatie_compose_draft") ?? undefined;
      sessionStorage.removeItem("floatie_compose_draft");
    } catch {
      /* ignore */
    }
    setComposeDraft(draft);
    setNote({ kind: "compose" });
    navigate({ to: "/home", search: {}, replace: true });
  }, [openCompose, isWoman, sendLocked, navigate]);

  const mood = useMemo(() => {
    if (isWoman) {
      if (bottles.some((x) => x.s === "replied")) return "답장이 도착했어요. 확인해볼까요?";
      const driftN = bottles.filter((x) => x.s === "drift").length;
      if (driftN > 0) return `띄운 플로티 ${driftN}개가 아직 표류 중이에요`;
      return "오늘은 어떤 답장이 올까요?";
    }
    const pending = bottles.find((x) => x.d.accepted_at && !x.d.reply_body && x.d.expires_at);
    if (pending?.d.expires_at) {
      const left = formatCountdown(pending.d.expires_at);
      return left ? `답장 남은 시간 ${left}` : "답장할 플로티가 있어요";
    }
    if (bottles.some((x) => x.s === "arrived")) return "플로티를 발견했어요. 확인해볼까요?";
    return "잔잔한 바다 — 곧 누군가의 질문이 떠오를지 몰라요";
  }, [bottles, isWoman, tick]);

  const nudge = useMemo(() => (me ? getProfileNudge(me) : null), [me]);

  useEffect(() => {
    if (bottles.length !== 0 || !me) return;
    const key = `fl_empty_${me.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    track("empty_sea_view", { gender: me.gender });
  }, [bottles.length, me]);

  useEffect(() => {
    if (bottles.length !== 0 || !me || !nudge) return;
    const key = `fl_empty_nudge_${me.id}_${nudge.kind}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    track("empty_sea_nudge_view", { gender: me.gender, kind: nudge.kind });
  }, [bottles.length, me, nudge]);

  async function tapBottle(d: MissionDelivery, s: FloatieState) {
    if (s === "opened" || s === "match") {
      setNote({ kind: "floatie", d, act: "profile" });
      return;
    }
    if (isWoman) {
      if (s === "drift") setNote({ kind: "floatie", d, act: "recall" });
      else if (s === "replied") {
        const from = await fetchReceiverCard(d.id).catch(() => null);
        setNote({ kind: "floatie", d, from, act: "like" });
      } else setNote({ kind: "floatie", d });
      return;
    }
    // man — resume in-progress reply, or pre-open: age/region → open | pass
    if (s === "arrived") {
      if (d.accepted_at && !d.reply_body) {
        setNote({ kind: "reply", d });
        return;
      }
      const from = await fetchSenderCard(d.id).catch(() => null);
      // Pre-open: age band + region only (no nick) — keep "words first" purity
      const meta = [from?.birth_year ? ageBand(from.birth_year) : "", from?.region]
        .filter(Boolean)
        .join(" · ");
      setConfirm({
        em: "✨",
        title: "플로티를 발견했어요",
        body: `${meta ? meta + " · " : ""}열어보면 질문이 보여요. 이름과 얼굴은 서로 마음이 올 때 열려요. 열기 전 패스는 페널티가 없어요.`,
        yes: "열어보기",
        no: "패스",
        onOk: () => setNote({ kind: "read", d }),
        onNo: () => decline.mutate(d),
      });
    } else if (s === "answered") {
      setNote({ kind: "floatie", d });
    } else {
      // accepted but not yet replied — resume reply sheet
      if (d.accepted_at && !d.reply_body) setNote({ kind: "reply", d });
      else setNote({ kind: "floatie", d });
    }
  }

  const content: NoteContent | null = useMemo(() => {
    if (!note) return null;
    if (note.kind === "compose")
      return {
        kind: "compose",
        presets: presetBodies,
        canFree,
        draft: composeDraft,
        sending: send.isPending,
        onSend: (body, askPhoto) => send.mutate({ body, askPhoto }),
      };
    if (note.kind === "read")
      return {
        kind: "read",
        question: note.d.mission?.body ?? "플로티",
        busy: accept.isPending,
        onAccept: () => accept.mutate(note.d),
        onReport: () => openReport(note.d),
      };
    if (note.kind === "reply")
      return {
        kind: "reply",
        preferPhoto: !!note.d.mission?.photo_answer,
        countdown: note.d.expires_at ? formatCountdown(note.d.expires_at) : null,
        busy: reply.isPending || forfeit.isPending,
        onSubmit: (body, photo) => reply.mutate({ d: note.d, body, photo }),
        onGiveUp: () => forfeit.mutate(note.d),
        // Subtle report — never for own outbox (handled in floatie branch)
        onReport: () => openReport(note.d),
      };
    const d = note.d;
    const s = isWoman ? womanState(d) : manState(d);
    const act =
      note.act === "recall"
        ? { label: "회수", variant: "warn" as const, busy: recall.isPending, onClick: () => recall.mutate(d.id) }
        : note.act === "like"
          ? {
              label: "마음에 들어요",
              busy: verdict.isPending,
              onClick: () =>
                setConfirm({
                  em: "💛",
                  title: "마음을 전할까요?",
                  body: "답장까지 온 관심에 응답하면, 내 프로필이 상대에게 열려요. 대화는 이후 티켓으로 시작할 수 있어요.",
                  yes: "마음 전하기",
                  onOk: () => verdict.mutate({ d, v: "ok" }),
                }),
            }
          : note.act === "profile"
            ? { label: "상대방 프로필 보기", onClick: () => openPeer(d) }
            : undefined;
    const secondary =
      note.act === "like"
        ? {
            label: "패스",
            busy: verdict.isPending,
            onClick: () =>
              setConfirm({
                em: "👋",
                title: "패스할까요?",
                body: "같은 분과는 잠시 다시 만나지 않아요.",
                yes: "패스",
                onOk: () => verdict.mutate({ d, v: "pass" }),
              }),
          }
        : undefined;
    return {
      kind: "floatie",
      question: d.mission?.body ?? "플로티",
      subtitle: SUBTITLE[s],
      reply: d.reply_body,
      replyPhoto: d.reply_photo,
      from: note.from ?? undefined,
      hint:
        s === "replied"
          ? "답장했다는 건 관심이 있다는 신호예요. 마음에 들면 프로필을 열어 주세요."
          : undefined,
      action: act,
      secondary,
      // Own outbox with no reply yet: nothing to report. After a reply, report the peer.
      onReport: isWoman && !d.reply_body ? undefined : () => openReport(d),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    note,
    presetBodies,
    canFree,
    composeDraft,
    send.isPending,
    accept.isPending,
    reply.isPending,
    verdict.isPending,
    recall.isPending,
    forfeit.isPending,
    isWoman,
  ]);

  const menuItems = [
    { key: "profile", label: "내 프로필", onClick: openMyProfile },
    { key: "history", label: "플로티 이력", onClick: () => setPage("history") },
    { key: "shop", label: "티켓 상점", onClick: () => setPage("shop") },
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
    bottles.length === 0
      ? isWoman
        ? {
            b: "바다가 고요해요",
            s: nudge?.body ?? "플로티를 하나 띄워 볼까요?",
          }
        : {
            b: "잔잔한 바다예요",
            s: nudge?.body ?? "곧 누군가의 플로티가 떠내려올 예정이에요",
          }
      : null;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <SeaWaves />

      {empty && (
        <div className="fl-empty">
          <b>{empty.b}</b>
          <span>{empty.s}</span>
          {nudge && (
            <button
              type="button"
              className="fl-empty-cta"
              onClick={() => {
                track("empty_sea_nudge_tap", { gender: me?.gender, kind: nudge.kind });
                navigate({ to: nudge.href });
              }}
            >
              {nudge.cta}
            </button>
          )}
        </div>
      )}

      <div className="fl-bottles">
        {bottles.map(({ d, s }) => {
          const pos = bottlePos(d.id);
          const showTimer = !!(d.accepted_at && !d.reply_body && d.expires_at);
          const cd = showTimer ? formatCountdown(d.expires_at!) : null;
          return (
            <button
              key={d.id}
              className={"fl-bottle" + (isGlow(s) || showTimer ? " glow" : "")}
              style={{ left: pos.left, top: pos.top, animationDelay: `${-(d.id % 5) * 0.8}s` }}
              onClick={() => tapBottle(d, s)}
              aria-label={cd ? `플로티 · 남은 ${cd}` : "플로티"}
            >
              <BottleGlyph state="drift" className="w-full h-auto" />
              {cd && <span className="fl-bottle-timer">{cd}</span>}
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
        <button
          className="fl-fab"
          disabled={sendLocked}
          onClick={() => {
            if (sendLocked) {
              toast("대화가 열려 있는 동안에는 새 플로티를 띄울 수 없어요");
              return;
            }
            setComposeDraft(undefined);
            setNote({ kind: "compose" });
          }}
        >
          <span style={{ width: 20, display: "inline-flex", marginBottom: -3 }}>
            <BottleGlyph state="drift" className="w-full h-auto" />
          </span>
          {sendLocked ? (
            <>대화 중 <span className="sub">· 채팅이 끝나면 띄울 수 있어요</span></>
          ) : (
            <>
              플로티 띄우기 <span className="sub">· {canFree ? "무료 1개" : "티켓 필요"}</span>
            </>
          )}
        </button>
      )}

      <ParchmentNote content={content} onClose={() => setNote(null)} />
      <ConfirmModal opts={confirm} onClose={() => setConfirm(null)} />
      <ReportDialog
        open={!!report}
        onClose={() => setReport(null)}
        target={
          report
            ? { type: "delivery", deliveryId: report.deliveryId, userId: report.userId }
            : { type: "user", userId: "" }
        }
      />
      <ProfileOverlay
        data={profile?.data ?? null}
        cta={
          profile?.delivery
            ? {
                label:
                  (isWoman ? womanState(profile.delivery) : manState(profile.delivery)) === "match"
                    ? "대화 이어가기"
                    : "매칭하고 대화 시작",
                busy: match.isPending,
                onClick: () => match.mutate(profile.delivery!),
              }
            : profile
              ? { label: "프로필 수정", onClick: () => navigate({ to: "/me/edit" }) }
              : null
        }
        onBack={() => setProfile(null)}
      />

      <SubPageOverlay open={page === "history"} title="플로티 이력" onBack={() => setPage(null)}>
        <p style={{ fontWeight: 800, color: "#5a6f6c", fontSize: 13, margin: "2px 2px 12px" }}>
          {isWoman ? "내가 띄운 플로티" : "내가 받은 플로티"}
        </p>
        {all.length === 0 && <p className="fl-page-note">아직 이력이 없어요.</p>}
        {all.map(({ d, s }) => {
          const lab = stateLabel(s);
          return (
            <div
              key={d.id}
              className="fl-hrow tap"
              onClick={() => {
                setPage(null);
                tapBottle(d, s);
              }}
            >
              <div className="bq">
                <div className="qq">{d.mission?.body ?? "플로티"}</div>
                <div className="sub2">{SUBTITLE[s]}</div>
              </div>
              <span className={"fl-hst " + lab.c}>{lab.t}</span>
              <span className="fl-chev">›</span>
            </div>
          );
        })}
      </SubPageOverlay>

      <SubPageOverlay open={page === "shop"} title="티켓 상점" onBack={() => setPage(null)}>
        {[
          { n: 1, price: "₩4,900", sub: "매칭 1회 · 가격 미정(안)" },
          { n: 3, price: "₩12,900", sub: "장당 약 4,300원 · 미정" },
          { n: 6, price: "₩23,900", sub: "장당 약 4,000원 · 미정" },
        ].map((t) => (
          <div key={t.n} className="fl-tk">
            <div className="big">{t.n}</div>
            <div className="t">
              <b>티켓 {t.n}장</b>
              <span>{t.sub}</span>
            </div>
            <button
              className="buy"
              onClick={() =>
                toast("티켓 구매", { description: "베타에선 결제가 없어요. 오픈 때 IAP로 연결돼요." })
              }
            >
              {t.price}
            </button>
          </div>
        ))}
        <p className="fl-page-note">
          지금 보유 티켓 {me?.ticket_balance ?? 0}장 · 베타 기본 10장.
          <br />
          매칭 1회 = 티켓 1장. 무료 발송은 하루 1회.
        </p>
      </SubPageOverlay>
    </div>
  );
}
