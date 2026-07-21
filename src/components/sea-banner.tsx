import { cn } from "@/lib/utils";
import { BottleGlyph } from "./bottle-glyph";

// Full-bleed sea header — bottle on pastel aqua, peach heart sun (matches app icon).
export function SeaBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn("relative w-full overflow-hidden", className)}
      style={{ background: "linear-gradient(180deg,#dceef0 0%,#93cfc7 55%,#54b7ae 100%)" }}
    >
      {/* peach heart — brand mark aligned with app icon */}
      <svg
        className="pointer-events-none absolute right-[14%] top-[18%] size-12"
        viewBox="0 0 48 48"
        aria-hidden="true"
        style={{ filter: "drop-shadow(0 2px 8px rgba(255,140,100,.35))", opacity: 0.95 }}
      >
        <defs>
          <radialGradient id="fl-banner-heart" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffe3cf" />
            <stop offset="55%" stopColor="#ffb69e" />
            <stop offset="100%" stopColor="#ff9d7e" />
          </radialGradient>
        </defs>
        <path
          fill="url(#fl-banner-heart)"
          d="M24 40c-7.2-5-11-10.6-7.4-14.9 3.1-3.6 6.2-1.9 7.4 1.5 1.2-3.4 4.3-5.1 7.4-1.5C35 29.4 31.2 35 24 40z"
        />
      </svg>
      <div className="relative flex h-full items-center justify-center translate-y-[12%]">
        <BottleGlyph className="w-[4.5rem] animate-floatie-bob sm:w-20" />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 overflow-hidden">
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
