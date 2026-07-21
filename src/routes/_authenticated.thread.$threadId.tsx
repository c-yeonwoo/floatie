import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  ageBand,
  fetchMessages,
  fetchThread,
  fetchUnlockedPeer,
  formatCountdown,
  mapMissionError,
  msUntil,
  // offerThreadContact, // MVP: contact share off — re-enable with UI below
  sendMessage,
  type UnlockedPeer,
} from "@/lib/mission";
import { ReportDialog } from "@/components/report-dialog";
import { AvatarImg } from "@/components/avatar-img";
import { displayPublicTags } from "@/lib/display-copy";
import { ProfileOverlay, type ProfileCardData } from "@/components/sea/profile-overlay";
import { pageTitle } from "@/lib/brand";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/_authenticated/thread/$threadId")({
  head: () => ({ meta: [{ title: pageTitle("대화") }] }),
  component: ThreadPage,
});

function peerToCard(p: UnlockedPeer): ProfileCardData {
  return {
    name: p.display_name ?? "상대",
    age: p.birth_year ? ageBand(p.birth_year) ?? "" : "",
    region: p.region ?? "",
    job: p.job_chip,
    heightCm: p.height_cm,
    smoke: p.smoke,
    drink: p.drink,
    tattoo: p.tattoo,
    photos: p.photos ?? undefined,
    photo: p.photos?.[0] ?? p.avatar_url,
    intro: p.ai_intro ?? p.bio ?? "",
    idealLine: p.ai_ideal_line ?? "",
    tags: displayPublicTags(p.ai_tags),
  };
}

function ThreadPage() {
  const { threadId } = Route.useParams();
  const id = Number(threadId);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [uid, setUid] = useState<string | null>(null);
  const [text, setText] = useState("");
  // MVP: contact-share UI commented out — keep draft state when re-enabling
  // const [contactDraft, setContactDraft] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [peerProfile, setPeerProfile] = useState<ProfileCardData | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  const { data: thread } = useQuery({
    queryKey: ["mission-thread-detail", id],
    enabled: Number.isFinite(id),
    queryFn: () => fetchThread(id),
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["mission-messages", id],
    enabled: Number.isFinite(id),
    queryFn: () => fetchMessages(id),
    refetchInterval: 4000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const timeClosed = thread ? msUntil(thread.expires_at) <= 0 : false;
  const closed = !!thread?.closed_at || timeClosed;

  const role = useMemo(() => {
    if (!thread || !uid) return null;
    if (thread.sender_id === uid) return "sender" as const;
    if (thread.receiver_id === uid) return "receiver" as const;
    return null;
  }, [thread, uid]);

  const peerId = role === "sender" ? thread?.receiver_id : thread?.sender_id;

  const { data: peer } = useQuery({
    queryKey: ["thread-peer", peerId],
    enabled: !!peerId,
    queryFn: () => fetchUnlockedPeer(peerId!),
  });

  const peerPhoto = peer?.photos?.[0] ?? peer?.avatar_url ?? null;
  const peerName = peer?.display_name ?? "상대";

  const send = useMutation({
    mutationFn: async () => {
      if (!text.trim()) return;
      await sendMessage(id, text);
    },
    onSuccess: () => {
      if (messages.length === 0) track("msg_first", { threadId: id });
      setText("");
      qc.invalidateQueries({ queryKey: ["mission-messages", id] });
      qc.invalidateQueries({ queryKey: ["mission-thread-detail", id] });
    },
    onError: (e) => {
      toast.error(mapMissionError(e, "메시지를 보내지 못했어요."));
      qc.invalidateQueries({ queryKey: ["mission-thread-detail", id] });
    },
  });

  /*
  // --- MVP off: external contact share ---
  const myContact =
    role === "sender" ? thread?.sender_contact : thread?.receiver_contact;
  const peerContact =
    role === "sender" ? thread?.receiver_contact : thread?.sender_contact;
  const bothOffered = !!(thread?.sender_contact && thread?.receiver_contact);

  const offer = useMutation({
    mutationFn: async () => {
      if (contactDraft.trim().length < 2) throw new Error("연락처를 입력해 주세요.");
      await offerThreadContact(id, contactDraft);
    },
    onSuccess: () => {
      toast.success("연락처를 제안했어요. 상대도 제안하면 서로 보여요.");
      setContactDraft("");
      qc.invalidateQueries({ queryKey: ["mission-thread-detail", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "실패했어요."),
  });
  */

  const openPeerProfile = () => {
    if (!peer) return;
    setPeerProfile(peerToCard(peer));
  };

  return (
    <main className="fl-thread">
      <header className="fl-thread-top">
        <button type="button" className="fl-thread-back" onClick={() => navigate({ to: "/home" })} aria-label="뒤로">
          ←
        </button>
        <button type="button" className="fl-thread-peer" onClick={openPeerProfile} disabled={!peer}>
          <AvatarImg src={peerPhoto} name={peerName} className="fl-thread-av" />
          <span className="fl-thread-peer-text">
            <span className="fl-thread-name">{peerName}</span>
            <span className="fl-thread-timer">
              {closed
                ? "대화가 끝났어요"
                : thread
                  ? `남은 시간 ${formatCountdown(thread.expires_at)}`
                  : "…"}
            </span>
          </span>
        </button>
        {peerId && (
          <button type="button" onClick={() => setReportOpen(true)} className="fl-thread-report">
            신고
          </button>
        )}
      </header>

      {closed && (
        <div className="fl-thread-banner">
          7일이 지났어요. 여기까지의 대화예요.
          <br />
          (추후 티켓으로 연장 가능 예정)
        </div>
      )}

      <div ref={listRef} className="fl-thread-list">
        {messages.length === 0 && (
          <p className="fl-thread-empty">남은 시간 안에 편하게 이야기해 보세요.</p>
        )}
        {messages.map((m: { id: number; sender_id: string; body: string }) => {
          const mine = m.sender_id === uid;
          return (
            <div key={m.id} className={"fl-thread-bubble" + (mine ? " mine" : "")}>
              {m.body}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/*
      // --- MVP off: external contact share UI ---
      <section className="px-4 py-3 space-y-2">
        {bothOffered ? (
          <div className="rounded-xl bg-secondary px-3 py-2 text-sm">
            <p className="text-xs text-muted-foreground mb-1">서로 연락처를 열었어요</p>
            <p>상대: {peerContact}</p>
            <p className="text-muted-foreground">나: {myContact}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              외부로 이어가기 · 양쪽이 연락처를 제안해야 서로 보여요
              {myContact ? ` · 내 제안: ${myContact}` : ""}
            </p>
            {!myContact && (
              <div className="flex gap-2">
                <input
                  value={contactDraft}
                  onChange={(e) => setContactDraft(e.target.value)}
                  maxLength={80}
                  placeholder="카카오/인스타/번호"
                  className="flex-1 rounded-full bg-secondary px-4 py-2 text-sm outline-none"
                />
                <button type="button" onClick={() => offer.mutate()}>제안</button>
              </div>
            )}
          </div>
        )}
      </section>
      */}

      <form
        className="fl-thread-composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (!closed) send.mutate();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder={closed ? "대화가 종료됐어요" : "메시지"}
          disabled={closed}
        />
        <button type="submit" disabled={closed || send.isPending || !text.trim()}>
          전송
        </button>
      </form>

      <ProfileOverlay data={peerProfile} onBack={() => setPeerProfile(null)} />

      {peerId && (
        <ReportDialog
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          target={{ type: "user", userId: peerId }}
        />
      )}
    </main>
  );
}
