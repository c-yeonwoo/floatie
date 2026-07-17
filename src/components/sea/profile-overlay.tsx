import { useEffect, useState } from "react";
import { StorageImg } from "@/components/storage-img";

export type ProfileCardData = {
  name: string;
  age: string;
  region: string;
  /** Extra meta under name: height · job · smoke (already filtered) */
  meta?: string;
  /** Prefer photos[]; photo kept as legacy single fallback */
  photos?: (string | null | undefined)[];
  photo?: string | null;
  intro: string;
  idealLine?: string;
  tags: string[];
  qa: { q: string; a: string }[];
};

function photoList(data: ProfileCardData): string[] {
  const fromArr = (data.photos ?? []).filter((p): p is string => !!p);
  if (fromArr.length) return fromArr;
  return data.photo ? [data.photo] : [];
}

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
  const [photoIdx, setPhotoIdx] = useState(0);

  useEffect(() => {
    if (data) {
      setShown(data);
      setPhotoIdx(0);
      const r = requestAnimationFrame(() => setOn(true));
      return () => cancelAnimationFrame(r);
    }
    setOn(false);
    const t = setTimeout(() => setShown(null), 360);
    return () => clearTimeout(t);
  }, [data]);

  const photos = shown ? photoList(shown) : [];
  const hero = photos[photoIdx] ?? photos[0] ?? null;

  return (
    <div className={"fl-ppage" + (on ? " on" : "")}>
      <button className="fl-pp-back" onClick={onBack} aria-label="뒤로">←</button>
      {shown && (
        <>
          <div className="fl-pp-hero">
            {hero ? <StorageImg src={hero} alt="" /> : null}
            <div className="grad" />
            {photos.length > 1 && (
              <div className="fl-pp-dots" role="tablist" aria-label="사진">
                {photos.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={"dot" + (i === photoIdx ? " on" : "")}
                    aria-label={`${i + 1}번째 사진`}
                    onClick={() => setPhotoIdx(i)}
                  />
                ))}
              </div>
            )}
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  className="fl-pp-tap left"
                  aria-label="이전 사진"
                  onClick={() => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)}
                />
                <button
                  type="button"
                  className="fl-pp-tap right"
                  aria-label="다음 사진"
                  onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)}
                />
              </>
            )}
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
