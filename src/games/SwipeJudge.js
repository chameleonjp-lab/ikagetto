// Judges a finger stroke against the guide line or circle drawn on screen.
// All coordinates are canvas pixels. Shared by the butcher and cooking games.
//
// Line: the stroke is projected onto the guide (a -> b).
//   reverse  - moved against the arrow (only when the direction matters)
//   off      - stroke strays too far sideways from the line
//   short    - covers too little of the line
//   over     - runs far past either end of the line ("cut too much")
// Circle: the stroke's distance from the centre is compared with the radius.

// Messages are the Japanese source strings; translations live in src/i18n/game-messages.js.
export const JUDGE_MESSAGES = {
  off: 'ズレた！線にそってなぞろう',
  short: '短い！線の端までなぞろう',
  over: '切りすぎ！線の先で止めよう',
  reverse: '逆向き！矢印の向きになぞろう',
  circleOff: 'ズレた！円にそって回そう',
  circleShort: '短い！ぐるっと1周なぞろう'
};

const LINE_RULES = {
  minCoverage: 0.6,   // at least 60 % of the line
  maxOvershoot: 0.4,  // may run past an end by up to 40 % of the line length
  maxMeanDev: 0.2,    // average sideways distance, as a share of the line length
  minDevPx: 26,       // ...but never stricter than this many pixels (short lines)
  maxPeakDev: 0.42    // single worst point, as a share of the line length
};

/**
 * @param {{x:number,y:number}[]} pts stroke points, oldest first
 * @param {{x:number,y:number}} a start of the guide line
 * @param {{x:number,y:number}} b end of the guide line (arrow side)
 * @param {{directional?: boolean}} opts
 * @returns {{ok: boolean, reason: string|null, accuracy: number}} accuracy 0..1 (1 = on the line)
 */
export function judgeLine(pts, a, b, { directional = true } = {}) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const L = Math.hypot(dx, dy);
  if (!pts || pts.length < 2 || L < 1) return { ok: false, reason: 'short', accuracy: 0 };
  const ux = dx / L, uy = dy / L;

  const along = (p) => ((p.x - a.x) * ux + (p.y - a.y) * uy) / L;   // 0 at a, 1 at b
  const side = (p) => Math.abs((p.x - a.x) * uy - (p.y - a.y) * ux); // pixels from the line

  let ts = along(pts[0]);
  let te = along(pts[pts.length - 1]);
  if (!directional && te < ts) { const k = ts; ts = te; te = k; }

  let sum = 0, peak = 0;
  for (const p of pts) { const d = side(p); sum += d; peak = Math.max(peak, d); }
  const meanDev = sum / pts.length;
  const devLimit = Math.max(LINE_RULES.minDevPx, L * LINE_RULES.maxMeanDev);
  const accuracy = Math.max(0, Math.min(1, 1 - meanDev / devLimit));

  if (directional && te - ts < -0.15) return { ok: false, reason: 'reverse', accuracy };
  if (meanDev > devLimit || peak > Math.max(LINE_RULES.minDevPx * 1.8, L * LINE_RULES.maxPeakDev)) {
    return { ok: false, reason: 'off', accuracy };
  }
  const lo = Math.min(ts, te), hi = Math.max(ts, te);
  if (lo < -LINE_RULES.maxOvershoot || hi > 1 + LINE_RULES.maxOvershoot) return { ok: false, reason: 'over', accuracy };
  const covered = Math.min(1, hi) - Math.max(0, lo);
  if (covered < LINE_RULES.minCoverage) return { ok: false, reason: 'short', accuracy };
  return { ok: true, reason: null, accuracy };
}

/** Average distance of the stroke from the circle, as a share of the radius (0 = on the circle). */
export function circleDeviation(pts, c, r) {
  if (!pts || pts.length === 0 || r <= 0) return 1;
  let sum = 0;
  for (const p of pts) sum += Math.abs(Math.hypot(p.x - c.x, p.y - c.y) - r);
  return sum / pts.length / r;
}

/** Score ratio for a successful stroke: 0.72 (barely on the line) .. 0.97 (right on it). */
export function scoreRatio(accuracy) {
  return 0.72 + 0.25 * Math.max(0, Math.min(1, accuracy));
}
