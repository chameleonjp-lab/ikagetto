// First-Time Play Contextual Spotlight Tutorial for Deep-Sea Giant Squid Fishing
// Dims everything outside the target UI element using a true spotlight cutout,
// pauses gameplay while the player reads, explains numbers/gauges & exact actions,
// and saves completion state in localStorage (with optional replay).
export class FishingTutorial {
  constructor(rootContainer) {
    this.root = rootContainer;
    this.STORAGE_KEY = 'architeuthis_fishing_tut_done_v1';
    this.enabled = true;
    try {
      if (window.localStorage && localStorage.getItem(this.STORAGE_KEY) === '1') {
        this.enabled = false;
      }
    } catch (_) {}

    this.shownSteps = new Set();
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
          <span class="tut-step-tag" id="tut-tag">初回ガイド 1 / 6</span>
          <button type="button" class="tut-skip-btn" id="tut-skip">ガイドをスキップ</button>
        </div>
        <div class="tut-title" id="tut-title">--</div>
        <div class="tut-body" id="tut-body">--</div>
        <div class="tut-actions">
          <button type="button" class="tut-ok-btn" id="tut-ok">わかった！次へ</button>
        </div>
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
    try {
      if (window.localStorage) localStorage.setItem(this.STORAGE_KEY, '1');
    } catch (_) {}
  }

  resetForReplay() {
    this.enabled = true;
    this.shownSteps.clear();
    this.queue = [];
    this.currentStep = null;
    try {
      if (window.localStorage) localStorage.removeItem(this.STORAGE_KEY);
    } catch (_) {}
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
    this.elOk.textContent = this.queue.length > 0 ? '次へ ▶' : (this.currentStep.okLabel || 'わかった！操作する');
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

    // 1. SEARCH Start -> Explain Sonar + 360° Joystick
    if (snap.phase === 'SEARCH' && !this.shownSteps.has('search_sonar')) {
      this._enqueue([
        {
          id: 'search_sonar',
          tag: '初回ガイド 1 / 6（ソナーの見方）',
          selector: '#hud-sonar-panel',
          title: 'まずはソナーでダイオウイカを探そう！',
          html: `<ul>
            <li><b>大きな数字（〇〇 m）</b>：ダイオウイカの反応地点までの距離です。</li>
            <li><b>矢印（◀ 左方向など）</b>：船を進める向きを教えてくれます。</li>
            <li><b>グラフの点線（投下OKライン）</b>：<b>22m以内</b>に近づくとグラフが緑色になり仕掛けを降ろせます！</li>
          </ul>`
        },
        {
          id: 'search_steer',
          tag: '初回ガイド 2 / 6（船の操舵）',
          selector: '#ship-keypad',
          title: '360°スティックで反応地点の真上へ！',
          html: `左下の<b>丸いスティックを指でスワイプ</b>して船を動かせます。<br>ソナーの距離が<b>22m以下（緑の「OK!」）</b>になるまで近づけよう！`,
          okLabel: 'わかった！船を動かす'
        }
      ]);
      return;
    }

    // 2. Arrived within 22m during SEARCH -> Explain Reel Out button
    if (snap.phase === 'SEARCH' && snap.distanceToTarget <= 22 && !this.shownSteps.has('search_drop')) {
      this._enqueue([
        {
          id: 'search_drop',
          tag: '初回ガイド 3 / 6（仕掛け投下）',
          selector: '#btn-reel-out',
          title: '真上に到達！「↓ 繰出/投下」を長押し！',
          html: `光っている<b>「↓ 繰出/投下」ボタンを長押し</b>すると、水深600mの深海へ仕掛けを降ろせます。<br>右上の水深（<b>〇〇 M</b>）が600m付近に到達するとダイオウイカが近づいてきます！`,
          okLabel: 'わかった！仕掛けを降ろす'
        }
      ]);
      return;
    }

    // 3. LURE_HOOK (Deep-sea approach & bite) -> Explain waiting for HOOK UP!! & Hooking button
    if (snap.phase === 'LURE_HOOK' && !this.shownSteps.has('lure_hook')) {
      this._enqueue([
        {
          id: 'lure_hook',
          tag: '初回ガイド 4 / 6（深海フッキング）',
          selector: '#btn-hook',
          title: '早合わせ厳禁！「HOOK UP!!」で一撃！',
          html: `最初はダイオウイカが腕で餌を探っています。ここではまだ押さずに待とう！<br>餌を完全に抱え込むと<b>「HOOK UP!!」</b>の文字が出て、赤く光る<b>「フッキング」ボタン</b>が出現するので、すかさずタップ！`,
          okLabel: 'わかった！タイミングを待つ'
        }
      ]);
      return;
    }

    // 4. FIGHT Start -> Explain the 4 meters & Reel In
    if (snap.phase === 'FIGHT' && !this.shownSteps.has('fight_gauges')) {
      this._enqueue([
        {
          id: 'fight_gauges',
          tag: '初回ガイド 5 / 6（計器と巻き上げ）',
          selector: '#top-gauges',
          title: '3つの計器を見ながら水深0mまで巻き上げろ！',
          html: `<ul>
            <li><b>ライン張力</b>：暴れている時に巻き続けると急上昇！<b>赤くなったら「↑ 巻上」を止めるか「↓ 繰出/投下」で糸を出して逃がそう！</b></li>
            <li><b>ウインチ温度</b>：高温になると過熱警告。少し休ませて冷却！</li>
            <li><b>イカスタミナ</b>：減るほど暴れにくくなり一気に巻き上げられます。</li>
          </ul>普段は右下の<b>「↑ 巻上」長押し</b>で引き上げよう！`,
          okLabel: 'わかった！ファイト開始！'
        }
      ]);
      return;
    }

    // 5. LANDING (Surface Crane) -> Explain 3 green conditions & 3 taps
    if (snap.phase === 'LANDING' && !this.shownSteps.has('landing_crane')) {
      this._enqueue([
        {
          id: 'landing_crane',
          tag: '初回ガイド 6 / 6（クレーン揚収）',
          selector: '#crane-timing-panel',
          title: '3条件が緑に揃ったらクレーン作動！',
          html: `海面まで引き上げ成功！最後はクレーンで船上へ引き上げます。<br><b>「ロール OK」「イカ静止 OK」「波頂点 OK!」</b>の3つが緑に揃い、オレンジの大きなボタンが光った瞬間にタップ！<br>これを<b>3回（0/3 → 3/3）</b>成功させれば捕獲完了です！`,
          okLabel: 'わかった！捕獲する！',
          isFinal: true
        }
      ]);
    }
  }
}
