import { ResultFXManager } from '../ui/ResultFX.js';
import { ResultRanking } from '../ui/FlowMenuManager.js';
import { localizeHtml, t } from '../i18n/runtime.js';
import { finishRankingRun, startRankingRun } from '../ranking/client.js';
import * as THREE from 'three';
import { ButcherStageModels } from '../models/ButcherModels.js';
import { getCommentForScore } from '../data/SquidTiersAndComments.js';
import { MiniGameCoach, drawGhostSwipe, drawGhostTap, drawGhostCircle } from '../ui/MiniGameCoach.js';
import { adaptText } from '../ui/DeviceProfile.js';

// Each step specifies exact 3D camera focus (fx, fz) AND exact 3D world start/end points
// so the on-screen glowing chevron guide aligns 1:1 with the anatomical part being cut!
const BUTCHER_STEPS_15 = [
  { id: 'wash',  title: 'ぬめり取り・水洗い',     hint: '胴を左右に3回こすって洗う',             rule: 'count',  type: 'rub',           count: 3, coach: 'intro',  fx: -1.1, fz: 0.1, p0: [-1.8, 0.55, 0.1], p1: [-0.3, 0.55, 0.1], maxScore: 3000, se: 'wash' },
  { id: 'fins',  title: '左右ヒレの切り離し',     hint: 'ヒレの付け根を、矢印の向きになぞる',                     type: 'swipe_v',       fx: -1.9, fz: 0.1, p0: [-1.85, 0.55, -0.75], p1: [-1.85, 0.55, 0.95], maxScore: 3300, se: 'slice' },
  { id: 'score', title: '胴体の浅切り',           hint: '胴のまん中を、左から右へなぞる',                         type: 'swipe_r',       fx: -1.1, fz: 0.1, p0: [-2.1, 0.58, 0.1], p1: [0.0, 0.58, 0.1], maxScore: 3300, se: 'slice' },
  { id: 'open',  title: '外套膜の観音開き',       hint: '胴を縦になぞって、左右に開く',                           type: 'swipe_v',       fx: -1.1, fz: 0.1, p0: [-1.1, 0.58, -0.65], p1: [-1.1, 0.58, 0.85], maxScore: 3400, se: 'peel' },
  { id: 'pen',   title: '軟甲（ペン）の引き抜き', hint: 'ペンを、右から左へゆっくり引き抜く',   rule: 'ゆっくり', ruleWarn: true, type: 'slow_swipe_l', coach: 'slow', fx: -1.1, fz: 0.1, p0: [-0.2, 0.45, 0.1], p1: [-2.1, 0.45, 0.1], maxScore: 3500, se: 'pen' },
  { id: 'gills', title: 'エラ・胃袋の切り離し',   hint: '黄色の棒が緑に重なったらタップ',       rule: 'タイミング', ruleWarn: true, type: 'timing', coach: 'timing', speed: 2.7, zone: 0.25, fx: -0.8, fz: 0.1, maxScore: 3300, se: 'slice' },
  { id: 'liver', title: '肝臓（ゴロ）の分離',     hint: '肝臓を、左から右へゆっくりはがす',     rule: 'ゆっくり', ruleWarn: true, type: 'slow_swipe_r', fx: -1.1, fz: 0.1, p0: [-1.8, 0.48, 0.1], p1: [-0.2, 0.48, 0.1], maxScore: 3400, se: 'peel' },
  { id: 'ink',   title: '墨袋の摘出（最難関）',   hint: '緑がせまい。重なった瞬間にタップ',     rule: 'タイミング', ruleWarn: true, type: 'timing', speed: 3.6, zone: 0.16, fx: -0.5, fz: 0.1, maxScore: 4200, se: 'ink' },
  { id: 'neck',  title: '頭部と胴体の切り離し',   hint: '首元を、縦に2回なぞって切る',          rule: 'count',  type: 'multi_swipe_v', count: 2, fx: 0.5, fz: 0.1, p0: [0.35, 0.55, -0.75], p1: [0.35, 0.55, 0.95], maxScore: 3300, se: 'chop' },
  { id: 'eyes',  title: '巨大眼球の摘出',         hint: '目のまわりを、ぐるっと円になぞる',                       type: 'circle',        fx: 1.1, fz: 0.1, p0: [1.15, 0.55, 0.1], maxScore: 3300, se: 'pop' },
  { id: 'beak',  title: 'カラストンビ（嘴）抜き', hint: '黄色の棒が緑に重なったらタップ',       rule: 'タイミング', ruleWarn: true, type: 'timing', speed: 3.1, zone: 0.21, fx: 1.4, fz: 0.1, maxScore: 3300, se: 'pop' },
  { id: 'skin',  title: '外套膜の赤皮むき',       hint: '皮を、下から上へ一気にむく',           rule: 'すばやく', ruleWarn: true, type: 'fast_swipe_u', coach: 'fast', fx: -1.1, fz: 0.1, p0: [-1.1, 0.45, 0.85], p1: [-1.1, 0.45, -0.75], maxScore: 3400, se: 'peel' },
  { id: 'film',  title: '内側の薄皮むき',         hint: '薄皮を、左右に2回こすってはがす',      rule: 'count',  type: 'rub',           count: 2, fx: -1.1, fz: 0.1, p0: [-1.8, 0.45, 0.1], p1: [-0.3, 0.45, 0.1], maxScore: 3200, se: 'peel' },
  { id: 'arms',  title: '8本腕（ゲソ）の切り分け', hint: 'ゲソの付け根を、縦に3回なぞって切る', rule: 'count',  type: 'multi_swipe_v', count: 3, fx: 2.1, fz: 0.1, p0: [1.75, 0.45, -0.85], p1: [1.75, 0.45, 1.05], maxScore: 3100, se: 'chop' },
  { id: 'tents', title: '触腕の切り離し',         hint: '最後の工程。左から右へなぞって切る',                     type: 'swipe_r',       fx: 2.3, fz: 0.1, p0: [1.5, 0.45, 0.1], p1: [3.1, 0.45, 0.1], maxScore: 3000, se: 'slice' }
];

