import { formatNumber, t } from '../i18n/runtime.js';

// Shared Tier-Differentiated Result Screen Celebration & Gloom VFX Overlay
// Supports S+ (Gold/Rainbow Fireworks & Confetti), S (Gold Confetti), A (Emerald Sparkles),
// B (Calm Blue Motes), and C/D (Comedic Raindrops & Card Shake) + Animated Score Count-Up!
export class ResultFXManager {
  constructor(rootContainer) {
    this.root = rootContainer;
    this.active = false;
    this.rank = 'A';
    this.particles = [];
    this.rafId = null;
    this.lastTime = 0;

    this._injectStyles();
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'result-fx-canvas';
    this.canvas.className = 'hidden';
    this.root.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.frame = document.createElement('div');
    this.frame.id = 'result-fx-frame';
    this.root.appendChild(this.frame);
  }

  _injectStyles() {
    if (document.getElementById('result-fx-styles')) return;
    const st = document.createElement('style');
    st.id = 'result-fx-styles';
    st.textContent = `
      #result-fx-canvas {
        position: fixed; inset: 0; width: 100%; height: 100%;
        z-index: 45; pointer-events: none;
      }
      #result-fx-canvas.hidden { display: none !important; }

      .res-tier-splus {
        border: 2px solid #ffe46b !important;
        box-shadow: 0 0 32px rgba(255, 212, 68, 0.65), inset 0 0 22px rgba(255, 224, 102, 0.22) !important;
        background: linear-gradient(155deg, rgba(36, 24, 6, 0.94), rgba(14, 18, 36, 0.94)) !important;
        animation: resSlamGold 0.55s cubic-bezier(0.2, 1.35, 0.4, 1) both;
      }
      .res-tier-s {
        border: 2px solid #ffd454 !important;
        box-shadow: 0 0 24px rgba(255, 200, 64, 0.48) !important;
        animation: resPopIn 0.45s cubic-bezier(0.2, 1.25, 0.4, 1) both;
      }
      .res-tier-a {
        border: 1.8px solid #3de08a !important;
        box-shadow: 0 0 20px rgba(61, 224, 138, 0.36) !important;
        animation: resPopIn 0.40s ease-out both;
      }
      .res-tier-b {
        border: 1.5px solid #5ce1ff !important;
        box-shadow: 0 0 14px rgba(92, 225, 255, 0.25) !important;
      }
      .res-tier-c {
        border: 1.8px solid #a05858 !important;
        box-shadow: 0 0 18px rgba(180, 50, 50, 0.35) !important;
        background: linear-gradient(160deg, rgba(24, 14, 18, 0.94), rgba(10, 12, 18, 0.95)) !important;
        animation: resFailShake 0.55s ease-in-out both;
      }

      /* 31m-50m ranks */
      .res-tier-ss {
        border: 2px solid #ffd36b !important;
        box-shadow: 0 0 34px rgba(255, 200, 80, 0.7), inset 0 0 20px rgba(125, 211, 252, 0.25) !important;
        background: linear-gradient(155deg, rgba(40, 26, 6, 0.95), rgba(8, 22, 40, 0.95)) !important;
        animation: resSlamGold 0.6s cubic-bezier(0.2, 1.35, 0.4, 1) both;
      }
      .res-tier-sss {
        border: 2px solid #c4b5fd !important;
        box-shadow: 0 0 38px rgba(196, 181, 253, 0.75), 0 0 18px rgba(255, 212, 68, 0.6) !important;
        background: linear-gradient(155deg, rgba(30, 12, 48, 0.95), rgba(8, 22, 40, 0.95)) !important;
        animation: resSlamGold 0.65s cubic-bezier(0.2, 1.4, 0.4, 1) both;
      }
      .res-tier-ex {
        border: 2px solid #fff3b0 !important;
        box-shadow: 0 0 44px rgba(255, 228, 107, 0.9), 0 0 22px rgba(125, 211, 252, 0.8) !important;
        background: linear-gradient(155deg, rgba(48, 30, 4, 0.96), rgba(6, 26, 48, 0.96)) !important;
        animation: resSlamGold 0.7s cubic-bezier(0.2, 1.45, 0.4, 1) both, resExGlow 1.6s ease-in-out 0.7s infinite alternate;
      }
      .res-rank-ss  { color: #ffe08a !important; text-shadow: 0 0 18px #ffb700, 0 0 8px #7dd3fc, 0 2px 6px rgba(0,0,0,0.9); }
      .res-rank-sss { color: #e9d5ff !important; text-shadow: 0 0 18px #a855f7, 0 0 10px #ffd454, 0 2px 6px rgba(0,0,0,0.9); }
      .res-rank-ex  { color: #fffbe0 !important; text-shadow: 0 0 22px #ffd454, 0 0 12px #7dd3fc, 0 2px 6px rgba(0,0,0,0.9); }
      .res-ribbon-ss  { background: linear-gradient(90deg, #ffb700, #fff08a, #7dd3fc); color: #1d1200; }
      .res-ribbon-sss { background: linear-gradient(90deg, #a855f7, #ffd454, #a855f7); color: #160626; }
      .res-ribbon-ex  { background: linear-gradient(90deg, #ffd454, #ffffff, #7dd3fc, #ffd454); color: #1a1000; }
      @keyframes resExGlow {
        from { box-shadow: 0 0 30px rgba(255, 228, 107, 0.7), 0 0 14px rgba(125, 211, 252, 0.6); }
        to { box-shadow: 0 0 56px rgba(255, 228, 107, 1), 0 0 28px rgba(125, 211, 252, 0.95); }
      }

      /* 50m MAX: gold frame glow around the whole screen */
      #result-fx-frame {
        position: fixed; inset: 0; z-index: 44; pointer-events: none; display: none;
        border: 3px solid rgba(255, 220, 110, 0.9); border-radius: 6px;
        box-shadow: inset 0 0 42px 10px rgba(255, 205, 70, 0.55), inset 0 0 120px 30px rgba(125, 211, 252, 0.18);
        animation: resFrame 1.4s ease-in-out infinite alternate;
      }
      #result-fx-frame.show { display: block; }
      @keyframes resFrame { from { opacity: 0.65; } to { opacity: 1; } }
      @media (prefers-reduced-motion: reduce) { #result-fx-frame, .res-tier-ex { animation: none !important; } }

      .res-rank-splus { color: #fff27a !important; text-shadow: 0 0 16px #ffb700, 0 2px 6px rgba(0,0,0,0.9); }
      .res-rank-s     { color: #ffd454 !important; text-shadow: 0 0 12px rgba(255,190,40,0.8); }
      .res-rank-a     { color: #4ef2a1 !important; text-shadow: 0 0 10px rgba(60,224,138,0.65); }
      .res-rank-b     { color: #7ce8ff !important; }
      .res-rank-c     { color: #ff7a7a !important; }

      .res-tier-ribbon {
        display: inline-block; padding: 2px 10px; border-radius: 999px;
        font-size: 10px; font-weight: 900; letter-spacing: 0.08em; margin-bottom: 4px;
      }
      .res-ribbon-splus { background: linear-gradient(90deg, #ffb700, #fff08a, #ffb700); color: #2b1700; }
      .res-ribbon-s     { background: linear-gradient(90deg, #ff9f1c, #ffe066); color: #261400; }
      .res-ribbon-a     { background: rgba(61, 224, 138, 0.26); color: #7dffb8; border: 1px solid #3de08a; }
      .res-ribbon-b     { background: rgba(92, 225, 255, 0.20); color: #9eefff; border: 1px solid #5ce1ff; }
      .res-ribbon-c     { background: rgba(255, 92, 92, 0.22); color: #ff9c9c; border: 1px solid #ff6b6b; }

      @keyframes resSlamGold {
        0% { transform: scale(1.22); opacity: 0; }
        60% { transform: scale(0.96); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes resPopIn {
        0% { transform: translateY(-14px) scale(0.92); opacity: 0; }
        100% { transform: translateY(0) scale(1); opacity: 1; }
      }
      @keyframes resFailShake {
        0%, 100% { transform: translateX(0); }
        18% { transform: translateX(-8px) rotate(-0.8deg); }
        36% { transform: translateX(7px) rotate(0.7deg); }
        54% { transform: translateX(-5px) rotate(-0.4deg); }
        72% { transform: translateX(4px); }
      }
    `;
    document.head.appendChild(st);
  }

