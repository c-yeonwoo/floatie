/** User-facing sanitizers — never leak internal/QA seed strings. */

const INTERNAL_MISSION =
  /^(ui병|e2e|smoke|test|스모크|테스트)\b/i;
const INTERNAL_MISSION_LOOSE =
  /\b(ui병\s*\d+|e2e[. ]|smoke\s*test)\b/i;

/** Hide QA / placeholder tags from unlock cards. */
const BLOCKED_TAG = /^(#?(qa|e2e|test|테스트|스모크))$/i;

export function displayMissionText(raw: string | null | undefined, fallback = "플로티"): string {
  const t = (raw ?? "").trim();
  if (!t) return fallback;
  if (INTERNAL_MISSION.test(t) || INTERNAL_MISSION_LOOSE.test(t)) return fallback;
  return t;
}

export function displayReplyText(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  if (INTERNAL_MISSION.test(t) || /스모크\s*답장/i.test(t)) {
    return "답장이 도착했어요.";
  }
  return t;
}

export function displayPublicTags(tags: string[] | null | undefined): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => String(t).trim())
    .filter((t) => t.length > 0 && !BLOCKED_TAG.test(t.replace(/\s/g, "")));
}
