/** Profile interview v2 chip catalogues (code fallback; app_config seed for admin later). */

export const JOB_CHIPS = ["직장인", "학생", "프리랜서", "창업", "기타"] as const;
export const SMOKE_CHIPS = ["안 함", "가끔", "함", "비공개"] as const;
export const WEEKEND_CHIPS = [
  "집에서 충전",
  "나가서 충전",
  "사람 만나며",
  "혼자만의 시간",
  "그때그때 달라요",
] as const;
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

export const S4_QUESTION = "주말에 에너지를 어디서 채워요?";
export const I1_QUESTION = "끌리는 사람의 분위기는?";
export const I2_QUESTION = "같이 있으면 좋은 리듬은?";

export type SmokeChip = (typeof SMOKE_CHIPS)[number];
export type JobChip = (typeof JOB_CHIPS)[number];

export type IntroAnswersV2 = {
  version: 2;
  self: string[]; // [s1, s2, s3, s4_chip]
  ideal: { vibes: string[]; pace: string };
  facts: { job_chip: string; smoke: string };
};

export function smokeLabel(smoke: string | null | undefined): string | null {
  if (!smoke || smoke === "비공개") return null;
  return smoke;
}
