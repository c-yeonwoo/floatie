import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { IdentityCard, type PersonLite } from "./identity-card";
import { StorageImg } from "@/components/storage-img";
import { pickPhoto, validatePickedPhoto } from "@/lib/native-photo";

type NoteAction = {
  label: string;
  onClick: () => void;
  variant?: "warn" | "locked";
  busy?: boolean;
};

/** What the parchment currently shows. `null` = closed. */
export type NoteContent =
  | {
      kind: "compose";
      presets: string[];
      canFree: boolean;
      sending?: boolean;
      onSend: (body: string, askPhoto: boolean) => void;
    }
  | {
      kind: "floatie";
      question: string;
      subtitle?: string;
      reply?: string | null;
      replyPhoto?: string | null;
      from?: PersonLite | null;
      hint?: string;
      action?: NoteAction;
      secondary?: NoteAction;
      onReport?: () => void;
    }
  | {
      kind: "read";
      question: string;
      onAccept: () => void;
      busy?: boolean;
      onReport?: () => void;
    }
  | {
      kind: "reply";
      /** Soft ask — never blocks send without a photo. */
      preferPhoto?: boolean;
      countdown?: string | null;
      onSubmit: (body: string, photo: File | null) => void;
      onGiveUp: () => void;
      busy?: boolean;
      onReport?: () => void;
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
        {shown?.kind === "read" && <ReadBody c={shown} />}
        {shown?.kind === "reply" && <ReplyBody c={shown} />}
      </div>
    </>
  );
}

function ReportLink({ onReport }: { onReport?: () => void }) {
  if (!onReport) return null;
  return (
    <button type="button" className="fl-note-link" onClick={onReport} style={{ marginTop: 10 }}>
      신고하기
    </button>
  );
}

function ComposeBody({ c }: { c: Extract<NoteContent, { kind: "compose" }> }) {
  const [body, setBody] = useState("");
  const [askPhoto, setAskPhoto] = useState(false);
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
        <div className="fl-photo-row">
          <div className="t">
            <b>사진으로 답해주면 좋겠어요</b>
            <span>강제는 아니에요. 부탁 한마디만 전해요.</span>
          </div>
          <button
            className={"fl-sw" + (askPhoto ? " on" : "")}
            onClick={() => setAskPhoto((v) => !v)}
            aria-pressed={askPhoto}
          />
        </div>
      </div>
      <div className="fl-note-foot">
        <span className="fl-cnt">{body.length}/60</span>
        <button className="fl-done" disabled={!ok} onClick={() => c.onSend(body.trim(), askPhoto)}>
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
        <ReportLink onReport={c.onReport} />
      </div>
      <div className="fl-note-foot">
        {c.secondary ? (
          <button
            className="fl-giveup"
            disabled={c.secondary.busy}
            onClick={c.secondary.onClick}
          >
            {c.secondary.busy ? "처리 중…" : c.secondary.label}
          </button>
        ) : c.action ? (
          <button className="fl-giveup" onClick={onClose}>
            닫기
          </button>
        ) : null}
        {c.action ? (
          <button
            className={
              "fl-done" +
              (c.action.variant === "warn" ? " warn" : c.action.variant === "locked" ? " locked" : "")
            }
            disabled={c.action.busy}
            onClick={c.action.onClick}
          >
            {c.action.busy ? "처리 중…" : c.action.label}
          </button>
        ) : (
          <button className="fl-done" onClick={onClose}>
            닫기
          </button>
        )}
      </div>
    </>
  );
}

function ReadBody({ c }: { c: Extract<NoteContent, { kind: "read" }> }) {
  return (
    <>
      <div className="fl-note-inner">
        <h3>도착한 플로티</h3>
        <p className="sub">수락하면 12시간 안에 답장해 주세요. 답이 없으면 하루 동안 새 플로티를 받지 못해요.</p>
        <div className="fl-note-read">{c.question}</div>
        <ReportLink onReport={c.onReport} />
      </div>
      <div className="fl-note-foot">
        <button className="fl-done" disabled={c.busy} onClick={c.onAccept}>
          {c.busy ? "여는 중…" : "수락하고 답장하기"}
        </button>
      </div>
    </>
  );
}

function ReplyBody({ c }: { c: Extract<NoteContent, { kind: "reply" }> }) {
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [armed, setArmed] = useState(false);
  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo.url);
    },
    [photo],
  );

  const pick = async () => {
    const f = await pickPhoto();
    if (!f) return;
    const err = validatePickedPhoto(f);
    if (err) return toast.error(err);
    setPhoto({ file: f, url: URL.createObjectURL(f) });
  };
  const ok = body.trim().length >= 2 && !c.busy;

  return (
    <>
      <div className="fl-note-inner">
        <h3>답장 쓰기</h3>
        <p className="sub">
          {c.countdown
            ? `남은 시간 ${c.countdown} · 포기하면 하루 동안 새 플로티를 받지 못해요.`
            : "쪽지에 적어 병에 담아 보내요."}
        </p>
        {c.preferPhoto && (
          <div className="fl-note-hint">상대가 사진으로 답해주면 좋겠다고 부탁했어요. 강제는 아니에요.</div>
        )}
        <textarea
          maxLength={200}
          placeholder="편하게 답해도 좋아요…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="fl-upl">
          <div className="fl-upl-lab">
            사진 첨부 <span className="fl-opt">선택</span>
          </div>
          <div className={"fl-drop" + (photo ? " filled" : "")} onClick={pick}>
            {photo ? (
              <>
                <img src={photo.url} alt="" />
                <div
                  className="x"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPhoto(null);
                  }}
                >
                  ✕
                </div>
              </>
            ) : (
              <span>눌러서 사진 추가</span>
            )}
          </div>
        </div>
        <ReportLink onReport={c.onReport} />
      </div>
      <div className="fl-note-foot">
        <button
          className="fl-giveup"
          style={armed ? { color: "#c0392b" } : undefined}
          onClick={() => {
            if (!armed) {
              setArmed(true);
              setTimeout(() => setArmed(false), 3500);
              return;
            }
            c.onGiveUp();
          }}
        >
          {armed ? "정말 포기?" : "포기"}
        </button>
        <span className="fl-cnt">{body.length}/200</span>
        <button
          className="fl-done"
          disabled={!ok}
          onClick={() => c.onSubmit(body.trim(), photo?.file ?? null)}
        >
          {c.busy ? "담는 중…" : "답장 담기"}
        </button>
      </div>
    </>
  );
}
