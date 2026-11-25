import { GuideStore } from './MiniGameCoach.js';

// First-Time Play Contextual Spotlight Tutorial for Deep-Sea Giant Squid Fishing
// Dims everything outside the target UI element using a true spotlight cutout,
// pauses gameplay while the player reads, and saves completion state (replayable).
//
// Timing rules: a card never appears the instant a phase starts. It waits until the
// phase's own big callout ("HOOKED!!" etc.) has been seen, so the dramatic moment is
// not covered by the dim layer. Nothing is shown during the HOOK UP window itself,
// because pausing there would break the timing the player is trying to learn.
export class FishingTutorial {
  constructor(rootContainer) {
    this.root = rootContainer;
    this.enabled = !GuideStore.has('fishing:done');

    this.shownSteps = new Set();
    this._armedAt = new Map();
    this.queue = [];
    this.currentStep = null;
    this.active = false;
    this.onPauseChange = null;

    this._injectStyles();
    this._buildDOM();
    this._bindEvents();
  }

  _injectStyles() {
    if (document.getElementById('fishing-tut-styles')) return;
    const st = document.createElement('style');
    st.id = 'fishing-tut-styles';
    st.textContent = `
      #tut-backdrop {
        position: fixed; inset: 0; z-index: 60;
        pointer-events: auto;
        font-family: "Hiragino Maru Gothic ProN", "Rounded Mplus 1c", -apple-system, sans-serif;
      }
      #tut-backdrop.hidden { display: none !important; }
      /* Dimmed mask when no specific element is targeted */
      #tut-full-dim {
        position: fixed; inset: 0; background: rgba(2, 8, 18, 0.80);
      }
      /* True bright spotlight hole with giant outer dark shadow */
      #tut-spotlight {
        position: fixed;
        border-radius: 14px;
        border: 2.5px solid #ffd454;
        box-shadow: 0 0 0 9999px rgba(2, 8, 18, 0.80), 0 0 24px rgba(255, 212, 84, 0.85), inset 0 0 12px rgba(255, 212, 84, 0.28);
        pointer-events: none;
        transition: left 0.22s ease, top 0.22s ease, width 0.22s ease, height 0.22s ease;
        animation: tutPulse 1.5s ease-in-out infinite;
      }
      @keyframes tutPulse {
        0%, 100% { border-color: #ffd454; box-shadow: 0 0 0 9999px rgba(2, 8, 18, 0.80), 0 0 18px rgba(255, 212, 84, 0.75); }
        50%      { border-color: #fff3a1; box-shadow: 0 0 0 9999px rgba(2, 8, 18, 0.80), 0 0 32px rgba(255, 232, 120, 1.0); }
      }
      #tut-card {
        position: fixed; left: 50%; transform: translateX(-50%);
        width: min(410px, calc(100vw - 24px));
        background: linear-gradient(160deg, rgba(8, 22, 42, 0.97), rgba(4, 14, 28, 0.97));
        border: 1.8px solid rgba(255, 212, 84, 0.85);
        border-radius: 16px;
        padding: 13px 15px 12px;
        color: #eef6ff;
        box-shadow: 0 14px 40px rgba(0, 0, 0, 0.85);
        pointer-events: auto;
        z-index: 62;
      }
      .tut-badge-row {
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
        margin-bottom: 5px;
      }
      .tut-step-tag {
        display: inline-block; padding: 2px 9px; border-radius: 999px;
        background: rgba(255, 212, 84, 0.20); border: 1px solid #ffd454;
        color: #ffe27a; font-size: 10.5px; font-weight: 900; letter-spacing: 0.04em;
      }
      .tut-skip-btn {
        background: transparent; border: none; color: #8cb4d6;
        font-size: 11px; font-weight: 700; cursor: pointer; padding: 2px 4px;
        text-decoration: underline; font-family: inherit;
      }
      .tut-title {
        font-size: clamp(14.5px, 4.1vw, 17px); font-weight: 900; color: #ffffff;
        margin-bottom: 6px; line-height: 1.3;
      }
      .tut-body {
        font-size: clamp(12px, 3.3vw, 13.5px); line-height: 1.52; color: #d9ecff;
      }
      .tut-body b { color: #ffd454; }
      .tut-body ul { margin: 5px 0 0 16px; padding: 0; }
      .tut-body li { margin-bottom: 3px; }
      .tut-actions {
        margin-top: 10px; display: flex; justify-content: flex-end; gap: 8px;
      }
      .tut-pause-note { margin-top: 6px; font-size: 10.5px; color: #8cb4d6; text-align: center; }
      .tut-ok-btn {
        width: 100%; padding: 10px 14px; border-radius: 10px;
        border: 1px solid rgba(255, 232, 130, 0.7);
        background: linear-gradient(135deg, #1b7bc4, #28b5e0);
        color: #ffffff; font-size: 14px; font-weight: 900;
        cursor: pointer; font-family: inherit;
        box-shadow: 0 4px 14px rgba(34, 174, 220, 0.4);
      }
    `;
    document.head.appendChild(st);
  }

