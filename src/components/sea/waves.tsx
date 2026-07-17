/**
 * Soft rolling sea waves — the redesign's ambient background.
 * Period-400 harmonic crests (1st/2nd/3rd) so the line undulates irregularly
 * and still tiles seamlessly under the horizontal translateX(-50%) loop.
 */

type Layer = { top: string; h: number; k: number; amp: number; op: number; dur: number; ph: number };

const LAYERS: Layer[] = [
  { top: "20%", h: 130, k: 1, amp: 12, op: 0.05, dur: 26, ph: 0 },
  { top: "38%", h: 140, k: 2, amp: 14, op: 0.07, dur: 22, ph: 1.2 },
  { top: "55%", h: 160, k: 1, amp: 18, op: 0.09, dur: 18, ph: 2.1 },
  { top: "70%", h: 180, k: 2, amp: 22, op: 0.12, dur: 15, ph: 0.7 },
  { top: "82%", h: 200, k: 1, amp: 26, op: 0.16, dur: 12, ph: 2.6 },
];

function bandPath(k: number, amp: number, h: number, ph: number): string {
  const baseY = amp * 1.1 + 6;
  const step = 8;
  const yy = (x: number) => {
    const t = (6.28318 * x) / 400;
    return (
      baseY +
      amp *
        (0.52 * Math.sin(k * t + ph) +
          0.32 * Math.sin(2 * k * t + ph * 1.6 + 0.9) +
          0.19 * Math.sin(3 * k * t + ph * 0.7 + 2.3))
    ).toFixed(1);
  };
  let d = `M0 ${yy(0)}`;
  for (let x = step; x <= 800; x += step) d += ` L${x} ${yy(x)}`;
  return `${d} L800 ${h} L0 ${h} Z`;
}

// paths are deterministic → compute once at module load
const PATHS = LAYERS.map((w) => ({ ...w, d: bandPath(w.k, w.amp, w.h, w.ph) }));

export function SeaWaves() {
  return (
    <div className="fl-sea" aria-hidden>
      {PATHS.map((w, i) => (
        <div
          key={i}
          className="fl-wave"
          style={{
            top: w.top,
            height: w.h,
            animation: `fl-flow ${w.dur}s linear infinite`,
            animationDelay: `${-i * 2.4}s`,
          }}
        >
          <svg viewBox={`0 0 800 ${w.h}`} preserveAspectRatio="none">
            <path d={w.d} fill="#ffffff" opacity={w.op} />
          </svg>
        </div>
      ))}
    </div>
  );
}
