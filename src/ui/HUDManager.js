export class HUDManager {
  constructor(rootContainer, callbacks = {}) {
    this.root = rootContainer;
    this.callbacks = callbacks;

    this.inputState = {
      throttle: 0,
      rudder: 0,
      bowThruster: 0,
      winchPower: 0,
      dragLevel: 0.55,
      lightPower: 0.45,
      hookAction: false,
      dropRig: false,
      craneAction: false
    };

    this.panelState = {
      sonar: true,        // Open by default in SEARCH so distance & linear graph are immediately clear!
      gauges: false,      // Auto-opens at top once Hookup / LURE_HOOK begins
      status: true,
      pip: true
    };
    this.userClosedGauges = false;
    this.lastPhase = 'HOME';
    this.lastLureStage = '';
    this.calloutTimer = 0;

    this.joyX = 0;
    this.joyY = 0;
    this.joyPointerId = null;
    this.keys = new Set();

    // Linear graph history buffer for Sonar (64 samples)
    this.SONAR_SAMPLES = 64;
    this.sonarSignalHistory = new Float32Array(this.SONAR_SAMPLES);
    this.sonarDepthHistory = new Float32Array(this.SONAR_SAMPLES);
    this.sonarSampleTimer = 0;

    this._injectStyles();
    this._buildDOM();
    this._bindEvents();
    this._applyPanelVisibility();
  }

  isPiPVisible() {
    return this.panelState.pip;
  }

  hideAll() {
    this.elHomeScreen.classList.add('hidden');
    this.elTopWrap.classList.add('hidden');
    this.elShipKeypad.classList.add('hidden');
    this.elActionPad.classList.add('hidden');
    this.elSonarPanel.classList.add('hidden');
    this.elCraneTimingPanel.classList.add('hidden');
    this.elInspectBar.classList.add('hidden');
    this.elRovOverlay.classList.remove('active');
    this.elPipLabel.classList.add('hidden');
    this.elBigCallout.classList.remove('show');
    this.elResultModal.classList.add('hidden');
  }

  _injectStyles() {
    if (document.getElementById('hud-maritime-styles')) return;
    const style = document.createElement('style');
    style.id = 'hud-maritime-styles';
    style.textContent = `
      :root {
        --bg-panel: rgba(5, 14, 28, 0.84);
        --border-cyan: rgba(78, 178, 232, 0.34);
        --amber: #f5b342;
        --cyan: #5ce1ff;
        --danger: #ff4a4a;
        --ok: #3de08a;
        --text-main: #d8eaf7;
        --text-dim: #799ab5;
      }
      #hud-layer {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 20;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif;
        color: var(--text-main);
        user-select: none;
        -webkit-user-select: none;
      }
      .hud-panel {
        pointer-events: auto;
        background: var(--bg-panel);
        border: 1px solid var(--border-cyan);
        border-radius: 10px;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
      }
      .hud-panel.collapsed, .hidden {
        display: none !important;
      }

      /* HOME SCREEN (Atmospheric Glass Overlay over live 3D Ocean & Vessel) */
      #home-screen {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: radial-gradient(circle at 50% 45%, rgba(2, 12, 28, 0.25) 0%, rgba(1, 6, 16, 0.76) 100%);
        pointer-events: auto;
        z-index: 45;
      }
      .home-card {
        width: min(460px, 100%);
        background: rgba(5, 16, 34, 0.82);
        border: 1px solid rgba(92, 225, 255, 0.38);
        border-radius: 18px;
        padding: 26px 22px;
        text-align: center;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.72);
      }
      .home-kicker {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.2em;
        color: var(--cyan);
        text-transform: uppercase;
      }
      .home-title {
        font-size: clamp(24px, 6.5vw, 32px);
        font-weight: 900;
        color: #f4faff;
        margin: 8px 0 4px;
        letter-spacing: 0.04em;
      }
      .home-latin {
        font-size: 13px;
        font-style: italic;
        color: #8bc2e6;
        margin-bottom: 16px;
      }
      .home-steps {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin-bottom: 16px;
        text-align: left;
      }
      .home-step {
        background: rgba(12, 30, 56, 0.75);
        border: 1px solid rgba(92, 225, 255, 0.2);
        border-radius: 9px;
        padding: 8px;
        font-size: 11px;
        line-height: 1.4;
      }
      .home-step strong {
        display: block;
        color: var(--amber);
        font-size: 11.5px;
        margin-bottom: 2px;
      }
      .home-equip-note {
        font-size: 11px;
        color: #9ac5e3;
        background: rgba(20, 52, 86, 0.45);
        border-radius: 8px;
        padding: 7px 10px;
        margin-bottom: 16px;
      }
      .home-play-btn {
        width: 100%;
        padding: 14px 18px;
        border-radius: 12px;
        border: 1px solid rgba(150, 238, 255, 0.65);
        background: linear-gradient(135deg, #1678be, #22b8e2);
        color: #ffffff;
        font-size: 16px;
        font-weight: 800;
        letter-spacing: 0.08em;
        cursor: pointer;
        box-shadow: 0 10px 28px rgba(34, 184, 226, 0.42);
        transition: transform 0.12s ease, box-shadow 0.2s ease;
      }
      .home-play-btn:hover { transform: translateY(-1px); box-shadow: 0 14px 34px rgba(34, 184, 226, 0.58); }
      .home-play-btn:active { transform: scale(0.98); }
      .home-guide-link {
        margin-top: 12px; background: transparent; border: none; color: #8cc8ec;
        font-size: 12px; font-weight: 700; text-decoration: underline; cursor: pointer; font-family: inherit;
      }
      .home-guide-link.hidden { display: none; }

      /* Top Stack: Toolbar + Guide + Hookup/Fight Instruments */
      #hud-top-wrap {
        position: fixed;
        top: 8px;
        left: 52px;
        right: 8px;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
        pointer-events: none;
        z-index: 30;
      }
      #hud-top-bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 5px;
        padding: 5px 8px;
        max-width: 100%;
      }
      .phase-pill {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        padding: 3px 8px;
        border-radius: 5px;
        background: rgba(92, 225, 255, 0.18);
        border: 1px solid rgba(92, 225, 255, 0.45);
        color: var(--cyan);
        white-space: nowrap;
      }
      .phase-pill.alarm {
        background: rgba(255, 74, 74, 0.28);
        border-color: var(--danger);
        color: #ff9c9c;
        animation: hudBlink 0.5s infinite alternate;
      }
      @keyframes hudBlink { from { opacity: 1; } to { opacity: 0.42; } }

      .mini-btn {
        background: rgba(16, 38, 66, 0.88);
        border: 1px solid rgba(92, 225, 255, 0.32);
        color: #d8f2ff;
        font-size: 11px;
        padding: 4px 8px;
        border-radius: 6px;
        cursor: pointer;
        white-space: nowrap;
      }
      .mini-btn:hover { background: rgba(30, 68, 112, 0.95); }
      .mini-btn.active {
        background: rgba(40, 118, 178, 0.85);
        border-color: var(--cyan);
        color: #ffffff;
      }

      #hud-status-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 9px;
        max-width: min(560px, 100%);
      }
      #hud-status-msg {
        font-size: 11.5px;
        color: #e6f4ff;
        line-height: 1.38;
        flex: 1;
        min-width: 0;
        word-break: break-word;
      }
      .close-x {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #c8e2f5;
        font-size: 11px;
        line-height: 1;
        padding: 3px 6px;
        border-radius: 5px;
        cursor: pointer;
        flex-shrink: 0;
      }
      .close-x:hover { background: rgba(255, 90, 90, 0.3); color: #fff; }

      /* TOP INSTRUMENTS PANEL */
      #top-gauges {
        width: min(540px, 100%);
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .panel-hdr {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 6px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.06em;
        color: var(--amber);
        text-transform: uppercase;
      }
      .panel-hdr-right { display: flex; align-items: center; gap: 6px; }
      .top-gauge-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 10px; }
      .gauge-row { display: flex; flex-direction: column; gap: 2px; }
      .gauge-lbl { display: flex; justify-content: space-between; font-size: 10.5px; font-variant-numeric: tabular-nums; }
      .gauge-track { height: 7px; border-radius: 4px; background: rgba(255, 255, 255, 0.09); overflow: hidden; }
      .gauge-fill {
        height: 100%; width: 0%; border-radius: 4px; transition: width 0.08s linear;
        background: linear-gradient(90deg, #32d583, #f5b342 70%, #ff4a4a 92%);
      }
      .gauge-fill.cyan { background: linear-gradient(90deg, #2ca9e1, #5ce1ff); }
      .gauge-fill.amber { background: linear-gradient(90deg, #e09f3e, #ff595e); }
      .top-sliders { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding-top: 2px; }
      .slider-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; font-size: 10.5px; }
      .slider-row span:first-child { white-space: nowrap; }
      .slider-row input[type="range"] { flex: 1; min-width: 48px; accent-color: var(--cyan); cursor: pointer; }

      /* UPGRADED SONAR PANEL (Big Distance Readout + Linear Line-Graph) */
      #hud-sonar-panel {
        position: fixed;
        left: 10px;
        bottom: 162px;
        width: 224px;
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        z-index: 24;
      }
      .sonar-big-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        background: rgba(4, 22, 38, 0.85);
        border: 1px solid rgba(92, 225, 255, 0.28);
        border-radius: 8px;
        padding: 6px 10px;
      }
      .sonar-dist-big {
        font-size: 24px;
        font-weight: 900;
        font-variant-numeric: tabular-nums;
        color: #7ce8ff;
        line-height: 1;
      }
      .sonar-dist-big.ready {
        color: #3de08a;
        text-shadow: 0 0 12px rgba(61, 224, 138, 0.65);
      }
      .sonar-dist-big, .sonar-bearing { white-space: nowrap; }
      .sonar-big-row { gap: 6px; }
      .sonar-bearing {
        font-size: 12px;
        font-weight: 800;
        color: var(--amber);
      }
      #sonar-canvas {
        width: 100%;
        height: 86px;
        border-radius: 6px;
        background: #020c14;
        border: 1px solid rgba(92, 225, 255, 0.28);
        display: block;
      }
      .helm-meta {
        display: flex;
        justify-content: space-between;
        font-size: 10px;
        font-variant-numeric: tabular-nums;
        color: var(--text-dim);
      }
      .tangle-lamp {
        font-size: 9.5px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(40, 180, 110, 0.16);
        color: var(--ok);
        border: 1px solid rgba(61, 224, 138, 0.3);
        text-align: center;
      }
      .tangle-lamp.warn {
        background: rgba(255, 74, 74, 0.28);
        color: #ff9c9c;
        border-color: var(--danger);
        animation: hudBlink 0.45s infinite alternate;
      }

      /* BOTTOM-LEFT: 360° Circular Swipe Joystick */
      #ship-keypad {
        position: fixed;
        left: 10px;
        bottom: 10px;
        width: 136px;
        padding: 8px 8px 10px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        z-index: 26;
      }
      #ship-keypad .panel-hdr { width: 100%; }
      #joy-base {
        position: relative;
        width: 112px;
        height: 112px;
        border-radius: 50%;
        background: radial-gradient(circle at 50% 50%, rgba(18, 48, 82, 0.72) 0%, rgba(6, 18, 34, 0.92) 72%, rgba(92, 225, 255, 0.22) 100%);
        border: 2px solid rgba(92, 225, 255, 0.42);
        box-shadow: inset 0 0 18px rgba(0, 0, 0, 0.65), 0 0 14px rgba(56, 175, 235, 0.22);
        touch-action: none;
        cursor: grab;
      }
      #joy-base.active {
        border-color: #7ee8ff;
        box-shadow: inset 0 0 18px rgba(0, 0, 0, 0.55), 0 0 20px rgba(92, 225, 255, 0.5);
        cursor: grabbing;
      }
      #joy-base::before, #joy-base::after {
        content: ""; position: absolute; left: 50%; top: 50%;
        background: rgba(92, 225, 255, 0.18); pointer-events: none;
      }
      #joy-base::before { width: 82%; height: 1px; transform: translate(-50%, -50%); }
      #joy-base::after  { width: 1px; height: 82%; transform: translate(-50%, -50%); }
      .joy-dir-lbl { position: absolute; font-size: 9px; font-weight: 700; color: rgba(155, 215, 245, 0.6); pointer-events: none; }
      .joy-dir-n { top: 4px; left: 50%; transform: translateX(-50%); }
      .joy-dir-s { bottom: 4px; left: 50%; transform: translateX(-50%); }
      .joy-dir-w { left: 6px; top: 50%; transform: translateY(-50%); }
      .joy-dir-e { right: 6px; top: 50%; transform: translateY(-50%); }
      #joy-knob {
        position: absolute; left: 50%; top: 50%;
        width: 44px; height: 44px; margin-left: -22px; margin-top: -22px;
        border-radius: 50%;
        background: radial-gradient(circle at 35% 32%, #8ef0ff 0%, #2688c2 55%, #0d3a60 100%);
        border: 2px solid rgba(210, 248, 255, 0.85);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6), 0 0 12px rgba(92, 225, 255, 0.55);
        pointer-events: none;
        transition: transform 0.06s ease-out;
      }
      #joy-base.active #joy-knob { transition: none; }

      /* BOTTOM-RIGHT: Always-Visible Action Pad */
      #action-pad {
        position: fixed;
        right: 10px;
        bottom: 10px;
        width: min(230px, calc(100vw - 170px));
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 7px;
        z-index: 26;
      }
      .winch-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
      .winch-pair.hidden, #btn-hook.hidden { display: none; }

      /* Big, colour-coded winch buttons: green = reel in, blue = pay out.
         Grey = cannot press now. Blinking = press this one now. */
      #btn-reel-in, #btn-reel-out {
        min-height: 78px;
        padding: 8px 4px;
        font-size: 16px;
        font-weight: 900;
        line-height: 1.25;
        border-radius: 12px;
        color: #ffffff;
      }
      #btn-reel-in  { background: rgba(28, 128, 74, 0.95); border: 2px solid rgba(110, 240, 160, 0.75); }
      #btn-reel-out { background: rgba(24, 92, 168, 0.95); border: 2px solid rgba(120, 200, 255, 0.75); }
      #btn-reel-in.pressed  { background: rgba(46, 176, 104, 1); }
      #btn-reel-out.pressed { background: rgba(40, 130, 220, 1); }
      #btn-reel-in.dim, #btn-reel-out.dim { opacity: 0.45; }
      #btn-reel-in.blink, #btn-reel-out.blink { animation: btnBlink 0.7s ease-in-out infinite; }
      #btn-reel-in.blink  { --blink-glow: rgba(110, 255, 170, 0.95); }
      #btn-reel-out.blink { --blink-glow: rgba(120, 210, 255, 0.95); }
      @keyframes btnBlink {
        0%, 100% { filter: brightness(1); box-shadow: 0 0 6px var(--blink-glow); transform: scale(1); }
        50%      { filter: brightness(1.45); box-shadow: 0 0 22px var(--blink-glow), 0 0 40px var(--blink-glow); transform: scale(1.04); }
      }
      #btn-hook { min-height: 72px; font-size: 17px; font-weight: 900; border-radius: 12px; }
      #btn-crane { display: none !important; }
      .ctrl-btn {
        background: rgba(14, 34, 58, 0.92);
        border: 1px solid rgba(92, 225, 255, 0.32);
        color: #d8ecfa;
        font-size: 11px;
        font-weight: 600;
        padding: 8px 4px;
        border-radius: 7px;
        cursor: pointer;
        text-align: center;
        touch-action: none;
        transition: transform 0.08s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease;
      }
      .ctrl-btn:hover:not(:disabled) { background: rgba(26, 62, 102, 0.95); }
      .ctrl-btn:active:not(:disabled), .ctrl-btn.pressed {
        background: rgba(60, 155, 220, 0.5); border-color: var(--cyan); transform: scale(0.96);
      }
      .ctrl-btn.hook-btn {
        background: rgba(135, 28, 32, 0.9); border-color: rgba(255, 110, 110, 0.55); color: #ffecec; padding: 9px 6px;
      }
      .ctrl-btn.crane-btn {
        background: rgba(138, 88, 18, 0.9); border-color: rgba(245, 179, 66, 0.6); color: #fff4d6; padding: 9px 6px;
      }
      .ctrl-btn:disabled {
        background: rgba(22, 30, 42, 0.65) !important;
        border-color: rgba(110, 130, 150, 0.22) !important;
        color: rgba(140, 160, 180, 0.42) !important;
        box-shadow: none !important;
        cursor: not-allowed;
        animation: none !important;
      }

      /* LARGE DEDICATED CRANE TIMING PANEL (Phase 5 LANDING) */
      #crane-timing-panel {
        position: fixed;
        left: 50%;
        /* Shown only while landing, when the stick and winch pad are hidden,
           so it sits low and leaves the middle free for the "海面到達!!" callout. */
        bottom: calc(24px + env(safe-area-inset-bottom, 0px));
        transform: translateX(-50%);
        width: min(360px, calc(100vw - 20px));
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 9px;
        z-index: 32;
        border-color: rgba(245, 179, 66, 0.55);
      }
      .crane-cond-row {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
      }
      .cond-pill {
        font-size: 11px;
        font-weight: 700;
        padding: 5px 4px;
        border-radius: 6px;
        text-align: center;
        background: rgba(160, 35, 35, 0.35);
        border: 1px solid rgba(255, 95, 95, 0.45);
        color: #ffb0b0;
        white-space: nowrap;
      }
      .cond-pill.ok {
        background: rgba(34, 175, 100, 0.28);
        border-color: #3de08a;
        color: #a6ffd0;
      }
      .wave-timing-track {
        position: relative;
        height: 18px;
        border-radius: 9px;
        background: rgba(8, 22, 42, 0.92);
        border: 1px solid rgba(92, 225, 255, 0.3);
        overflow: hidden;
      }
      .wave-ok-zone {
        position: absolute;
        right: 0;
        top: 0;
        bottom: 0;
        width: 39%;
        background: rgba(61, 224, 138, 0.28);
        border-left: 2px dashed #3de08a;
      }
      .wave-marker {
        position: absolute;
        top: 2px;
        width: 14px;
        height: 14px;
        margin-left: -7px;
        border-radius: 50%;
        background: #5ce1ff;
        box-shadow: 0 0 10px #5ce1ff;
      }
      .wave-marker.in-zone {
        background: #3de08a;
        box-shadow: 0 0 14px #3de08a;
      }
      #btn-crane-big {
        width: 100%;
        padding: 15px 12px;
        font-size: 16px;
        font-weight: 900;
        letter-spacing: 0.05em;
        border-radius: 10px;
        white-space: nowrap;
        font-size: clamp(13px, 3.8vw, 16px);
      }

      /* INSPECT / OBSERVATION BAR (After Capture Cutscene) */
      #inspect-bar {
        position: fixed;
        left: 50%;
        bottom: 14px;
        transform: translateX(-50%);
        width: min(460px, calc(100vw - 20px));
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        text-align: center;
        z-index: 36;
      }
      .inspect-stats {
        font-size: 14px;
        font-weight: 800;
        color: #fff4d2;
      }
      .inspect-hint {
        font-size: 11px;
        color: #9ec8e6;
      }
      .inspect-btns {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      /* GUIDED BUTTON GLOW ANIMATIONS */
      .ctrl-btn.glow-cyan {
        background: rgba(18, 102, 156, 0.95) !important;
        border-color: #7ee8ff !important;
        color: #ffffff !important;
        animation: pulseCyan 0.85s ease-in-out infinite;
      }
      .ctrl-btn.glow-gold {
        background: rgba(196, 112, 14, 0.96) !important;
        border-color: #ffe07d !important;
        color: #ffffff !important;
        animation: pulseGold 0.6s ease-in-out infinite;
      }
      .ctrl-btn.glow-red {
        background: rgba(210, 32, 38, 0.98) !important;
        border-color: #ffcf70 !important;
        color: #ffffff !important;
        animation: pulseRed 0.5s ease-in-out infinite;
      }
      @keyframes pulseCyan {
        0%, 100% { box-shadow: 0 0 8px rgba(92, 225, 255, 0.7), 0 0 18px rgba(92, 225, 255, 0.4); transform: scale(1); }
        50%      { box-shadow: 0 0 16px rgba(126, 236, 255, 1), 0 0 32px rgba(92, 225, 255, 0.8); transform: scale(1.04); }
      }
      @keyframes pulseGold {
        0%, 100% { box-shadow: 0 0 10px rgba(255, 200, 70, 0.8), 0 0 22px rgba(245, 165, 35, 0.5); transform: scale(1); }
        50%      { box-shadow: 0 0 22px rgba(255, 232, 120, 1), 0 0 42px rgba(255, 180, 40, 0.95); transform: scale(1.05); }
      }
      @keyframes pulseRed {
        0%, 100% { box-shadow: 0 0 12px rgba(255, 85, 65, 0.9), 0 0 26px rgba(255, 185, 60, 0.6); transform: scale(1); }
        50%      { box-shadow: 0 0 24px rgba(255, 110, 80, 1), 0 0 46px rgba(255, 220, 90, 1); transform: scale(1.07); }
      }

      /* DRAMATIC BIG TEXT CALLOUT BANNER */
      #big-callout {
        position: fixed;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        z-index: 35;
        opacity: 0;
        transform: scale(0.84);
        transition: opacity 0.2s ease, transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
        text-align: center;
        padding: 16px;
      }
      #big-callout.show { opacity: 1; transform: scale(1); }
      .callout-main {
        font-size: clamp(28px, 8vw, 54px);
        font-weight: 900;
        letter-spacing: 0.08em;
        color: #fff6d6;
        text-shadow: 0 0 18px rgba(255, 180, 40, 0.95), 0 0 42px rgba(255, 70, 40, 0.85), 0 4px 14px rgba(0, 0, 0, 0.9);
        line-height: 1.1;
      }
      .callout-main.hooked {
        color: #ffffff;
        text-shadow: 0 0 20px rgba(92, 225, 255, 1), 0 0 48px rgba(255, 80, 60, 0.95), 0 4px 16px rgba(0, 0, 0, 0.95);
      }
      .callout-sub {
        margin-top: 8px;
        font-size: clamp(14px, 4vw, 21px);
        font-weight: 800;
        padding: 6px 16px;
        border-radius: 999px;
        background: rgba(8, 18, 34, 0.84);
        border: 2px solid #ffd56b;
        color: #ffe89e;
        box-shadow: 0 0 24px rgba(255, 190, 55, 0.65);
      }

      /* ROV Overlay & PiP Label */
      #rov-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 12; display: none; }
      #rov-overlay.active { display: block; }
      .rov-rec {
        position: fixed; bottom: 140px; right: 12px;
        font-size: 10px; font-weight: 700; letter-spacing: 0.08em; color: #ff6b6b;
        display: flex; align-items: center; gap: 5px;
      }
      .rec-dot { width: 7px; height: 7px; border-radius: 50%; background: #ff4a4a; animation: hudBlink 0.9s infinite alternate; }
      .rov-meta {
        position: fixed; bottom: 158px; right: 12px; text-align: right;
        font-size: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        color: rgba(155, 220, 255, 0.85); line-height: 1.4;
      }
      .pip-label {
        position: fixed; top: 56px; right: 10px;
        font-size: 10px; font-weight: 700; color: var(--cyan);
        background: rgba(3, 12, 24, 0.8); border: 1px solid rgba(92, 225, 255, 0.35);
        padding: 2px 7px; border-radius: 5px; pointer-events: auto; cursor: pointer; z-index: 26;
      }

      @media (max-width: 768px) {
        #hud-top-wrap { left: 50px; right: 6px; top: 6px; }
        #ship-keypad { width: 132px; left: 8px; bottom: 8px; padding: 7px 7px 9px; }
        #action-pad { right: 8px; bottom: 8px; padding: 7px; }
        #hud-sonar-panel { left: 8px; bottom: 162px; width: 204px; }
        .pip-label { top: 96px; right: 8px; }
        .ctrl-btn { font-size: 10.5px; padding: 7px 3px; }
      }

      /* Result Modal */
      .modal-backdrop {
        position: fixed; inset: 0; background: rgba(1, 7, 16, 0.82); backdrop-filter: blur(6px);
        display: flex; align-items: center; justify-content: center; padding: 14px; pointer-events: auto; z-index: 44;
      }
      .modal-box {
        width: min(460px, 100%); background: #071528; border: 1px solid rgba(92, 225, 255, 0.38);
        border-radius: 14px; padding: 20px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.72);
      }
      .modal-title { font-size: 18px; font-weight: 800; color: #f0f8ff; margin-bottom: 4px; }
      .modal-sub { font-size: 13px; color: #d8eaf7; margin-bottom: 12px; line-height: 1.65; }
      .rank-badge { display: inline-block; font-size: 34px; font-weight: 900; color: var(--amber); margin: 8px 0; }
      .primary-btn {
        width: 100%; margin-top: 10px; padding: 11px; border-radius: 9px; border: none;
        background: linear-gradient(135deg, #1b7ec2, #25b0d8);
        color: #ffffff; font-size: 14px; font-weight: 700; cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  _buildDOM() {
    this.layer = document.createElement('div');
    this.layer.id = 'hud-layer';
    this.layer.innerHTML = `
      <!-- HOME SCREEN -->
      <div id="home-screen">
        <div class="home-card">
          <div class="home-kicker">DEEP SEA FISHING SIMULATOR</div>
          <div class="home-title">イカゲット</div>
          <div class="home-latin">Architeuthis dux — Depth 800m</div>
          <div class="home-steps">
            <div class="home-step"><strong>① 索敵・投下</strong>360°スティックで反応地点へ近づき仕掛けを投下</div>
            <div class="home-step"><strong>② 深海フッキング</strong>抱え込みの瞬間に光るフッキングボタンを押す</div>
            <div class="home-step"><strong>③ ファイト＆揚収</strong>張力・温度を管理し波頂点でクレーン揚収</div>
          </div>

          <button type="button" id="btn-home-play" class="home-play-btn">出港する（PLAY）</button>
          <button type="button" id="btn-home-guide" class="home-guide-link hidden">はじめてガイドを、もう一度見る</button>
        </div>
      </div>

      <!-- Top Stack: Compact Toolbar + Guide + Hookup/Fight Instruments -->
      <div id="hud-top-wrap" class="hidden">
        <div id="hud-top-bar" class="hud-panel">
          <span id="hud-phase-pill" class="phase-pill">SEARCH</span>
          <button type="button" id="btn-toggle-sonar" class="mini-btn active">ソナー</button>
          <button type="button" id="btn-toggle-gauges" class="mini-btn">計器</button>
          <button type="button" id="btn-swap-view" class="mini-btn">視点</button>
          <button type="button" id="btn-toggle-pip" class="mini-btn active">PiP</button>
          <button type="button" id="btn-toggle-status" class="mini-btn active">ガイド</button>
          <button type="button" id="btn-mute" class="mini-btn">音ON</button>
        </div>

        <div id="hud-status-bar" class="hud-panel">
          <span id="hud-status-msg">ソナー反応地点へ操船してください</span>
          <button type="button" id="btn-close-status" class="close-x" title="閉じる">×</button>
        </div>

        <div id="top-gauges" class="hud-panel collapsed">
          <div class="panel-hdr">
            <span>WINCH &amp; FIGHT // 計器</span>
            <div class="panel-hdr-right">
              <span id="right-depth">0 m</span>
              <button type="button" id="btn-close-gauges" class="close-x" title="閉じる">×</button>
            </div>
          </div>
          <div class="top-gauge-grid">
            <div class="gauge-row">
              <div class="gauge-lbl"><span>ライン張力</span><span id="val-tension">0%</span></div>
              <div class="gauge-track"><div class="gauge-fill" id="bar-tension"></div></div>
            </div>
            <div class="gauge-row">
              <div class="gauge-lbl"><span>ウインチ温度</span><span id="val-temp">26°C</span></div>
              <div class="gauge-track"><div class="gauge-fill amber" id="bar-temp"></div></div>
            </div>
            <div class="gauge-row">
              <div class="gauge-lbl"><span>イカスタミナ</span><span id="val-stamina">100%</span></div>
              <div class="gauge-track"><div class="gauge-fill cyan" id="bar-stamina"></div></div>
            </div>
          </div>

        </div>
      </div>

      <!-- Dramatic Center Callout Banner -->
      <div id="big-callout">
        <div class="callout-main" id="callout-main">HOOKED!!</div>
        <div class="callout-sub" id="callout-sub">ダイオウイカが掛かった！</div>
      </div>

      <!-- ROV Camera Reticle Overlay -->
      <div id="rov-overlay">
        <div class="rov-rec"><span class="rec-dot"></span>REC // ROV</div>
        <div class="rov-meta" id="rov-meta-text">DEPTH: 0 m<br>TEMP: 4.2 °C</div>
      </div>
      <div class="pip-label hidden" id="pip-label" title="クリックでPiP非表示">PiP: DEEP ROV ×</div>

      <!-- UPGRADED SONAR PANEL (Big Distance + Linear Line-Graph) -->
      <div id="hud-sonar-panel" class="hud-panel hidden">
        <div class="panel-hdr">
          <span>SONAR // 線形魚探</span>
          <div class="panel-hdr-right">
            <span id="sonar-sig-lbl">SIG 0%</span>
            <button type="button" id="btn-close-sonar" class="close-x" title="閉じる">×</button>
          </div>
        </div>
        <div class="sonar-big-row">
          <span class="sonar-dist-big" id="sonar-dist-big">35 m</span>
          <span class="sonar-bearing" id="sonar-bearing">▲ まっすぐ</span>
        </div>
        <canvas id="sonar-canvas" width="210" height="86"></canvas>
        <div class="helm-meta">
          <span id="helm-heading">HDG 000°</span>
          <span id="helm-roll">ROLL 0.0°</span>
          <span id="helm-cur">CUR 0.0kt</span>
        </div>

      </div>

      <!-- LARGE CRANE TIMING PANEL (Visible during Phase 5 LANDING) -->
      <div id="crane-timing-panel" class="hud-panel hidden">
        <div class="panel-hdr">
          <span>A-FRAME CRANE // 揚収タイミング</span>
          <span id="crane-stage-lbl" style="color:#5ce1ff;">STEP 0 / 3</span>
        </div>
        <div class="crane-cond-row">
          <div class="cond-pill" id="cond-roll">ロール NG</div>
          <div class="cond-pill" id="cond-squid">イカ抵抗</div>
          <div class="cond-pill" id="cond-wave">波待ち</div>
        </div>
        <div class="wave-timing-track">
          <div class="wave-ok-zone"></div>
          <div class="wave-marker" id="wave-marker" style="left: 50%;"></div>
        </div>
        <button type="button" class="ctrl-btn crane-btn" id="btn-crane-big">クレーン作動！（波頂点で押せ）</button>
      </div>

      <!-- BOTTOM-LEFT: 360° Circular Swipe Joystick -->
      <div id="ship-keypad" class="hud-panel hidden">
        <div class="panel-hdr">
          <span>360° 操舵</span>
          <span id="keypad-dist-mini" style="color:#7cc8ff;">-- m</span>
        </div>
        <div id="joy-base" aria-label="360度操舵スティック">
          <span class="joy-dir-lbl joy-dir-n">▲</span>
          <span class="joy-dir-lbl joy-dir-s">▼</span>
          <span class="joy-dir-lbl joy-dir-w">◀</span>
          <span class="joy-dir-lbl joy-dir-e">▶</span>
          <div id="joy-knob"></div>
        </div>
      </div>

      <!-- BOTTOM-RIGHT: Always-Visible Winch / Hookup / Crane Action Pad -->
      <div id="action-pad" class="hud-panel hidden">
        <div class="panel-hdr">
          <span>ウインチ・操作</span>
          <span id="action-depth-mini" style="color:#5ce1ff;">0 m</span>
        </div>
        <div class="winch-pair" id="winch-pair">
          <button type="button" class="ctrl-btn" data-hold="reelIn" id="btn-reel-in" disabled>↑<br>巻上</button>
          <button type="button" class="ctrl-btn" data-hold="reelOut" id="btn-reel-out" disabled>↓<br>繰出/投下</button>
        </div>
        <button type="button" class="ctrl-btn hook-btn" id="btn-hook" disabled>フッキング (Space)</button>
        <button type="button" class="ctrl-btn crane-btn" id="btn-crane" disabled>クレーン (0/3)</button>
      </div>

      <!-- INSPECT / OBSERVATION BAR (After Capture Cutscene) -->
      <div id="inspect-bar" class="hud-panel hidden">
        <div class="inspect-stats" id="inspect-stats">捕獲成功！ 全長 9.4 m ／ 体重 260 kg</div>
        <div class="inspect-hint">画面ドラッグで360°回転・ピンチ／スクロールでダイオウイカを拡大観察できます</div>
        <div class="inspect-btns">
          <button type="button" class="ctrl-btn glow-gold" id="btn-show-result">評価・リザルトを見る</button>
          <button type="button" class="ctrl-btn" id="btn-inspect-retry">もう一回釣る</button>
        </div>
      </div>

      <!-- Result / Game Over Modal -->
      <div id="result-modal" class="modal-backdrop hidden">
        <div class="modal-box" style="text-align:center;">
          <div class="modal-title" id="res-title">--</div>
          <div class="rank-badge" id="res-rank"></div>
          <div class="modal-sub" id="res-body"></div>
          <div id="res-advice" style="font-size:12px; color:#f5b342; background:rgba(245,179,66,0.1); border:1px solid rgba(245,179,66,0.3); border-radius:8px; padding:10px; margin-bottom:12px;"></div>
          <button type="button" id="btn-retry" class="primary-btn">もう一度出港する</button>
        </div>
      </div>
    `;
    this.root.appendChild(this.layer);

    // Cache DOM refs
    this.elHomeScreen = document.getElementById('home-screen');
    this.elBtnHomePlay = document.getElementById('btn-home-play');
    this.elBtnHomeGuide = document.getElementById('btn-home-guide');
    this.elTopWrap = document.getElementById('hud-top-wrap');
    this.elShipKeypad = document.getElementById('ship-keypad');
    this.elActionPad = document.getElementById('action-pad');

    this.elSonarPanel = document.getElementById('hud-sonar-panel');
    this.elSonarDistBig = document.getElementById('sonar-dist-big');
    this.elSonarBearing = document.getElementById('sonar-bearing');
    this.elSonarSigLbl = document.getElementById('sonar-sig-lbl');

    this.elCraneTimingPanel = document.getElementById('crane-timing-panel');
    this.elCraneStageLbl = document.getElementById('crane-stage-lbl');
    this.elCondRoll = document.getElementById('cond-roll');
    this.elCondSquid = document.getElementById('cond-squid');
    this.elCondWave = document.getElementById('cond-wave');
    this.elWaveMarker = document.getElementById('wave-marker');
    this.elBtnCraneBig = document.getElementById('btn-crane-big');

    this.elInspectBar = document.getElementById('inspect-bar');
    this.elInspectStats = document.getElementById('inspect-stats');
    this.elBtnShowResult = document.getElementById('btn-show-result');
    this.elBtnInspectRetry = document.getElementById('btn-inspect-retry');

    this.elTopGauges = document.getElementById('top-gauges');
    this.elStatusBar = document.getElementById('hud-status-bar');
    this.elPhasePill = document.getElementById('hud-phase-pill');
    this.elStatusMsg = document.getElementById('hud-status-msg');
    this.elSonarCanvas = document.getElementById('sonar-canvas');
    this.sonarCtx = this.elSonarCanvas.getContext('2d');
    this.elKeypadDistMini = document.getElementById('keypad-dist-mini');
    this.elJoyBase = document.getElementById('joy-base');
    this.elJoyKnob = document.getElementById('joy-knob');
    this.elActionDepthMini = document.getElementById('action-depth-mini');
    this.elHeading = document.getElementById('helm-heading');
    this.elRoll = document.getElementById('helm-roll');
    this.elCur = document.getElementById('helm-cur');
    this.elTangle = null;
    this.elRightDepth = document.getElementById('right-depth');
    this.elValTension = document.getElementById('val-tension');
    this.elBarTension = document.getElementById('bar-tension');
    this.elValTemp = document.getElementById('val-temp');
    this.elBarTemp = document.getElementById('bar-temp');
    this.elValStamina = document.getElementById('val-stamina');
    this.elBarStamina = document.getElementById('bar-stamina');
    this.elRngDrag = null;
    this.elValDrag = null;
    this.elRngLight = null;
    this.elValLight = null;

    this.elWinchPair = document.getElementById('winch-pair');
    this.elBtnReelIn = document.getElementById('btn-reel-in');
    this.elBtnReelOut = document.getElementById('btn-reel-out');
    this.elBtnHook = document.getElementById('btn-hook');
    this.elBtnCrane = document.getElementById('btn-crane');

    this.elBigCallout = document.getElementById('big-callout');
    this.elCalloutMain = document.getElementById('callout-main');
    this.elCalloutSub = document.getElementById('callout-sub');

    this.elRovOverlay = document.getElementById('rov-overlay');
    this.elRovMeta = document.getElementById('rov-meta-text');
    this.elPipLabel = document.getElementById('pip-label');

    this.elBtnToggleSonar = document.getElementById('btn-toggle-sonar');
    this.elBtnToggleGauges = document.getElementById('btn-toggle-gauges');
    this.elBtnTogglePip = document.getElementById('btn-toggle-pip');
    this.elBtnToggleStatus = document.getElementById('btn-toggle-status');
    this.elBtnCloseStatus = document.getElementById('btn-close-status');
    this.elBtnCloseSonar = document.getElementById('btn-close-sonar');
    this.elBtnCloseGauges = document.getElementById('btn-close-gauges');

    this.elResultModal = document.getElementById('result-modal');
    this.elResTitle = document.getElementById('res-title');
    this.elResRank = document.getElementById('res-rank');
    this.elResBody = document.getElementById('res-body');
    this.elResAdvice = document.getElementById('res-advice');
    this.elBtnRetry = document.getElementById('btn-retry');
    this.elBtnSwap = document.getElementById('btn-swap-view');
    this.elBtnMute = document.getElementById('btn-mute');
  }

  _showCallout(mainText, subText, duration = 2.2, isHooked = false) {
    this.elCalloutMain.textContent = mainText;
    this.elCalloutMain.classList.toggle('hooked', isHooked);
    this.elCalloutSub.textContent = subText;
    this.elBigCallout.classList.add('show');
    this.calloutTimer = duration;
  }

  setGuideReplayVisible(visible) {
    this.elBtnHomeGuide.classList.toggle('hidden', !visible);
    this.elBtnHomeGuide.disabled = false;
    this.elBtnHomeGuide.textContent = 'はじめてガイドを、もう一度見る';
  }

  _applyPanelVisibility() {
    this.elSonarPanel.classList.toggle('collapsed', !this.panelState.sonar);
    this.elTopGauges.classList.toggle('collapsed', !this.panelState.gauges);
    this.elStatusBar.classList.toggle('collapsed', !this.panelState.status);
    this.elPipLabel.classList.toggle('hidden', !this.panelState.pip);

    this.elBtnToggleSonar.classList.toggle('active', this.panelState.sonar);
    this.elBtnToggleGauges.classList.toggle('active', this.panelState.gauges);
    this.elBtnToggleStatus.classList.toggle('active', this.panelState.status);
    this.elBtnTogglePip.classList.toggle('active', this.panelState.pip);
  }

  _bindEvents() {
    this.heldButtons = new Set();

    // Home Play button
    this.elBtnHomePlay.addEventListener('click', () => {
      this.userClosedGauges = false;
      this.panelState.gauges = false;
      this.panelState.sonar = true;
      this._applyPanelVisibility();
      if (this.callbacks.onStartGame) this.callbacks.onStartGame();
    });

    // Replay first-play guides
    this.elBtnHomeGuide.addEventListener('click', () => {
      if (this.callbacks.onResetGuides) this.callbacks.onResetGuides();
      this.elBtnHomeGuide.textContent = '次のプレイから、ガイドをもう一度表示します';
      this.elBtnHomeGuide.disabled = true;
    });

        // Inspection buttons
    this.elBtnShowResult.addEventListener('click', () => {
      if (this.callbacks.onOpenResult) this.callbacks.onOpenResult();
    });
    this.elBtnInspectRetry.addEventListener('click', () => {
      this._resetHUDForRetry();
    });

    // Panel open/close toggles
    this.elBtnToggleSonar.addEventListener('click', () => {
      this.panelState.sonar = !this.panelState.sonar;
      this._applyPanelVisibility();
    });
    this.elBtnCloseSonar.addEventListener('click', () => {
      this.panelState.sonar = false;
      this._applyPanelVisibility();
    });
    this.elBtnToggleGauges.addEventListener('click', () => {
      this.panelState.gauges = !this.panelState.gauges;
      this.userClosedGauges = !this.panelState.gauges;
      this._applyPanelVisibility();
    });
    this.elBtnCloseGauges.addEventListener('click', () => {
      this.panelState.gauges = false;
      this.userClosedGauges = true;
      this._applyPanelVisibility();
    });
    this.elBtnToggleStatus.addEventListener('click', () => {
      this.panelState.status = !this.panelState.status;
      this._applyPanelVisibility();
    });
    this.elBtnCloseStatus.addEventListener('click', () => {
      this.panelState.status = false;
      this._applyPanelVisibility();
    });
    this.elBtnTogglePip.addEventListener('click', () => {
      this.panelState.pip = !this.panelState.pip;
      this._applyPanelVisibility();
    });
    this.elPipLabel.addEventListener('click', () => {
      this.panelState.pip = false;
      this._applyPanelVisibility();
    });

    // 360° Circular Swipe Joystick Pointer Handling
    const maxJoyRadius = 36;
    const updateJoyFromPointer = (clientX, clientY) => {
      const rect = this.elJoyBase.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > maxJoyRadius) {
        dx = (dx / dist) * maxJoyRadius;
        dy = (dy / dist) * maxJoyRadius;
      }
      this.joyX = dx / maxJoyRadius;
      this.joyY = dy / maxJoyRadius;
      this.elJoyKnob.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    };
    const resetJoy = this._resetJoy = () => {
      this.joyPointerId = null;
      this.joyX = 0;
      this.joyY = 0;
      this.elJoyBase.classList.remove('active');
      this.elJoyKnob.style.transform = 'translate(0px, 0px)';
    };
    this.elJoyBase.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.joyPointerId = e.pointerId;
      try { this.elJoyBase.setPointerCapture(e.pointerId); } catch (_) {}
      this.elJoyBase.classList.add('active');
      updateJoyFromPointer(e.clientX, e.clientY);
    });
    this.elJoyBase.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joyPointerId) return;
      e.preventDefault();
      e.stopPropagation();
      updateJoyFromPointer(e.clientX, e.clientY);
    });
    this.elJoyBase.addEventListener('pointerup', (e) => { if (e.pointerId === this.joyPointerId) resetJoy(); });
    this.elJoyBase.addEventListener('pointercancel', (e) => { if (e.pointerId === this.joyPointerId) resetJoy(); });

    // Holdable winch buttons
    this.layer.querySelectorAll('[data-hold]').forEach((btn) => {
      const code = btn.getAttribute('data-hold');
      const down = (e) => {
        if (btn.disabled) return;
        e.preventDefault();
        this.heldButtons.add(code);
        btn.classList.add('pressed');
      };
      const up = () => {
        this.heldButtons.delete(code);
        btn.classList.remove('pressed');
      };
      btn.addEventListener('pointerdown', down);
      window.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
    });

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (e.code === 'Space') this.inputState.hookAction = true;
      if (e.code === 'Tab' && this.callbacks.onSwapView) this.callbacks.onSwapView();

    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });



    this.elBtnHook.addEventListener('click', () => {
      if (!this.elBtnHook.disabled) this.inputState.hookAction = true;
    });
    this.elBtnCrane.addEventListener('click', () => {
      if (!this.elBtnCrane.disabled) this.inputState.craneAction = true;
    });
    this.elBtnCraneBig.addEventListener('click', () => {
      this.inputState.craneAction = true;
    });

    this.elBtnSwap.addEventListener('click', () => {
      if (this.callbacks.onSwapView) this.callbacks.onSwapView();
    });
    this.elBtnMute.addEventListener('click', () => {
      if (this.callbacks.onToggleMute) {
        const muted = this.callbacks.onToggleMute();
        this.elBtnMute.textContent = muted ? '音OFF' : '音ON';
      }
    });
    this.elBtnRetry.addEventListener('click', () => {
      this._resetHUDForRetry();
    });
  }

  _resetHUDForRetry() {
    this.elResultModal.classList.add('hidden');
    this.userClosedGauges = false;
    this.panelState.gauges = false;
    this.panelState.sonar = true;
    this.lastPhase = 'HOME';
    this.lastLureStage = '';
    this.sonarSignalHistory.fill(0);
    this.sonarDepthHistory.fill(0);
    this._applyPanelVisibility();
    if (this.callbacks.onRetry) this.callbacks.onRetry();
  }

  // Forget every finger / key that is currently held. Used when a guide card opens:
  // the card swallows the finger-up event, so a held "↑ 巻上" would stay pressed.
  releaseAllInputs() {
    this.heldButtons.clear();
    this.layer.querySelectorAll('[data-hold].pressed').forEach((b) => b.classList.remove('pressed'));
    this.keys.clear();
    if (this._resetJoy) this._resetJoy();
    this.inputState.hookAction = false;
    this.inputState.craneAction = false;
  }

  pollControls() {
    const fwd = this.keys.has('KeyW') ? 1 : 0;
    const rev = this.keys.has('KeyS') ? 1 : 0;
    const left = this.keys.has('KeyA') ? 1 : 0;
    const right = this.keys.has('KeyD') ? 1 : 0;
    const bowL = this.keys.has('KeyQ') ? 1 : 0;
    const bowR = this.keys.has('KeyE') ? 1 : 0;
    const reelIn = this.keys.has('ArrowUp') || this.heldButtons.has('reelIn') ? 1 : 0;
    const reelOut = this.keys.has('ArrowDown') || this.heldButtons.has('reelOut') ? 1 : 0;

    const joyMag = Math.hypot(this.joyX, this.joyY);
    const jFwd = joyMag > 0.08 ? -this.joyY : 0;
    const jRight = joyMag > 0.08 ? this.joyX : 0;

    const out = {
      throttle: Math.max(-1, Math.min(1, (fwd - rev) + jFwd)),
      rudder: Math.max(-1, Math.min(1, (left - right) - jRight * 0.95)),
      bowThruster: Math.max(-1, Math.min(1, (bowR - bowL) + jRight * 0.85)),
      winchPower: reelIn - reelOut,
      dragLevel: this.inputState.dragLevel,
      lightPower: this.inputState.lightPower,
      hookAction: this.inputState.hookAction,
      dropRig: reelOut > 0,
      craneAction: this.inputState.craneAction
    };

    this.inputState.hookAction = false;
    this.inputState.craneAction = false;
    return out;
  }

  // Linear Line-Graph Sonar (Crystal-clear signal waveform + rig depth line)
  _drawLinearSonar(snap, dt) {
    this.sonarSampleTimer += dt;
    const dist = snap.hotspot.distance;
    const sig = snap.phase === 'SEARCH' ? Math.max(0, Math.min(1, 1.0 - dist / 52)) : 1.0;

    if (this.sonarSampleTimer >= 0.08) {
      this.sonarSampleTimer = 0;
      for (let i = 0; i < this.SONAR_SAMPLES - 1; i++) {
        this.sonarSignalHistory[i] = this.sonarSignalHistory[i + 1];
        this.sonarDepthHistory[i] = this.sonarDepthHistory[i + 1];
      }
      const jitter = (Math.random() - 0.5) * 0.04;
      this.sonarSignalHistory[this.SONAR_SAMPLES - 1] = Math.max(0.02, Math.min(1.0, sig + jitter));
      this.sonarDepthHistory[this.SONAR_SAMPLES - 1] = Math.min(1.0, snap.depth / 900);
    }

    const ctx = this.sonarCtx;
    const w = this.elSonarCanvas.width;
    const h = this.elSonarCanvas.height;

    ctx.fillStyle = '#020d18';
    ctx.fillRect(0, 0, w, h);

    // Horizontal reference grid lines + labels
    ctx.strokeStyle = 'rgba(80, 175, 230, 0.16)';
    ctx.lineWidth = 1;
    for (let g = 1; g <= 3; g++) {
      const y = (g / 4) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // "Drop Ready" green threshold line at 58% signal (22m)
    const readyY = h - 0.58 * (h - 14) - 7;
    ctx.strokeStyle = 'rgba(61, 224, 138, 0.35)';
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(0, readyY);
    ctx.lineTo(w, readyY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Filled area under linear signal curve
    ctx.beginPath();
    for (let i = 0; i < this.SONAR_SAMPLES; i++) {
      const x = (i / (this.SONAR_SAMPLES - 1)) * (w - 8) + 4;
      const y = h - this.sonarSignalHistory[i] * (h - 14) - 7;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(w - 4, h);
    ctx.lineTo(4, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, sig >= 0.58 ? 'rgba(61, 224, 138, 0.42)' : 'rgba(245, 179, 66, 0.38)');
    grad.addColorStop(1, 'rgba(10, 40, 70, 0.04)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Crisp linear polyline for Giant Squid Sonar Signal Strength
    ctx.beginPath();
    for (let i = 0; i < this.SONAR_SAMPLES; i++) {
      const x = (i / (this.SONAR_SAMPLES - 1)) * (w - 8) + 4;
      const y = h - this.sonarSignalHistory[i] * (h - 14) - 7;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = sig >= 0.58 ? '#3de08a' : '#f5b342';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Glowing current point dot
    const lastY = h - this.sonarSignalHistory[this.SONAR_SAMPLES - 1] * (h - 14) - 7;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w - 4, lastY, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Secondary cyan line for Rig Depth progress (when descending/fighting)
    if (snap.depth > 5) {
      ctx.beginPath();
      for (let i = 0; i < this.SONAR_SAMPLES; i++) {
        const x = (i / (this.SONAR_SAMPLES - 1)) * (w - 8) + 4;
        const y = 6 + this.sonarDepthHistory[i] * (h - 12);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#5ce1ff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Compact axis labels
    ctx.fillStyle = 'rgba(180, 220, 245, 0.72)';
    ctx.font = '9px sans-serif';
    ctx.fillText('反応強', 4, 11);
    ctx.fillText('投下OKライン', 4, readyY - 3);

    this.elSonarSigLbl.textContent = `反応 ${Math.round(sig * 100)}%`;
  }

  update(snap, dt, isROVMain) {
    const isHome = snap.phase === 'HOME';
    const isCapture = snap.phase === 'CAPTURE_SCENE';
    const isInspect = snap.phase === 'INSPECT';
    const isEnd = snap.phase === 'SUCCESS' || snap.phase === 'GAMEOVER';
    const isActivePlay = !isHome && !isCapture && !isInspect && !isEnd;

    this.elHomeScreen.classList.toggle('hidden', !isHome);
    // Show only what the current step needs, so the 3D scene stays as large as possible.
    //  SEARCH    : sonar + stick + winch buttons
    //  LURE_HOOK : hook button only (stick / winch do nothing useful while waiting)
    //  FIGHT     : stick + winch buttons + top meters
    //  LANDING   : only the big crane panel in the middle
    const ph = snap.phase;
    const isLanding = ph === 'LANDING';
    this.elTopWrap.classList.toggle('hidden', isHome || isInspect || isEnd || isCapture || isLanding);
    this.elShipKeypad.classList.toggle('hidden', !(ph === 'SEARCH' || ph === 'FIGHT'));
    this.elActionPad.classList.toggle('hidden', !(ph === 'SEARCH' || ph === 'LURE_HOOK' || ph === 'FIGHT'));
    this.elWinchPair.classList.toggle('hidden', ph === 'LURE_HOOK');
    this.elBtnHook.classList.toggle('hidden', ph !== 'LURE_HOOK');
    this.elSonarPanel.classList.toggle('hidden', ph !== 'SEARCH');
    this.elCraneTimingPanel.classList.toggle('hidden', snap.phase !== 'LANDING');
    this.elInspectBar.classList.toggle('hidden', !isInspect);

    // Auto-show top instruments once Hookup / LURE_HOOK begins; hide sonar during deep LURE_HOOK/FIGHT to keep view open
    if ((snap.phase === 'LURE_HOOK' || snap.phase === 'FIGHT') && this.lastPhase !== snap.phase && !this.userClosedGauges) {
      this.panelState.gauges = true;
      if (window.innerWidth <= 768) this.panelState.sonar = false;
      this._applyPanelVisibility();
    }

    // DRAMATIC BIG TEXT CALLOUTS
    if (snap.phase === 'LURE_HOOK' && snap.squid.lureStage === 'WRAP' && this.lastLureStage !== 'WRAP') {
      this._showCallout('HOOK UP!!', '今だ！「フッキング」ボタンを押せ！', 2.5, false);
    }
    if (snap.events.hookSuccess || (snap.phase === 'FIGHT' && this.lastPhase === 'LURE_HOOK')) {
      this._showCallout('ダイオウイカが掛かった!!', '「↑ 巻上」長押しで引き上げろ！', 2.5, true);
    }
    if (snap.phase === 'LANDING' && this.lastPhase === 'FIGHT') {
      this._showCallout('海面到達!!', '3条件OKで大型クレーンボタンを押せ！', 2.3, false);
    }
    if (snap.phase === 'CAPTURE_SCENE' && this.lastPhase !== 'CAPTURE_SCENE') {
      this._showCallout('CAPTURE SUCCESS!!', 'ダイオウイカ揚収成功！', 3.4, true);
    }

    this.lastPhase = snap.phase;
    this.lastLureStage = snap.squid.lureStage;

    if (this.calloutTimer > 0) {
      this.calloutTimer -= dt;
      if (this.calloutTimer <= 0) this.elBigCallout.classList.remove('show');
    }

    // Inspect Bar stats
    if (isInspect && snap.result) {
      this.elInspectStats.textContent = `捕獲成功！ 推定全長 ${snap.result.lengthMeters} m ／ 推定体重 ${snap.result.weightKg} kg`;
    }

    // Result / Game Over Modal (only shown on SUCCESS after Inspect, or GAMEOVER)
    if (snap.phase === 'GAMEOVER' && snap.result) {
      this.elResultModal.classList.remove('hidden');
      if (snap.result.success) {
        this.elResTitle.textContent = 'ダイオウイカ揚収リザルト';
        this.elResRank.textContent = `RANK ${snap.result.rank}`;
        this.elResBody.innerHTML = `推定全長：<strong>${snap.result.lengthMeters} m</strong> ／ 推定体重：<strong>${snap.result.weightKg} kg</strong><br>所要時間：<strong>${Math.round(snap.result.elapsedTime)} 秒</strong>`;
        this.elResAdvice.textContent = '見事な操船・フッキング・ランディングでした！';
      } else {
        this.elResTitle.textContent = snap.result.title;
        this.elResRank.textContent = 'MISSION FAILED';
        this.elResBody.textContent = snap.result.reason;
        this.elResAdvice.textContent = `対策アドバイス：${snap.result.advice}`;
      }
    } else {
      this.elResultModal.classList.add('hidden');
    }

    if (isHome) return;

    // Top Bar & Status
    this.elPhasePill.textContent = snap.events.alarmActive ? snap.events.alarmType : snap.phase;
    this.elPhasePill.classList.toggle('alarm', snap.events.alarmActive);
    this.elStatusMsg.textContent = snap.events.statusMessage;

    this.elRovOverlay.classList.toggle('active', isROVMain && isActivePlay);
    this.elRovMeta.textContent = `水深 ${Math.round(snap.depth)} m`;

    this.elPipLabel.classList.toggle('hidden', !this.panelState.pip || !isActivePlay || isLanding);
    this.elPipLabel.textContent = isROVMain ? 'PiP: SURFACE ×' : 'PiP: DEEP ROV ×';

    // Upgraded Sonar: Large Distance + Bearing Arrow + Linear Line-Graph
    this._drawLinearSonar(snap, dt);
    const dM = Math.round(snap.hotspot.distance);
    const dropReady = snap.phase === 'SEARCH' && dM < 22;
    this.elSonarDistBig.textContent = snap.phase === 'SEARCH' ? `${dM} m` : `${Math.round(snap.depth)} m`;
    this.elSonarDistBig.classList.toggle('ready', dropReady);

    const b = snap.hotspot.relBearing || 0;
    if (snap.phase === 'SEARCH') {
      if (dropReady) this.elSonarBearing.textContent = '◎ 投下OK';
      else if (Math.abs(b) < 0.45) this.elSonarBearing.textContent = '▲ まっすぐ';
      else if (Math.abs(b) > 2.55) this.elSonarBearing.textContent = '▼ 後ろ方向';
      else if (b > 0) this.elSonarBearing.textContent = '▶ 右方向';
      else this.elSonarBearing.textContent = '◀ 左方向';
    } else {
      this.elSonarBearing.textContent = `目標 ${snap.targetDepth}m`;
    }

    this.elKeypadDistMini.textContent = snap.phase === 'SEARCH' ? `${dM}m` : `${Math.round(snap.depth)}m`;
    this.elActionDepthMini.textContent = `${Math.round(snap.depth)} m`;

    const hdg = ((Math.round((snap.ship.heading * 180) / Math.PI) % 360) + 360) % 360;
    this.elHeading.textContent = `HDG ${String(hdg).padStart(3, '0')}°`;
    this.elRoll.textContent = `ROLL ${snap.ship.rollDeg.toFixed(1)}°`;
    const curSpd = Math.hypot(snap.currentVec.x, snap.currentVec.z);
    this.elCur.textContent = `CUR ${(curSpd * 1.94).toFixed(1)}kt`;



    // Top Instruments
    this.elRightDepth.textContent = `${Math.round(snap.depth)} m`;
    this.elValTension.textContent = `${Math.round(snap.tension)}%`;
    this.elBarTension.style.width = `${Math.min(100, snap.tension)}%`;
    this.elValTemp.textContent = `${Math.round(snap.winchTemp)}°C`;
    this.elBarTemp.style.width = `${Math.min(100, ((snap.winchTemp - 20) / 100) * 100)}%`;
    const stamPct = Math.round((snap.squid.stamina / Math.max(1, snap.squid.staminaMax || 100)) * 100);
    this.elValStamina.textContent = `${stamPct}%`;
    this.elBarStamina.style.width = `${Math.min(100, stamPct)}%`;

    // Right Action Pad Enable/Grey-out & Glow Guidance
    const canReelOut = (snap.phase === 'SEARCH' && (dM < 22 || snap.depth > 5)) || snap.phase === 'LURE_HOOK' || snap.phase === 'FIGHT';
    const canReelIn = (snap.phase === 'SEARCH' && snap.depth > 2) || snap.phase === 'LURE_HOOK' || snap.phase === 'FIGHT';
    const canHook = snap.phase === 'LURE_HOOK';
    const canCrane = snap.phase === 'LANDING';

    this.elBtnReelOut.disabled = !canReelOut;
    this.elBtnReelIn.disabled = !canReelIn;
    this.elBtnHook.disabled = !canHook;
    this.elBtnCrane.disabled = !canCrane;

    this.elBtnReelIn.classList.remove('glow-cyan', 'glow-gold', 'glow-red', 'blink', 'dim');
    this.elBtnReelOut.classList.remove('glow-cyan', 'glow-gold', 'glow-red', 'blink', 'dim');
    this.elBtnHook.classList.remove('glow-cyan', 'glow-gold', 'glow-red');
    this.elBtnCrane.classList.remove('glow-cyan', 'glow-gold', 'glow-red');
    this.elBtnCraneBig.classList.remove('glow-gold');

    if (snap.phase === 'SEARCH' && dM < 22 && snap.depth < 600) {
      this.elBtnReelOut.classList.add('blink');
    }

    if (snap.phase === 'LURE_HOOK' && snap.squid.lureStage === 'WRAP') {
      this.elBtnHook.textContent = `今すぐフッキング! (${snap.squid.wrapWindowLeft.toFixed(1)}s)`;
      this.elBtnHook.classList.add('glow-red');
    } else {
      this.elBtnHook.textContent = 'フッキング (Space)';
    }

    if (snap.phase === 'FIGHT') {
      if (snap.tension >= 85 || snap.winchTemp >= 100) {
        // Danger: pay out line. Reel-in stays pressable but is dimmed.
        this.elBtnReelOut.classList.add('blink');
        this.elBtnReelIn.classList.add('dim');
      } else if (snap.tension < 72 && snap.winchTemp < 92) {
        this.elBtnReelIn.classList.add('blink');
        this.elBtnReelOut.classList.add('dim');
      }
    }

    // Large Dedicated Crane Timing Panel (Phase 5 LANDING)
    if (canCrane) {
      const rollOK = Math.abs(snap.ship.rollDeg) < 18;
      const squidOK = !snap.squid.surfaceResisting;
      const waveOK = snap.landing.waveCrestReady;
      const allOK = rollOK && squidOK && waveOK;

      const stageNames = ['スリング確保', 'クレーン巻上', '甲板収容'];
      const stepName = stageNames[Math.min(2, snap.landing.stage)];

      this.elCraneStageLbl.textContent = `STEP ${snap.landing.stage} / 3`;
      this.elCondRoll.textContent = rollOK ? 'ロール OK' : '横揺れ危険!';
      this.elCondRoll.classList.toggle('ok', rollOK);
      this.elCondSquid.textContent = squidOK ? 'イカ静止 OK' : '抵抗中! 待て';
      this.elCondSquid.classList.toggle('ok', squidOK);
      this.elCondWave.textContent = waveOK ? '波頂点 OK!' : '波待ち...';
      this.elCondWave.classList.toggle('ok', waveOK);

      // Wave timing bar marker position (waveSin -1..+1 -> 5%..95%)
      const pct = 5 + ((snap.landing.waveSin + 1) * 0.5) * 90;
      this.elWaveMarker.style.left = `${pct.toFixed(1)}%`;
      this.elWaveMarker.classList.toggle('in-zone', waveOK);

      this.elBtnCraneBig.textContent = allOK
        ? `今だ！クレーン作動！（${stepName}）`
        : `待機中… (${stepName} ${snap.landing.stage}/3)`;
      this.elBtnCrane.textContent = `クレーン (${snap.landing.stage}/3)`;

      if (allOK) {
        this.elBtnCraneBig.classList.add('glow-gold');
        this.elBtnCrane.classList.add('glow-gold');
      }
    } else {
      this.elBtnCrane.textContent = 'クレーン (0/3)';
    }
  }
}
