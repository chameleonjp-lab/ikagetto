// First-play guidance shared by the fishing tutorial and the butcher / cooking mini-games.
//
// Design rules (kept deliberately small so the guide never gets in the way of play):
//  1. Show nothing up-front. Explain a rule only right before the player first needs it.
//  2. Interrupt (pause) only for rules that cause a failure if unknown
//     (speed, timing, "keep your finger down", time limits). Plain swipes are taught
//     by a looping "ghost finger" drawn over the real target instead of a dialog.
//  3. Never open a card on top of a success / failure message: wait until it fades.
//  4. One card = one action sentence + at most two short supporting lines.
//  5. Each card is shown once per device. Everything can be replayed from the home screen.

const SEEN_KEY = 'ikagetto_guides_seen_v1';
const LEGACY_FISHING_KEY = 'architeuthis_fishing_tut_done_v1';

function safeRead(key) {
  try { return window.localStorage ? localStorage.getItem(key) : null; } catch (_) { return null; }
}
function safeWrite(key, value) {
  try { if (window.localStorage) localStorage.setItem(key, value); } catch (_) {}
}
function safeRemove(key) {
  try { if (window.localStorage) localStorage.removeItem(key); } catch (_) {}
}

// Small persistent "already seen" set. Falls back to memory when storage is blocked.
export const GuideStore = {
  _set: null,
  _load() {
    if (this._set) return this._set;
    let arr = [];
    try { arr = JSON.parse(safeRead(SEEN_KEY) || '[]'); } catch (_) { arr = []; }
    this._set = new Set(Array.isArray(arr) ? arr : []);
    if (safeRead(LEGACY_FISHING_KEY) === '1') this._set.add('fishing:done');
    return this._set;
  },
  has(id) { return this._load().has(id); },
  mark(id) {
    const s = this._load();
    if (s.has(id)) return;
    s.add(id);
    safeWrite(SEEN_KEY, JSON.stringify([...s]));
  },
  anySeen() { return this._load().size > 0; },
  resetAll() {
    this._set = new Set();
    safeRemove(SEEN_KEY);
    safeRemove(LEGACY_FISHING_KEY);
  }
};

// ---------------------------------------------------------------------------
// Ghost finger: a looping hand-demo drawn on the gesture canvas.
// ---------------------------------------------------------------------------
function fingerDot(ctx, x, y, alpha, pressed) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (pressed) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, 27, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = pressed ? 'rgba(255, 255, 255, 0.82)' : 'rgba(255, 255, 255, 0.55)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(x, y, pressed ? 17 : 19, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Swipe from a to b. `speed` 1 = normal (0.9s stroke), <1 slow, >1 fast. `time` in seconds.
export function drawGhostSwipe(ctx, a, b, time, speed = 1) {
  const moveDur = 0.9 / speed;
  const cycle = moveDur + 0.9;
  const t = (time % cycle) / cycle;
  const press = 0.2 / cycle, moveEnd = press + moveDur / cycle;
  if (t < press) {
    fingerDot(ctx, a.x, a.y, t / press, true);
  } else if (t < moveEnd) {
    const k = (t - press) / (moveEnd - press);
    const e = k * k * (3 - 2 * k);
    const x = a.x + (b.x - a.x) * e;
    const y = a.y + (b.y - a.y) * e;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();
    fingerDot(ctx, x, y, 1, true);
  } else {
    const k = (t - moveEnd) / Math.max(0.001, 1 - moveEnd);
    fingerDot(ctx, b.x, b.y, Math.max(0, 1 - k * 1.6), false);
  }
}

// Single tap pulse at a point. Pass `pressedNow` to sync the tap with a game cue.
export function drawGhostTap(ctx, p, time, pressedNow = null) {
  const t = (time % 1.1) / 1.1;
  const pressed = pressedNow === null ? (t > 0.35 && t < 0.55) : pressedNow;
  fingerDot(ctx, p.x, p.y - (pressed ? 0 : 6), 0.95, pressed);
}

