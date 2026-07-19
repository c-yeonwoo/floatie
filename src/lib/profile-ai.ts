import { supabase } from "@/integrations/supabase/client";
import { stripExifAndCompress } from "@/lib/image-utils";
import type { IntroAnswersV2 } from "@/lib/interview-chips";
import { formatIntroSections, type IntroSection } from "@/lib/intro-story";

/** S1–S3 free-text questions (S4 is a chip — see interview-chips). */
export const PROFILE_QUESTIONS: { q: string; ph: string }[] = [
  {
    q: "요즘 빠져 있는 건 뭐예요?",
    ph: "예: 테니스, 주말 클라이밍 · 짧게 적어도 AI가 이어서 풀어 줘요",
  },
  {
    q: "쉬는 날은 보통 어떻게 보내요?",
    ph: "예: 오전에 운동하고 카페에서 쉬어요",
  },
  {
    q: "주변에서 자주 듣는 말은요?",
    ph: "예: 책임감 있다, 편하게 대해준다, 웃기다",
  },
];

export type ProfileDraft = { intro: string; idealLine: string; tags: string[] };

export type IdealInput = { vibes: string[]; pace: string };

/** Extra profile facts for richer AI expansion (short answers OK). */
export type ProfileGenFacts = {
  displayName?: string | null;
  gender?: string | null;
  birthYear?: number | null;
  region?: string | null;
  heightCm?: number | null;
  jobChip?: string | null;
  smoke?: string | null;
  drink?: string | null;
  tattoo?: string | null;
};

const TAG_WORDS: [string, string][] = [
  ["테니스", "#테니스"], ["바다", "#바다"], ["파도", "#바다"], ["책", "#독서"], ["독서", "#독서"],
  ["영화", "#영화"], ["러닝", "#러닝"], ["달리", "#러닝"], ["등산", "#등산"],
  ["클라이밍", "#클라이밍"], ["음악", "#음악"], ["노래", "#음악"], ["커피", "#커피"],
  ["카페", "#카페"], ["여행", "#여행"], ["요리", "#요리"], ["사진", "#필름사진"],
  ["카메라", "#필름사진"], ["강아지", "#강아지"], ["고양이", "#고양이"], ["게임", "#게임"],
  ["산책", "#산책"], ["운동", "#운동"],
];

function templateDraft(answers: string[], ideal?: IdealInput): ProfileDraft {
  const clip = (s: string) => s.trim().replace(/[.。!?~\s]+$/, "");
  const [a0, a1, a2, a3] = answers.map(clip);
  const sections: IntroSection[] = [];
  if (a0) {
    sections.push({
      heading: "요즘 빠져 있는 건 뭐예요?",
      body: `요즘은 ${a0}에 마음이 가 있어요. 관심 가는 게 생기면 조금씩 깊게 파보는 편이에요.`,
    });
  }
  if (a1) {
    sections.push({
      heading: "쉬는 날은 보통 어떻게 보내요?",
      body: `쉬는 날엔 ${a1}. 크게 떠들기보다 그런 리듬이 편해요.`,
    });
  }
  if (a2 || a3) {
    const bits = [
      a2 && `주변에서는 ${a2}는 이야기를 자주 들어요`,
      a3 && `연애에선 ${a3} 쪽에 가까워요`,
    ].filter(Boolean);
    sections.push({
      heading: "주변에서 자주 듣는 말은요?",
      body: `${bits.join(". ")}. 서로 리듬이 맞을 때 더 편하게 다가가요.`,
    });
  }
  const intro = formatIntroSections(sections);

  const text = answers.join(" ");
  const found: string[] = [];
  for (const [w, t] of TAG_WORDS) if (text.includes(w) && !found.includes(t)) found.push(t);
  for (const d of ["#일상", "#담백", "#여유"]) if (found.length < 3 && !found.includes(d)) found.push(d);

  let idealLine = "";
  if (ideal?.vibes?.length || ideal?.pace) {
    const vibe = (ideal.vibes ?? []).slice(0, 2).join("·");
    const pace = ideal.pace?.trim();
    if (vibe && pace) idealLine = `${vibe} 분위기랑, ${pace} 리듬이 잘 맞을 것 같아요.`;
    else if (vibe) idealLine = `${vibe} 분위기랑 잘 맞을 것 같아요.`;
    else if (pace) idealLine = `${pace} 리듬이랑 잘 맞을 것 같아요.`;
  }

  return { intro, idealLine, tags: found.slice(0, 6) };
}

/** Generate intro + ideal line + tags. Falls back to local template. */
export async function generateProfileDraft(
  answers: string[],
  ideal?: IdealInput,
  facts?: ProfileGenFacts | null,
): Promise<ProfileDraft> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-profile", {
      body: { answers, ideal: ideal ?? null, profile: facts ?? null },
    });
    if (!error && data && Array.isArray(data.tags)) {
      let intro = "";
      if (Array.isArray(data.sections) && data.sections.length) {
        const sections: IntroSection[] = data.sections
          .filter((s: unknown) => s && typeof s === "object")
          .map((s: { heading?: string; body?: string }) => ({
            heading: typeof s.heading === "string" ? s.heading : "",
            body: typeof s.body === "string" ? s.body : "",
          }))
          .filter((s: IntroSection) => s.body.trim());
        intro = formatIntroSections(sections);
      } else if (typeof data.intro === "string") {
        intro = data.intro;
      }
      if (intro) {
        return {
          intro,
          idealLine: typeof data.ideal_line === "string" ? data.ideal_line : "",
          tags: data.tags.filter((t: unknown) => typeof t === "string").slice(0, 6),
        };
      }
    }
  } catch {
    /* fall through */
  }
  return templateDraft(answers, ideal);
}

