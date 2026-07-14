import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchMessages, sendMessage } from "@/lib/mission";

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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  const { data: messages = [] } = useQuery({
    queryKey: ["mission-messages", id],
    enabled: Number.isFinite(id),
    queryFn: () => fetchMessages(id),
    refetchInterval: 4000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = useMutation({
    mutationFn: async () => {
      if (!text.trim()) return;
      await sendMessage(id, text);
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["mission-messages", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "전송 실패"),
  });

  return (
    <main className="flex flex-col h-[calc(var(--app-vh)-var(--safe-top))]">
      <header className="px-5 py-4 border-b border-border flex items-center gap-3">
        <button type="button" onClick={() => navigate({ to: "/outbox" })} className="text-sm">
          ←
        </button>
        <h1 className="font-serif text-lg">대화</h1>
        <p className="text-xs text-muted-foreground ml-auto">7일 후 soft close</p>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center mt-10">
            첫 인사를 보내 보세요.
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

      <form
        className="border-t border-border px-4 py-3 flex gap-2"
        style={{ paddingBottom: "calc(var(--safe-bottom) + 12px)" }}
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="메시지"
          className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm"
        />
        <button
          type="submit"
          disabled={send.isPending || !text.trim()}
          className="rounded-full bg-foreground text-background px-4 py-2.5 text-sm disabled:opacity-40"
        >
          전송
        </button>
      </form>
    </main>
  );
}
