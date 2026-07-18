/** Storybook-style AI intro: ## heading + body chapters. */

export type IntroSection = { heading: string; body: string };

const FALLBACK_HEADINGS = ["평소의 나", "요즘의 나", "함께할 때"];

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