  _buildDOM() {
    this.el = document.createElement('div');
    this.el.id = 'tut-backdrop';
    this.el.className = 'hidden';
    this.el.innerHTML = `
      <div id="tut-full-dim" class="hidden"></div>
      <div id="tut-spotlight"></div>
      <div id="tut-card">
        <div class="tut-badge-row">
          <span class="tut-step-tag" id="tut-tag">はじめてガイド 1 / 6</span>
          <button type="button" class="tut-skip-btn" id="tut-skip">今後ガイドを出さない</button>
        </div>
        <div class="tut-title" id="tut-title">--</div>
        <div class="tut-body" id="tut-body">--</div>
        <div class="tut-actions">
          <button type="button" class="tut-ok-btn" id="tut-ok">わかった</button>
        </div>
        <div class="tut-pause-note">この説明が出ている間、ゲームは止まっています</div>
      </div>
    `;
    this.root.appendChild(this.el);

    this.elFullDim = this.el.querySelector('#tut-full-dim');
    this.elSpot = this.el.querySelector('#tut-spotlight');
    this.elCard = this.el.querySelector('#tut-card');
    this.elTag = this.el.querySelector('#tut-tag');
    this.elTitle = this.el.querySelector('#tut-title');
    this.elBody = this.el.querySelector('#tut-body');
    this.elOk = this.el.querySelector('#tut-ok');
    this.elSkip = this.el.querySelector('#tut-skip');
  }

  _bindEvents() {
    this.elOk.addEventListener('click', (e) => {
      e.stopPropagation();
      this._advance();
    });
    this.elSkip.addEventListener('click', (e) => {
      e.stopPropagation();
      // "Don't show guides again" also silences the butcher / cooking tips.
      GuideStore.mark('all:off');
      this.markCompleted();
      this.closeAll();
    });
    window.addEventListener('resize', () => {
      if (this.active && this.currentStep) this._positionSpotlight(this.currentStep);
    });
  }

  isPaused() {
    return this.active;
  }

  markCompleted() {
    this.enabled = false;
    GuideStore.mark('fishing:done');
  }

  resetForReplay() {
    this.enabled = true;
    this.shownSteps.clear();
    this._armedAt.clear();
    this.queue = [];
    this.currentStep = null;
  }

  // True once `cond` has held continuously for `delaySec`.
  _armed(id, cond, delaySec) {
    if (!cond || this.shownSteps.has(id)) {
      this._armedAt.delete(id);
      return false;
    }
    const now = performance.now();
    if (!this._armedAt.has(id)) this._armedAt.set(id, now);
    return now - this._armedAt.get(id) >= delaySec * 1000;
  }

  closeAll() {
    this.active = false;
    this.currentStep = null;
    this.queue = [];
    this.el.classList.add('hidden');
    if (this.onPauseChange) this.onPauseChange(false);
  }

  _enqueue(steps) {
    if (!this.enabled) return;
    let added = false;
    for (const s of steps) {
      if (this.shownSteps.has(s.id)) continue;
      this.shownSteps.add(s.id);
      this.queue.push(s);
      added = true;
    }
    if (added && !this.active) {
      this._advance();
    }
  }

  _advance() {
    if (this.queue.length === 0) {
      const wasLast = this.currentStep && this.currentStep.isFinal;
      this.closeAll();
      if (wasLast) this.markCompleted();
      return;
    }
    this.currentStep = this.queue.shift();
    this.active = true;
    if (this.onPauseChange) this.onPauseChange(true);

    this.elTag.textContent = this.currentStep.tag;
    this.elTitle.textContent = this.currentStep.title;
    this.elBody.innerHTML = this.currentStep.html;
    this.elOk.textContent = this.queue.length > 0 ? '次へ ▶' : (this.currentStep.okLabel || 'わかった');
    this.el.classList.remove('hidden');

    // Position spotlight on next frame so target HUD panel layout is settled
    requestAnimationFrame(() => {
      if (this.active && this.currentStep) this._positionSpotlight(this.currentStep);
    });
  }

