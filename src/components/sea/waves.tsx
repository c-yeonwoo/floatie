/**
 * Layered ocean waves — the redesign's ambient background.
 *
 * Each crest is trochoidal-ish (`sin θ − 0.24·sin 2θ`) so peaks are sharper and
 * troughs flatter, like real swell — not a flat horizontal band. Two harmonics
 * per layer give an organic crest; amplitude + opacity grow toward the bottom
 * (perspective/foreground). All harmonics are integer multiples of a base
 * period (400) so the pattern tiles seamlessly under the translateX(-50%) loop.
 */

type Comp = [k: number, amp: number, ph: number];
type Layer = { top: string; h: number; comps: Comp[]; op: number; dur: number };

const LAYERS: Layer[] = [
  { top: "10%", h: 160, comps: [[2, 10, 0.0], [5, 4, 1.1]], op: 0.05, dur: 30 },
  { top: "23%", h: 180, comps: [[3, 13, 1.2], [6, 4.5, 2.0]], op: 0.07, dur: 26 },
  { top: "37%", h: 205, comps: [[2, 16, 2.1], [5, 6.5, 0.4]], op: 0.09, dur: 22 },
  { top: "51%", h: 230, comps: [[3, 19, 0.7], [7, 6.5, 3.0]], op: 0.115, dur: 18 },
  { top: "65%", h: 260, comps: [[2, 25, 2.6], [4, 10, 1.5]], op: 0.14, dur: 15 },
  { top: "79%", h: 300, comps: [[3, 31, 1.9], [6, 11, 0.9]], op: 0.17, dur: 12 },
];

function bandPath(comps: Comp[], h: number): string {
  const totalAmp = comps.reduce((s, c) => s + c[1], 0);
  const baseY = totalAmp * 1.28 + 6;
  const step = 6;
  const yy = (x: number) => {
    const t = (6.28318 * x) / 400;
    let y = baseY;
    for (const [k, amp, ph] of comps) {
      const th = k * t + ph;
      y += amp * (Math.sin(th) - 0.24 * Math.sin(2 * th));
    }
    return y.toFixed(1);
  };
  let d = `M0 ${yy(0)}`;
  for (let x = step; x <= 800; x += step) d += ` L${x} ${yy(x)}`;
  return `${d} L800 ${h} L0 ${h} Z`;
}

// paths are deterministic → compute once at module load
const PATHS = LAYERS.map((w) => ({ ...w, d: bandPath(w.comps, w.h) }));

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
