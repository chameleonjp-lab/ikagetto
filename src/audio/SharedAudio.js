// One AudioContext shared by every sound in the app (sea / winch / mini-games).
//
// Why: browsers (iOS Safari in particular) suspend or "interrupt" an AudioContext
// when the page is hidden, another app takes the audio, or the phone locks.
// It only comes back when resume() is called from inside a user gesture.
// Before, resume was only tried on a few buttons, so after returning to the game
// or replaying, every sound could stay silent. Here every tap tries to wake it,
// and a context that cannot be woken is replaced with a new one.

let ctx = null;
const listeners = new Set();

export function getAudioContext() {
  return ctx;
}

// Called with the new context whenever one is (re)created, so owners can rebuild nodes.
export function onAudioContextCreated(fn) {
  listeners.add(fn);
}

export function ensureAudioContext() {
  if (!ctx || ctx.state === 'closed') {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    listeners.forEach((fn) => {
      try { fn(ctx); } catch (_) {}
    });
  }
  return ctx;
}

function recreate(old) {
  if (ctx !== old) return;
  try { old.close(); } catch (_) {}
  ctx = null;
  ensureAudioContext();
}

// Must be called from inside a user gesture (tap / click / key).
export function unlockAudio() {
  const c = ensureAudioContext();
  if (!c || c.state === 'running') return;
  try {
    // iOS needs a sound started inside the gesture to fully open the output.
    const b = c.createBuffer(1, 1, 22050);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(c.destination);
    s.start(0);
  } catch (_) {}
  c.resume()
    .then(() => {
      // A context that still is not running after resume is broken; replace it.
      setTimeout(() => { if (c.state !== 'running') recreate(c); }, 400);
    })
    .catch(() => recreate(c));
}

let installed = false;
export function installAudioUnlock() {
  if (installed) return;
  installed = true;
  const onGesture = () => unlockAudio();
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach((type) => {
    window.addEventListener(type, onGesture, { capture: true, passive: true });
  });
  const onVisible = () => {
    if (document.hidden || !ctx || ctx.state === 'running') return;
    ctx.resume().catch(() => {});
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pageshow', onVisible);
  window.addEventListener('focus', onVisible);
}
