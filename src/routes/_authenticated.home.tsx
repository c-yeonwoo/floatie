import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  acceptDelivery,
  ageBand,
  countSendsToday,
  createAndDeliverMission,
  fetchInbox,
  fetchOutbox,
  fetchPresets,
  fetchReceiverCard,
  fetchSenderCard,
  fetchUnlockedPeer,
  recallDelivery,
  replyToDelivery,
  setReplyPhoto,
  setVerdict,
  startMatch,
  type MissionDelivery,
  type PersonCard,
  type UnlockedPeer,
} from "@/lib/mission";
import { PROFILE_QUESTIONS, uploadReplyPhoto } from "@/lib/profile-ai";
import { SeaWaves } from "@/components/sea/waves";
import { ParchmentNote, type NoteContent } from "@/components/sea/parchment-note";
import { ConfirmModal, type ConfirmOpts } from "@/components/sea/confirm-modal";
import { ProfileOverlay, type ProfileCardData } from "@/components/sea/profile-overlay";
import { SubPageOverlay } from "@/components/sea/sub-page";
import { AvatarMenu } from "@/components/sea/avatar-menu";
import { BottleGlyph } from "@/components/bottle-glyph";
import {
  bottlePos,
  isGlow,
  manState,
  womanState,
  stateLabel,
  MISSION_PRESETS_FALLBACK,
  type FloatieState,
} from "@/lib/sea";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "플로티" }] }),
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
  ai_intro: string | null;
  ai_tags: string[] | null;
  intro_answers: { answers?: string[] } | null;
};

type NoteState =
  | null
  | { kind: "compose" }
  | { kind: "floatie"; d: MissionDelivery; from?: PersonCard | null; act?: "like" | "recall" | "profile" }
  | { kind: "read"; d: MissionDelivery }
  | { kind: "reply"; d: MissionDelivery };

function qaFrom(answers: string[] | undefined): { q: string; a: string }[] {
  if (!answers) return [];
  return PROFILE_QUESTIONS.map((q, i) => ({ q: q.q, a: answers[i] ?? "" })).filter((x) => x.a.trim());
}

function peerCard(p: UnlockedPeer, ageOf: (y: number | null) => string): ProfileCardData {
  return {
    name: p.display_name ?? "상대",
    age: ageOf(p.birth_year),
    region: p.region ?? "",
    photo: p.photos?.[0] ?? p.avatar_url,
    intro: p.ai_intro ?? p.bio ?? "",
    tags: p.ai_tags ?? [],
    qa: qaFrom(p.intro_answers?.answers),
  };
}

function SeaHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [note, setNote] = useState<NoteState>(null);
  const [confirm, setConfirm] = useState<ConfirmOpts | null>(null);
  const [profile, setProfile] = useState<{ data: ProfileCardData; delivery: MissionDelivery | null } | null>(null);
  const [page, setPage] = useState<null | "history" | "shop">(null);
  const ageOf = (y: number | null) => (y ? ageBand(y) : "") ?? "";

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
          "id, gender, display_name, ticket_balance, photos, birth_year, region, ai_intro, ai_tags, intro_answers",
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

  const { data: presetRows = [] } = useQuery({ queryKey: ["presets"], queryFn: fetchPresets });
  const presetBodies = useMemo(() => {
    const bodies = presetRows.map((p) => p.body).filter(Boolean);
    return (bodies.length ? bodies : MISSION_PRESETS_FALLBACK).slice(0, 5);
  }, [presetRows]);

  const refresh = () => qc.invalidateQueries();

  const send = useMutation({
    mutationFn: ({ body, photoAnswer }: { body: string; photoAnswer: boolean }) =>
      createAndDeliverMission({ kind: "question", body, useTicket: !canFree, photoAnswer }),
    onSuccess: () => {
      setNote(null);
      toast.success("플로티를 바다 위로 띄웠어요", { description: "어떤 멋진 분께 닿을지 행운을 빌어요 🍀" });
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "티켓이 필요해요."),
  });

  const accept = useMutation({
    mutationFn: async (d: MissionDelivery) => {
      if (!d.accepted_at) await acceptDelivery(d.id);
      return d;
    },
    onSuccess: (d) => setNote({ kind: "reply", d }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "열지 못했어요."),
  });

  const reply = useMutation({
    mutationFn: async ({ d, body, photo }: { d: MissionDelivery; body: string; photo: File | null }) => {
      await replyToDelivery(d.id, body);
      if (photo && uid) {
        const path = await uploadReplyPhoto(uid, d.id, photo);
        await setReplyPhoto(d.id, path);
      }
    },
    onSuccess: () => {
      setNote(null);
      toast.success("답장을 병에 담아 보냈어요", { description: "상대가 좋다고 하면 프로필이 열려요 💌" });
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "답장을 보내지 못했어요."),
  });

  const openPeer = async (d: MissionDelivery) => {
    const peerId = isWoman ? d.receiver_id : d.sender_id;
    const p = await fetchUnlockedPeer(peerId).catch(() => null);
    if (!p) return toast.error("프로필을 열 수 없어요.");
    setNote(null);
    setProfile({ data: peerCard(p, ageOf), delivery: d });
  };

  const verdict = useMutation({
    mutationFn: (d: MissionDelivery) => setVerdict(d.id, "sender", "ok"),
    onSuccess: (_res, d) => {
      toast.success("마음을 전했어요", { description: "프로필이 열렸어요 💛" });
      refresh();
      openPeer(d);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "실패했어요."),
  });

  const match = useMutation({
    mutationFn: (d: MissionDelivery) => startMatch(d.id),
    onSuccess: (threadId) => {
      setProfile(null);
      toast.success("매칭됐어요! 대화방이 열렸어요", { description: "7일 · 최대 20통, 천천히 알아가요 💬" });
      refresh();
      navigate({ to: "/thread/$threadId", params: { threadId: String(threadId) } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "매칭하지 못했어요."),
  });

  const openMyProfile = () => {
    if (!me) return;
    setProfile({
      data: {
        name: me.display_name,
        age: ageOf(me.birth_year),
        region: me.region ?? "",
        photo: me.photos?.[0],
        intro: me.ai_intro ?? "",
        tags: me.ai_tags ?? [],
        qa: qaFrom(me.intro_answers?.answers),
      },
      delivery: null,
    });
  };

  const recall = useMutation({
    mutationFn: (id: number) => recallDelivery(id),
    onSuccess: () => {
      setNote(null);
      toast("플로티를 회수했어요", { description: "다시 새로 띄울 수 있어요" });
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "회수하지 못했어요."),
  });

  const all = useMemo(
    () => floaties.map((d) => ({ d, s: isWoman ? womanState(d) : manState(d) })),
    [floaties, isWoman],
  );
  const bottles = useMemo(() => all.filter((x) => x.s !== "done" && x.s !== "expired"), [all]);

  const mood = useMemo(() => {
    if (isWoman) {
      if (bottles.some((x) => x.s === "replied")) return "답장이 도착했어요. 확인해볼까요?";
      if (bottles.some((x) => x.s === "drift")) return "띄운 플로티가 누군가에게 닿는 중…";
      return "오늘은 어떤 답장이 올까요?";
    }
    return bottles.some((x) => x.s === "arrived")
      ? "플로티를 발견했어요. 확인해볼까요?"
      : "오늘은 어떤 안부가 닿을까요?";
  }, [bottles, isWoman]);

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
    // man
    if (s === "arrived") {
      const from = await fetchSenderCard(d.id).catch(() => null);
      const name = from?.display_name ?? "누군가";
      const meta = [from?.birth_year ? ageBand(from.birth_year) : "", from?.region].filter(Boolean).join(" · ");
      setConfirm({
        em: "✨",
        title: `‘${name}’님이 띄운 플로티를 발견했어요`,
        body: `${meta ? meta + " · " : ""}열어서 질문을 확인해볼까요?`,
        yes: "열어보기",
        onOk: () => setNote({ kind: "read", d }),
      });
    } else {
      setNote({ kind: "floatie", d });
    }
  }

  const content: NoteContent | null = useMemo(() => {
    if (!note) return null;
    if (note.kind === "compose")
      return {
        kind: "compose",
        presets: presetBodies,
        canFree,
        sending: send.isPending,
        onSend: (body, photoAnswer) => send.mutate({ body, photoAnswer }),
      };
    if (note.kind === "read")
      return {
        kind: "read",
        question: note.d.mission?.body ?? "플로티",
        busy: accept.isPending,
        onAccept: () => accept.mutate(note.d),
      };
    if (note.kind === "reply")
      return {
        kind: "reply",
        requirePhoto: !!note.d.mission?.photo_answer,
        busy: reply.isPending,
        onSubmit: (body, photo) => reply.mutate({ d: note.d, body, photo }),
        onGiveUp: () => {
          setNote(null);
          toast("답장을 포기했어요", { description: "하루 동안 새 플로티를 만날 수 없어요 🕐" });
        },
      };
    // floatie (read-only or with an action)
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
                  body: "프로필을 열면 상대에게도 알림이 가고, 서로 좋으면 프로필이 공개돼요.",
                  yes: "마음 전하기",
                  onOk: () => verdict.mutate(d),
                }),
            }
          : note.act === "profile"
            ? { label: "상대방 프로필 보기", onClick: () => openPeer(d) }
            : undefined;
    return {
      kind: "floatie",
      question: d.mission?.body ?? "플로티",
      subtitle: SUBTITLE[s],
      reply: d.reply_body,
      replyPhoto: d.reply_photo,
      from: note.from ?? undefined,
      hint: s === "replied" ? "답장이 마음에 들면, 서로의 프로필이 열려요 💛" : undefined,
      action: act,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note, presetBodies, canFree, send.isPending, accept.isPending, reply.isPending, verdict.isPending, recall.isPending, isWoman]);

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
        {bottles.map(({ d, s }) => {
          const pos = bottlePos(d.id);
          return (
            <button
              key={d.id}
              className={"fl-bottle" + (isGlow(s) ? " glow" : "")}
              style={{ left: pos.left, top: pos.top, animationDelay: `${-(d.id % 5) * 0.8}s` }}
              onClick={() => tapBottle(d, s)}
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
      <ConfirmModal opts={confirm} onClose={() => setConfirm(null)} />
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
          { n: 1, price: "₩1,900", sub: "플로티를 더 띄우거나 매칭에 사용" },
          { n: 5, price: "₩7,900", sub: "가장 인기 · 장당 1,580원" },
          { n: 12, price: "₩15,900", sub: "가장 알뜰 · 장당 1,325원" },
        ].map((t) => (
          <div key={t.n} className="fl-tk">
            <div className="big">{t.n}</div>
            <div className="t">
              <b>티켓 {t.n}장</b>
              <span>{t.sub}</span>
            </div>
            <button className="buy" onClick={() => toast("티켓 구매", { description: "실제 앱에선 결제로 이어져요 🎟️" })}>
              {t.price}
            </button>
          </div>
        ))}
        <p className="fl-page-note">
          지금 보유 티켓 {me?.ticket_balance ?? 0}장.
          <br />
          무료로는 하루 하나의 플로티만 띄울 수 있어요.
        </p>
      </SubPageOverlay>
    </div>
  );
}
