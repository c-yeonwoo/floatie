import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  createAndDeliverMission,
  fetchPresets,
  type MissionPreset,
} from "@/lib/mission";

export const Route = createFileRoute("/_authenticated/send")({
  head: () => ({ meta: [{ title: "보내기 — 쪽지" }] }),
  component: SendPage,
});

function SendPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [custom, setCustom] = useState("");
  const [selected, setSelected] = useState<MissionPreset | null>(null);

  const { data: presets = [], isLoading } = useQuery({
    queryKey: ["mission-presets"],
    queryFn: fetchPresets,
  });

  const send = useMutation({
    mutationFn: async () => {
      if (selected) {
        return createAndDeliverMission({
          presetId: selected.id,
          kind: selected.kind,
          body: selected.body,
          chips: selected.chips,
        });
      }
      const body = custom.trim();
      if (body.length < 2) throw new Error("미션을 두 글자 이상 적어 주세요.");
      if (body.length > 40) throw new Error("커스텀 미션은 40자까지예요.");
      return createAndDeliverMission({
        kind: "question",
        body,
      });
    },
    onSuccess: () => {
      toast.success("쪽지를 보냈어요. 누군가에게 도착했어요.");
      qc.invalidateQueries({ queryKey: ["mission-outbox"] });
      navigate({ to: "/outbox" });
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "보내지 못했어요.";
      if (msg.includes("no eligible recipient")) {
        toast.error("지금 받을 수 있는 사람이 없어요. 조금 뒤 다시 시도해 주세요.");
      } else if (msg.includes("daily send cap")) {
        toast.error("오늘은 보낼 수 있는 쪽지를 다 썼어요.");
      } else {
        toast.error(msg);
      }
    },
  });

  return (
    <main className="px-5 py-8 pb-24">
      <header className="mb-8">
        <p className="text-xs tracking-widest text-muted-foreground uppercase">쪽지</p>
        <h1 className="font-serif text-3xl mt-1">보내기</h1>
        <p className="text-[15px] text-muted-foreground mt-2">
          프리셋을 고르거나, 짧은 미션을 직접 적어 익명으로 보내요.
        </p>
      </header>

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
          disabled={send.isPending || (!selected && custom.trim().length < 2)}
          onClick={() => send.mutate()}
          className="w-full rounded-full bg-foreground text-background py-3.5 text-sm font-medium disabled:opacity-40"
        >
          {send.isPending ? "보내는 중…" : "익명으로 보내기"}
        </button>
      </div>
    </main>
  );
}
