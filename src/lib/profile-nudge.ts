import { parseIntroAnswers } from "@/lib/profile-ai";
import { hasRequiredPhotos } from "@/lib/profile-photos";

export type ProfileNudgeInput = {
  photos?: string[] | null;
  ai_intro?: string | null;
  ai_ideal_line?: string | null;
  intro_answers?: unknown;
};

export type ProfileNudge = {
  /** Short headline under the empty-sea title */
  body: string;
  cta: string;
  href: "/me/edit";
  kind: "photos" | "intro" | "ideal" | "interview";
};

/**
 * Pick the weakest profile gap for empty-sea retention.
 * Priority: photos → AI intro → ideal line → interview answers.
 */
export function getProfileNudge(p: ProfileNudgeInput | null | undefined): ProfileNudge | null {
  if (!p) return null;

  if (!hasRequiredPhotos(p.photos)) {
    return {
      kind: "photos",
      body: "프로필 사진 3장이 필요해요. 얼굴을 올리면 마음이 더 잘 닿아요.",
      cta: "사진 올리기",
      href: "/me/edit",
    };
  }

  if (!p.ai_intro?.trim()) {
    return {
      kind: "intro",
      body: "소개 글이 비어 있어요. 한 줄만 있어도 분위기가 달라져요.",
      cta: "소개 보완하기",
      href: "/me/edit",
    };
  }

  if (!p.ai_ideal_line?.trim()) {
    return {
      kind: "ideal",
      body: "이런 사람이에요 한 줄이 없어요. 취향을 알려줄래요?",
      cta: "이상형 한 줄 쓰기",
      href: "/me/edit",
    };
  }

  const parsed = parseIntroAnswers(p.intro_answers);
  const selfFilled = (parsed.self ?? []).filter((s) => String(s).trim().length > 0).length;
  const hasIdeal =
    (parsed.ideal.vibes?.length ?? 0) > 0 || Boolean(parsed.ideal.pace?.trim());
  if (selfFilled < 3 || !hasIdeal) {
    return {
      kind: "interview",
      body: "인터뷰 답이 조금 얇아요. 다듬어 두면 프로필이 살아나요.",
      cta: "인터뷰 다듬기",
      href: "/me/edit",
    };
  }

  return null;
}
