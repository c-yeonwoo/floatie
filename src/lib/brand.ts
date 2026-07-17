/** Product brand — KR display / EN store, tab & mascot */
export const BRAND_KO = "플로티";
export const BRAND_EN = "Floatie";

/** Browser tab / document title — EN brand */
export function pageTitle(section?: string): string {
  return section ? `${section} — ${BRAND_EN}` : BRAND_EN;
}
