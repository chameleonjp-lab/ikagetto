import { t } from '../i18n/runtime.js';

// =============================================================================
// 31m-50m deep-sea discovery warning (5 levels) and boss-action banners.
// - Never blocks play: the overlay ignores pointer events, so taps still reach
//   the buttons below. A tap anywhere also fades the warning out in 0.2s.
// - Physics keep running while it is shown (it is purely visual).
// =============================================================================

const LEVELS = {
  1: {
    cls: 'lv1',
    duration: 2000,
    banner: '⚠ 異常反応：30m超の超大型個体',
    headline: '',
    sub: '',
    shake: ''
  },
  2: {
    cls: 'lv2',
    duration: 2400,
    banner: '',
    headline: 'WARNING // DEEP SEA ANOMALY',
    sub: '推定 35m+ ヌシ級確認',
    shake: 'colossal-shake-weak'
  },
  3: {
    cls: 'lv3',
    duration: 2600,
    banner: '',
    headline: 'CRITICAL WARNING // COLOSSAL CLASS 40m+',
    sub: '推定 40m+ 超巨大級コロッサル',
    tape: 'CRITICAL WARNING // COLOSSAL CLASS 40m+',
    shake: 'colossal-shake-mid'
  },
  4: {
    cls: 'lv4',
    duration: 2800,
    banner: '',
    headline: 'EXTREME ALERT // ABYSSAL TITAN 45m+',
    sub: '推定 45m+ 超巨大級・極大タイタン',
    sonar: true,
    shake: 'colossal-shake-strong'
  },
  5: {
    cls: 'lv5',
    duration: 3200,
    banner: '',
    headline: 'EMERGENCY // CLASS-50M LEVIATHAN DETECTED',
    sub: '推定 50m 伝説の深海神リヴァイアサン',
    sonar: true,
    glitch: true,
    shake: 'colossal-shake-strong'
  }
};

const ACTIONS = {
  INK_BURST: { cls: 'ink', text: '墨幕！視界が悪くなった。張力計を見て操作しよう', veil: 'ink', ms: 2600 },
  ABYSSAL_PULSE: { cls: 'pulse', text: '深海パルス！体を光らせて威嚇している', veil: 'pulse', ms: 2000 },
  SHIP_GRAB: { cls: 'grab', text: '船体に抱きつこうとしている！最後の抵抗だ', veil: '', ms: 2200 },
  BEAK_SNAP: { cls: 'beak', text: 'カラストンビで威嚇！海面まであと少し', veil: '', ms: 2000 }
};

const DEPTH_IDS = ['right-depth', 'action-depth-mini', 'sonar-dist-big'];

export function colossalAlertLevelForLength(lengthMeters) {
  if (lengthMeters >= 50) return 5;
  if (lengthMeters >= 45) return 4;
  if (lengthMeters >= 40) return 3;
  if (lengthMeters >= 35) return 2;
  return 1;
}

export class ColossalAlertOverlay {
  constructor(rootContainer) {
    this.root = rootContainer;
    this.active = false;
    this.hideTimer = null;
    this.fadeTimer = null;
    this.actionTimer = null;
    this.onSkip = null;
    this._injectStyles();
    this._buildDOM();
    this._onPointerDown = () => { if (this.active) this.skip(); };
    // Capture phase + passive: we only listen, we never stop the tap.
    window.addEventListener('pointerdown', this._onPointerDown, { capture: true, passive: true });
  }