// Press and hold at a point, ring grows while held.
export function drawGhostHold(ctx, p, time) {
  const t = (time % 2.4) / 2.4;
  const pressed = t > 0.1 && t < 0.8;
  fingerDot(ctx, p.x, p.y, 0.95, pressed);
  if (pressed) {
    const k = (t - 0.1) / 0.7;
    ctx.save();
    ctx.strokeStyle = 'rgba(61, 224, 138, 0.95)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
    ctx.stroke();
    ctx.restore();
  }
}

// Keep finger down and move back and forth between a and b.
export function drawGhostShuttle(ctx, a, b, time) {
  const k = 0.5 - 0.5 * Math.cos(time * 3.2);
  fingerDot(ctx, a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, 0.95, true);
}

// Keep finger down and orbit around c.
export function drawGhostCircle(ctx, c, radius, time) {
  const a = time * 2.6;
  fingerDot(ctx, c.x + Math.cos(a) * radius, c.y + Math.sin(a) * radius, 0.95, true);
}

// ---------------------------------------------------------------------------
// Coach card: short pause card shown only before rule-heavy steps.
// ---------------------------------------------------------------------------
const DEMOS = {
  swipe: '<div class="coach-demo-track"></div><div class="coach-demo-dot d-swipe"></div>',
  slow: '<div class="coach-demo-track"></div><div class="coach-demo-dot d-slow"></div><span class="coach-demo-cap">ゆっくり</span>',
  fast: '<div class="coach-demo-track v"></div><div class="coach-demo-dot d-fast"></div><span class="coach-demo-cap">すばやく</span>',
  timing: '<div class="coach-demo-bar"><div class="coach-demo-zone"></div><div class="coach-demo-cursor"></div></div><div class="coach-demo-dot d-tap"></div>',
  hold: '<div class="coach-demo-bar"><div class="coach-demo-zone wide"></div><div class="coach-demo-fill"></div></div><div class="coach-demo-dot d-hold"></div>',
  shuttle: '<div class="coach-demo-track"></div><div class="coach-demo-dot d-shuttle"></div><span class="coach-demo-cap">はなさない</span>',
  circle: '<div class="coach-demo-ring"></div><div class="coach-demo-dot d-circle"></div>'
};

export class MiniGameCoach {
  constructor(rootContainer, prefix) {
    this.root = rootContainer;
    this.prefix = prefix;
    this.open = false;
    this.pendingTimer = null;
    this.onChange = null;
    this._injectStyles();
    this._buildDOM();
  }

  isFirstPlay() { return !GuideStore.has('all:off') && !GuideStore.has(`${this.prefix}:done`); }
  markDone() { GuideStore.mark(`${this.prefix}:done`); }
  hasSeen(cardId) { return GuideStore.has('all:off') || GuideStore.has(`${this.prefix}:${cardId}`); }
  isBlocking() { return this.open || this.pendingTimer !== null; }

  // Ghost finger rule: on first play show it until the player touches;
  // afterwards (or later plays) bring it back only when the player seems stuck.
  shouldShowGhost(touchedThisStep, idleSec, pointerDown) {
    if (pointerDown || this.isBlocking()) return false;
    if (this.isFirstPlay() && !touchedThisStep) return idleSec > 0.6;
    return idleSec > 3.5;
  }

  // Returns true when a card was scheduled (game should hold input / timers).
  request(card, delaySec = 0) {
    if (!card || this.hasSeen(card.id)) return false;
    this.cancel();
    this.pendingTimer = setTimeout(() => {
      this.pendingTimer = null;
      this._show(card);
    }, Math.max(0, delaySec * 1000));
    return true;
  }

  cancel() {
    if (this.pendingTimer !== null) clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
    if (this.open) this._close(false);
  }

  _show(card) {
    this.card = card;
    this.elDemo.innerHTML = DEMOS[card.demo] || '';
    this.elDemo.classList.toggle('hidden', !DEMOS[card.demo]);
    this.elTitle.textContent = card.title;
    this.elBody.innerHTML = card.html;
    this.elOk.textContent = '分かった';
    this.el.classList.remove('hidden');
    this.open = true;
    if (this.onChange) this.onChange(true);
    setTimeout(() => { if (this.open) this.elOk.focus({ preventScroll: true }); }, 30);
  }