  static getTierInfo(rank) {
    if (rank === 'EX')  return { key: 'ex',  label: '✦ LEVIATHAN EX ✦' };
    if (rank === 'SSS') return { key: 'sss', label: '★★★ ABYSSAL TITAN ★★★' };
    if (rank === 'SS')  return { key: 'ss',  label: '★★ COLOSSAL RECORD ★★' };
    if (rank === 'S+') return { key: 'splus', label: '★ LEGENDARY RECORD ★' };
    if (rank === 'S')  return { key: 's',     label: '★ EXCELLENT! ★' };
    if (rank === 'A')  return { key: 'a',     label: 'GREAT RESULT!' };
    if (rank === 'B')  return { key: 'b',     label: 'GOOD CLEAR' };
    return { key: 'c', label: 'TRY AGAIN...' };
  }

  static applyCardStyle(cardEl, rankEl, ribbonEl, rank) {
    const info = ResultFXManager.getTierInfo(rank);
    const keys = ['ex', 'sss', 'ss', 'splus', 's', 'a', 'b', 'c'];
    const allCard = keys.map((k) => `res-tier-${k}`);
    const allRank = keys.map((k) => `res-rank-${k}`);
    const allRib  = keys.map((k) => `res-ribbon-${k}`);

    if (cardEl) {
      cardEl.classList.remove(...allCard);
      // Force animation replay
      void cardEl.offsetWidth;
      cardEl.classList.add(`res-tier-${info.key}`);
    }
    if (rankEl) {
      rankEl.classList.remove(...allRank);
      rankEl.classList.add(`res-rank-${info.key}`);
    }
    if (ribbonEl) {
      ribbonEl.classList.remove(...allRib);
      ribbonEl.classList.add(`res-ribbon-${info.key}`);
      ribbonEl.textContent = t(info.label);
    }
  }