// Pause cards are used only where a hidden rule (speed / timing) would otherwise
// make a first-time player fail. Plain swipes are taught by the ghost finger.
const BUTCHER_COACH_CARDS = {
  intro: {
    id: 'intro', demo: 'swipe',
    title: '光る線を、矢印の向きになぞろう',
    html: '赤い丸がスタート地点です。指を置いたまま、矢印の向きに動かします。<br>いまやることは、いつも画面の上に出ます。'
  },
  slow: {
    id: 'slow', demo: 'slow',
    title: 'この工程は「ゆっくり」なぞる',
    html: '速く動かすと、ペンが途中で折れてしまいます。<b>1秒くらい</b>かけて引き抜こう。'
  },
  timing: {
    id: 'timing', demo: 'timing',
    title: '黄色の棒が緑に重なったらタップ',
    html: '画面のどこをタップしても大丈夫です。時間制限はないので、棒の動きを何回か見てから押しましょう。'
  },
  fast: {
    id: 'fast', demo: 'fast',
    title: 'この工程は「すばやく」なぞる',
    html: 'ゆっくりだと、皮が途中でちぎれます。下から上へ、<b>一気に</b>なぞろう。'
  }
};

export class ButcherGame {
  constructor(rootContainer, audio, callbacks = {}, resultFX = null) {
    this.root = rootContainer;
    this.audio = audio;
    this.callbacks = callbacks;
    this.resultFX = resultFX;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c1622);
    this.camera = new THREE.PerspectiveCamera(44, 1, 0.1, 60);
    this.camTarget = new THREE.Vector3(0, 0.25, 0.1);
    this.camDesiredTarget = new THREE.Vector3(0, 0.25, 0.1);

    this.scene.add(new THREE.HemisphereLight(0xdcf0ff, 0x1a2634, 1.35));
    const key = new THREE.DirectionalLight(0xfff9f0, 1.85);
    key.position.set(4, 9, 5);
    this.scene.add(key);

    this.models = new ButcherStageModels(this.scene);

    this.active = false;
    this.mode = 'PLAY';
    this.stepIdx = 0;
    this.stepResults = [];
    this.totalScore = 0;
    this.time = 0;
    this.cursorPhase = 0;
    this.pointerDown = false;
    this.dragStart = { x: 0, y: 0, t: 0 };
    this.dragCurrent = { x: 0, y: 0 };
    this.subCount = 0;
    this.circleSweep = 0;
    this.lastAngle = null;
    this.toolWorldX = 0;
    this.toolWorldZ = 0;
    this.feedbackTimer = 0;

