/** Slow sea drift + light repulsion for floatie bottles. */

export type DriftBody = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
};

const BOTTLE = 44;
const PAD_X = 14;
const PAD_TOP = 150;
const PAD_BOTTOM = 110;
const MIN_SPEED = 10;
const MAX_SPEED = 22;
const REPEL_DIST = 58;
const REPEL_STRENGTH = 28;

function hash(id: number, salt: number): number {
  return ((id * 2654435761) ^ (salt * 40503)) >>> 0;
}

/** Deterministic start point inside the sea band (px). */
export function seedBottleXY(id: number, width: number, height: number): { x: number; y: number } {
  const h1 = hash(id, 1);
  const h2 = hash(id, 2);
  const usableW = Math.max(1, width - PAD_X * 2 - BOTTLE);
  const usableH = Math.max(1, height - PAD_TOP - PAD_BOTTOM - BOTTLE);
  return {
    x: PAD_X + (h1 % 1000) / 1000 * usableW,
    y: PAD_TOP + (h2 % 1000) / 1000 * usableH,
  };
}

function seedVelocity(id: number): { vx: number; vy: number } {
  const angle = ((hash(id, 7) % 360) * Math.PI) / 180;
  const speed = MIN_SPEED + (hash(id, 9) % 1000) / 1000 * (MAX_SPEED - MIN_SPEED);
  return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
}

export function ensureDriftBody(
  map: Map<number, DriftBody>,
  id: number,
  width: number,
  height: number,
): DriftBody {
  let b = map.get(id);
  if (b) return b;
  const { x, y } = seedBottleXY(id, width, height);
  const { vx, vy } = seedVelocity(id);
  b = { id, x, y, vx, vy };
  map.set(id, b);
  return b;
}

/** Integrate one frame. Mutates bodies in place. `dt` in seconds. */
export function stepBottleDrift(
  bodies: DriftBody[],
  width: number,
  height: number,
  dt: number,
): void {
  if (width < 80 || height < 200 || bodies.length === 0) return;
  const minX = PAD_X;
  const maxX = Math.max(minX, width - PAD_X - BOTTLE);
  const minY = PAD_TOP;
  const maxY = Math.max(minY, height - PAD_BOTTOM - BOTTLE);

  // Soft repulsion (O(n²) — n is tiny: usually ≤5)
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.hypot(dx, dy) || 0.01;
      if (dist >= REPEL_DIST) continue;
      const push = ((REPEL_DIST - dist) / REPEL_DIST) * REPEL_STRENGTH * dt;
      const nx = dx / dist;
      const ny = dy / dist;
      a.vx += nx * push;
      a.vy += ny * push;
      b.vx -= nx * push;
      b.vy -= ny * push;
    }
  }

  for (const b of bodies) {
    // Cap speed after repulsion so they don't dart
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > MAX_SPEED * 1.4) {
      const s = (MAX_SPEED * 1.2) / sp;
      b.vx *= s;
      b.vy *= s;
    } else if (sp < MIN_SPEED * 0.6 && sp > 0) {
      const s = MIN_SPEED / sp;
      b.vx *= s;
      b.vy *= s;
    }

    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (b.x < minX) {
      b.x = minX;
      b.vx = Math.abs(b.vx);
    } else if (b.x > maxX) {
      b.x = maxX;
      b.vx = -Math.abs(b.vx);
    }
    if (b.y < minY) {
      b.y = minY;
      b.vy = Math.abs(b.vy);
    } else if (b.y > maxY) {
      b.y = maxY;
      b.vy = -Math.abs(b.vy);
    }
  }
}

/** Rare heading change so paths don't look robotic. */
export function nudgeDriftHeadings(bodies: DriftBody[], bucket: number): void {
  for (const b of bodies) {
    b.vx += (hash(b.id, bucket) % 7) - 3;
    b.vy += (hash(b.id + 3, bucket) % 7) - 3;
  }
}
