import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { pickPhoto, validatePickedPhoto } from "@/lib/native-photo";
import { ImageCropModal } from "@/components/image-crop-modal";
import {
  PROFILE_QUESTIONS,
  generateProfileDraft,
  uploadProfilePhoto,
  saveOnboarding,
} from "@/lib/profile-ai";
import {
  JOB_CHIPS,
  SMOKE_CHIPS,
  DRINK_CHIPS,
  TATTOO_CHIPS,
  VIBE_CHIPS,
  PACE_CHIPS,
  PROFILE_REGIONS,
  S4_QUESTION,
  I1_QUESTION,
  I2_QUESTION,
  parseHeightCm,
  s4ChipOptions,
} from "@/lib/interview-chips";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: pageTitle("시작하기") }] }),
  component: OnboardingPage,
});

const STEPS = [
  "name",
  "basic",
  "region",
  "photo",
  "facts",
  "q0",
  "q1",
  "q2",
  "s4",
  "bridge",
  "i1",
  "i2",
  "gen",
  "review",
] as const;
type Step = (typeof STEPS)[number];
const INPUT_STEPS = STEPS.filter((s) => s !== "gen" && s !== "review").length;

type Photo = { file: File; url: string };

function OnboardingPage() {
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [gender, setGender] = useState<"female" | "male" | "">("");
  const [region, setRegion] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [jobChip, setJobChip] = useState("");
  const [smoke, setSmoke] = useState("");
  const [drink, setDrink] = useState("");
  const [tattoo, setTattoo] = useState("");
  const [height, setHeight] = useState("");
  const [answers, setAnswers] = useState<string[]>(["", "", ""]);
  const [loveView, setLoveView] = useState("");
  const [vibes, setVibes] = useState<string[]>([]);
  const [pace, setPace] = useState("");
  const [intro, setIntro] = useState("");
  const [idealLine, setIdealLine] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const photosRef = useRef<Photo[]>([]);
  photosRef.current = photos;

  const step: Step = STEPS[i];

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, onboarded")
        .eq("id", uid)
        .maybeSingle();
      if (prof?.onboarded) navigate({ to: "/home" });
      else if (prof?.display_name && !prof.display_name.startsWith("user_")) setName(prof.display_name);
    })();
  }, [navigate]);

  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const valid = (): boolean => {
    if (step === "name") return name.trim().length >= 1;
    if (step === "basic") return /^\d{4}$/.test(year) && +year >= 1940 && +year <= 2008 && !!gender;
    if (step === "region") return !!region;
    if (step === "photo") return photos.length >= 3;
    if (step === "facts")
      return !!jobChip && !!smoke && !!drink && !!tattoo && parseHeightCm(height) != null;
    if (step[0] === "q") return answers[+step[1]].trim().length >= 2;
    if (step === "s4") return !!loveView;
    if (step === "bridge") return true;
    if (step === "i1") return vibes.length >= 1 && vibes.length <= 2;
    if (step === "i2") return !!pace;
    if (step === "review") return intro.trim().length >= 2 && idealLine.trim().length >= 2;
    return true;
  };

  const progress = step === "gen" || step === "review" ? 100 : Math.round((i / INPUT_STEPS) * 100);

  const back = () => {
    if (i <= 0) return navigate({ to: "/home" });
    let n = i - 1;
    if (STEPS[n] === "gen") n -= 1;
    setI(n);
  };

  const toggleVibe = (v: string) => {
    setVibes((prev) => {
      if (prev.includes(v)) return prev.filter((x) => x !== v);
      if (prev.length >= 2) return prev;
      return [...prev, v];
    });
  };

  const next = async () => {
    if (!valid()) return;
    if (step === "i2") {
      setI(STEPS.indexOf("gen"));
      const selfAnswers = [...answers, loveView];
      const ideal = { vibes, pace };
      const draft = await generateProfileDraft(selfAnswers, ideal, {
        displayName: name.trim(),
        gender,
        birthYear: +year,
        region,
        heightCm: parseHeightCm(height),
        jobChip,
        smoke,
        drink,
        tattoo,
      }).catch(() => ({
        intro: "",
        idealLine: "",
        tags: [] as string[],
      }));
      setIntro(draft.intro);
      setIdealLine(draft.idealLine);
      setTags(draft.tags);
      setTimeout(() => setI(STEPS.indexOf("review")), 900);
      return;
    }
    if (step === "review") return finish();
    setI(i + 1);
  };

  const addPhoto = async () => {
    if (photos.length >= 3) return;
    const f = await pickPhoto();
    if (!f) return;
    const err = validatePickedPhoto(f);
    if (err) return toast.error(err);
    if (cropSrc?.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
    setCropSrc(URL.createObjectURL(f));
  };
  const applyCrop = (file: File) => {
    setPhotos((p) => [...p, { file, url: URL.createObjectURL(file) }]);
    if (cropSrc?.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };
  const rmPhoto = (idx: number) =>
    setPhotos((p) => {
      URL.revokeObjectURL(p[idx].url);
      return p.filter((_, k) => k !== idx);
    });

  const setAnswer = (idx: number, v: string) =>
    setAnswers((a) => a.map((x, k) => (k === idx ? v : x)));

  const finish = async () => {
    setSaving(true);
    try {
      const { data } = await supabase.auth.getUser();
      const uid = data.user!.id;
      const paths: string[] = [];
      for (let k = 0; k < photos.length; k++) paths.push(await uploadProfilePhoto(uid, photos[k].file, k));
      const heightCm = parseHeightCm(height);
      if (heightCm == null) throw new Error("키를 입력해 주세요.");
      await saveOnboarding(uid, {
        displayName: name,
        gender: gender as "female" | "male",
        birthYear: +year,
        region: region || null,
        photos: paths,
        heightCm,
        jobChip,
        smoke,
        drink,
        tattoo,
        selfAnswers: [...answers, loveView],
        ideal: { vibes, pace },
        intro,
        idealLine,
        tags,
      });
      toast.success("프로필이 완성됐어요 🎉");
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "다시 시도해 주세요.");
      setSaving(false);
    }
  };

  const sectionHint =
    step === "s4" || step.startsWith("q")
      ? "나에 대해"
      : step === "bridge" || step === "i1" || step === "i2"
        ? "끌리는 사람"
        : null;

  return (
    <div className="fl-onb">
      <div className="fl-onb-top">
        <button className="bk" onClick={back} aria-label="뒤로">←</button>
        <div className="fl-prog">
          <i style={{ width: `${progress}%` }} />
        </div>
        <div className="fl-onb-step">{step === "gen" || step === "review" ? "" : `${Math.min(i + 1, INPUT_STEPS)}/${INPUT_STEPS}`}</div>
      </div>

      <div className={"fl-onb-body" + (step === "review" || step === "gen" ? "" : " center")}>
        {sectionHint && <span className="fl-onb-sec">{sectionHint}</span>}

        {step === "name" && (
          <>
            <h2>어떻게 불러드릴까요?</h2>
            <p className="desc">플로티에서 보일 닉네임이에요. 언제든 바꿀 수 있어요.</p>
            <input className="fl-in" maxLength={12} placeholder="닉네임" value={name} onChange={(e) => setName(e.target.value)} />
          </>
        )}

        {step === "basic" && (
          <>
            <h2>기본 정보를 알려주세요</h2>
            <p className="desc">나이와 성별은 매칭에 쓰여요. 프로필엔 나이대로 표시돼요.</p>
            <input
              className="fl-in"
              inputMode="numeric"
              maxLength={4}
              placeholder="출생연도 (예: 1998)"
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/[^0-9]/g, ""))}
              style={{ marginBottom: 12 }}
            />
            <div className="fl-seg">
              <button className={gender === "female" ? "on" : ""} onClick={() => setGender("female")}>여자</button>
              <button className={gender === "male" ? "on" : ""} onClick={() => setGender("male")}>남자</button>
            </div>
          </>
        )}

        {step === "region" && (
          <>
            <h2>어디에 살고 있어요?</h2>
            <p className="desc">가까운 지역의 인연을 우선 보여드려요.</p>
            <div className="fl-chipgrid">
              {PROFILE_REGIONS.map((r) => (
                <button key={r} className={"fl-selchip" + (region === r ? " on" : "")} onClick={() => setRegion(r)}>{r}</button>
              ))}
            </div>
          </>
        )}

        {step === "photo" && (
          <>
            <h2>프로필 사진 3장을 올려요</h2>
            <p className="desc">열기 전에는 상대에게 안 보여요. 첫 장이 대표예요.</p>
            <div className="fl-photos3">
              {[0, 1, 2].map((k) => {
                const p = photos[k];
                return p ? (
                  <div key={k} className="fl-pslot filled">
                    {k === 0 && <span className="main">대표</span>}
                    <img src={p.url} alt="" />
                    <div className="x" onClick={() => rmPhoto(k)}>✕</div>
                  </div>
                ) : (
                  <div key={k} className="fl-pslot" onClick={addPhoto}>＋</div>
                );
              })}
            </div>
          </>
        )}

        {step === "facts" && (
          <>
            <h2>조금만 더 알려주세요</h2>
            <p className="desc">프로필에 짧게 보여요.</p>
            <p className="fl-field-label">하는 일</p>
            <div className="fl-chipgrid">
              {JOB_CHIPS.map((c) => (
                <button key={c} type="button" className={"fl-selchip" + (jobChip === c ? " on" : "")} onClick={() => setJobChip(c)}>{c}</button>
              ))}
            </div>
            <p className="fl-field-label">흡연</p>
            <div className="fl-chipgrid">
              {SMOKE_CHIPS.map((c) => (
                <button key={c} type="button" className={"fl-selchip" + (smoke === c ? " on" : "")} onClick={() => setSmoke(c)}>{c}</button>
              ))}
            </div>
            <p className="fl-field-label">음주</p>
            <div className="fl-chipgrid">
              {DRINK_CHIPS.map((c) => (
                <button key={c} type="button" className={"fl-selchip" + (drink === c ? " on" : "")} onClick={() => setDrink(c)}>{c}</button>
              ))}
            </div>
            <p className="fl-field-label">타투</p>
            <div className="fl-chipgrid">
              {TATTOO_CHIPS.map((c) => (
                <button key={c} type="button" className={"fl-selchip" + (tattoo === c ? " on" : "")} onClick={() => setTattoo(c)}>{c}</button>
              ))}
            </div>
            <p className="fl-field-label">키</p>
            <div className="fl-in-cm">
              <input
                className="fl-in fl-in-compact"
                inputMode="numeric"
                maxLength={3}
                placeholder="170"
                value={height}
                onChange={(e) => setHeight(e.target.value.replace(/[^0-9]/g, ""))}
              />
              <span>cm</span>
            </div>
          </>
        )}

        {step[0] === "q" && step.length === 2 && (
          <>
            <h2>{PROFILE_QUESTIONS[+step[1]].q}</h2>
            <p className="desc">짧게 적어도 괜찮아요. 다른 답·기본 정보랑 이어서 AI가 풀어 줘요.</p>
            <textarea
              className="fl-in"
              maxLength={120}
              placeholder={PROFILE_QUESTIONS[+step[1]].ph}
              value={answers[+step[1]]}
              onChange={(e) => setAnswer(+step[1], e.target.value)}
            />
          </>
        )}

        {step === "s4" && (
          <>
            <h2>{S4_QUESTION}</h2>
            <p className="desc">가까운 느낌 하나만 골라 주세요.</p>
            <div className="fl-chipgrid">
              {s4ChipOptions(loveView).map((c) => (
                <button
                  key={c}
                  type="button"
                  className={"fl-selchip" + (loveView === c ? " on" : "")}
                  onClick={() => setLoveView(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </>
        )}

        {step === "bridge" && (
          <>
            <h2>어떤 사람에게 마음이 기울어요?</h2>
            <p className="desc">
              매칭 조건이 아니에요. 프로필에 살짝 남겨, 서로 읽는 맛만 더할게요.
            </p>
          </>
        )}

        {step === "i1" && (
          <>
            <h2>{I1_QUESTION}</h2>
            <p className="desc">최대 2개까지 골라 주세요.</p>
            <div className="fl-chipgrid">
              {VIBE_CHIPS.map((c) => (
                <button key={c} type="button" className={"fl-selchip" + (vibes.includes(c) ? " on" : "")} onClick={() => toggleVibe(c)}>{c}</button>
              ))}
            </div>
          </>
        )}

        {step === "i2" && (
          <>
            <h2>{I2_QUESTION}</h2>
            <p className="desc">하나만 골라 주세요.</p>
            <div className="fl-chipgrid">
              {PACE_CHIPS.map((c) => (
                <button key={c} type="button" className={"fl-selchip" + (pace === c ? " on" : "")} onClick={() => setPace(c)}>{c}</button>
              ))}
            </div>
          </>
        )}

        {step === "gen" && (
          <div className="fl-gen">
            <div className="spin" />
            <b>AI가 소개를 정리하고 있어요</b>
            <span>나와 끌리는 사람을 바탕으로 초안을 만드는 중…</span>
          </div>
        )}

        {step === "review" && (
          <>
            <span className="fl-rev-ai">✨ AI 초안 · 자유롭게 고쳐요</span>
            <h2 style={{ marginBottom: 14 }}>{name || "나"}님의 프로필</h2>
            <div className="fl-rev-card">
              <h5>이야기</h5>
              <textarea maxLength={480} value={intro} onChange={(e) => setIntro(e.target.value)} />
            </div>
            <div className="fl-rev-card">
              <h5>이런 사람에게 끌려요</h5>
              <textarea maxLength={160} value={idealLine} onChange={(e) => setIdealLine(e.target.value)} />
            </div>
            <div className="fl-rev-card">
              <h5>관심사</h5>
              <div className="fl-chipgrid">
                {tags.map((t, k) => (
                  <span key={k} className="fl-etag">
                    {t}
                    <span className="rm" onClick={() => setTags((ts) => ts.filter((_, j) => j !== k))}>✕</span>
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {step !== "gen" && (
        <div className="fl-onb-foot">
          <button className="fl-onb-cta" disabled={!valid() || saving} onClick={next}>
            {saving
              ? "저장하는 중…"
              : step === "review"
                ? "이대로 시작하기"
                : step === "i2"
                  ? "소개 만들기"
                  : step === "bridge"
                    ? "골라볼게요"
                    : "다음"}
          </button>
        </div>
      )}

      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          onCancel={() => {
            URL.revokeObjectURL(cropSrc);
            setCropSrc(null);
          }}
          onDone={applyCrop}
        />
      )}
    </div>
  );
}