    this._projA = new THREE.Vector3();
    this._projB = new THREE.Vector3();

    this.touchedThisStep = false;
    this.stepIdle = 0;

    this._buildUI();
    this.coach = new MiniGameCoach(rootContainer, 'butcher');
  }

  _buildUI() {
    if (!document.getElementById('minigame-shared-styles')) {
      const st = document.createElement('style');
      st.id = 'minigame-shared-styles';
      st.textContent = `
        .mg-overlay {
          position: fixed; inset: 0; z-index: 42; pointer-events: none;
          font-family: "Hiragino Maru Gothic ProN", "Rounded Mplus 1c", "Yu Gothic", sans-serif;
          color: #eef6ff; user-select: none; -webkit-user-select: none;
        }
        .mg-overlay.hidden { display: none !important; }
        /* Safe top offset (54px) so top-left iOS close button NEVER covers text! */
        .mg-top-card {
          position: fixed; top: 54px; left: 50%; transform: translateX(-50%);
          width: min(500px, calc(100vw - 20px));
          background: rgba(6, 18, 34, 0.90); border: 1px solid rgba(110, 210, 255, 0.45);
          border-radius: 14px; padding: 9px 14px; text-align: center;
          backdrop-filter: blur(8px); pointer-events: auto;
        }
        .mg-step-badge { font-size: 11px; font-weight: 800; color: #ffd46b; letter-spacing: 0.05em; }
        .mg-hint-text { font-size: clamp(13.5px, 3.8vw, 17px); font-weight: 800; color: #ffffff; margin-top: 2px; }
        .mg-prog-bar { height: 6px; border-radius: 3px; background: rgba(255,255,255,0.12); margin-top: 6px; overflow: hidden; }
        .mg-prog-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #3de08a, #5ce1ff); transition: width 0.2s ease; }
        .mg-gesture-canvas { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: auto; touch-action: none; }
        .mg-feedback {
          position: fixed; left: 50%; top: 44%; transform: translate(-50%, -50%) scale(0.85);
          font-size: clamp(22px, 6.5vw, 40px); font-weight: 900; padding: 8px 18px;
          border-radius: 14px; opacity: 0; pointer-events: none;
          transition: opacity 0.18s ease, transform 0.2s ease; text-shadow: 0 4px 16px rgba(0,0,0,0.85);
        }
        .mg-feedback.show { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        .mg-feedback.ok { color: #7dffb8; }
        .mg-feedback.ng { color: #ff7a7a; }
        .mg-res-screen {
          position: fixed; inset: 0; display: flex; flex-direction: column; justify-content: space-between;
          padding: 54px 14px 16px; pointer-events: none; z-index: 44;
        }
        .mg-res-screen.hidden { display: none !important; }
        .mg-res-card {
          width: min(500px, 100%); margin: 0 auto;
          background: rgba(5, 15, 30, 0.92); border: 1.5px solid rgba(255, 212, 107, 0.55);
          border-radius: 16px; padding: 12px 16px; text-align: center;
          backdrop-filter: blur(10px); box-shadow: 0 12px 36px rgba(0,0,0,0.65);
        }
        .mg-res-rank-row { display: flex; align-items: baseline; justify-content: center; gap: 12px; margin-top: 4px; }
        .mg-res-rank { font-size: clamp(28px, 7vw, 40px); font-weight: 900; color: #ffd454; }
        .mg-res-score { font-size: clamp(22px, 6vw, 34px); font-weight: 900; color: #7ce8ff; }
        .mg-res-comment { font-size: 13px; color: #e8f5ff; margin-top: 6px; line-height: 1.45; }
        .mg-res-card .result-ranking { justify-content: center; }
        .mg-res-dots { display: flex; justify-content: center; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
        .mg-dot { width: 15px; height: 15px; border-radius: 50%; font-size: 9px; line-height: 15px; font-weight: 800; }
        .mg-dot.ok { background: rgba(61, 224, 138, 0.28); border: 1px solid #3de08a; color: #9effcc; }
        .mg-dot.ng { background: rgba(255, 85, 85, 0.28); border: 1px solid #ff5555; color: #ffb0b0; }
        .mg-result-footer {
          width: min(460px, 100%); margin: 0 auto;
          display: grid; grid-template-columns: 1fr 1fr; gap: 10px; pointer-events: auto;
        }
        .mg-btn {
          min-height: 44px; padding: 10px; border-radius: 10px; border: 1px solid rgba(130, 220, 255, 0.5);
          background: linear-gradient(135deg, #1769a8, #24a8d4); color: #fff;
          font-size: 14px; font-weight: 800; cursor: pointer; font-family: inherit;
        }
        .mg-btn.x-btn { background: linear-gradient(135deg, #14171c, #272d36); border-color: rgba(255,255,255,0.35); }
        @media (min-width: 600px) and (max-height: 430px) {
          .mg-res-screen { padding-top: 42px; }
          .mg-res-card { padding-block: 8px; }
        }
      `;
      document.head.appendChild(st);
    }

    this.el = document.createElement('div');
    this.el.className = 'mg-overlay hidden';
    this.el.innerHTML = localizeHtml(`
      <canvas class="mg-gesture-canvas" id="butcher-guide-canvas"></canvas>
      <div class="mg-top-card" id="butcher-top">
        <div class="mg-step-badge" id="butcher-step-title">解体工程 1 / 15</div>
        <div class="mg-hint-row">
          <span class="mg-rule-chip hidden" id="butcher-rule"></span>
          <div class="mg-hint-text" id="butcher-hint">光る線にそってなぞろう</div>
        </div>
        <div class="mg-prog-bar"><div class="mg-prog-fill" id="butcher-prog"></div></div>
      </div>
      <div class="mg-feedback" id="butcher-feedback">PERFECT!</div>

      <div class="mg-res-screen hidden" id="butcher-res-screen">
        <div class="mg-res-card" id="butcher-res-card">
          <div class="res-tier-ribbon" id="butcher-res-ribbon">RESULT</div>
          <div class="mg-step-badge">ダイオウイカ解体 結果発表（全15工程）</div>
          <div class="mg-res-rank-row">
            <span class="mg-res-rank" id="butcher-res-rank">S</span>
            <span class="mg-res-score" id="butcher-res-score">0 点</span>
          </div>
          <div class="result-ranking" aria-live="polite">
            <span data-result-position></span><span data-result-play-count></span>
          </div>
          <div class="mg-res-comment" id="butcher-res-comment">--</div>
          <div class="mg-res-dots" id="butcher-res-dots"></div>
        </div>
        <div class="mg-result-footer">
          <button type="button" class="mg-btn x-btn" id="butcher-btn-x" data-result-share>Xでシェア</button>
          <button type="button" class="mg-btn" id="butcher-btn-next">次へ</button>
        </div>
      </div>
    `);
    this.root.appendChild(this.el);

    this.guideCanvas = this.el.querySelector('#butcher-guide-canvas');
    this.gCtx = this.guideCanvas.getContext('2d');
    this.elTop = this.el.querySelector('#butcher-top');
    this.elStepTitle = this.el.querySelector('#butcher-step-title');
    this.elHint = this.el.querySelector('#butcher-hint');
    this.elRule = this.el.querySelector('#butcher-rule');
    this.elProg = this.el.querySelector('#butcher-prog');
    this.elFeedback = this.el.querySelector('#butcher-feedback');
    this.elResScreen = this.el.querySelector('#butcher-res-screen');
    this.elResRank = this.el.querySelector('#butcher-res-rank');
    this.elResScore = this.el.querySelector('#butcher-res-score');
    this.elResComment = this.el.querySelector('#butcher-res-comment');
    this.elResDots = this.el.querySelector('#butcher-res-dots');
    this.rankingResult = new ResultRanking('butcher', this.el);

    this.el.querySelector('#butcher-btn-next').addEventListener('click', () => {
      this.hide();
      if (this.callbacks.onComplete) this.callbacks.onComplete({ score: this.totalScore, stepResults: this.stepResults });
    });

    const toNorm = (e) => {
      const r = this.guideCanvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    };

    this.guideCanvas.addEventListener('pointerdown', (e) => {
      if (!this.active || this.mode !== 'PLAY' || this.coach.isBlocking()) return;
      e.preventDefault();
      // Keep receiving the move / release even if the mouse leaves the canvas while dragging.
      try { this.guideCanvas.setPointerCapture(e.pointerId); } catch (_) {}
      const pt = toNorm(e);
      this.pointerDown = true;
      this.touchedThisStep = true;
      this.stepIdle = 0;
      this.dragStart = { x: pt.x, y: pt.y, t: performance.now() };
      this.dragCurrent = pt;
      this.circleSweep = 0;
      this.lastAngle = Math.atan2(pt.y - 0.52, pt.x - 0.5);

      const step = BUTCHER_STEPS_15[this.stepIdx];
      if (step.type === 'timing') {
        const pos = 0.5 + 0.44 * Math.sin(this.cursorPhase);
        const dist = Math.abs(pos - 0.5);
        const ok = dist <= step.zone * 0.58;
        const ratio = ok ? Math.max(0.62, 1.0 - dist / (step.zone * 0.65)) : 0.14;
        if (step.se === 'ink') { if (ok) this.audio?.playPop(); else this.audio?.playInkBurst(); }
        else this._playStepSE(step.se);
        this._finishStep(ok, Math.round(step.maxScore * ratio), ok ? '完璧な手さばき！' : (step.id === 'ink' ? '墨袋破裂!! 真っ黒だ!' : '少しズレてしまった…'));
        this.pointerDown = false;
      }
    });

    this.guideCanvas.addEventListener('pointermove', (e) => {
      if (!this.active || this.mode !== 'PLAY' || !this.pointerDown) return;
      e.preventDefault();
      const pt = toNorm(e);
      const step = BUTCHER_STEPS_15[this.stepIdx];
      this.toolWorldX = step.fx + (pt.x - 0.5) * 3.6;
      this.toolWorldZ = step.fz + (pt.y - 0.5) * 3.2;

      if (step.type === 'circle') {
        const a = Math.atan2(pt.y - 0.52, pt.x - 0.5);
        let da = a - this.lastAngle;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        this.circleSweep += Math.abs(da);
        this.lastAngle = a;
      }
      this.dragCurrent = pt;
    });

    const onUp = () => {
      if (!this.active || this.mode !== 'PLAY' || !this.pointerDown) return;
      this.pointerDown = false;
      this._evaluateGesture();
    };
    this.guideCanvas.addEventListener('pointerup', onUp);
    this.guideCanvas.addEventListener('pointercancel', onUp);
  }

  _playStepSE(se) {
    if (!this.audio) return;
    if (se === 'wash') this.audio.playWash();
    else if (se === 'slice') this.audio.playSlice();
    else if (se === 'chop') this.audio.playChop();
    else if (se === 'pen') this.audio.playPenPull();
    else if (se === 'pop') this.audio.playPop();
    else if (se === 'peel') this.audio.playPeel();
  }

  _evaluateGesture() {
    const step = BUTCHER_STEPS_15[this.stepIdx];
    const dtSec = Math.max(0.05, (performance.now() - this.dragStart.t) / 1000);
    const dx = this.dragCurrent.x - this.dragStart.x;
    const dy = this.dragCurrent.y - this.dragStart.y;

    if (step.type === 'rub') {
      if (Math.abs(dx) > 0.13) {
        this._playStepSE(step.se);
        this.models.knifeSwing = 0.8;
        this.subCount++;
        if (this.subCount >= step.count) this._finishStep(true, Math.round(step.maxScore * 0.96), 'ツルツルに綺麗になった！');
        else this._refreshRuleChip();
      }
    } else if (step.type === 'multi_swipe_v') {
      if (Math.abs(dy) > 0.13) {
        this._playStepSE(step.se);
        this.models.knifeSwing = 1.0;
        this.models.burstParticles(step.fx, step.fz, 0xffe8e4, 20);
        this.subCount++;
        if (this.subCount >= step.count) this._finishStep(true, Math.round(step.maxScore * 0.95), 'リズミカルに綺麗に切断！');
        else this._refreshRuleChip();
      }
    } else if (step.type === 'swipe_v') {
      const ok = Math.abs(dy) > 0.15;
      this._playStepSE(step.se);
      this._finishStep(ok, Math.round(step.maxScore * (ok ? 0.95 : 0.25)), ok ? 'スパッと綺麗に決まった！' : '切り込みが浅かった…');
    } else if (step.type === 'swipe_r') {
      const ok = dx > 0.15;
      this._playStepSE(step.se);
      this._finishStep(ok, Math.round(step.maxScore * (ok ? 0.95 : 0.25)), ok ? '一閃！美しい切断面！' : '長さが足りなかった…');
    } else if (step.type === 'slow_swipe_l') {
      const ok = dx < -0.15 && dtSec >= 0.40;
      this._playStepSE(step.se);
      this._finishStep(ok, Math.round(step.maxScore * (ok ? 0.96 : 0.22)), ok ? '軟甲が1本丸ごと抜けた！' : '速すぎて途中で折れた！');
    } else if (step.type === 'slow_swipe_r') {
      const ok = dx > 0.14 && dtSec >= 0.36;
      this._playStepSE(step.se);
      this._finishStep(ok, Math.round(step.maxScore * (ok ? 0.95 : 0.24)), ok ? '肝臓を無傷で分離！' : '肝臓が潰れてしまった…');
    } else if (step.type === 'fast_swipe_u') {
      const ok = dy < -0.14 && dtSec < 0.85;
      this._playStepSE(step.se);
      this._finishStep(ok, Math.round(step.maxScore * (ok ? 0.96 : 0.24)), ok ? 'つるりと綺麗な白身に！' : '皮が千切れて残った…');
    } else if (step.type === 'circle') {
      const ok = this.circleSweep >= Math.PI * 1.1;
      this._playStepSE(step.se);
      this._finishStep(ok, Math.round(step.maxScore * (ok ? 0.95 : 0.24)), ok ? '巨大眼球を綺麗に摘出！' : '目玉に傷がついた…');
    }
  }

  _finishStep(ok, pts, msg) {
    this.stepResults[this.stepIdx] = ok;
    this.totalScore = Math.min(50000, this.totalScore + pts);
    this.models.applyStepVisual(this.stepIdx, ok);
    if (ok) this.audio?.playStepOK(); else this.audio?.playStepNG();

    this.elFeedback.textContent = t(msg);
    this.elFeedback.className = `mg-feedback show ${ok ? 'ok' : 'ng'}`;
    this.feedbackTimer = 1.0;

    this.stepIdx++;
    this.subCount = 0;
    if (this.stepIdx >= BUTCHER_STEPS_15.length) {
      const run = this.rankingRun;
      setTimeout(() => { if (this.active && this.rankingRun === run) this._enterResult(); }, 850);
    } else {
      this._refreshStepUI();
    }
  }

  _refreshRuleChip() {
    const step = BUTCHER_STEPS_15[this.stepIdx];
    if (!step || !step.rule) {
      this.elRule.classList.add('hidden');
      return;
    }
    this.elRule.textContent = step.rule === 'count' ? t('あと {0} 回', step.count - this.subCount) : t(step.rule);
    this.elRule.classList.toggle('warn', !!step.ruleWarn);
    this.elRule.classList.remove('hidden');
  }

  _refreshStepUI() {
    const step = BUTCHER_STEPS_15[this.stepIdx];
    this.elStepTitle.textContent = t('解体 {0} / {1} ・ {2}', this.stepIdx + 1, BUTCHER_STEPS_15.length, t(step.title));
    this.elHint.textContent = t(step.hint);
    this._refreshRuleChip();
    this.touchedThisStep = false;
    this.stepIdle = 0;
    // Wait for the previous step's result message to fade before explaining a new rule.
    if (step.coach) this.coach.request(BUTCHER_COACH_CARDS[step.coach], this.stepIdx === 0 ? 0.6 : 1.05);
    this.elProg.style.width = `${(this.stepIdx / BUTCHER_STEPS_15.length) * 100}%`;
    this.camDesiredTarget.set(step.fx, 0.25, step.fz);
    this.toolWorldX = step.fx;
    this.toolWorldZ = step.fz;
  }

  _enterResult() {
    if (this.mode !== 'PLAY') return;
    this.mode = 'RESULT';
    this.coach.cancel();
    this.coach.markDone();
    const rank = this.totalScore >= 45000 ? 'S+' : this.totalScore >= 37500 ? 'S' : this.totalScore >= 27500 ? 'A' : this.totalScore >= 17500 ? 'B' : 'C';
    this.audio?.playResultJingle(rank);
    this.models.arrangeForResult(this.stepResults);
    this.elTop.classList.add('hidden');
    this.elResScreen.classList.remove('hidden');
    this.guideCanvas.style.pointerEvents = 'none';

    this.elResRank.textContent = rank;
    ResultFXManager.applyCardStyle(this.el.querySelector('#butcher-res-card'), this.elResRank, this.el.querySelector('#butcher-res-ribbon'), rank);
    ResultFXManager.animateScore(this.elResScore, this.totalScore, 750);
    this.resultFX?.start(rank);
    const comment = getCommentForScore(this.totalScore, 'butcher');
    this.elResComment.textContent = comment;
    this.rankingResult.show({ score: this.totalScore, comment }, finishRankingRun(this.rankingRun, this.totalScore), this.rankingPlayerName);
    this.elResDots.innerHTML = this.stepResults.map((ok) => `<span class="mg-dot ${ok ? 'ok' : 'ng'}">${ok ? '○' : '×'}</span>`).join('');
  }

  start(playerName = '') {
    this.active = true;
    this.mode = 'PLAY';
    this.rankingPlayerName = playerName;
    this.rankingRun = startRankingRun('butcher', playerName);
    this.rankingResult.clear();
    this.stepIdx = 0;
    this.subCount = 0;
    this.stepResults = [];
    this.totalScore = 0;
    this.cursorPhase = 0;
    this.models.resetForNewButcher();

    this.el.classList.remove('hidden');
    this.elTop.classList.remove('hidden');
    this.elResScreen.classList.add('hidden');
    this.guideCanvas.style.pointerEvents = 'auto';
    this._refreshStepUI();
  }

  hide() {
    this.active = false;
    this.rankingResult.clear();
    this.pointerDown = false;
    this.coach.cancel();
    this.el.classList.add('hidden');
    this.resultFX?.stop();
  }

  _projectToScreen(worldArr, w, h, out) {
    out.set(worldArr[0], worldArr[1], worldArr[2]).project(this.camera);
    return { x: (out.x * 0.5 + 0.5) * w, y: (-out.y * 0.5 + 0.5) * h };
  }

  _drawOverlay2D(w, h) {
    if (this.guideCanvas.width !== w || this.guideCanvas.height !== h) {
      this.guideCanvas.width = w;
      this.guideCanvas.height = h;
    }
    const ctx = this.gCtx;
    ctx.clearRect(0, 0, w, h);
    if (this.mode !== 'PLAY' || this.stepIdx >= BUTCHER_STEPS_15.length) return;

    const step = BUTCHER_STEPS_15[this.stepIdx];
    const pulse = 0.55 + 0.45 * Math.sin(this.time * 7.5);

    if (step.type === 'timing') {
      const bw = Math.min(330, w * 0.82), bh = 30;
      const bx = (w - bw) * 0.5, by = h * 0.74;
      ctx.fillStyle = 'rgba(5, 16, 30, 0.92)';
      ctx.fillRect(bx, by, bw, bh);
      const zw = bw * step.zone;
      ctx.fillStyle = 'rgba(61, 224, 138, 0.86)';
      ctx.fillRect(bx + (bw - zw) * 0.5, by, zw, bh);

      const cNorm = 0.5 + 0.44 * Math.sin(this.cursorPhase);
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(bx + cNorm * bw - 4, by - 7, 8, bh + 14);
      ctx.strokeStyle = '#5ce1ff';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(adaptText(t('▼ 緑に重なったらタップ ▼')), w * 0.5, by - 14);
    } else if (step.type === 'circle' && step.p0) {
      const c = this._projectToScreen(step.p0, w, h, this._projA);
      const rad = Math.min(w, h) * 0.16;
      ctx.strokeStyle = `rgba(255, 220, 90, ${0.65 + 0.35 * pulse})`;
      ctx.lineWidth = 6;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.arc(c.x, c.y, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      const a = this.time * 3.0;
      ctx.fillStyle = '#5ce1ff';
      ctx.beginPath();
      ctx.arc(c.x + Math.cos(a) * rad, c.y + Math.sin(a) * rad, 11, 0, Math.PI * 2);
      ctx.fill();
    } else if (step.p0 && step.p1) {
      // Project exact 3D anatomical start/end coordinates onto screen!
      const s0 = this._projectToScreen(step.p0, w, h, this._projA);
      const s1 = this._projectToScreen(step.p1, w, h, this._projB);

      // Glowing cut track
      ctx.strokeStyle = `rgba(92, 225, 255, ${0.55 + 0.4 * pulse})`;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s0.x, s0.y);
      ctx.lineTo(s1.x, s1.y);
      ctx.stroke();

      // Animated sliding golden chevron arrow showing exact swipe direction!
      const arrowProgress = (this.time * 0.95) % 1.0;
      const ax = s0.x + (s1.x - s0.x) * arrowProgress;
      const ay = s0.y + (s1.y - s0.y) * arrowProgress;
      const ang = Math.atan2(s1.y - s0.y, s1.x - s0.x);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-10, -10);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-10, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Pulsing start circle
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(s0.x, s0.y, 14 + pulse * 8, 0, Math.PI * 2);
      ctx.stroke();

      if (step.count) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(t('残り {0} 回', step.count - this.subCount), (s0.x + s1.x) * 0.5, Math.min(s0.y, s1.y) - 18);
      }
    }

    if (this.coach.shouldShowGhost(this.touchedThisStep, this.stepIdle, this.pointerDown)) {
      this._drawGhost(ctx, step, w, h);
    }

    if (this.pointerDown) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(this.dragStart.x * w, this.dragStart.y * h);
      ctx.lineTo(this.dragCurrent.x * w, this.dragCurrent.y * h);
      ctx.stroke();
    }
  }

  _drawGhost(ctx, step, w, h) {
    const t = this.time;
    if (step.type === 'timing') {
      const inZone = Math.abs(0.44 * Math.sin(this.cursorPhase)) <= step.zone * 0.5;
      drawGhostTap(ctx, { x: w * 0.5, y: h * 0.74 + 62 }, t, inZone);
    } else if (step.type === 'circle' && step.p0) {
      const c = this._projectToScreen(step.p0, w, h, this._projA);
      drawGhostCircle(ctx, c, Math.min(w, h) * 0.16, t);
    } else if (step.p0 && step.p1) {
      const a = this._projectToScreen(step.p0, w, h, this._projA);
      const b = this._projectToScreen(step.p1, w, h, this._projB);
      const speed = step.type.startsWith('slow') ? 0.8 : (step.type === 'fast_swipe_u' ? 1.8 : 1);
      drawGhostSwipe(ctx, { x: a.x, y: a.y }, { x: b.x, y: b.y }, t, speed);
    }
  }

  render(renderer, width, height, dt) {
    if (!this.active) return;
    const safeDt = Math.min(0.05, dt);
    this.time += safeDt;

    const step = BUTCHER_STEPS_15[Math.min(this.stepIdx, BUTCHER_STEPS_15.length - 1)];
    // Hold the timing cursor still while a guide card is up so nothing moves behind it.
    if (!this.coach.isBlocking()) {
      this.cursorPhase += safeDt * (step.speed || 2.5);
      if (this.mode === 'PLAY' && !this.pointerDown) this.stepIdle += safeDt;
    }

    if (this.feedbackTimer > 0) {
      this.feedbackTimer -= safeDt;
      if (this.feedbackTimer <= 0) this.elFeedback.classList.remove('show');
    }

    const aspect = width / Math.max(1, height);
    const portraitPull = aspect < 0.75 ? 1.38 : 1.0;

    if (this.mode === 'RESULT') {
      const a = Math.sin(this.time * 0.45) * 0.38;
      this.camera.position.set(Math.sin(a) * 6.8 * portraitPull, 5.4 * portraitPull, Math.cos(a) * 5.2 * portraitPull);
      this.camera.lookAt(0, 0.25, 0.1);
    } else {
      // Smoothly pan camera directly over the active anatomical part so it's NEVER off-screen!
      this.camTarget.lerp(this.camDesiredTarget, Math.min(1, safeDt * 5.5));
      this.camera.position.set(this.camTarget.x, 4.9 * portraitPull, this.camTarget.z + 3.2 * portraitPull);
      this.camera.lookAt(this.camTarget);
    }

    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.models.update(safeDt, this.toolWorldX, this.toolWorldZ);
    this._drawOverlay2D(width, height);

    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, width, height);
    renderer.render(this.scene, this.camera);
  }
}
