// Shared "cutting feel" and readable canvas text for the butcher / cooking mini-games.
//
//  - drawBladeTrail(): while the finger moves, a tapered glowing blade streak follows it.
//  - addSlash(): on a successful cut, a bright flash along the cut that then splits
//    into two lines drifting apart, with sparks, a short screen shake and a tiny
//    vibration on phones that support it (Android; iOS Safari has no vibration API).
//  - drawOutlinedText(): bold rounded text with a dark outline, readable over 3D scenes.

export const GAME_FONT = '"Hiragino Maru Gothic ProN", "Rounded Mplus 1c", "Noto Sans JP", "Yu Gothic", system-ui, sans-serif';

// Canvas label size that follows the screen width (16-22 px).
export function labelPx(w) {
  return Math.round(Math.max(16, Math.min(22, w * 0.046)));
}

export function setGameFont(ctx, px) {
  ctx.font = `900 ${px}px ${GAME_FONT}`;
}

export function drawOutlinedText(ctx, text, x, y, { size = 17, color = '#ffffff', maxWidth, align = 'center', baseline = 'alphabetic' } = {}) {
  ctx.save();
  setGameFont(ctx, size);
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeStyle = 'rgba(0, 6, 14, 0.9)';
  ctx.lineWidth = Math.max(3, size * 0.34);
  if (maxWidth) ctx.strokeText(text, x, y, maxWidth); else ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  if (maxWidth) ctx.fillText(text, x, y, maxWidth); else ctx.fillText(text, x, y);
  ctx.restore();
}

export function haptic(ms = 15) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {}
}

const SLASH_LIFE = 0.5;

export class SlashFX {
  constructor() {
    this.slashes = [];
    this.rings = [];
    this.sparks = [];
    this.shake = 0;
  }

  clear() {
    this.slashes = [];
    this.rings = [];
    this.sparks = [];
    this.shake = 0;
  }

  // Successful straight cut from (ax, ay) to (bx, by), in canvas pixels.
  addSlash(ax, ay, bx, by, color = '255, 255, 255') {
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 8) return;
    this.slashes.push({ ax, ay, bx, by, life: SLASH_LIFE, color });
    const nx = -(by - ay) / len, ny = (bx - ax) / len;
    for (let i = 0; i < 26; i++) {
      const k = Math.random();
      const side = Math.random() < 0.5 ? -1 : 1;
      const sp = 120 + Math.random() * 260;
      this.sparks.push({
        x: ax + (bx - ax) * k, y: ay + (by - ay) * k,
        vx: nx * side * sp + (Math.random() - 0.5) * 80,
        vy: ny * side * sp + (Math.random() - 0.5) * 80 - 40,
        life: 0.35 + Math.random() * 0.3
      });
    }
    this.shake = Math.max(this.shake, 1);
    haptic(18);
  }

  // Successful round cut (e.g. around the eye).
  addRing(cx, cy, r) {
    this.rings.push({ cx, cy, r, life: SLASH_LIFE });
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 140 + Math.random() * 200;
      this.sparks.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35 + Math.random() * 0.3 });
    }
    this.shake = Math.max(this.shake, 0.8);
    haptic(18);
  }

  // Glowing blade streak along the recent finger points (canvas pixels, oldest first).
  drawBladeTrail(ctx, pts) {
    if (!pts || pts.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const n = pts.length;
    for (let i = 1; i < n; i++) {
      const k = i / (n - 1);              // 0 = oldest, 1 = newest
      ctx.strokeStyle = `rgba(120, 230, 255, ${0.25 + 0.45 * k})`;
      ctx.lineWidth = 4 + 14 * k;
      ctx.beginPath();
      ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
      ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
    for (let i = 1; i < n; i++) {
      const k = i / (n - 1);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 + 0.65 * k})`;
      ctx.lineWidth = 1.5 + 4.5 * k;
      ctx.beginPath();
      ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
      ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Draw and age every effect. Call once per frame after the guide is drawn.
  draw(ctx, dt) {
    this.shake = Math.max(0, this.shake - dt * 5);
    ctx.save();
    ctx.lineCap = 'round';

    this.slashes = this.slashes.filter((s) => (s.life -= dt) > 0);
    for (const s of this.slashes) {
      const t = 1 - s.life / SLASH_LIFE;          // 0 -> 1
      const len = Math.hypot(s.bx - s.ax, s.by - s.ay);
      const nx = -(s.by - s.ay) / len, ny = (s.bx - s.ax) / len;
      if (t < 0.28) {
        // Flash: bright blade line shooting along the cut.
        const k = Math.min(1, t / 0.18);
        const ex = s.ax + (s.bx - s.ax) * k, ey = s.ay + (s.by - s.ay) * k;
        ctx.strokeStyle = 'rgba(140, 235, 255, 0.55)';
        ctx.lineWidth = 22;
        ctx.beginPath(); ctx.moveTo(s.ax, s.ay); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = `rgba(${s.color}, 1)`;
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(s.ax, s.ay); ctx.lineTo(ex, ey); ctx.stroke();
      } else {
        // Split: two edges drift apart and fade, like the cut opening.
        const k = (t - 0.28) / 0.72;
        const gap = 3 + k * 16;
        const a = 1 - k;
        ctx.strokeStyle = `rgba(${s.color}, ${a})`;
        ctx.lineWidth = 4 * a + 1;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s.ax + nx * gap * side, s.ay + ny * gap * side);
          ctx.lineTo(s.bx + nx * gap * side, s.by + ny * gap * side);
          ctx.stroke();
        }
      }
    }

    this.rings = this.rings.filter((r) => (r.life -= dt) > 0);
    for (const r of this.rings) {
      const t = 1 - r.life / SLASH_LIFE;
      ctx.strokeStyle = `rgba(255, 255, 255, ${1 - t})`;
      ctx.lineWidth = 7 * (1 - t) + 1;
      ctx.beginPath(); ctx.arc(r.cx, r.cy, r.r * (1 + t * 0.35), 0, Math.PI * 2); ctx.stroke();
    }

    this.sparks = this.sparks.filter((p) => (p.life -= dt) > 0);
    for (const p of this.sparks) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 520 * dt;
      p.vx *= 0.96;
      ctx.fillStyle = `rgba(255, 245, 200, ${Math.min(1, p.life * 2.6)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // Small random offset for the 3D camera while the shake lasts (world units).
  shakeOffset(scale = 0.08) {
    if (this.shake <= 0) return 0;
    return (Math.random() - 0.5) * 2 * scale * this.shake;
  }
}
