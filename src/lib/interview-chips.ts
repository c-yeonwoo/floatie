/** Profile interview v2 chip catalogues (code fallback; app_config seed for admin later). */

export const PROFILE_REGIONS = ["서울", "경기", "인천", "부산", "대구", "대전", "광주", "기타"] as const;
export const NICK_MAX = 12;
export const INTRO_MAX = 480;
export const IDEAL_LINE_MAX = 160;
export const HEIGHT_MIN = 120;
export const HEIGHT_MAX = 230;

export const JOB_CHIPS = ["직장인", "전문직", "학생", "프리랜서", "창업", "기타"] as const;
export const SMOKE_CHIPS = ["안 함", "가끔", "함"] as const;
export const DRINK_CHIPS = ["안 마심", "가끔", "자주"] as const;
export const TATTOO_CHIPS = ["없어요", "있어요"] as const;

/** S4 — dating / relationship value (replaces old weekend-energy chips). */
export const LOVE_VIEW_CHIPS = [
  "천천히 깊게",
  "편하고 즐겁게",
  "서로 성장",
  "자주 연락하며",
  "아직 모르겠어요",
] as const;

/** Legacy S4 options — still shown if stored on an older profile. */
export const WEEKEND_CHIPS_LEGACY = [
  "집에서 충전",
  "나가서 충전",
  "사람 만나며",
  "혼자만의 시간",
  "그때그때 달라요",
] as const;

/** @deprecated use LOVE_VIEW_CHIPS — kept so old imports don't break mid-refactor */
export const WEEKEND_CHIPS = LOVE_VIEW_CHIPS;

export const VIBE_CHIPS = [
  "잔잔한",
  "유머 있는",
  "진지한",
  "따뜻한",
  "솔직한",
  "여유로운",
  "호기심 많은",
] as const;
export const PACE_CHIPS = [
  "천천히 알아가기",
  "자주 연락",
  "주말 위주",
  "즉흥 만남",
  "아직 모르겠어요",
] as const;

export const S4_QUESTION = "연애에서 더 가까운 쪽은?";
export const I1_QUESTION = "끌리는 사람의 분위기는?";
export const I2_QUESTION = "같이 있으면 좋은 리듬은?";

export type SmokeChip = (typeof SMOKE_CHIPS)[number];
export type JobChip = (typeof JOB_CHIPS)[number];

export type IntroAnswersV2 = {
  version: 2;
  self: string[]; // [s1, s2, s3, s4_chip]
  ideal: { vibes: string[]; pace: string };
  facts: { job_chip: string; smoke: string; drink?: string; tattoo?: string };
};

/** S4 chip list for UI — current options + legacy value if still selected. */
export function s4ChipOptions(selected?: string | null): string[] {
  const base = [...LOVE_VIEW_CHIPS] as string[];
  if (selected && !base.includes(selected) && (WEEKEND_CHIPS_LEGACY as readonly string[]).includes(selected)) {
    base.push(selected);
  }
  return base;
}

export function smokeLabel(smoke: string | null | undefined): string | null {
  if (!smoke || smoke === "비공개") return null;
  return `흡연 ${smoke}`;
}

export function drinkLabel(drink: string | null | undefined): string | null {
  if (!drink) return null;
  return `음주 ${drink}`;
}

export function tattooLabel(tattoo: string | null | undefined): string | null {
  if (!tattoo) return null;
  return tattoo === "있어요" ? "타투 있어요" : "타투 없어요";
}

export function parseHeightCm(raw: string): number | null {
  if (!/^\d{3}$/.test(raw.trim())) return null;
  const n = +raw.trim();
  if (n < HEIGHT_MIN || n > HEIGHT_MAX) return null;
  return n;
}

export function profileMetaLine(p: {
  height_cm?: number | null;
  job_chip?: string | null;
  smoke?: string | null;
  drink?: string | null;
  tattoo?: string | null;
}): string {
  return [
    p.height_cm ? `${p.height_cm}cm` : null,
    p.job_chip || null,
    smokeLabel(p.smoke),
    drinkLabel(p.drink),
    tattooLabel(p.tattoo),
  ]
    .filter(Boolean)
    .join(" · ");
}