  static animateScore(el, targetScore, durationMs = 720) {
    if (!el) return;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const ease = 1 - Math.pow(1 - progress, 3);
      el.textContent = t('{0} 点', formatNumber(Math.round(targetScore * ease)));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // options.lengthMeters: 35m+ adds 2.5x gold & pale-blue deep-sea light particles,
  // 50m adds the gold screen frame and continuous fireworks.
  start(rank, options = {}) {
    this.stop();
    const lengthMeters = Number(options.lengthMeters) || 0;
    this.fireworks = lengthMeters >= 50;
    this.fireworkTimer = 0.2;
    if (rank === 'SS' || rank === 'SSS' || rank === 'EX') rank = 'S+';
    this.rank = rank;
    this.active = true;
    this.canvas.classList.remove('hidden');
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.particles = [];

    const w = this.canvas.width, h = this.canvas.height;
    const count = rank === 'S+' ? 110 : rank === 'S' ? 75 : rank === 'A' ? 42 : rank === 'B' ? 24 : 55;
    if (lengthMeters >= 35) {
      // Deep-sea light motes: base amount x 2.5, gold and pale blue.
      const deepPal = ['#ffd454', '#fff2b3', '#bfeaff', '#7dd3fc', '#e0f7ff'];
      const extra = Math.round(count * 2.5);
      for (let i = 0; i < extra; i++) {
        this.particles.push({
          kind: 'sparkle',
          x: Math.random() * w,
          y: h * (0.1 + Math.random() * 0.9),
          vx: (Math.random() - 0.5) * 26,
          vy: -(30 + Math.random() * 70),
          size: 1.5 + Math.random() * 3.5,
          color: deepPal[i % deepPal.length],
          phase: Math.random() * Math.PI * 2
        });
      }
    }
    if (this.fireworks) this.frame.classList.add('show');
    const paletteSPlus = ['#ffd454', '#fff59d', '#ff6b9d', '#5ce1ff', '#7dffb8', '#ffffff'];
    const paletteS     = ['#ffd454', '#ffaa33', '#5ce1ff', '#ffffff'];
    const paletteA     = ['#3de08a', '#7ce8ff', '#ffe066'];

    for (let i = 0; i < count; i++) {
      if (rank === 'S+' || rank === 'S') {
        const pal = rank === 'S+' ? paletteSPlus : paletteS;
        const burst = rank === 'S+' && i < 40;
        const angle = Math.random() * Math.PI * 2;
        const spd = burst ? (140 + Math.random() * 260) : 0;
        this.particles.push({
          kind: 'confetti',
          x: burst ? w * 0.5 : Math.random() * w,
          y: burst ? h * 0.25 : -Math.random() * h * 0.6,
          vx: burst ? Math.cos(angle) * spd : (Math.random() - 0.5) * 65,
          vy: burst ? Math.sin(angle) * spd - 60 : (90 + Math.random() * 140),
          size: 5 + Math.random() * 6,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 8,
          color: pal[i % pal.length],
          alpha: 1
        });
      } else if (rank === 'A' || rank === 'B') {
        this.particles.push({
          kind: 'sparkle',
          x: Math.random() * w,
          y: h * (0.15 + Math.random() * 0.75),
          vx: (Math.random() - 0.5) * 20,
          vy: -(25 + Math.random() * 45),
          size: rank === 'A' ? (3 + Math.random() * 4) : (2 + Math.random() * 3),
          color: rank === 'A' ? paletteA[i % paletteA.length] : '#7ce8ff',
          phase: Math.random() * Math.PI * 2
        });
      } else {
        // Comedic gloomy rain for low score (C / D)
        this.particles.push({
          kind: 'rain',
          x: Math.random() * w,
          y: Math.random() * h,
          vx: -24,
          vy: 340 + Math.random() * 180,
          len: 14 + Math.random() * 14,
          alpha: 0.25 + Math.random() * 0.35
        });
      }
    }

    this.lastTime = performance.now();
    const loop = (now) => {
      if (!this.active) return;
      const dt = Math.min(0.05, (now - this.lastTime) * 0.001);
      this.lastTime = now;
      this._render(dt);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  _launchFirework(w, h) {
    const cx = w * (0.15 + Math.random() * 0.7);
    const cy = h * (0.12 + Math.random() * 0.4);
    const pal = ['#ffd454', '#fff59d', '#7dd3fc', '#ff6b9d', '#ffffff', '#a78bfa'];
    const color = pal[Math.floor(Math.random() * pal.length)];
    const n = 46;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const spd = 120 + Math.random() * 90;
      this.particles.push({ kind: 'spark', x: cx, y: cy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 1.3, max: 1.3, color });
    }
  }

  _render(dt) {
    const w = this.canvas.width, h = this.canvas.height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    if (this.fireworks) {
      this.fireworkTimer -= dt;
      if (this.fireworkTimer <= 0) {
        this.fireworkTimer = 0.45 + Math.random() * 0.5;
        this._launchFirework(w, h);
      }
      // Drop finished sparks so the list never grows without limit.
      if (this.particles.length > 900) this.particles = this.particles.filter((p) => p.kind !== 'spark' || p.life > 0);
    }

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.kind === 'confetti') {
        p.vy += 180 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
        if (p.y > h + 20) {
          p.y = -12;
          p.x = Math.random() * w;
          p.vy = 85 + Math.random() * 110;
          p.vx = (Math.random() - 0.5) * 55;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size * 0.5, -p.size * 0.3, p.size, p.size * 0.6);
        ctx.restore();
      } else if (p.kind === 'sparkle') {
        p.phase += dt * 4.5;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.y < -15) { p.y = h + 10; p.x = Math.random() * w; }
        const a = 0.35 + 0.65 * Math.abs(Math.sin(p.phase));
        ctx.fillStyle = p.color;
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (p.kind === 'spark') {
        if (p.life <= 0) continue;
        p.life -= dt;
        p.vx *= Math.exp(-dt * 1.6);
        p.vy = p.vy * Math.exp(-dt * 1.6) + 60 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (p.kind === 'rain') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.y > h + 20) { p.y = -20; p.x = Math.random() * (w + 60); }
        ctx.strokeStyle = `rgba(140, 175, 210, ${p.alpha})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - 3, p.y + p.len);
        ctx.stroke();
      }
    }
  }

  stop() {
    this.active = false;
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.canvas.classList.add('hidden');
    this.fireworks = false;
    this.frame?.classList.remove('show');
  }
}
