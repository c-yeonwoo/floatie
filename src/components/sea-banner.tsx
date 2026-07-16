import { cn } from "@/lib/utils";
import { BottleGlyph } from "./bottle-glyph";

// Airy sea hero — the drifting bottle on a pastel-aqua sea at sunset.
// Reused on login (and available for splash / onboarding) to set a warm,
// unserious first impression. Colors are fixed illustration values so the
// banner reads the same in light and dark.
export function SeaBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.75rem] shadow-[var(--shadow-md)]",
        className,
      )}
      style={{ background: "linear-gradient(180deg,#dceef0 0%,#93cfc7 58%,#54b7ae 100%)" }}
    >
      {/* sunset glow */}
      <div
        className="pointer-events-none absolute right-[15%] top-[18%] size-12 rounded-full"
        style={{ background: "radial-gradient(circle,#ffe3cf,#ffb69e 72%)", filter: "blur(2px)", opacity: 0.9 }}
      />
      {/* soft wave layers */}
      <svg
        className="pointer-events-none absolute inset-x-0 bottom-0 w-full"
        viewBox="0 0 400 70"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden="true"
      >
        <path d="M0 34 Q50 20 100 34 T200 34 T300 34 T400 34 V70 H0Z" fill="#ffffff" opacity="0.12" />
        <path d="M0 48 Q50 36 100 48 T200 48 T300 48 T400 48 V70 H0Z" fill="#ffffff" opacity="0.16" />
      </svg>
      <div className="relative flex items-center justify-center py-9">
        <BottleGlyph
          className="w-14 animate-floatie-bob"
          // soft cast shadow under the bottle
        />
      </div>
    </div>
  );
}
