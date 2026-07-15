type BottleDriftSceneProps = {
  missionBody?: string;
  phase?: "drifting" | "accepted" | "replied" | "expired";
  countdown?: string | null;
  className?: string;
};

/** Floatie sea drift — draft visual; full redesign later. */
export function BottleDriftScene({
  missionBody,
  phase = "drifting",
  countdown,
  className = "",
}: BottleDriftSceneProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl bottle-sea-scene ${className}`}
      aria-hidden={!missionBody}
    >
      <div className="bottle-sea-sky" />
      <div className="bottle-sea-horizon" />
      <div className="bottle-sea-wave bottle-sea-wave--back" />
      <div className="bottle-sea-wave bottle-sea-wave--front" />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-[280px] px-6 py-10">
        <div className={`bottle-drift-float ${phase === "drifting" ? "bottle-drift-float--active" : ""}`}>
          <div className="bottle-drift-bottle">
            <div className="bottle-drift-neck" />
            <div className="bottle-drift-glass">
              {missionBody && (
                <p className="bottle-drift-scroll font-serif text-[11px] leading-snug line-clamp-4">
                  {missionBody}
                </p>
              )}
            </div>
          </div>
          <div className="bottle-drift-ripple" />
        </div>

        {countdown && phase === "accepted" && (
          <p className="mt-6 text-xs tabular-nums text-white/90 tracking-wide">{countdown}</p>
        )}
      </div>
    </div>
  );
}
