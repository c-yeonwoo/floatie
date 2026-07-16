import { cn } from "@/lib/utils";
import { BottleGlyph } from "./bottle-glyph";

// Full-bleed sea header — a bottle drifting on a pastel-aqua sunset sea, with
// wave layers that flow continuously left-to-right. Sets a warm, unserious
// first impression. Fixed illustration colors so it reads the same in both themes.
export function SeaBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn("relative w-full overflow-hidden", className)}
      style={{ background: "linear-gradient(180deg,#dceef0 0%,#93cfc7 55%,#54b7ae 100%)" }}
    >
      {/* sunset glow */}
      <div
        className="pointer-events-none absolute right-[16%] top-[20%] size-11 rounded-full"
        style={{ background: "radial-gradient(circle,#ffe3cf,#ffb69e 72%)", filter: "blur(2px)", opacity: 0.9 }}
      />
      {/* drifting bottle */}
      <div className="relative flex h-full items-center justify-center pb-6">
        <BottleGlyph className="w-14 animate-floatie-bob" />
      </div>
      {/* continuously flowing waves (two parallax layers) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 overflow-hidden">
        <svg
          className="absolute bottom-0 left-0 h-full w-[200%] animate-wave-flow"
          viewBox="0 0 800 60"
          preserveAspectRatio="none"
          fill="#ffffff"
          aria-hidden="true"
        >
          <path d="M0 34 Q100 16 200 34 T400 34 T600 34 T800 34 V60 H0Z" opacity="0.12" />
        </svg>
        <svg
          className="absolute bottom-0 left-0 h-full w-[200%] animate-wave-flow-slow"
          viewBox="0 0 800 60"
          preserveAspectRatio="none"
          fill="#ffffff"
          aria-hidden="true"
        >
          <path d="M0 44 Q100 28 200 44 T400 44 T600 44 T800 44 V60 H0Z" opacity="0.18" />
        </svg>
      </div>
    </div>
  );
}