  _injectStyles() {
    if (document.getElementById('colossal-alert-styles')) return;
    const st = document.createElement('style');
    st.id = 'colossal-alert-styles';
    st.textContent = `
      #colossal-alert { position: fixed; inset: 0; z-index: 50; pointer-events: none; display: none; overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif; }
      #colossal-alert.show { display: block; animation: caIn 0.18s ease-out both; }
      #colossal-alert.fade { opacity: 0; transition: opacity 0.2s ease-out; }
      #colossal-alert .ca-layer { position: absolute; inset: 0; }
      #colossal-alert .ca-center {
        position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%);
        width: min(92vw, 640px); text-align: center;
      }
      #colossal-alert .ca-headline {
        font-size: clamp(17px, 5.2vw, 34px); font-weight: 900; letter-spacing: 0.06em; line-height: 1.15;
        color: #fff; text-shadow: 0 0 14px rgba(255, 60, 60, 0.9), 0 2px 4px #000; word-break: break-word;
      }
      #colossal-alert .ca-sub {
        margin-top: 8px; font-size: clamp(14px, 4vw, 22px); font-weight: 800; color: #ffe2e2;
        text-shadow: 0 2px 6px #000;
      }
      #colossal-alert .ca-skip {
        position: absolute; left: 50%; bottom: max(18px, env(safe-area-inset-bottom)); transform: translateX(-50%);
        font-size: 12px; color: rgba(255,255,255,0.78); background: rgba(0,0,0,0.45); padding: 3px 12px; border-radius: 999px;
      }
      #colossal-alert .ca-banner {
        position: absolute; left: 50%; top: max(64px, calc(env(safe-area-inset-top) + 56px)); transform: translateX(-50%);
        max-width: 92vw; padding: 8px 16px; border-radius: 10px; font-weight: 900;
        font-size: clamp(14px, 4vw, 20px); color: #1f1300; background: #F59E0B;
        box-shadow: 0 0 24px rgba(245, 158, 11, 0.8); text-align: center; animation: caBlink 0.5s steps(2) infinite;
      }
      #colossal-alert .ca-tape {
        position: absolute; left: 0; right: 0; height: 30px; overflow: hidden; white-space: nowrap;
        background: repeating-linear-gradient(135deg, #facc15 0 18px, #111 18px 36px);
      }
      #colossal-alert .ca-tape span {
        display: inline-block; padding: 3px 0; font-weight: 900; font-size: 15px; color: #fff;
        background: rgba(153, 27, 27, 0.92); padding-inline: 14px; animation: caTape 2.4s linear infinite;
      }
      #colossal-alert .ca-tape.top { top: max(0px, env(safe-area-inset-top)); }
      #colossal-alert .ca-tape.bottom { bottom: max(0px, env(safe-area-inset-bottom)); }
      #colossal-alert .ca-tape.bottom span { animation-direction: reverse; }
      #colossal-alert svg.ca-sonar { position: absolute; left: 0; right: 0; top: 60%; width: 100%; height: 80px; }
      #colossal-alert svg.ca-sonar polyline { fill: none; stroke: #7cf3ff; stroke-width: 2.5; filter: drop-shadow(0 0 6px #22d3ee); }

      /* Level looks */
      #colossal-alert.lv1 .ca-bg { box-shadow: inset 0 0 120px 30px rgba(245, 158, 11, 0.75); animation: caPulse 0.6s ease-in-out infinite alternate; }
      #colossal-alert.lv2 .ca-bg {
        background: rgba(30, 0, 0, 0.55); animation: caRedBlack 0.34s steps(2) infinite;
        box-shadow: inset 0 0 140px 40px rgba(220, 20, 20, 0.85);
      }
      #colossal-alert.lv2 .ca-scan, #colossal-alert.lv3 .ca-scan, #colossal-alert.lv4 .ca-scan, #colossal-alert.lv5 .ca-scan {
        background: repeating-linear-gradient(0deg, rgba(0,0,0,0.28) 0 2px, transparent 2px 5px);
        animation: caScan 0.9s linear infinite;
      }
      #colossal-alert.lv3 .ca-bg {
        background: rgba(153, 27, 27, 0.55); box-shadow: inset 0 0 160px 50px rgba(124, 58, 237, 0.7);
        animation: caPurple 0.5s ease-in-out infinite alternate;
      }
      #colossal-alert.lv4 .ca-bg {
        background:
          repeating-linear-gradient(135deg, rgba(250, 204, 21, 0.55) 0 26px, rgba(0, 0, 0, 0.55) 26px 52px) top / 100% 42px no-repeat,
          repeating-linear-gradient(135deg, rgba(250, 204, 21, 0.55) 0 26px, rgba(0, 0, 0, 0.55) 26px 52px) bottom / 100% 42px no-repeat,
          rgba(40, 10, 0, 0.5);
        animation: caFlash 0.42s steps(2) infinite;
      }
      #colossal-alert.lv5 .ca-bg { animation: caLeviathan 0.3s steps(2) infinite; }
      #colossal-alert.lv5 .ca-headline { text-shadow: 0 0 18px #7dd3fc, 0 0 6px #ff2a55, 0 2px 4px #000; }

      @keyframes caIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes caBlink { 0% { opacity: 1; } 100% { opacity: 0.55; } }
      @keyframes caPulse { from { opacity: 0.55; } to { opacity: 1; } }
      @keyframes caRedBlack { 0% { background: rgba(170, 0, 0, 0.5); } 100% { background: rgba(0, 0, 0, 0.55); } }
      @keyframes caPurple { from { box-shadow: inset 0 0 120px 30px rgba(124, 58, 237, 0.45); } to { box-shadow: inset 0 0 180px 60px rgba(168, 85, 247, 0.85); } }
      @keyframes caFlash { 0% { filter: brightness(1); } 100% { filter: brightness(1.7); } }
      @keyframes caLeviathan {
        0% { background: rgba(220, 20, 50, 0.55); box-shadow: inset 0 0 180px 60px rgba(255, 30, 60, 0.9); }
        100% { background: rgba(186, 230, 253, 0.42); box-shadow: inset 0 0 180px 60px rgba(125, 211, 252, 0.9); }
      }
      @keyframes caScan { from { background-position: 0 0; } to { background-position: 0 30px; } }
      @keyframes caTape { from { transform: translateX(0); } to { transform: translateX(-50%); } }

      .colossal-shake-weak { animation: caShakeW 0.12s linear infinite; }
      .colossal-shake-mid { animation: caShakeM 0.1s linear infinite; }
      .colossal-shake-strong { animation: caShakeS 0.08s linear infinite; }
      @keyframes caShakeW { 0%,100% { transform: translate(0,0); } 25% { transform: translate(-2px,1px); } 75% { transform: translate(2px,-1px); } }
      @keyframes caShakeM { 0%,100% { transform: translate(0,0); } 25% { transform: translate(-5px,3px); } 75% { transform: translate(5px,-3px); } }
      @keyframes caShakeS { 0%,100% { transform: translate(0,0); } 25% { transform: translate(-9px,5px) rotate(-0.3deg); } 75% { transform: translate(9px,-5px) rotate(0.3deg); } }

      .colossal-depth-glitch { animation: caGlitch 0.16s steps(2) infinite; color: #ff4d6d !important; }
      @keyframes caGlitch {
        0% { transform: translate(0,0) skewX(0deg); text-shadow: 2px 0 #22d3ee, -2px 0 #ff2a55; }
        100% { transform: translate(1px,-1px) skewX(-8deg); text-shadow: -3px 0 #22d3ee, 3px 0 #ff2a55; }
      }

      /* Boss-action banner (small, top center) and veils over the 3D view only */
      #colossal-action {
        /* Between the centre call-outs and the bottom control pads, so it never covers the gauges. */
        position: fixed; left: 50%; bottom: max(200px, 24vh); transform: translateX(-50%);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif;
        z-index: 49; pointer-events: none; display: none; max-width: 90vw; text-align: center;
        padding: 7px 14px; border-radius: 10px; font-weight: 900; font-size: clamp(13px, 3.6vw, 17px);
        color: #fff; background: rgba(20, 8, 30, 0.86); border: 1.5px solid #a78bfa; box-shadow: 0 0 18px rgba(167, 139, 250, 0.6);
      }
      #colossal-action.show { display: block; animation: caIn 0.2s ease-out both; }
      #colossal-action.ink { border-color: #64748b; box-shadow: 0 0 18px rgba(15, 23, 42, 0.9); }
      #colossal-action.pulse { border-color: #67e8f9; box-shadow: 0 0 22px rgba(103, 232, 249, 0.8); }
      #colossal-action.grab, #colossal-action.beak { border-color: #fb7185; box-shadow: 0 0 22px rgba(251, 113, 133, 0.75); }
      #colossal-veil { position: fixed; inset: 0; z-index: 15; pointer-events: none; opacity: 0; transition: opacity 0.35s ease-out; }
      #colossal-veil.ink { background: radial-gradient(ellipse at 50% 45%, rgba(12, 4, 18, 0.55) 0%, rgba(8, 2, 12, 0.92) 70%); }
      #colossal-veil.pulse { background: radial-gradient(circle at 50% 50%, rgba(103, 232, 249, 0.38), rgba(255, 42, 85, 0.18) 45%, transparent 75%); }
      #colossal-veil.on { opacity: 1; }

      @media (prefers-reduced-motion: reduce) {
        #colossal-alert .ca-bg, #colossal-alert .ca-banner, #colossal-alert .ca-scan, #colossal-alert .ca-tape span { animation: none !important; }
        .colossal-shake-weak, .colossal-shake-mid, .colossal-shake-strong, .colossal-depth-glitch { animation: none !important; }
      }
    `;
    document.head.appendChild(st);
  }

