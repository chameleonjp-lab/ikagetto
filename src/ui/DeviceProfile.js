// Works out what kind of device the game runs on and tags <html> with classes,
// so the CSS can lay the screen out for it:
//
//   dev-phone / dev-tablet / dev-pc / dev-dual   form of the device
//   input-touch / input-mouse                    main way to operate it
//   os-ios                                       iPhone / iPad (Safari quirks)
//   dual-h / dual-v                              two screens side by side / stacked
//
// The layout is chosen from the space the page really has (CSS viewport), not
// from the device name, following WebKit's advice for iPhone Duo: Safari gives
// pages 382-951 CSS px of width there, and the same iPhone can be a "phone"
// (cover screen, split view) or a "tablet" (inner screen) from one moment to the
// next. Fold / unfold changes the viewport, so the classes are re-applied on resize.
//
//   short side of the viewport < 600 px, touch  -> phone layout
//   short side >= 600 px, touch                 -> tablet layout (iPad, iPhone Duo open)
//   mouse with hover                            -> PC layout
//   Viewport Segments API reports 2 segments    -> dual layout (keep dialogs off the fold)
//
// The fold is invisible to pages unless the browser exposes the Viewport Segments
// API (on iPhone Duo it is a developer preview behind a Safari feature flag), so by
// default an open iPhone Duo is treated as one large screen.
// The user agent is only used to recognise iOS for Safari-specific tweaks.
//
// adaptText() rewrites finger words for mouse users ("タップ" -> "クリック").

const mq = (q) => { try { return window.matchMedia(q).matches; } catch (_) { return false; } };

function viewportSegments() {
  try {
    if (window.viewport && Array.isArray(window.viewport.segments) && window.viewport.segments.length > 1) {
      return window.viewport.segments;
    }
    if (typeof window.getWindowSegments === 'function') {
      const s = window.getWindowSegments();
      if (s && s.length > 1) return s;
    }
  } catch (_) {}
  return null;
}

function detect() {
  const ua = navigator.userAgent || '';
  const isIPhone = /iPhone|iPod/.test(ua);
  const isIPad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const coarse = mq('(pointer: coarse)');
  const fineHover = mq('(pointer: fine)') && mq('(hover: hover)');
  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  const segs = viewportSegments();
  const dualH = mq('(horizontal-viewport-segments: 2)') || (segs && segs[1].left > segs[0].left);
  const dualV = mq('(vertical-viewport-segments: 2)') || (segs && segs[1].top > segs[0].top);

  let device;
  if (dualH || dualV) device = 'dual';
  else if (!fineHover || coarse || isIPhone || isIPad) device = shortSide < 600 ? 'phone' : 'tablet';
  else device = 'pc';

  const input = fineHover && !coarse && !isIPhone && !isIPad ? 'mouse' : 'touch';
  return { device, input, shortSide, ios: isIPhone || isIPad, dualH: !!dualH, dualV: !!dualV && !dualH, segs };
}

let profile = detect();

function apply() {
  const root = document.documentElement;
  const keep = [...root.classList].filter((c) => !/^(dev-|input-|os-|dual-)/.test(c));
  const add = [`dev-${profile.device}`, `input-${profile.input}`];
  // A large screen reported as two segments (e.g. iPhone Duo open with the flag on) still gets tablet-size controls.
  if (profile.device === 'dual' && profile.input === 'touch' && profile.shortSide >= 600) add.push('dev-tablet');
  if (profile.ios) add.push('os-ios');
  if (profile.dualH) add.push('dual-h');
  if (profile.dualV) add.push('dual-v');
  root.className = [...keep, ...add].join(' ');

  // Second screen rectangle for dual-screen layouts (dialogs go there, away from the hinge).
  const s = profile.segs;
  const w = window.innerWidth, h = window.innerHeight;
  let x = 0, y = 0, sw = w, sh = h;
  if (s) {
    x = s[1].left; y = s[1].top; sw = s[1].width; sh = s[1].height;
  } else if (profile.dualH) {
    x = w / 2; sw = w / 2;
  } else if (profile.dualV) {
    y = h / 2; sh = h / 2;
  }
  root.style.setProperty('--seg2-x', `${x}px`);
  root.style.setProperty('--seg2-y', `${y}px`);
  root.style.setProperty('--seg2-w', `${sw}px`);
  root.style.setProperty('--seg2-h', `${sh}px`);
}