  _positionSpotlight(step) {
    const targetEl = step.selector ? document.querySelector(step.selector) : null;
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    if (targetEl && targetEl.offsetParent !== null) {
      const r = targetEl.getBoundingClientRect();
      if (r.width > 10 && r.height > 10) {
        const pad = 6;
        const left = Math.max(4, r.left - pad);
        const top = Math.max(4, r.top - pad);
        const width = Math.min(vw - left - 4, r.width + pad * 2);
        const height = Math.min(vh - top - 4, r.height + pad * 2);

        this.elFullDim.classList.add('hidden');
        this.elSpot.style.display = 'block';
        this.elSpot.style.left = `${left}px`;
        this.elSpot.style.top = `${top}px`;
        this.elSpot.style.width = `${width}px`;
        this.elSpot.style.height = `${height}px`;

        // Place card cleanly away from the spotlighted element (above or below)
        const centerY = top + height * 0.5;
        this.elCard.style.top = '';
        this.elCard.style.bottom = '';
        if (centerY > vh * 0.50) {
          // Target is in bottom half -> place card near top (below iOS close button)
          const idealBottom = Math.min(vh - 70, vh - top + 14);
          this.elCard.style.bottom = `${Math.max(16, idealBottom)}px`;
        } else {
          // Target is in top half -> place card right below target
          const idealTop = Math.min(vh - 220, top + height + 14);
          this.elCard.style.top = `${Math.max(60, idealTop)}px`;
        }
        return;
      }
    }

    // Fallback centered card if element is hidden
    this.elFullDim.classList.remove('hidden');
    this.elSpot.style.display = 'none';
    this.elCard.style.bottom = '';
    this.elCard.style.top = `${Math.round(vh * 0.34)}px`;
  }

  // Called every frame from main loop with live fishing snapshot
  checkTriggers(snap) {
    if (!this.enabled || !snap) return;
    const phase = snap.phase;

    // 1. SEARCH: let the player see the ocean for a moment, then explain sonar + stick.
    if (this._armed('search_sonar', phase === 'SEARCH', 1.0)) {
      this._enqueue([
        {
          id: 'search_sonar',
          tag: 'はじめてガイド 1 / 6',
          selector: '#hud-sonar-panel',
          title: 'ソナーで、イカのいる場所をさがす',
          html: '大きな数字はイカまでの距離、矢印は船を進める向きです。<b>22m以内</b>に近づくと、グラフが緑になります。'
        },
        {
          id: 'search_steer',
          tag: 'はじめてガイド 2 / 6',
          selector: '#ship-keypad',
          title: '丸いスティックで、船を動かす',
          html: '指を置いてすべらせると、その向きに船が進みます。ソナーの数字が<b>22m以下</b>になるまで近づこう。',
          okLabel: '船を動かす'
        }
      ]);
      return;
    }

    // 2. Arrived above the target: explain the drop button.
    if (this._armed('search_drop', phase === 'SEARCH' && snap.distanceToTarget <= 22, 0.4)) {
      this._enqueue([
        {
          id: 'search_drop',
          tag: 'はじめてガイド 3 / 6',
          selector: '#btn-reel-out',
          title: '「↓ 繰出/投下」を長押しする',
          html: '仕掛けが深海へ降りていきます。水深が<b>600m</b>に届くと、イカが近づいてきます。',
          okLabel: '仕掛けを降ろす'
        }
      ]);
      return;
    }

    // 3. LURE_HOOK: explain "wait" BEFORE the bite. Never pause during the HOOK UP window.
    if (this._armed('lure_hook', phase === 'LURE_HOOK' && snap.squid?.lureStage !== 'WRAP', 1.0)) {
      this._enqueue([
        {
          id: 'lure_hook',
          tag: 'はじめてガイド 4 / 6',
          selector: '#btn-hook',
          title: 'まだ押さずに、イカを待つ',
          html: '腕で餌をさわっている間に押すと、イカが逃げます。<b>「HOOK UP!!」</b>の文字が出たら、赤く光る<b>「フッキング」</b>をすぐ押そう。数秒で消えます。',
          okLabel: '待つ'
        }
      ]);
      return;
    }

    // 4. FIGHT: let the "掛かった!!" callout play first, then explain the meters.
    if (this._armed('fight_gauges', phase === 'FIGHT', 1.3)) {
      this._enqueue([
        {
          id: 'fight_gauges',
          tag: 'はじめてガイド 5 / 6',
          selector: '#top-gauges',
          title: '「↑ 巻上」を長押しして引き上げる',
          html: `水深0mまで巻き上げれば成功です。上の計器を見ながら巻こう。
          <ul>
            <li><b>ライン張力</b>が赤くなったら、巻上から指をはなすか「↓ 繰出」で糸を出す</li>
            <li><b>ウインチ温度</b>が高いときも、少し休ませる</li>
            <li><b>イカスタミナ</b>が減るほど、楽に巻ける</li>
          </ul>`,
          okLabel: '巻き上げる'
        }
      ]);
      return;
    }

    // 5. LANDING: after the "海面到達!!" callout, explain the crane.
    if (this._armed('landing_crane', phase === 'LANDING', 1.2)) {
      this._enqueue([
        {
          id: 'landing_crane',
          tag: 'はじめてガイド 6 / 6',
          selector: '#crane-timing-panel',
          title: '3つが緑になったら、クレーンを押す',
          html: '「ロール」「イカ静止」「波頂点」の3つが緑になると、オレンジのボタンが光ります。その瞬間に押す操作を<b>3回</b>成功させると捕獲です。',
          okLabel: '引き上げる',
          isFinal: true
        }
      ]);
    }
  }
}