  _buildDOM() {
    this.el = document.createElement('div');
    this.el.id = 'colossal-alert';
    this.el.setAttribute('role', 'alert');
    this.el.setAttribute('aria-live', 'assertive');
    this.root.appendChild(this.el);

    this.elAction = document.createElement('div');
    this.elAction.id = 'colossal-action';
    this.elAction.setAttribute('aria-live', 'polite');
    this.root.appendChild(this.elAction);

    this.elVeil = document.createElement('div');
    this.elVeil.id = 'colossal-veil';
    this.root.appendChild(this.elVeil);
  }

  _sonarPoints(seed) {
    const pts = [];
    for (let i = 0; i <= 48; i++) {
      const x = (i / 48) * 1000;
      const spike = Math.sin(i * 1.7 + seed) * Math.sin(i * 0.33 + seed * 2.1);
      const y = 40 + spike * (i % 7 === 3 ? 36 : 14) + (Math.random() - 0.5) * 10;
      pts.push(`${x.toFixed(0)},${y.toFixed(1)}`);
    }
    return pts.join(' ');
  }

  show(lengthMeters, level = colossalAlertLevelForLength(lengthMeters)) {
    const cfg = LEVELS[level] || LEVELS[1];
    this.clear();
    this.active = true;
    this.level = level;

    const parts = ['<div class="ca-layer ca-bg"></div>', '<div class="ca-layer ca-scan"></div>'];
    if (cfg.banner) parts.push(`<div class="ca-banner">${escapeHtml(t(cfg.banner))}</div>`);
    if (cfg.tape) {
      const tape = escapeHtml(`${t(cfg.tape)}  ///  `.repeat(8));
      parts.push(`<div class="ca-tape top"><span>${tape}</span></div>`);
      parts.push(`<div class="ca-tape bottom"><span>${tape}</span></div>`);
    }
    if (cfg.sonar) {
      parts.push(`<svg class="ca-sonar" viewBox="0 0 1000 80" preserveAspectRatio="none"><polyline points="${this._sonarPoints(1)}"></polyline></svg>`);
    }
    if (cfg.headline || cfg.sub) {
      parts.push(`<div class="ca-center">${cfg.headline ? `<div class="ca-headline">${escapeHtml(t(cfg.headline))}</div>` : ''}` +
        `${cfg.sub ? `<div class="ca-sub">${escapeHtml(t(cfg.sub))}</div>` : ''}</div>`);
    }
    parts.push(`<div class="ca-skip">${escapeHtml(t('タップでスキップ'))}</div>`);
    this.el.innerHTML = parts.join('');
    this.el.className = `show ${cfg.cls}`;

    // Re-draw the jittering sonar line a few times per second.
    if (cfg.sonar) {
      const line = this.el.querySelector('svg.ca-sonar polyline');
      let seed = 1;
      this.sonarTimer = setInterval(() => { seed += 0.9; line?.setAttribute('points', this._sonarPoints(seed)); }, 90);
    }

    this.shakeTarget = document.querySelector('canvas.webgl-canvas');
    if (cfg.shake && this.shakeTarget) {
      this.shakeClass = cfg.shake;
      this.shakeTarget.classList.add(cfg.shake);
    }
    if (cfg.glitch) {
      this.glitched = DEPTH_IDS.map((id) => document.getElementById(id)).filter(Boolean);
      this.glitched.forEach((el) => el.classList.add('colossal-depth-glitch'));
    }

    this.hideTimer = setTimeout(() => this._fadeOut(), cfg.duration);
  }