  _close(markSeen = true) {
    if (markSeen && this.card) GuideStore.mark(`${this.prefix}:${this.card.id}`);
    this.open = false;
    this.card = null;
    this.el.classList.add('hidden');
    if (this.onChange) this.onChange(false);
  }

  _buildDOM() {
    this.el = document.createElement('div');
    this.el.className = 'coach-layer hidden';
    this.el.innerHTML = `
      <div class="coach-card" role="dialog" aria-live="polite">
        <div class="coach-head">
          <div class="coach-demo"></div>
          <div class="coach-text">
            <div class="coach-kicker">はじめてのコツ</div>
            <div class="coach-title"></div>
          </div>
        </div>
        <div class="coach-body"></div>
        <button type="button" class="coach-ok">分かった</button>
        <div class="coach-note">この説明が出ている間、ゲームは止まっています</div>
      </div>
    `;
    this.root.appendChild(this.el);
    this.elDemo = this.el.querySelector('.coach-demo');
    this.elTitle = this.el.querySelector('.coach-title');
    this.elBody = this.el.querySelector('.coach-body');
    this.elOk = this.el.querySelector('.coach-ok');
    this.elOk.addEventListener('click', (e) => { e.stopPropagation(); this._close(true); });
    // Swallow touches so nothing behind the card reacts while it is open.
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  _injectStyles() {
    if (document.getElementById('coach-styles')) return;
    const st = document.createElement('style');
    st.id = 'coach-styles';
    st.textContent = `
      .coach-layer {
        position: fixed; inset: 0; z-index: 50; pointer-events: auto;
        background: rgba(2, 8, 18, 0.42);
        font-family: "Hiragino Maru Gothic ProN", "Rounded Mplus 1c", "Yu Gothic", sans-serif;
        animation: coachFade 0.18s ease-out;
      }
      .coach-layer.hidden { display: none !important; }
      @keyframes coachFade { from { opacity: 0; } to { opacity: 1; } }
      .coach-card {
        position: fixed; top: 54px; left: 50%; transform: translateX(-50%);
        width: min(420px, calc(100vw - 24px));
        background: linear-gradient(160deg, rgba(8, 22, 42, 0.97), rgba(4, 14, 28, 0.97));
        border: 1.6px solid rgba(255, 212, 84, 0.8); border-radius: 16px;
        padding: 12px 14px 10px; color: #eef6ff;
        box-shadow: 0 14px 40px rgba(0, 0, 0, 0.8);
        animation: coachRise 0.22s ease-out;
      }
      @keyframes coachRise { from { transform: translate(-50%, -8px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      .coach-head { display: flex; align-items: center; gap: 12px; }
      .coach-demo {
        position: relative; flex: 0 0 auto; width: 92px; height: 60px; border-radius: 10px;
        background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.14); overflow: hidden;
      }
      .coach-demo.hidden { display: none; }
      .coach-kicker { font-size: 10.5px; font-weight: 900; color: #ffe27a; letter-spacing: 0.06em; }
      .coach-title { font-size: clamp(14.5px, 4vw, 17px); font-weight: 900; color: #fff; line-height: 1.32; margin-top: 2px; }
      .coach-body { font-size: clamp(12px, 3.3vw, 13.5px); line-height: 1.55; color: #d9ecff; margin-top: 8px; }
      .coach-body b { color: #ffd454; }
      .coach-ok {
        width: 100%; margin-top: 10px; padding: 11px 14px; border-radius: 10px;
        border: 1px solid rgba(255, 232, 130, 0.7);
        background: linear-gradient(135deg, #1b7bc4, #28b5e0);
        color: #fff; font-size: 14.5px; font-weight: 900; cursor: pointer; font-family: inherit;
      }
      .coach-note { margin-top: 6px; font-size: 10.5px; color: #8cb4d6; text-align: center; }

      /* Tiny looping gesture demos */
      .coach-demo-track { position: absolute; left: 14px; right: 14px; top: 29px; height: 3px; border-radius: 2px; background: rgba(92, 225, 255, 0.6); }
      .coach-demo-track.v { left: 45px; right: auto; width: 3px; top: 8px; height: 44px; }
      .coach-demo-dot {
        position: absolute; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%;
        background: rgba(255, 255, 255, 0.9); box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.22);
      }
      .coach-demo-cap { position: absolute; left: 0; right: 0; bottom: 3px; text-align: center; font-size: 9.5px; font-weight: 900; color: #ffe27a; }
      .d-swipe   { top: 30px; animation: dSwipe 1.6s ease-in-out infinite; }
      .d-slow    { top: 24px; animation: dSwipe 3.2s linear infinite; }
      .d-shuttle { top: 24px; animation: dShuttle 1.4s ease-in-out infinite alternate; }
      .d-fast    { left: 46px; animation: dFast 1.5s ease-in infinite; }
      .d-tap     { left: 46px; top: 44px; animation: dTap 1.8s ease-in-out infinite; }
      .d-hold    { left: 46px; top: 44px; animation: dHold 2.6s linear infinite; }
      .d-circle  { left: 46px; top: 30px; animation: dCircle 1.6s linear infinite; }
      @keyframes dSwipe   { 0% { left: 14px; opacity: 0; } 12% { opacity: 1; } 80% { left: 78px; opacity: 1; } 100% { left: 78px; opacity: 0; } }
      @keyframes dShuttle { from { left: 16px; } to { left: 76px; } }
      @keyframes dFast    { 0%, 40% { top: 50px; opacity: 0; } 45% { opacity: 1; } 62% { top: 10px; opacity: 1; } 75%, 100% { top: 10px; opacity: 0; } }
      @keyframes dTap     { 0%, 41%, 59%, 100% { transform: scale(1); opacity: 0.55; } 50% { transform: scale(0.78); opacity: 1; } }
      @keyframes dHold    { 0%, 8% { transform: scale(1); opacity: 0.55; } 12%, 70% { transform: scale(0.8); opacity: 1; } 76%, 100% { transform: scale(1); opacity: 0.55; } }
      @keyframes dCircle  { from { transform: rotate(0deg) translateX(20px); } to { transform: rotate(360deg) translateX(20px); } }
      .coach-demo-ring { position: absolute; left: 26px; top: 10px; width: 40px; height: 40px; border-radius: 50%; border: 2px dashed rgba(255, 220, 90, 0.8); }
      .coach-demo-bar { position: absolute; left: 10px; right: 10px; top: 12px; height: 14px; border-radius: 4px; background: rgba(5, 16, 30, 0.95); border: 1px solid #5ce1ff; overflow: hidden; }
      .coach-demo-zone { position: absolute; left: 40%; width: 20%; top: 0; bottom: 0; background: rgba(61, 224, 138, 0.85); }
      .coach-demo-zone.wide { left: 48%; width: 24%; }
      .coach-demo-cursor { position: absolute; top: -2px; bottom: -2px; width: 4px; margin-left: -2px; background: #ffe066; animation: dCursor 1.8s ease-in-out infinite; }
      @keyframes dCursor { 0% { left: 4%; } 50% { left: 50%; } 100% { left: 96%; } }
      .coach-demo-fill { position: absolute; left: 0; top: 3px; bottom: 3px; background: #f5b342; animation: dFill 2.6s linear infinite; }
      @keyframes dFill { 0%, 10% { width: 0%; background: #f5b342; } 55% { background: #f5b342; } 60%, 70% { width: 60%; background: #3de08a; } 100% { width: 60%; background: #3de08a; } }

      /* Rule chip in the mini-game top card */
      .mg-hint-row { display: flex; align-items: center; justify-content: center; gap: 7px; margin-top: 3px; flex-wrap: wrap; }
      .mg-hint-row .mg-hint-text { margin-top: 0; }
      .mg-rule-chip {
        flex: 0 0 auto; padding: 2px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 900;
        background: rgba(92, 225, 255, 0.16); border: 1px solid rgba(92, 225, 255, 0.75); color: #aef0ff;
      }
      .mg-rule-chip.warn { background: rgba(255, 212, 84, 0.18); border-color: #ffd454; color: #ffe58a; }
      .mg-rule-chip.hidden { display: none; }
    `;
    document.head.appendChild(st);
  }
}
