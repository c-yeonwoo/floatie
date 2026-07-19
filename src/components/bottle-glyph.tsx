// Floatie's brand mascot — a message-in-a-bottle. Reused across empty states,
// the drift/waiting screen, and unlock moments so the tone stays consistent.
// `drift` = corked & floating (anonymous/waiting); `open` = uncorked, note out.

type BottleGlyphProps = {
  state?: "drift" | "open";
  className?: string;
};

export function BottleGlyph({ state = "drift", className }: BottleGlyphProps) {
  return (
    <svg viewBox="0 0 66 132" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="floatie-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d3ede7" />
          <stop offset="1" stopColor="#67beb3" />
        </linearGradient>
      </defs>

      {state === "open" ? (
        <>
          <rect x="12" y="34" width="42" height="88" rx="18" fill="#eaf6f1" opacity="0.92" />
          <rect x="12" y="34" width="42" height="88" rx="18" fill="url(#floatie-glass)" opacity="0.5" />
          <rect x="26" y="14" width="14" height="24" rx="4" fill="#eaf6f1" opacity="0.92" />
          <rect x="22" y="0" width="18" height="9" rx="3" fill="#d99a5b" transform="rotate(18 31 4)" />
          <path d="M18 92 L33 44 L48 92 Z" fill="#fbf3df" stroke="#ecd8ab" strokeWidth="1.5" />
          <line x1="27" y1="76" x2="39" y2="76" stroke="#cbb488" strokeWidth="2" />
          <line x1="25" y1="84" x2="41" y2="84" stroke="#cbb488" strokeWidth="2" />
          <path
            fill="#ff9d7e"
            d="M33 46.2c-4.2-2.9-6.4-6.2-4.3-8.7 1.8-2.1 3.6-1.1 4.3.9.7-2 2.5-3 4.3-.9 2.1 2.5-.1 5.8-4.3 8.7z"
          />
        </>
      ) : (
        <>
          <rect x="12" y="30" width="42" height="92" rx="18" fill="#eaf6f1" opacity="0.92" />
          <rect x="12" y="30" width="42" height="92" rx="18" fill="url(#floatie-glass)" opacity="0.5" />
          <rect x="26" y="8" width="14" height="26" rx="4" fill="#eaf6f1" opacity="0.92" />
          <rect x="24" y="2" width="18" height="9" rx="3" fill="#d99a5b" />
          <rect x="20" y="60" width="26" height="40" rx="3" fill="#fbf3df" />
          <line x1="24" y1="70" x2="42" y2="70" stroke="#cbb488" strokeWidth="2" />
          <line x1="24" y1="78" x2="42" y2="78" stroke="#cbb488" strokeWidth="2" />
          <line x1="24" y1="86" x2="37" y2="86" stroke="#cbb488" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}
