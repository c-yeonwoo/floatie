import type { MissionDelivery } from "./mission";

export type FloatieState =
  | "drift" // sent, still floating (no reply yet)
  | "replied" // a reply arrived, awaiting my "마음에 들어요"
  | "opened" // mutual OK — profiles unlocked, not matched yet
  | "match" // matched (thread exists)
  | "arrived" // (man) discovered, not yet answered
  | "answered" // (man) I replied, awaiting their like
  | "expired"
  | "done";

/** State of one of MY sent floaties (woman / sender). */
export function womanState(d: MissionDelivery): FloatieState {
  // start_match sets status=closed while unlocked_at stays set
  if (d.unlocked_at && d.status === "closed") return "match";
  if (d.unlocked_at) return "opened";
  if (d.status === "closed") return "done";
  if (d.reply_body && d.sender_verdict === "pending") return "replied";
  if (d.status === "expired") return "expired";
  return "drift";
}

/** State of a floatie I RECEIVED (man / receiver). */
export function manState(d: MissionDelivery): FloatieState {
  if (d.unlocked_at && d.status === "closed") return "match";
  if (d.unlocked_at) return "opened";
  if (d.status === "closed") return "done";
  if (d.reply_body) return "answered";
  if (d.status === "expired") return "expired";
  return "arrived";
}

export function isGlow(s: FloatieState): boolean {
  return s === "replied" || s === "arrived";
}

/** History status pill (class suffix + label). */
export function stateLabel(s: FloatieState): { c: string; t: string } {
  switch (s) {
    case "drift": return { c: "drift", t: "표류 중" };
    case "replied": return { c: "reply", t: "답장 도착" };
    case "answered": return { c: "reply", t: "답장 보냄" };
    case "opened": return { c: "open", t: "프로필 열림" };
    case "match": return { c: "match", t: "매칭됨" };
    case "arrived": return { c: "drift", t: "발견" };
    case "expired": return { c: "done", t: "표류 끝" };
    default: return { c: "done", t: "종료" };
  }
}

/** Deterministic pseudo-random bottle position within the sea band. */
export function bottlePos(id: number): { left: string; top: string } {
  const h1 = (id * 2654435761) >>> 0;
  const h2 = ((id * 40503 + 12345) >>> 0) ^ (h1 >>> 3);
  const left = 7 + (h1 % 76); // percent
  const top = 210 + (h2 % 310); // px from top of the sea
  return { left: `${left}%`, top: `${top}px` };
}

export const MISSION_PRESETS_FALLBACK = [
  "지금 뭐하고 있어요?",
  "요즘 마음이 가장 편해지는 순간은?",
  "사람의 어떤 점에 마음이 기울어요?",
  "혼자인 시간, 뭘 하며 채워요?",
  "여행이면 계획파 vs 즉흥파?",
];
