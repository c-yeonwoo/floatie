/**
 * Sea waves — the exact smooth, continuously-flowing wave the login banner uses
 * (SeaBanner: a quadratic Q-curve with T reflections), layered down the
 * full-screen sea. Two flow speeds give parallax; opacity + amplitude grow
 * toward the bottom for depth. Period 200 → tiles seamlessly under the
 * translateX(-50%) loop (animate-wave-flow / -slow, defined in styles.css).
 */

type Layer = { top: string; h: number; b: number; a: number; op: number; slow: boolean };

const LAYERS: Layer[] = [
  { top: "12%", h: 640, b: 26, a: 12, op: 0.06, slow: true },
  { top: "24%", h: 560, b: 28, a: 14, op: 0.08, slow: false },
  { top: "37%", h: 470, b: 30, a: 16, op: 0.1, slow: true },
  { top: "50%", h: 380, b: 32, a: 18, op: 0.12, slow: false },
  { top: "64%", h: 290, b: 34, a: 21, op: 0.15, slow: true },
  { top: "78%", h: 210, b: 40, a: 25, op: 0.18, slow: false },
];

// smooth quadratic wave (login-banner shape): baseline b, crest up by a, period 200
function wavePath(b: number, a: number, h: number): string {
  return `M0 ${b} Q100 ${b - a} 200 ${b} T400 ${b} T600 ${b} T800 ${b} V${h} H0Z`;
}

export function SeaWaves() {
  return (
    <div className="fl-sea" aria-hidden>
      {LAYERS.map((w, i) => (
        <div
          key={i}
          className={"fl-wave " + (w.slow ? "animate-wave-flow-slow" : "animate-wave-flow")}
          style={{ top: w.top, height: w.h, animationDelay: `${-i * 1.5}s` }}
        >
          <svg viewBox={`0 0 800 ${w.h}`} preserveAspectRatio="none">
            <path d={wavePath(w.b, w.a, w.h)} fill="#ffffff" opacity={w.op} />
          </svg>
        </div>
      ))}
    </div>
  );
}
