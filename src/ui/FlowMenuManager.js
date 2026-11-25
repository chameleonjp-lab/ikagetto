import { ResultFXManager } from './ResultFX.js';
// Manages fishing results, the menus between stages, and sharing to X.

export function shareToX(text) {
  const pageUrl = document.querySelector('link[rel="canonical"]').href;
  const params = new URLSearchParams({ text, url: pageUrl });
  const intentUrl = `https://twitter.com/intent/tweet?${params}`;
  window.open(intentUrl, '_blank', 'noopener,noreferrer');
}

export class FlowMenuManager {
  constructor(rootContainer, callbacks = {}, audio = null, resultFX = null) {
    this.root = rootContainer;
    this.callbacks = callbacks;
    this.audio = audio;
    this.resultFX = resultFX;
    this.lastFishingSummary = null;

    this._injectStyles();
    this._buildDOM();
    this._bindEvents();
  }

  _injectStyles() {
    if (document.getElementById('flow-menu-styles')) return;
    const style = document.createElement('style');
    style.id = 'flow-menu-styles';
    style.textContent = `
      #fishing-result-ui {
        position: fixed; inset: 0; z-index: 43; pointer-events: none;
        display: flex; flex-direction: column; justify-content: space-between;
        padding: 54px 12px 14px;
        font-family: "Hiragino Maru Gothic ProN", "Rounded Mplus 1c", -apple-system, sans-serif;
      }
      #fishing-result-ui.hidden { display: none !important; }
      .fr-header-row {
        display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;
      }
      .fr-topleft {
        max-width: min(265px, 66vw);
        background: rgba(4, 14, 28, 0.84);
        border: 1px solid rgba(92, 225, 255, 0.45);
        border-radius: 12px;
        padding: 9px 11px;
        backdrop-filter: blur(8px);
        color: #eef6ff;
      }
      .fr-rank-row { display: flex; align-items: baseline; gap: 8px; }
      .fr-rank { font-size: clamp(24px, 6.5vw, 34px); font-weight: 900; color: #ffd454; line-height: 1; }
      .fr-score { font-size: clamp(16px, 4.5vw, 22px); font-weight: 900; color: #7ce8ff; }
      .fr-stats {
        margin-top: 5px;
        display: grid; grid-template-columns: repeat(3, auto); gap: 4px 10px;
        font-size: clamp(12px, 3.2vw, 15px); font-weight: 900; color: #ffffff;
      }
      .fr-stat-lbl { display: block; font-size: 9px; font-weight: 600; color: #8cb8d8; }
      .fr-comment {
        margin-top: 6px; font-size: 11px; line-height: 1.38; color: #e2f2ff;
        border-top: 1px solid rgba(92, 225, 255, 0.22); padding-top: 5px;
      }
      .fr-footer {
        pointer-events: auto;
        width: min(440px, 100%); margin: 0 auto;
        display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
      }
      .flow-btn {
        padding: 12px 10px; border-radius: 10px; border: 1px solid rgba(120, 215, 255, 0.5);
        background: linear-gradient(135deg, #1672b8, #22aedc); color: #fff;
        font-size: 14px; font-weight: 800; cursor: pointer; font-family: inherit;
      }
      .flow-btn.x-share { background: linear-gradient(135deg, #111418, #262c35); border-color: rgba(255,255,255,0.35); }
      .flow-btn.sub { background: rgba(14, 34, 58, 0.92); border-color: rgba(92, 225, 255, 0.35); }

      #flow-menu-modal {
        position: fixed; inset: 0; z-index: 46;
        background: rgba(2, 8, 18, 0.84); backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center; padding: 16px;
        pointer-events: auto;
      }
      #flow-menu-modal.hidden { display: none !important; }
      .flow-menu-card {
        width: min(400px, 100%); background: #07162b;
        border: 1px solid rgba(92, 225, 255, 0.42); border-radius: 16px;
        padding: 22px 20px; text-align: center; box-shadow: 0 22px 60px rgba(0, 0, 0, 0.72);
      }
      .flow-menu-title { font-size: 18px; font-weight: 900; color: #f4faff; margin-bottom: 14px; }
      .flow-menu-stack { display: flex; flex-direction: column; gap: 10px; }
      .flow-toast { margin-top: 10px; font-size: 12px; color: #ffd46b; min-height: 16px; }
    `;
    document.head.appendChild(style);
  }