// Layout per device. Selectors start with html.dev-* / html.input-* so they win over
// the base HUD styles without !important.
const DEVICE_CSS = `
  /* Keyboard / mouse hints: PC only */
  .key-hint { display: none; }
  html.input-mouse .key-hint {
    display: block; margin-top: 3px;
    font-size: 10.5px; font-weight: 700; line-height: 1.2; color: rgba(220, 240, 255, 0.78);
  }
  html.input-mouse #ship-keypad .key-hint { font-size: 10px; color: #8cc8ec; text-align: center; }
  html.input-mouse .ctrl-btn:not(:disabled), html.input-mouse .home-play-btn { cursor: pointer; }
  /* The key hint makes the stick panel taller: lift the sonar above it. */
  html.input-mouse #hud-sonar-panel { bottom: 180px; }
  html.input-mouse #ship-keypad .key-hint { white-space: nowrap; }

  /* Touch devices: no long-press menu, text selection or grey tap flash on game controls */
  html.input-touch body { -webkit-tap-highlight-color: transparent; }
  html.input-touch #app, html.input-touch #app * {
    -webkit-touch-callout: none; -webkit-user-select: none; user-select: none;
  }
  html.os-ios body { -webkit-text-size-adjust: 100%; }

  /* PC: a little more room for the winch buttons */
  html.dev-pc #action-pad { width: min(260px, calc(100vw - 170px)); }
  html.dev-pc #btn-reel-in, html.dev-pc #btn-reel-out { min-height: 84px; }

  /* Tablet: bigger stick, buttons and text for fingers on a large screen */
  html.dev-tablet #ship-keypad { width: 196px; padding: 10px 10px 12px; }
  html.dev-tablet #joy-base { width: 168px; height: 168px; }
  html.dev-tablet #joy-knob { width: 64px; height: 64px; margin-left: -32px; margin-top: -32px; }
  html.dev-tablet #action-pad { width: min(320px, calc(100vw - 236px)); padding: 10px; gap: 10px; }
  html.dev-tablet #btn-reel-in, html.dev-tablet #btn-reel-out { min-height: 108px; font-size: 21px; }
  html.dev-tablet #btn-hook { min-height: 100px; font-size: 22px; }
  html.dev-tablet #hud-sonar-panel { width: 290px; bottom: 236px; }
  html.dev-tablet .sonar-dist-big { font-size: 32px; }
  html.dev-tablet #crane-timing-panel { width: min(520px, calc(100vw - 40px)); }
  html.dev-tablet #btn-crane-big { font-size: 21px; padding: 20px 14px; }
  html.dev-tablet .cond-pill { font-size: 15px; padding: 8px 4px; }
  html.dev-tablet #tut-card, html.dev-tablet .coach-card { width: min(540px, calc(100vw - 40px)); }
  html.dev-tablet .tut-title, html.dev-tablet .coach-title { font-size: 21px; }
  html.dev-tablet .tut-body, html.dev-tablet .coach-body { font-size: 16.5px; }
  html.dev-tablet .tut-ok-btn, html.dev-tablet .coach-ok { font-size: 18px; padding: 14px; }
  html.dev-tablet .home-card { width: min(580px, 100%); padding: 34px 28px; }
  html.dev-tablet .home-step-icon { width: 76px; height: 76px; }
  html.dev-tablet .home-step-label { font-size: 18px; }
  html.dev-tablet .home-play-btn { font-size: 20px; padding: 18px; }
  html.dev-tablet .mini-btn { font-size: 14px; padding: 7px 12px; }

  /* Two viewport segments side by side (fold reported by the Viewport Segments API): keep dialogs and the
     centre panels on the right screen so nothing is cut by the hinge. */
  html.dual-h #hud-top-wrap { right: calc(100vw - var(--seg2-x) + 8px); }
  html.dual-h #home-screen, html.dual-h .modal-backdrop, html.dual-h #flow-menu-modal, html.dual-h #big-callout {
    left: var(--seg2-x); right: auto; width: var(--seg2-w);
  }
  html.dual-h #tut-card, html.dual-h .coach-card, html.dual-h #crane-timing-panel, html.dual-h #inspect-bar {
    left: calc(var(--seg2-x) + var(--seg2-w) / 2);
    width: min(440px, calc(var(--seg2-w) - 24px));
  }
  /* Two screens stacked: dialogs on the upper screen, controls stay on the lower one. */
  html.dual-v #home-screen, html.dual-v .modal-backdrop, html.dual-v #flow-menu-modal, html.dual-v #big-callout {
    top: 0; bottom: auto; height: var(--seg2-y);
  }
`;

function injectStyles() {
  if (document.getElementById('device-layout-styles')) return;
  const st = document.createElement('style');
  st.id = 'device-layout-styles';
  st.textContent = DEVICE_CSS;
  document.head.appendChild(st);
}

export function getDeviceProfile() { return profile; }
export function isMouseInput() { return profile.input === 'mouse'; }

const MOUSE_WORDS = [
  ['指を置いてすべらせると', 'クリックしたまま動かすと'],
  ['指を置いたまま', 'クリックしたまま'],
  ['指をはなさずに', 'ボタンをはなさずに'],
  ['指を左右に動かして', 'クリックしたまま左右に動かして'],
  ['指をはな', 'ボタンをはな'],
  ['タップ', 'クリック']
];

// Finger words -> mouse words (only when the main input is a mouse).
export function adaptText(text) {
  if (profile.input !== 'mouse' || !text) return text;
  let out = text;
  for (const [a, b] of MOUSE_WORDS) if (out.includes(a)) out = out.split(a).join(b);
  return out;
}

export function installDeviceProfile() {
  injectStyles();
  apply();
  const refresh = () => {
    const next = detect();
    // Keep the input mode chosen at start so texts already shown stay consistent.
    next.input = profile.input;
    profile = next;
    apply();
  };
  window.addEventListener('resize', refresh);
  window.addEventListener('orientationchange', refresh);
  try { window.matchMedia('(horizontal-viewport-segments: 2)').addEventListener('change', refresh); } catch (_) {}
  try { window.matchMedia('(vertical-viewport-segments: 2)').addEventListener('change', refresh); } catch (_) {}
}
