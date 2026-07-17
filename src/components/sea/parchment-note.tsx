import { useEffect, useRef, useState } from "react";
import { IdentityCard, type PersonLite } from "./identity-card";
import { StorageImg } from "@/components/storage-img";

/** What the parchment currently shows. `null` = closed. */
export type NoteContent =
  | {
      kind: "compose";
      presets: string[];
      canFree: boolean;
      sending?: boolean;
      onSend: (body: string) => void;
    }
  | {
      kind: "floatie";
      question: string;
      subtitle?: string;
      reply?: string | null;
      replyPhoto?: string | null;
      from?: PersonLite | null;
      hint?: string;
      action?: { label: string; onClick: () => void; variant?: "warn" | "locked"; busy?: boolean };
    };

export function ParchmentNote({ content, onClose }: { content: NoteContent | null; onClose: () => void }) {
  const [shown, setShown] = useState<NoteContent | null>(content);
  const [up, setUp] = useState(false);

  useEffect(() => {
    if (content) {
      setShown(content);
      const r = requestAnimationFrame(() => setUp(true));
      return () => cancelAnimationFrame(r);
    }
    setUp(false);
    const t = setTimeout(() => setShown(null), 460);
    return () => clearTimeout(t);
  }, [content]);

  return (
    <>
      <div className={"fl-scrim note-scrim" + (content ? " on" : "")} onClick={onClose} />
      <div className={"fl-note" + (up ? " up" : "")}>
        <div className="fl-grip" />
        {shown?.kind === "compose" && <ComposeBody c={shown} />}
        {shown?.kind === "floatie" && <FloatieBody c={shown} onClose={onClose} />}
      </div>
    </>
  );
}

function ComposeBody({ c }: { c: Extract<NoteContent, { kind: "compose" }> }) {
  const [body, setBody] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const t = setTimeout(() => taRef.current?.focus(), 320);
    return () => clearTimeout(t);
  }, []);
  const ok = body.trim().length >= 2 && !c.sending;
  return (
    <>
      <div className="fl-note-inner">
        <h3>어떤 질문을 띄워 볼까요?</h3>
        <p className="sub">쪽지에 적어 병에 담아 보낼게요.</p>
        <textarea
          ref={taRef}
          maxLength={60}
          placeholder="편하게 적어도 좋아요…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        {c.presets.length > 0 && (
          <div className="fl-chips">
            {c.presets.map((p) => (
              <button key={p} className="fl-chip" onClick={() => setBody(p)}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="fl-note-foot">
        <span className="fl-cnt">{body.length}/60</span>
        <button className="fl-done" disabled={!ok} onClick={() => c.onSend(body.trim())}>
          {c.sending ? "담는 중…" : c.canFree ? "병에 담기" : "티켓으로 담기"}
        </button>
      </div>
    </>
  );
}

function FloatieBody({ c, onClose }: { c: Extract<NoteContent, { kind: "floatie" }>; onClose: () => void }) {
  const body = c.reply || "";
  return (
    <>
      <div className="fl-note-inner">
        <h3>{c.question}</h3>
        {c.subtitle && <p className="sub">{c.subtitle}</p>}
        {c.from && <IdentityCard person={c.from} withPhoto />}
        {body && <div className="fl-note-read">{body}</div>}
        {c.replyPhoto && (
          <div className="fl-reply-photo">
            <StorageImg src={c.replyPhoto} alt="" />
          </div>
        )}
        {c.hint && <div className="fl-note-hint">{c.hint}</div>}
      </div>
      <div className="fl-note-foot">
        {c.action ? (
          <>
            <button className="fl-giveup" onClick={onClose}>닫기</button>
            <button
              className={"fl-done" + (c.action.variant === "warn" ? " warn" : c.action.variant === "locked" ? " locked" : "")}
              disabled={c.action.busy}
              onClick={c.action.onClick}
            >
              {c.action.busy ? "처리 중…" : c.action.label}
            </button>
          </>
        ) : (
          <button className="fl-done" onClick={onClose}>닫기</button>
        )}
      </div>
    </>
  );
}