  _buildDOM() {
    this.elResultUI = document.createElement('div');
    this.elResultUI.id = 'fishing-result-ui';
    this.elResultUI.className = 'hidden';
    this.elResultUI.innerHTML = `
      <div class="fr-header-row">
        <div class="fr-topleft" id="fr-card">
          <div class="res-tier-ribbon" id="fr-ribbon">RESULT</div>
          <div class="fr-rank-row">
            <span class="fr-rank" id="fr-rank">S</span>
            <span class="fr-score" id="fr-score">38,500 点</span>
          </div>
          <div class="fr-stats">
            <div><span class="fr-stat-lbl">全長</span><span id="fr-len">12 m</span></div>
            <div><span class="fr-stat-lbl">重さ</span><span id="fr-wt">540 kg</span></div>
            <div><span class="fr-stat-lbl">時間</span><span id="fr-time">68 秒</span></div>
          </div>
          <div class="fr-comment" id="fr-comment">--</div>
        </div>
      </div>
      <div class="fr-footer">
        <button type="button" class="flow-btn x-share" id="fr-btn-x">Xにシェア</button>
        <button type="button" class="flow-btn" id="fr-btn-next">次へ</button>
      </div>
    `;
    this.root.appendChild(this.elResultUI);

    this.elMenuModal = document.createElement('div');
    this.elMenuModal.id = 'flow-menu-modal';
    this.elMenuModal.className = 'hidden';
    this.elMenuModal.innerHTML = `
      <div class="flow-menu-card">
        <div class="flow-menu-title" id="flow-menu-title">次のアクションを選択</div>
        <div class="flow-menu-stack" id="flow-menu-stack"></div>
        <div class="flow-toast" id="flow-toast"></div>
      </div>
    `;
    this.root.appendChild(this.elMenuModal);
  }

  _bindEvents() {
    this.elResultUI.querySelector('#fr-btn-x').addEventListener('click', () => {
      if (!this.lastFishingSummary) return;
      const r = this.lastFishingSummary;
      shareToX(`ダイオウイカを釣り上げた！\n評価：${r.rank}（${r.score.toLocaleString()}点）\n全長：${r.lengthMeters}m ／ 重さ：${r.weightKg}kg ／ 時間：${Math.round(r.elapsedTime)}秒\n「${r.comment}」\n#イカゲット`);
    });
    this.elResultUI.querySelector('#fr-btn-next').addEventListener('click', () => {
      this.hideFishingResult();
      this.showPostFishingMenu();
    });
  }

  showFishingResult(result) {
    this.lastFishingSummary = result;
    const rankEl = this.elResultUI.querySelector('#fr-rank');
    const scoreEl = this.elResultUI.querySelector('#fr-score');
    const cardEl = this.elResultUI.querySelector('#fr-card');
    const ribbonEl = this.elResultUI.querySelector('#fr-ribbon');
    rankEl.textContent = result.rank;
    this.elResultUI.querySelector('#fr-len').textContent = `${result.lengthMeters} m`;
    this.elResultUI.querySelector('#fr-wt').textContent = `${result.weightKg} kg`;
    this.elResultUI.querySelector('#fr-time').textContent = `${Math.round(result.elapsedTime)} 秒`;
    this.elResultUI.querySelector('#fr-comment').textContent = result.comment;
    this.elResultUI.classList.remove('hidden');

    ResultFXManager.applyCardStyle(cardEl, rankEl, ribbonEl, result.rank);
    ResultFXManager.animateScore(scoreEl, result.score, 750);
    this.audio?.playResultJingle(result.rank);
    this.resultFX?.start(result.rank);
  }

  hideFishingResult() {
    this.elResultUI.classList.add('hidden');
    this.resultFX?.stop();
  }

  _openMenu(title, items) {
    const titleEl = this.elMenuModal.querySelector('#flow-menu-title');
    const stackEl = this.elMenuModal.querySelector('#flow-menu-stack');
    const toastEl = this.elMenuModal.querySelector('#flow-toast');
    titleEl.textContent = title;
    toastEl.textContent = '';
    stackEl.innerHTML = '';

    items.forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `flow-btn ${item.primary ? '' : 'sub'}`;
      btn.textContent = item.label;
      btn.addEventListener('click', () => {
        if (item.comingSoon) {
          toastEl.textContent = 'ランキング機能は現在準備中です！';
          return;
        }
        this.hideMenu();
        if (item.action) item.action();
      });
      stackEl.appendChild(btn);
    });
    this.elMenuModal.classList.remove('hidden');
  }

  showPostFishingMenu() {
    this._openMenu('釣り上げ完了！次はどうする？', [
      { label: 'ダイオウイカを解体する', primary: true, action: () => this.callbacks.onStartButcher?.() },
      { label: '再ゲーム', primary: false, action: () => this.callbacks.onReplayFishing?.() },
      { label: 'ホーム', primary: false, action: () => this.callbacks.onGoHome?.() },
      { label: 'ランキング（準備中）', primary: false, comingSoon: true }
    ]);
  }

  showPostButcherMenu() {
    this._openMenu('解体完了！次はどうする？', [
      { label: 'ダイオウイカを調理する（アヒージョ）', primary: true, action: () => this.callbacks.onStartCooking?.() },
      { label: 'ダイオウイカを釣りにいく', primary: false, action: () => this.callbacks.onReplayFishing?.() },
      { label: 'ホーム', primary: false, action: () => this.callbacks.onGoHome?.() },
      { label: 'ランキング（準備中）', primary: false, comingSoon: true }
    ]);
  }

  hideMenu() {
    this.elMenuModal.classList.add('hidden');
  }
}
