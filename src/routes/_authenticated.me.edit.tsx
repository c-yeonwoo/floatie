import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StorageImg } from "@/components/storage-img";
import { AutoGrowTextarea } from "@/components/auto-grow-textarea";
import { pickPhoto, validatePickedPhoto } from "@/lib/native-photo";
import {
  PROFILE_QUESTIONS,
  uploadProfilePhoto,
  generateProfileDraft,
  regenerateIntro,
  parseIntroAnswers,
  remainingRegenToday,
} from "@/lib/profile-ai";
import {
  JOB_CHIPS,
  SMOKE_CHIPS,
  WEEKEND_CHIPS,
  VIBE_CHIPS,
  PACE_CHIPS,
  PROFILE_REGIONS,
  NICK_MAX,
  INTRO_MAX,
  IDEAL_LINE_MAX,
  S4_QUESTION,
  I1_QUESTION,
  I2_QUESTION,
  parseHeightCm,
  type IntroAnswersV2,
} from "@/lib/interview-chips";

export const Route = createFileRoute("/_authenticated/me/edit")({
  head: () => ({ meta: [{ title: "프로필 수정 — 플로티" }] }),
  component: EditProfilePage,
});

const GENDER_LABEL: Record<string, string> = {
  female: "여자",
  male: "남자",
};

type PhotoSlot = {
  path: string | null;
  file: File | null;
  preview: string | null;
};

function emptySlots(): PhotoSlot[] {
  return [
    { path: null, file: null, preview: null },
    { path: null, file: null, preview: null },
    { path: null, file: null, preview: null },
  ];
}

function EditProfilePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-profile-edit"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select(
          "display_name, bio, avatar_url, gender, birth_year, region, height_cm, photos, job_chip, smoke, ai_intro, ai_ideal_line, ai_tags, intro_answers, intro_regen_date, intro_regen_count",
        )
        .eq("id", uid)
        .maybeSingle();
      return { uid, profile };
    },
  });

  const [displayName, setDisplayName] = useState("");
  const [intro, setIntro] = useState("");
  const [idealLine, setIdealLine] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [gender, setGender] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [region, setRegion] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [jobChip, setJobChip] = useState("");
  const [smoke, setSmoke] = useState("");
  const [answers, setAnswers] = useState<[string, string, string]>(["", "", ""]);
  const [weekend, setWeekend] = useState("");
  const [vibes, setVibes] = useState<string[]>([]);
  const [pace, setPace] = useState("");
  const [slots, setSlots] = useState<PhotoSlot[]>(emptySlots);
  const [regenLeft, setRegenLeft] = useState(2);
  const [saving, setSaving] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);

  useEffect(() => {
    const p = data?.profile;
    if (!p) return;
    setDisplayName(p.display_name ?? "");
    setIntro(p.ai_intro ?? p.bio ?? "");
    setIdealLine(p.ai_ideal_line ?? "");
    setTags(Array.isArray(p.ai_tags) ? p.ai_tags : []);
    setGender(p.gender ?? "");
    setBirthYear(p.birth_year ? String(p.birth_year) : "");
    setRegion(p.region ?? "");
    setHeightCm(p.height_cm ? String(p.height_cm) : "");
    setJobChip(p.job_chip ?? "");
    setSmoke(p.smoke ?? "");
    setRegenLeft(remainingRegenToday(p.intro_regen_date, p.intro_regen_count));

    const parsed = parseIntroAnswers(p.intro_answers);
    setAnswers([parsed.self[0], parsed.self[1], parsed.self[2]]);
    setWeekend(parsed.self[3] ?? "");
    setVibes(parsed.ideal.vibes);
    setPace(parsed.ideal.pace);

    const paths: string[] =
      Array.isArray(p.photos) && p.photos.length
        ? p.photos.slice(0, 3)
        : p.avatar_url
          ? [p.avatar_url]
          : [];
    setSlots(
      [0, 1, 2].map((i) => ({
        path: paths[i] ?? null,
        file: null,
        preview: paths[i] ?? null,
      })),
    );
  }, [data]);

  const filledCount = slots.filter((s) => s.path || s.file).length;

  const setSlot = async (idx: number) => {
    const f = await pickPhoto();
    if (!f) return;
    const err = validatePickedPhoto(f);
    if (err) return toast.error(err);
    setSlots((prev) => {
      const next = [...prev];
      if (next[idx].preview?.startsWith("blob:")) URL.revokeObjectURL(next[idx].preview!);
      next[idx] = { path: null, file: f, preview: URL.createObjectURL(f) };
      return next;
    });
  };

  const clearSlot = (idx: number) => {
    setSlots((prev) => {
      const next = [...prev];
      if (next[idx].preview?.startsWith("blob:")) URL.revokeObjectURL(next[idx].preview!);
      next[idx] = { path: null, file: null, preview: null };
      return next;
    });
  };

  const setAnswer = (idx: 0 | 1 | 2, v: string) =>
    setAnswers((a) => {
      const next: [string, string, string] = [...a];
      next[idx] = v;
      return next;
    });

  const toggleVibe = (v: string) => {
    setVibes((prev) => {
      if (prev.includes(v)) return prev.filter((x) => x !== v);
      if (prev.length >= 2) return prev;
      return [...prev, v];
    });
  };

  const interviewOk = () =>
    answers.every((a) => a.trim().length >= 2) &&
    !!weekend &&
    vibes.length >= 1 &&
    vibes.length <= 2 &&
    !!pace;

  const onRegen = async () => {
    if (!interviewOk()) {
      return toast.error("인터뷰 답변을 먼저 채워 주세요.");
    }
    if (regenLeft <= 0) {
      return toast.error("오늘은 AI 정리를 다 썼어요. 내일 다시 시도해 주세요.");
    }
    setRegenBusy(true);
    try {
      const draft = await generateProfileDraft([...answers, weekend], { vibes, pace });
      const left = await regenerateIntro(draft.intro, draft.tags, draft.idealLine);
      setIntro(draft.intro);
      setIdealLine(draft.idealLine);
      setTags(draft.tags);
      setRegenLeft(left);
      toast.success(`소개를 다시 정리했어요. 오늘 ${left}회 남았어요.`);
      qc.invalidateQueries({ queryKey: ["my-profile-edit"] });
      qc.invalidateQueries({ queryKey: ["sea-me"] });
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/daily regenerate|limit/i.test(msg)) {
        setRegenLeft(0);
        toast.error("오늘은 AI 정리를 다 썼어요. 내일 다시 시도해 주세요.");
      } else {
        toast.error(msg || "다시 시도해 주세요.");
      }
    } finally {
      setRegenBusy(false);
    }
  };

  const onSave = async () => {
    if (!displayName.trim()) return toast.error("닉네임을 입력해 주세요.");
    if (displayName.length > NICK_MAX) return toast.error(`닉네임은 ${NICK_MAX}자 이하로 입력해 주세요.`);
    if (intro.trim().length < 2) return toast.error("소개를 적어 주세요.");
    if (intro.length > INTRO_MAX) return toast.error(`소개는 ${INTRO_MAX}자 이하로 입력해 주세요.`);
    if (idealLine.trim().length < 2) return toast.error("끌리는 사람 소개를 적어 주세요.");
    if (idealLine.length > IDEAL_LINE_MAX) return toast.error("끌리는 사람 소개가 너무 길어요.");
    const year = Number(birthYear);
    if (!year || year < 1940 || year > 2008) return toast.error("출생 연도를 확인해 주세요.");
    if (!region) return toast.error("지역을 골라 주세요.");
    const height = parseHeightCm(heightCm);
    if (height == null) return toast.error("키를 입력해 주세요.");
    if (!jobChip) return toast.error("하는 일을 골라 주세요.");
    if (!smoke) return toast.error("흡연을 골라 주세요.");
    if (filledCount < 3) return toast.error("프로필 사진 3장이 필요해요.");
    if (!interviewOk()) return toast.error("인터뷰 답변을 모두 채워 주세요.");
    if (!data?.uid) return;

    setSaving(true);
    try {
      const paths: string[] = [];
      for (let i = 0; i < 3; i++) {
        const s = slots[i];
        if (s.file) paths.push(await uploadProfilePhoto(data.uid, s.file, i));
        else if (s.path) paths.push(s.path);
        else throw new Error("사진이 비어 있어요.");
      }

      const intro_answers: IntroAnswersV2 = {
        version: 2,
        self: [...answers, weekend],
        ideal: { vibes, pace },
        facts: { job_chip: jobChip, smoke },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          bio: intro.trim() || null,
          ai_intro: intro.trim() || null,
          ai_ideal_line: idealLine.trim() || null,
          ai_tags: tags,
          intro_answers,
          photos: paths,
          avatar_url: paths[0] ?? null,
          birth_year: year,
          region,
          height_cm: height,
          job_chip: jobChip,
          smoke,
        })
        .eq("id", data.uid);
      if (error) throw error;

      toast.success("프로필을 저장했어요.");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      qc.invalidateQueries({ queryKey: ["my-profile-edit"] });
      qc.invalidateQueries({ queryKey: ["my-mission-profile"] });
      qc.invalidateQueries({ queryKey: ["sea-me"] });
      navigate({ to: "/me" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="fl-me">
      <header className="fl-me-top">
        <Link to="/me" className="fl-me-link">← 취소</Link>
        <h1 className="fl-me-title">프로필 수정</h1>
        <button type="button" className="fl-me-link strong" onClick={onSave} disabled={saving || isLoading || regenBusy}>
          {saving ? "저장 중…" : "저장"}
        </button>
      </header>

      <div className="fl-me-body">
        <h5 className="fl-onb-label first">프로필 사진 3장</h5>
        <p className="fl-me-hint">첫 장이 대표예요. 열리기 전에는 상대에게 안 보여요.</p>
        <div className="fl-photos3">
          {[0, 1, 2].map((k) => {
            const s = slots[k];
            return s.preview ? (
              <div key={k} className="fl-pslot filled">
                {k === 0 && <span className="main">대표</span>}
                <StorageImg src={s.preview} alt="" />
                <div className="x" onClick={() => clearSlot(k)}>✕</div>
              </div>
            ) : (
              <div key={k} className="fl-pslot" onClick={() => setSlot(k)}>＋</div>
            );
          })}
        </div>

        <h5 className="fl-onb-label">닉네임</h5>
        <input
          className="fl-in"
          maxLength={NICK_MAX}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />

        <h5 className="fl-onb-label">성별</h5>
        <p className="fl-me-readonly">{GENDER_LABEL[gender] ?? "—"}</p>

        <h5 className="fl-onb-label">출생 연도</h5>
        <input
          className="fl-in"
          inputMode="numeric"
          maxLength={4}
          value={birthYear}
          onChange={(e) => setBirthYear(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="1998"
        />

        <h5 className="fl-onb-label">지역</h5>
        <div className="fl-chipgrid">
          {PROFILE_REGIONS.map((r) => (
            <button
              key={r}
              type="button"
              className={"fl-selchip" + (region === r ? " on" : "")}
              onClick={() => setRegion(r)}
            >
              {r}
            </button>
          ))}
        </div>

        <h5 className="fl-onb-label">하는 일</h5>
        <div className="fl-chipgrid">
          {JOB_CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              className={"fl-selchip" + (jobChip === c ? " on" : "")}
              onClick={() => setJobChip(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <h5 className="fl-onb-label">흡연</h5>
        <div className="fl-chipgrid">
          {SMOKE_CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              className={"fl-selchip" + (smoke === c ? " on" : "")}
              onClick={() => setSmoke(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <h5 className="fl-onb-label">키</h5>
        <input
          className="fl-in"
          inputMode="numeric"
          maxLength={3}
          value={heightCm}
          onChange={(e) => setHeightCm(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="170"
        />

        <span className="fl-onb-sec" style={{ marginTop: 22 }}>나에 대해</span>

        {PROFILE_QUESTIONS.map((q, i) => (
          <div key={q.q}>
            <h5 className="fl-onb-label">{q.q}</h5>
            <AutoGrowTextarea
              className="fl-in fl-in-grow"
              maxLength={120}
              value={answers[i as 0 | 1 | 2]}
              onChange={(e) => setAnswer(i as 0 | 1 | 2, e.target.value)}
              placeholder={q.ph}
            />
          </div>
        ))}

        <h5 className="fl-onb-label">{S4_QUESTION}</h5>
        <div className="fl-chipgrid">
          {WEEKEND_CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              className={"fl-selchip" + (weekend === c ? " on" : "")}
              onClick={() => setWeekend(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <span className="fl-onb-sec" style={{ marginTop: 22 }}>끌리는 사람</span>

        <h5 className="fl-onb-label">{I1_QUESTION}</h5>
        <p className="fl-me-hint">최대 2개</p>
        <div className="fl-chipgrid">
          {VIBE_CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              className={"fl-selchip" + (vibes.includes(c) ? " on" : "")}
              onClick={() => toggleVibe(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <h5 className="fl-onb-label">{I2_QUESTION}</h5>
        <div className="fl-chipgrid">
          {PACE_CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              className={"fl-selchip" + (pace === c ? " on" : "")}
              onClick={() => setPace(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="fl-me-regen-row">
          <span className="fl-onb-sec" style={{ margin: 0 }}>AI 소개</span>
          <button
            type="button"
            className="fl-regen"
            disabled={regenBusy || regenLeft <= 0}
            onClick={onRegen}
          >
            {regenBusy ? "정리 중…" : `소개 다시 만들기 · ${regenLeft}/2`}
          </button>
        </div>
        <p className="fl-me-hint">인터뷰를 바꾼 뒤 누르면 AI가 소개·관심사를 다시 써요. 하루 2회.</p>

        <h5 className="fl-onb-label">이런 사람이에요</h5>
        <AutoGrowTextarea
          className="fl-in fl-in-grow"
          maxLength={INTRO_MAX}
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          placeholder="열린 뒤 상대에게 보여요."
        />
        <p className="fl-me-count">{intro.length}/{INTRO_MAX}</p>

        <h5 className="fl-onb-label">이런 사람에게 끌려요</h5>
        <AutoGrowTextarea
          className="fl-in fl-in-grow"
          maxLength={IDEAL_LINE_MAX}
          value={idealLine}
          onChange={(e) => setIdealLine(e.target.value)}
          placeholder="잘 맞을 것 같은 분위기를 한 줄로."
        />
        <p className="fl-me-count">{idealLine.length}/{IDEAL_LINE_MAX}</p>

        <h5 className="fl-onb-label">관심사</h5>
        <div className="fl-chipgrid">
          {tags.map((t) => (
            <span key={t} className="fl-etag">
              {t}
              <span className="rm" onClick={() => setTags((ts) => ts.filter((x) => x !== t))}>✕</span>
            </span>
          ))}
          {tags.length === 0 && <p className="fl-me-hint" style={{ margin: 0 }}>AI로 다시 만들면 채워져요.</p>}
        </div>
      </div>
    </main>
  );
}
