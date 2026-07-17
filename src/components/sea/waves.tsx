/**
 * Sea receding to the horizon. Each BAND is two offset sub-waves (the login
 * banner's doubling: different baseline + flow speed) so crests read as an
 * organic doubled line, never a straight boundary. Perspective: near the top
 * (far) waves are small / dense / faint; toward the bottom (near) big / wide /
 * opaque. Full-height layers all fill to the bottom, so overlaps build depth.
 * Smooth quadratic Q-curve, period ∈ {100,200,400} (÷400) → seamless flow.
 */

type Band = { b: number; a: number; P: number; op: number };

// waterline b (of an 800-tall viewBox), amplitude a, full-cycle period P, opacity
const BANDS: Band[] = [
  { b: 70, a: 5, P: 100, op: 0.045 },
  { b: 120, a: 6, P: 100, op: 0.05 },
  { b: 180, a: 7, P: 200, op: 0.055 },
  { b: 250, a: 9, P: 200, op: 0.065 },
  { b: 330, a: 11, P: 200, op: 0.075 },
  { b: 420, a: 14, P: 400, op: 0.09 },
  { b: 520, a: 18, P: 400, op: 0.105 },
  { b: 630, a: 23, P: 400, op: 0.125 },
  { b: 740, a: 28, P: 400, op: 0.15 },
];

function wave(b: number, a: number, P: number): string {
  const half = P / 2;
  let d = `M0 ${b} Q${half / 2} ${b - a} ${half} ${b}`;
  for (let x = half * 2; x <= 800; x += half) d += ` T${x} ${b}`;
  return d + " V800 H0Z";
}

type Sub = { d: string; op: number; slow: boolean; delay: number };
const SUBS: Sub[] = BANDS.flatMap((bd, i) => [
  { d: wave(bd.b, bd.a, bd.P), op: +(bd.op * 0.62).toFixed(3), slow: true, delay: -i * 1.3 },
  { d: wave(bd.b + 9, bd.a * 0.82, bd.P), op: bd.op, slow: false, delay: -i * 1.3 - 3 },
]);

export function SeaWaves() {
  return (
    <div className="fl-sea" aria-hidden>
      {SUBS.map((s, i) => (
        <div
          key={i}
          className={"fl-wave " + (s.slow ? "animate-wave-flow-slow" : "animate-wave-flow")}
          style={{ top: 0, height: "100%", animationDelay: `${s.delay}s` }}
        >
          <svg viewBox="0 0 800 800" preserveAspectRatio="none">
            <path d={s.d} fill="#ffffff" opacity={s.op} />
          </svg>
        </div>
      ))}
    </div>
  );
}
