// Stops the browser's own touch gestures from getting in the way of the game:
// text / element selection, long-press menus, pinch and double-tap zoom,
// pull-to-refresh, edge swipes that go back / forward, and the back action.
//
// Notes (from public reports, not tested on every device):
//  - iOS Safari ignores user-scalable=no in the viewport tag (iOS 10+), so zoom is
//    stopped with CSS touch-action and by cancelling the WebKit gesture events.
//  - iOS Safari 13.4+ lets a page cancel the back / forward edge swipe by calling
//    preventDefault() on a touchstart that begins near the screen edge
//    (the listener must be non-passive). It may still fail while the page scrolls,
//    and Chrome on iOS does not always honour it.
//  - Nothing lets a page block the browser's back action itself, so during play we
//    keep an extra history entry and step forward again when "back" is used.
//
// The home screen still supports scrolling, text editing, and native controls.

const EDGE_PX = 24;

const CSS = `
  html, body {
    overscroll-behavior: none;          /* no pull-to-refresh / overscroll navigation */
  }
  html.game-playing, html.game-playing body {
    touch-action: none;                 /* no pinch zoom, double-tap zoom or panning */
  }
  html, body, body * {
    -webkit-user-select: none;
    user-select: none;                  /* no text / element selection */
    -webkit-touch-callout: none;        /* no long-press menu on iOS */
    -webkit-tap-highlight-color: transparent;
  }
  html #app #home-player-name, input, textarea, [contenteditable="true"] {
    -webkit-user-select: text; user-select: text; touch-action: manipulation;
    -webkit-touch-callout: default;
  }
`;

function isEditable(el) {
  return !!el?.closest?.('input, select, textarea, [contenteditable="true"]');
}

let trapBack = false;
let guardPushed = false;

// Turn the "back stays in the game" guard on while playing, off on the home screen.
export function setBackGuard(on) {
  if (trapBack !== !!on) document.documentElement.classList.toggle('game-playing', !!on);
  trapBack = !!on;
  if (trapBack && !guardPushed) {
    try { history.pushState({ ikagettoGuard: true }, ''); guardPushed = true; } catch (_) {}
  }
}

export function installTouchGuard() {
  if (!document.getElementById('touch-guard-styles')) {
    const st = document.createElement('style');
    st.id = 'touch-guard-styles';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  const cancel = (e) => { if (!isEditable(e.target)) e.preventDefault(); };

  // Long-press menus, selection, drag of images / text.
  document.addEventListener('contextmenu', cancel);
  document.addEventListener('selectstart', cancel);
  document.addEventListener('dragstart', cancel);

  // Pinch zoom (WebKit gesture events) and multi-finger moves.
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', cancel, { passive: false });

  // Edge swipe back / forward: cancel touches that start at the left or right edge.
  // Cancelling a touchstart also cancels the click that would follow, so a button
  // touched there is clicked by hand when the finger lifts on the same button.
  let edgeTarget = null;
  document.addEventListener('touchstart', (e) => {
    edgeTarget = null;
    if (!trapBack || isEditable(e.target)) return;
    const t = e.touches[0];
    if (!t || e.touches.length > 1) return;
    if (t.clientX > EDGE_PX && t.clientX < window.innerWidth - EDGE_PX) return;
    e.preventDefault();
    edgeTarget = e.target?.closest?.('button, [role="button"], a[href]') || null;
  }, { passive: false });
  document.addEventListener('touchend', (e) => {
    if (!edgeTarget) return;
    const t = e.changedTouches[0];
    const el = t ? document.elementFromPoint(t.clientX, t.clientY) : null;
    if (el && edgeTarget.contains(el) && !edgeTarget.disabled) edgeTarget.click();
    edgeTarget = null;
  });

  // Browser back during play: step forward again instead of leaving the game.
  window.addEventListener('popstate', () => {
    guardPushed = false;
    if (trapBack) setBackGuard(true);
  });
}
