import { supabase } from "@/integrations/supabase/client";
import { stripExifAndCompress } from "@/lib/image-utils";

/** The 3 interview questions whose answers feed the AI intro. */
export const PROFILE_QUESTIONS: { q: string; ph: string }[] = [
  { q: "가장 마음이 편해지는 순간은?", ph: "예: 밤에 파도 소리 틀어놓고 멍 때릴 때" },
  { q: "요즘 빠져 있는 건 뭐예요?", ph: "예: 주말 클라이밍, 필름 카메라" },
  { q: "어떤 대화를 좋아해요?", ph: "예: 침묵도 어색하지 않은, 결이 맞는 대화" },
];

export type ProfileDraft = { intro: string; tags: string[] };

const TAG_WORDS: [string, string][] = [
  ["바다", "#바다"], ["파도", "#바다"], ["책", "#독서"], ["독서", "#독서"],
  ["영화", "#영화"], ["러닝", "#러닝"], ["달리", "#러닝"], ["등산", "#등산"],
  ["클라이밍", "#클라이밍"], ["음악", "#음악"], ["노래", "#음악"], ["커피", "#커피"],
  ["카페", "#카페"], ["여행", "#여행"], ["요리", "#요리"], ["사진", "#필름사진"],
  ["카메라", "#필름사진"], ["강아지", "#강아지"], ["고양이", "#고양이"], ["게임", "#게임"],
  ["산책", "#산책"], ["운동", "#운동"],
];

/** Deterministic fallback used when the AI edge function is unavailable. */
function templateDraft(answers: string[]): ProfileDraft {
  const clip = (s: string) => s.trim().replace(/[.。!?~\s]+$/, "");
  const [a0, a1, a2] = answers.map(clip);
  const parts: string[] = [];
  if (a0) parts.push(`${a0}, 그때 가장 마음이 편해지는 사람이에요`);
  if (a1) parts.push(`요즘은 ${a1}에 마음이 가 있어요`);
  if (a2) parts.push(`${a2}, 그런 대화를 좋아해요`);
  const intro = parts.length ? parts.join(". ") + "." : "";
  const text = answers.join(" ");
  const found: string[] = [];
  for (const [w, t] of TAG_WORDS) if (text.includes(w) && !found.includes(t)) found.push(t);
  for (const d of ["#잔잔함", "#대화", "#여운"]) if (found.length < 3 && !found.includes(d)) found.push(d);
  return { intro, tags: found.slice(0, 6) };
}

/**
 * Generate an AI profile draft from the interview answers.
 * Tries the `generate-profile` Edge Function (Claude); falls back to a
 * deterministic local template so onboarding always works.
 */
export async function generateProfileDraft(answers: string[]): Promise<ProfileDraft> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-profile", {
      body: { answers },
    });
    if (!error && data && typeof data.intro === "string" && Array.isArray(data.tags)) {
      return { intro: data.intro, tags: data.tags.slice(0, 6) };
    }
  } catch {
    /* fall through to template */
  }
  return templateDraft(answers);
}

/** Strip EXIF, compress, upload to the shared `answers` bucket; return its path. */
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
  photos: string[]; // storage paths
  answers: string[];
  intro: string;
  tags: string[];
};

/** Persist the finished profile and mark onboarded. */
export async function saveOnboarding(uid: string, d: OnboardingData): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("profiles")
    .update({
      display_name: d.displayName.trim(),
      gender: d.gender,
      birth_year: d.birthYear,
      region: d.region,
      photos: d.photos,
      avatar_url: d.photos[0] ?? null,
      intro_answers: { answers: d.answers },
      ai_intro: d.intro,
      ai_tags: d.tags,
      bio: d.intro, // keep bio in sync for legacy unlock views
      onboarded: true,
      last_active_at: new Date().toISOString(),
    })
    .eq("id", uid);
  if (error) throw error;
}

/** Save a re-generated intro/tags under the server-enforced 2/day cap.
 *  Returns regenerations remaining today. */
export async function regenerateIntro(intro: string, tags: string[]): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("regenerate_intro", {
    p_intro: intro,
    p_tags: tags,
  });
  if (error) throw error;
  return typeof data === "number" ? data : 0;
}

/** Upload a man's reply photo to the `answers` bucket; return its path. */
export async function uploadReplyPhoto(uid: string, deliveryId: number, file: File): Promise<string> {
  const cleaned = await stripExifAndCompress(file);
  const path = `${uid}/reply-${deliveryId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from("answers")
    .upload(path, cleaned, { upsert: true, contentType: cleaned.type });
  if (error) throw error;
  return path;
}