export async function uploadProfilePhoto(uid: string, file: File, i: number): Promise<string> {
  const cleaned = await stripExifAndCompress(file);
  const path = `${uid}/photo-${i}-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from("answers")
    .upload(path, cleaned, { upsert: true, contentType: cleaned.type });
  if (error) throw error;
  return path;
}

export type OnboardingData = {
  displayName: string;
  gender: "female" | "male";
  birthYear: number;
  region: string | null;
  photos: string[];
  heightCm: number | null;
  jobChip: string;
  smoke: string;
  drink: string;
  tattoo: string;
  selfAnswers: string[]; // s1–s3 text + s4 chip
  ideal: IdealInput;
  intro: string;
  idealLine: string;
  tags: string[];
};

export function buildIntroAnswersV2(d: OnboardingData): IntroAnswersV2 {
  return {
    version: 2,
    self: d.selfAnswers,
    ideal: d.ideal,
    facts: { job_chip: d.jobChip, smoke: d.smoke, drink: d.drink, tattoo: d.tattoo },
  };
}

/** Persist finished profile and mark onboarded. */
export async function saveOnboarding(uid: string, d: OnboardingData): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("profiles")
    .update({
      display_name: d.displayName.trim(),
      gender: d.gender,
      birth_year: d.birthYear,
      region: d.region,
      height_cm: d.heightCm,
      job_chip: d.jobChip,
      smoke: d.smoke,
      drink: d.drink,
      tattoo: d.tattoo,
      photos: d.photos,
      avatar_url: d.photos[0] ?? null,
      intro_answers: buildIntroAnswersV2(d),
      ai_intro: d.intro,
      ai_ideal_line: d.idealLine || null,
      ai_tags: d.tags,
      bio: d.intro,
      onboarded: true,
    })
    .eq("id", uid);
  if (error) throw error;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc("touch_last_active");
  } catch {
    /* best-effort */
  }
}

/** Save re-generated intro/tags/ideal under 2/day cap. */
export async function regenerateIntro(
  intro: string,
  tags: string[],
  idealLine?: string | null,
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("regenerate_intro", {
    p_intro: intro,
    p_tags: tags,
    p_ideal_line: idealLine ?? null,
  });
  if (error) throw error;
  return typeof data === "number" ? data : 0;
}

export async function uploadReplyPhoto(uid: string, deliveryId: number, file: File): Promise<string> {
  const cleaned = await stripExifAndCompress(file);
  const path = `${uid}/reply-${deliveryId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from("answers")
    .upload(path, cleaned, { upsert: true, contentType: cleaned.type });
  if (error) throw error;
  return path;
}

/** Q&A rows for unlock card (S1–S3 only; S4 is lifestyle chip). */
export function qaFromIntroAnswers(
  introAnswers: { version?: number; self?: string[]; answers?: string[] } | null | undefined,
): { q: string; a: string }[] {
  const list = introAnswers?.self ?? introAnswers?.answers;
  if (!list) return [];
  return PROFILE_QUESTIONS.map((q, i) => ({ q: q.q, a: list[i] ?? "" })).filter((x) => x.a.trim());
}

export type ParsedIntroAnswers = {
  self: [string, string, string, string];
  ideal: IdealInput;
};

/** Normalize v1 `{answers}` or v2 `{self,ideal}` for edit UI. */
export function parseIntroAnswers(raw: unknown): ParsedIntroAnswers {
  const empty: ParsedIntroAnswers = {
    self: ["", "", "", ""],
    ideal: { vibes: [], pace: "" },
  };
  if (!raw || typeof raw !== "object") return empty;
  const o = raw as {
    version?: number;
    self?: string[];
    answers?: string[];
    ideal?: { vibes?: string[]; pace?: string };
  };
  if (o.version === 2 || Array.isArray(o.self)) {
    const s = o.self ?? [];
    return {
      self: [s[0] ?? "", s[1] ?? "", s[2] ?? "", s[3] ?? ""],
      ideal: {
        vibes: Array.isArray(o.ideal?.vibes) ? o.ideal!.vibes!.filter(Boolean).slice(0, 2) : [],
        pace: typeof o.ideal?.pace === "string" ? o.ideal.pace : "",
      },
    };
  }
  const a = o.answers ?? [];
  return {
    self: [a[0] ?? "", a[1] ?? "", a[2] ?? "", ""],
    ideal: { vibes: [], pace: "" },
  };
}

/** Remaining AI regenerations today (0–2). */
export function remainingRegenToday(
  regenDate: string | null | undefined,
  regenCount: number | null | undefined,
  cap = 2,
): number {
  const today = new Date().toISOString().slice(0, 10);
  if (regenDate !== today) return cap;
  return Math.max(0, cap - (regenCount ?? 0));
}