  skip() {
    if (!this.active) return;
    this.onSkip?.();
    this._fadeOut();
  }

  _fadeOut() {
    if (!this.active) return;
    this.active = false;
    clearTimeout(this.hideTimer);
    this._stopEffects();
    this.el.classList.add('fade');
    this.fadeTimer = setTimeout(() => {
      this.el.className = '';
      this.el.innerHTML = '';
    }, 200);
  }

  _stopEffects() {
    clearInterval(this.sonarTimer);
    this.sonarTimer = null;
    if (this.shakeTarget && this.shakeClass) this.shakeTarget.classList.remove(this.shakeClass);
    this.shakeClass = null;
    (this.glitched || []).forEach((el) => el.classList.remove('colossal-depth-glitch'));
    this.glitched = null;
  }

  showAction(actionName) {
    const cfg = ACTIONS[actionName];
    if (!cfg) return;
    clearTimeout(this.actionTimer);
    this.elAction.className = `show ${cfg.cls}`;
    this.elAction.textContent = t(cfg.text);
    this.elVeil.className = cfg.veil ? `${cfg.veil} on` : '';
    this.actionTimer = setTimeout(() => {
      this.elAction.className = '';
      this.elVeil.classList.remove('on');
    }, cfg.ms);
  }

  clear() {
    clearTimeout(this.hideTimer);
    clearTimeout(this.fadeTimer);
    this._stopEffects();
    this.active = false;
    this.el.className = '';
    this.el.innerHTML = '';
  }

  clearAll() {
    this.clear();
    clearTimeout(this.actionTimer);
    this.elAction.className = '';
    this.elVeil.className = '';
  }
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
