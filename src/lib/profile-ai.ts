import { supabase } from "@/integrations/supabase/client";
import { stripExifAndCompress } from "@/lib/image-utils";
import type { IntroAnswersV2 } from "@/lib/interview-chips";

/** S1–S3 free-text questions (S4 is a chip — see interview-chips). */
export const PROFILE_QUESTIONS: { q: string; ph: string }[] = [
  { q: "가장 마음이 편해지는 순간은?", ph: "예: 밤에 파도 소리 틀어놓고 멍 때릴 때" },
  { q: "요즘 빠져 있는 건 뭐예요?", ph: "예: 주말 클라이밍, 필름 카메라" },
  { q: "어떤 대화를 좋아해요?", ph: "예: 침묵도 어색하지 않은, 결이 맞는 대화" },
];

export type ProfileDraft = { intro: string; idealLine: string; tags: string[] };

export type IdealInput = { vibes: string[]; pace: string };

const TAG_WORDS: [string, string][] = [
  ["바다", "#바다"], ["파도", "#바다"], ["책", "#독서"], ["독서", "#독서"],
  ["영화", "#영화"], ["러닝", "#러닝"], ["달리", "#러닝"], ["등산", "#등산"],
  ["클라이밍", "#클라이밍"], ["음악", "#음악"], ["노래", "#음악"], ["커피", "#커피"],
  ["카페", "#카페"], ["여행", "#여행"], ["요리", "#요리"], ["사진", "#필름사진"],
  ["카메라", "#필름사진"], ["강아지", "#강아지"], ["고양이", "#고양이"], ["게임", "#게임"],
  ["산책", "#산책"], ["운동", "#운동"],
];

function templateDraft(answers: string[], ideal?: IdealInput): ProfileDraft {
  const clip = (s: string) => s.trim().replace(/[.。!?~\s]+$/, "");
  const [a0, a1, a2, a3] = answers.map(clip);
  const parts: string[] = [];
  if (a0) parts.push(`${a0}, 그때 가장 마음이 편해지는 사람이에요`);
  if (a1) parts.push(`요즘은 ${a1}에 마음이 가 있어요`);
  if (a2) parts.push(`${a2}, 그런 대화를 좋아해요`);
  if (a3) parts.push(`주말엔 ${a3} 쪽이에요`);
  const intro = parts.length ? parts.join(". ") + "." : "";

  const text = answers.join(" ");
  const found: string[] = [];
  for (const [w, t] of TAG_WORDS) if (text.includes(w) && !found.includes(t)) found.push(t);
  for (const d of ["#잔잔함", "#대화", "#여운"]) if (found.length < 3 && !found.includes(d)) found.push(d);

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
): Promise<ProfileDraft> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-profile", {
      body: { answers, ideal: ideal ?? null },
    });
    if (
      !error &&
      data &&
      typeof data.intro === "string" &&
      Array.isArray(data.tags)
    ) {
      return {
        intro: data.intro,
        idealLine: typeof data.ideal_line === "string" ? data.ideal_line : "",
        tags: data.tags.slice(0, 6),
      };
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
    facts: { job_chip: d.jobChip, smoke: d.smoke },
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
    // supabase.rpc() is Thenable but has no .catch — use try/await
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
