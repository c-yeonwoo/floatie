import { useEffect, useRef } from "react";
import { BottleGlyph } from "@/components/bottle-glyph";
import {
  ensureDriftBody,
  nudgeDriftHeadings,
  stepBottleDrift,
  type DriftBody,
} from "@/lib/bottle-drift";
import { bottlePos } from "@/lib/sea";

export type DriftBottleItem = {
  id: number;
  glow?: boolean;
  timer?: string | null;
  onTap: () => void;
  ariaLabel: string;
};

/**
 * Sea bottles with slow random drift + light mutual repulsion.
 * Positions update via DOM (no React re-render per frame).
 */
export function DriftingBottles({ items }: { items: DriftBottleItem[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const bodiesRef = useRef(new Map<number, DriftBody>());
  const elsRef = useRef(new Map<number, HTMLButtonElement>());
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const idsKey = items.map((i) => i.id).join(",");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const syncBodies = () => {
      const ids = new Set(itemsRef.current.map((i) => i.id));
      for (const id of [...bodiesRef.current.keys()]) {
        if (!ids.has(id)) bodiesRef.current.delete(id);
      }
      const w = root.clientWidth || 360;
      const h = root.clientHeight || 640;
      for (const item of itemsRef.current) {
        ensureDriftBody(bodiesRef.current, item.id, w, h);
        const el = elsRef.current.get(item.id);
        const b = bodiesRef.current.get(item.id);
        if (!el) continue;
        if (reduced) {
          const pos = bottlePos(item.id);
          el.style.left = pos.left;
          el.style.top = pos.top;
        } else if (b) {
          el.style.left = `${b.x}px`;
          el.style.top = `${b.y}px`;
        }
      }
    };
    syncBodies();

    if (reduced) return;

    let raf = 0;
    let last = performance.now();
    let lastNudge = -1;
    const tick = (now: number) => {
      const dt = Math.min(0.048, (now - last) / 1000);
      last = now;
      const list = [...bodiesRef.current.values()];
      stepBottleDrift(list, root.clientWidth, root.clientHeight, dt);
      const bucket = Math.floor(now / 5000);
      if (bucket !== lastNudge) {
        lastNudge = bucket;
        nudgeDriftHeadings(list, bucket);
      }
      for (const b of list) {
        const el = elsRef.current.get(b.id);
        if (!el) continue;
        el.style.left = `${b.x}px`;
        el.style.top = `${b.y}px`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [idsKey]);

  return (
    <div className="fl-bottles" ref={rootRef}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={"fl-bottle" + (item.glow ? " glow" : "")}
          ref={(el) => {
            if (el) elsRef.current.set(item.id, el);
            else elsRef.current.delete(item.id);
          }}
          onClick={item.onTap}
          aria-label={item.ariaLabel}
        >
          <span
            className="fl-bottle-bob"
            style={{ animationDelay: `${-(item.id % 5) * 0.8}s` }}
          >
            <BottleGlyph state="drift" className="w-full h-auto" />
            {item.timer && <span className="fl-bottle-timer">{item.timer}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
