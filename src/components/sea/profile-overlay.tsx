import { useEffect, useState } from "react";
import { StorageImg } from "@/components/storage-img";

export type ProfileCardData = {
  name: string;
  age: string;
  region: string;
  /** Extra meta under name: height · job · smoke (already filtered) */
  meta?: string;
  photo?: string | null;
  intro: string;
  idealLine?: string;
  tags: string[];
  qa: { q: string; a: string }[];
};

/** Aqua profile card — deliberately NOT the parchment note. Slides in from right. */
export function ProfileOverlay({
  data,
  cta,
  onBack,
}: {
  data: ProfileCardData | null;
  cta?: { label: string; onClick: () => void; busy?: boolean } | null;
  onBack: () => void;
}) {
  const [shown, setShown] = useState<ProfileCardData | null>(data);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (data) {
      setShown(data);
      const r = requestAnimationFrame(() => setOn(true));
      return () => cancelAnimationFrame(r);
    }
    setOn(false);
    const t = setTimeout(() => setShown(null), 360);
    return () => clearTimeout(t);
  }, [data]);

  return (
    <div className={"fl-ppage" + (on ? " on" : "")}>
      <button className="fl-pp-back" onClick={onBack} aria-label="뒤로">←</button>
      {shown && (
        <>
          <div className="fl-pp-hero">
            {shown.photo ? <StorageImg src={shown.photo} alt="" /> : null}
            <div className="grad" />
            <div className="nm">
              <b>{shown.age ? `${shown.name} · ${shown.age}` : shown.name}</b>
              {(shown.region || shown.meta) && (
                <span>{[shown.region, shown.meta].filter(Boolean).join(" · ")}</span>
              )}
            </div>
          </div>
          <div className="fl-pp-body">
            <span className="fl-pp-ai">✨ AI가 정리한 소개</span>
            {shown.intro && (
              <div className="fl-pp-card">
                <h5>이런 사람이에요</h5>
                <p>{shown.intro}</p>
              </div>
            )}
            {shown.tags.length > 0 && (
              <div className="fl-pp-card">
                <h5>관심사</h5>
                <div className="fl-pp-tags">
                  {shown.tags.map((t) => (
                    <span key={t} className="fl-pp-tag">{t}</span>
                  ))}
                </div>
              </div>
            )}
            {shown.idealLine?.trim() && (
              <div className="fl-pp-card fl-pp-ideal">
                <h5>이런 사람에게 끌려요</h5>
                <p>{shown.idealLine}</p>
              </div>
            )}
            {shown.qa.length > 0 && (
              <div className="fl-pp-card">
                <h5>몇 가지 질문</h5>
                {shown.qa.map((x, i) => (
                  <div key={i} className="fl-pp-qa">
                    <div className="q">{x.q}</div>
                    <div className="a">{x.a}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {cta && (
            <div className="fl-pp-cta-wrap">
              <button className="fl-pp-cta" disabled={cta.busy} onClick={cta.onClick}>
                {cta.busy ? "여는 중…" : cta.label}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
