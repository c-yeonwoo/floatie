import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  MESSAGE_CAP_DEFAULT,
  fetchMessages,
  fetchThread,
  formatCountdown,
  msUntil,
  offerThreadContact,
  sendMessage,
} from "@/lib/mission";
import { ReportDialog } from "@/components/report-dialog";

export const Route = createFileRoute("/_authenticated/thread/$threadId")({
  head: () => ({ meta: [{ title: "대화 — 쪽지" }] }),
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  const id = Number(threadId);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [uid, setUid] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [contactDraft, setContactDraft] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  const cap = thread?.message_cap ?? MESSAGE_CAP_DEFAULT;
  const count = messages.length;
  const timeClosed = thread ? msUntil(thread.expires_at) <= 0 : false;
  const closed = !!thread?.closed_at || timeClosed || count >= cap;
  const remaining = Math.max(0, cap - count);

  const role = useMemo(() => {
    if (!thread || !uid) return null;
    if (thread.sender_id === uid) return "sender" as const;
    if (thread.receiver_id === uid) return "receiver" as const;
    return null;
  }, [thread, uid]);

  const myContact =
    role === "sender" ? thread?.sender_contact : thread?.receiver_contact;
  const peerContact =
    role === "sender" ? thread?.receiver_contact : thread?.sender_contact;
  const bothOffered = !!(thread?.sender_contact && thread?.receiver_contact);

  const peerId =
    role === "sender" ? thread?.receiver_id : thread?.sender_id;

  const send = useMutation({
    mutationFn: async () => {
      if (!text.trim()) return;
      await sendMessage(id, text);
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["mission-messages", id] });
      qc.invalidateQueries({ queryKey: ["mission-thread-detail", id] });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "전송 실패";
      if (msg.includes("message cap") || msg.includes("thread closed")) {
        toast.error("대화가 종료됐어요. (20통 또는 7일)");
      } else {
        toast.error(msg);
      }
      qc.invalidateQueries({ queryKey: ["mission-thread-detail", id] });
    },
  });

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

  return (
    <main className="flex flex-col h-[calc(var(--app-vh)-var(--safe-top))]">
      <header className="px-5 py-4 border-b border-border flex items-center gap-3">
        <button type="button" onClick={() => navigate({ to: "/outbox" })} className="text-sm">
          ←
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-lg">대화</h1>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {closed
              ? "종료됨"
              : `${remaining}/${cap} · ${thread ? formatCountdown(thread.expires_at) : ""}`}
          </p>
        </div>
        {peerId && (
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="text-xs text-muted-foreground underline"
          >
            신고
          </button>
        )}
      </header>

      {closed && (
        <div className="px-5 py-2 bg-foreground/5 text-xs text-muted-foreground text-center border-b border-border">
          메시지 한도 또는 기간이 끝나 soft close 됐어요.
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center mt-10">
            첫 인사를 보내 보세요. 최대 {cap}통 · 7일.
          </p>
        )}
        {messages.map((m: { id: number; sender_id: string; body: string }) => {
          const mine = m.sender_id === uid;
          return (
            <div
              key={m.id}
              className={
                "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[15px] " +
                (mine
                  ? "ml-auto bg-foreground text-background"
                  : "mr-auto bg-surface border border-border")
              }
            >
              {m.body}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <section className="border-t border-border px-4 py-3 space-y-2">
        {bothOffered ? (
          <div className="rounded-xl bg-foreground/5 px-3 py-2 text-sm">
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
                  className="flex-1 rounded-full border border-border px-4 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={offer.isPending || contactDraft.trim().length < 2}
                  onClick={() => offer.mutate()}
                  className="rounded-full border border-border px-3 py-2 text-sm disabled:opacity-40"
                >
                  제안
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <form
        className="border-t border-border px-4 py-3 flex gap-2"
        style={{ paddingBottom: "calc(var(--safe-bottom) + 12px)" }}
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
          className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={closed || send.isPending || !text.trim()}
          className="rounded-full bg-foreground text-background px-4 py-2.5 text-sm disabled:opacity-40"
        >
          전송
        </button>
      </form>

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
