/** Storybook-style AI intro: ## heading + body chapters. */

export type IntroSection = { heading: string; body: string };

/** Interview-question tone (not stiff section labels). */
const FALLBACK_HEADINGS = [
  "요즘 빠져 있는 건 뭐예요?",
  "쉬는 날은 보통 어떻게 보내요?",
  "주변에서 자주 듣는 말은요?",
];

const LEGACY_HEADING_TO_QUESTION: Record<string, string> = {
  "요즘의 나": "요즘 빠져 있는 건 뭐예요?",
  "평소의 나": "요즘 빠져 있는 건 뭐예요?",
  "쉬는 날": "쉬는 날은 보통 어떻게 보내요?",
  "함께할 때": "주변에서 자주 듣는 말은요?",
  "이런 사람": "주변에서 자주 듣는 말은요?",
};

/** Map stored AI headings → softer interview questions for display. */
export function displayIntroHeading(heading: string): string {
  const h = heading.trim();
  return LEGACY_HEADING_TO_QUESTION[h] ?? h;
}

export function formatIntroSections(sections: IntroSection[]): string {
  return sections
    .filter((s) => s.body.trim())
    .map((s) => {
      const h = s.heading.trim() || "소개";
      return `## ${h}\n${s.body.trim()}`;
    })
    .join("\n\n");
}

export function parseIntroSections(text: string | null | undefined): IntroSection[] {
  if (!text?.trim()) return [];
  const raw = text.trim();

  if (/^##\s/m.test(raw)) {
    return raw
      .split(/^##\s+/m)
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const nl = chunk.indexOf("\n");
        if (nl < 0) return { heading: chunk, body: "" };
        return { heading: chunk.slice(0, nl).trim(), body: chunk.slice(nl + 1).trim() };
      })
      .filter((s) => s.body);
  }

  const paras = raw.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  if (paras.length <= 1) {
    // Section title lives in the overlay — avoid duplicating "이런 사람이에요".
    return [{ heading: "", body: paras[0] ?? raw }];
  }
  return paras.map((body, i) => ({
    heading: FALLBACK_HEADINGS[i] ?? `이야기 ${i + 1}`,
    body,
  }));
}
