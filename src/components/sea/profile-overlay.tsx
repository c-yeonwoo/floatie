import { useEffect, useState } from "react";
import { StorageImg } from "@/components/storage-img";
import { displayIntroHeading, parseIntroSections } from "@/lib/intro-story";
import { profileHeroMeta, profileLifestyleLine } from "@/lib/interview-chips";

export type ProfileCardData = {
  name: string;
  age: string;
  region: string;
  /** @deprecated hero uses region/age/job/height fields */
  meta?: string;
  job?: string | null;
  heightCm?: number | null;
  smoke?: string | null;
  drink?: string | null;
  tattoo?: string | null;
  photos?: (string | null | undefined)[];
  photo?: string | null;
  intro: string;
  idealLine?: string;
  tags: string[];
};

function photoList(data: ProfileCardData): string[] {
  const fromArr = (data.photos ?? []).filter((p): p is string => !!p);
  if (fromArr.length) return fromArr;
  return data.photo ? [data.photo] : [];
}

const AI_TIP = "인터뷰내용을 바탕으로 AI가 요약한 내용입니다.";

function AiTip() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on) return;
    const close = () => setOn(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [on]);
  return (
    <button
      type="button"
      className={"fl-pp-info" + (on ? " on" : "")}
      aria-label={AI_TIP}
      data-tip={AI_TIP}
      onClick={(e) => {
        e.stopPropagation();
        setOn((v) => !v);
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      i
    </button>
  );
}

/** Story-style unlock card — chapters + photos interleaved (Palette-lite). */
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

  const photos = shown ? photoList(shown) : [];
  const chapters = shown ? parseIntroSections(shown.intro) : [];
  const hero = photos[0] ?? null;
  const restPhotos = photos.slice(1);
  const heroMeta = shown
    ? profileHeroMeta({
        region: shown.region,
        age: shown.age,
        job_chip: shown.job,
        height_cm: shown.heightCm,
      })
    : "";
  const lifestyle = shown
    ? profileLifestyleLine({
        smoke: shown.smoke,
        drink: shown.drink,
        tattoo: shown.tattoo,
      })
    : "";

  return (
    <div className={"fl-ppage" + (on ? " on" : "")}>
      <header className="fl-pp-top">
        <button type="button" className="fl-pp-back" onClick={onBack} aria-label="뒤로">
          ←
        </button>
      </header>
      {shown && (
        <>
          <div className="fl-pp-hero">
            {hero ? <StorageImg src={hero} alt="" /> : null}
            <div className="grad" />
            <div className="nm">
              <b>{shown.name}</b>
              {heroMeta && <span>{heroMeta}</span>}
            </div>
          </div>

          <div className="fl-pp-body">
            {lifestyle && (
              <p className="fl-pp-lifestyle">{lifestyle}</p>
            )}

            {chapters.length > 0 && (
              <>
                <div className="fl-pp-sec-head">
                  <h5>이런 사람이에요</h5>
                  <AiTip />
                </div>
                {chapters.map((ch, i) => {
                  const heading = ch.heading ? displayIntroHeading(ch.heading) : "";
                  return (
                    <div key={i}>
                      <div className="fl-pp-chapter">
                        {heading && heading !== "이런 사람이에요" && <h4>{heading}</h4>}
                        <p>{ch.body}</p>
                      </div>
                      {restPhotos[i] && (
                        <div className="fl-pp-bleed">
                          <StorageImg src={restPhotos[i]} alt="" />
                        </div>
                      )}
                    </div>
                  );
                })}
                {restPhotos.slice(chapters.length).map((src, i) => (
                  <div key={`p-${i}`} className="fl-pp-bleed">
                    <StorageImg src={src} alt="" />
                  </div>
                ))}
              </>
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
