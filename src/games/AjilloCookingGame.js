import { ResultFXManager } from '../ui/ResultFX.js';
import * as THREE from 'three';
import { CookingStageModels } from '../models/CookingModels.js';
import { getCommentForScore } from '../data/SquidTiersAndComments.js';

const COOK_STEPS_10 = [
  { id: 'score_arm', title: '1. イカ足の隠し包丁（格子切り）',   hint: 'ガイド線に沿って斜め2回スワイプしよう！',               type: 'multi_cut',   count: 2, maxScore: 4500 },
  { id: 'slice_arm', title: '2. イカ足の輪切りカット（5切れ）',  hint: '光るガイド線に沿って縦に5回スワイプしよう！',           type: 'slice_arm',   count: 5, maxScore: 5200 },
  { id: 'garlic',    title: '3. ニンニクの押し潰し＆みじん切り', hint: 'ニンニクの上をトントン3回タップしよう！',               type: 'multi_tap',   count: 3, maxScore: 4600 },
  { id: 'veggies',   title: '4. 唐辛子・きのこ・トマト下処理',   hint: '各具材のガイド線を3回スワイプして切ろう！',             type: 'multi_cut',   count: 3, maxScore: 4700 },
  { id: 'pour_oil',  title: '5. オリーブオイル注ぎ',             hint: '画面を長押しして注ぎ、緑の適量ゾーンで離そう！',        type: 'hold_fill',   maxScore: 5200 },
  { id: 'aroma',     title: '6. 弱火で香り出し（火加減）',       hint: '左右にドラッグして緑の弱火ゾーンをキープしよう！',      type: 'heat_keep',   maxScore: 5400 },
  { id: 'drop_in',   title: '7. イカ足＆具材のスキレット投入',   hint: '下から上へ勢いよくスワイプして具材を投入！',            type: 'swipe_up',    maxScore: 4800 },
  { id: 'toss_cook', title: '8. トング混ぜ＆スキレット煽り',     hint: '左右スワイプで混ぜ、緑の焼き加減ゾーンで指を離そう！',  type: 'toss_cook',   maxScore: 5600 },
  { id: 'mills',     title: '9. 粗塩＆黒胡椒ミル（3〜4周回転）', hint: '円に沿って3〜4周グルグル回して緑になったら離そう！',    type: 'mill_circle', maxScore: 5200 },
  { id: 'parsley',   title: '10. パセリ＆バゲット仕上げ',        hint: 'スキレットの上を3回タップしてパセリを散らそう！',       type: 'multi_tap',   count: 3, maxScore: 4800 }
];

export class AjilloCookingGame {
  constructor(rootContainer, audio, callbacks = {}, resultFX = null) {
    this.root = rootContainer;
    this.audio = audio;
    this.callbacks = callbacks;
    this.resultFX = resultFX;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1b1511);
    this.camera = new THREE.PerspectiveCamera(44, 1, 0.1, 60);
    this.camera.position.set(0, 4.6, 4.2);
    this.camera.lookAt(0, 0.25, 0);

    this.scene.add(new THREE.HemisphereLight(0xfff0d6, 0x2d2218, 1.35));
    const key = new THREE.DirectionalLight(0xfff6e5, 2.0);
    key.position.set(4, 8, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xffcb8c, 0.9);
    rim.position.set(-5, 4, -4);
    this.scene.add(rim);

    this.models = new CookingStageModels(this.scene);

    this.active = false;
    this.mode = 'PLAY';
    this.stepIdx = 0;
    this.cookResults = [];
    this.totalScore = 0;
    this.time = 0;
    this.feedbackTimer = 0;

    this.pointerDown = false;
    this.dragStart = { x: 0, y: 0 };
    this.dragCurrent = { x: 0, y: 0 };
    this.trail = [];
    this.subCount = 0;
    this.fillLevel = 0;
    this.heatDial = 0.48;
    this.heatGoodTime = 0;
    this.heatElapsed = 0;
    this.tossProgress = 0;
    this.panShakeX = 0;
    this.millSweep = 0;
    this.lastAngle = null;
    this.seCooldown = 0;
    this._projVec = new THREE.Vector3();

    this._buildUI();
  }

  _buildUI() {
    this.el = document.createElement('div');
    this.el.className = 'mg-overlay hidden';
    this.el.innerHTML = `
      <canvas class="mg-gesture-canvas" id="cook-guide-canvas"></canvas>
      <div class="mg-top-card" id="cook-top">
        <div class="mg-step-badge" id="cook-step-title">調理工程 1 / 10</div>
        <div class="mg-hint-text" id="cook-hint">調理アクションを始めよう！</div>
        <div class="mg-prog-bar"><div class="mg-prog-fill" id="cook-prog"></div></div>
      </div>
      <div class="mg-feedback" id="cook-feedback">GOOD!</div>

      <div class="mg-res-screen hidden" id="cook-res-screen">
        <div class="mg-res-card" id="cook-res-card">
          <div class="res-tier-ribbon" id="cook-res-ribbon">RESULT</div>
          <div class="mg-step-badge">ダイオウイカのアヒージョ 結果発表（全10工程）</div>
          <div class="mg-res-rank-row">
            <span class="mg-res-rank" id="cook-res-rank">S</span>
            <span class="mg-res-score" id="cook-res-score">0 点</span>
          </div>
          <div class="mg-res-comment" id="cook-res-comment">--</div>
          <div class="mg-res-dots" id="cook-res-dots"></div>
        </div>
        <div class="mg-result-footer">
          <button type="button" class="mg-btn x-btn" id="cook-btn-x">Xでシェア</button>
          <button type="button" class="mg-btn" id="cook-btn-home">ホームに戻る</button>
        </div>
      </div>
    `;
    this.root.appendChild(this.el);

    this.guideCanvas = this.el.querySelector('#cook-guide-canvas');
    this.gCtx = this.guideCanvas.getContext('2d');
    this.elTop = this.el.querySelector('#cook-top');
    this.elStepTitle = this.el.querySelector('#cook-step-title');
    this.elHint = this.el.querySelector('#cook-hint');
    this.elProg = this.el.querySelector('#cook-prog');
    this.elFeedback = this.el.querySelector('#cook-feedback');
    this.elResScreen = this.el.querySelector('#cook-res-screen');
    this.elResRank = this.el.querySelector('#cook-res-rank');
    this.elResScore = this.el.querySelector('#cook-res-score');
    this.elResComment = this.el.querySelector('#cook-res-comment');
    this.elResDots = this.el.querySelector('#cook-res-dots');

    this.el.querySelector('#cook-btn-x').addEventListener('click', () => {
      if (this.callbacks.onShareX) {
        const comment = getCommentForScore(this.totalScore, 'cooking');
        this.callbacks.onShareX(`ダイオウイカのアヒージョ（全10工程）を作った！\n調理スコア：${this.totalScore.toLocaleString()}点\n「${comment}」\n#ダイオウイカ深海釣り`);
      }
    });
    this.el.querySelector('#cook-btn-home').addEventListener('click', () => {
      this.hide();
      if (this.callbacks.onReturnHome) this.callbacks.onReturnHome();
    });

    const toNorm = (e) => {
      const r = this.guideCanvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    };

    this.guideCanvas.addEventListener('pointerdown', (e) => {
      if (!this.active || this.mode !== 'PLAY') return;
      e.preventDefault();
      const pt = toNorm(e);
      this.pointerDown = true;
      this.dragStart = pt;
      this.dragCurrent = pt;
      this.trail = [pt];
      this.lastAngle = Math.atan2(pt.y - 0.50, pt.x - 0.50);

      const step = COOK_STEPS_10[this.stepIdx];
      if (step.type === 'multi_tap') {
        this.subCount++;
        if (step.id === 'garlic') {
          this.audio?.playChop();
          this.models.triggerGarlicTap(this.subCount);
        } else {
          this.audio?.playSprinkle();
          this.models.triggerParsleyTap(this.subCount);
        }
        if (this.subCount >= step.count) {
          this._finishStep(true, Math.round(step.maxScore * 0.96), step.id === 'garlic' ? '香り立つ綺麗な刻みニンニク！' : '彩り完璧なパセリ仕上げ！');
        } else {
          this.elHint.textContent = `あと ${step.count - this.subCount} 回タップしよう！`;
        }
        this.pointerDown = false;
      }
    });

    this.guideCanvas.addEventListener('pointermove', (e) => {
      if (!this.active || this.mode !== 'PLAY' || !this.pointerDown) return;
      e.preventDefault();
      const pt = toNorm(e);
      this.trail.push(pt);
      if (this.trail.length > 26) this.trail.shift();

      const step = COOK_STEPS_10[this.stepIdx];
      if (step.type === 'multi_cut' || step.type === 'slice_arm') {
        this.models.knifeTargetX = (pt.x - 0.5) * 3.4;
      } else if (step.type === 'heat_keep') {
        this.heatDial = Math.max(0.05, Math.min(1.0, pt.x));
      } else if (step.type === 'toss_cook') {
        const dx = pt.x - this.dragCurrent.x;
        this.panShakeX = (pt.x - 0.5) * 2.2;
        this.models.stirPhase += dx * 6.5;
        this.tossProgress = Math.min(1.35, this.tossProgress + Math.abs(dx) * 0.42);
        this.models.setLiveDoneness(this.tossProgress);
        if (Math.abs(dx) > 0.025 && this.seCooldown <= 0) {
          this.audio?.playToss();
          this.seCooldown = 0.22;
        }
      } else if (step.type === 'mill_circle') {
        const a = Math.atan2(pt.y - 0.50, pt.x - 0.50);
        let da = a - this.lastAngle;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        this.millSweep += Math.abs(da);
        this.lastAngle = a;
        if (Math.abs(da) > 0.06) {
          this.models.millGrinding = 1.0;
          if (this.seCooldown <= 0) {
            this.audio?.playMillGrind();
            this.seCooldown = 0.16;
          }
        }
      }
      this.dragCurrent = pt;
    });

    const onUp = () => {
      if (!this.active || this.mode !== 'PLAY' || !this.pointerDown) return;
      this.pointerDown = false;
      this.panShakeX = 0;
      const step = COOK_STEPS_10[this.stepIdx];
      const dx = this.dragCurrent.x - this.dragStart.x;
      const dy = this.dragCurrent.y - this.dragStart.y;
      this.trail = [];

      if (step.type === 'multi_cut' || step.type === 'slice_arm') {
        if (Math.hypot(dx, dy) > 0.10) {
          this.audio?.playChop();
          if (step.type === 'slice_arm') {
            this.models.triggerSliceCut(this.subCount);
          } else if (step.id === 'score_arm') {
            this.models.triggerScoreSlash(this.subCount + 1);
          } else if (step.id === 'veggies') {
            this.models.triggerVeggieCut(this.subCount + 1);
          }
          this.subCount++;
          if (this.subCount >= step.count) {
            this._finishStep(true, Math.round(step.maxScore * 0.96), step.type === 'slice_arm' ? '吸盤付き輪切り5枚完成！' : '鮮やかな包丁さばき！');
          } else {
            this.elHint.textContent = `あと ${step.count - this.subCount} 回スワイプして切ろう！`;
          }
        }
      } else if (step.type === 'hold_fill') {
        const ok = this.fillLevel >= 0.56 && this.fillLevel <= 0.86;
        const st = this.fillLevel < 0.56 ? 'dry' : (this.fillLevel > 0.86 ? 'overflow' : 'ok');
        const msg = st === 'ok' ? '黄金オイルちょうどいい量！' : (st === 'dry' ? '油が少なすぎた…' : '入れすぎて溢れた！');
        this._finishStep(st, Math.round(step.maxScore * (ok ? 0.96 : 0.24)), msg);
      } else if (step.type === 'swipe_up') {
        const ok = dy < -0.12;
        if (ok) this.audio?.playSizzle();
        this._finishStep(ok, Math.round(step.maxScore * (ok ? 0.96 : 0.25)), ok ? 'ジュワーッ！最高の投入！' : '勢いが足りずこぼれた…');
      } else if (step.type === 'toss_cook') {
        if (this.tossProgress > 0.08) {
          const ok = this.tossProgress >= 0.72 && this.tossProgress <= 1.08;
          const st = this.tossProgress < 0.72 ? 'raw' : (this.tossProgress > 1.08 ? 'burnt' : 'ok');
          const msg = st === 'ok' ? 'プリッと最高の火入れ！' : (st === 'raw' ? 'まだ半生だった…' : '火を入れすぎて黒焦げ！');
          this._finishStep(st, Math.round(step.maxScore * (ok ? 0.96 : 0.22)), msg);
        }
      } else if (step.type === 'mill_circle') {
        const turns = this.millSweep / (Math.PI * 2);
        if (turns > 0.3) {
          const ok = turns >= 2.6 && turns <= 4.8;
          const msg = ok ? '塩＆黒胡椒 絶妙な挽き加減！' : (turns < 2.6 ? '回し足りず薄味に…' : '回しすぎて塩の雪山に！');
          this._finishStep(ok, Math.round(step.maxScore * (ok ? 0.96 : 0.22)), msg);
        }
      }
    };
    this.guideCanvas.addEventListener('pointerup', onUp);
    this.guideCanvas.addEventListener('pointercancel', onUp);
  }

  _finishStep(resultVal, pts, msg) {
    this.cookResults[this.stepIdx] = resultVal;
    const isGood = resultVal === true || resultVal === 'ok';
    this.totalScore = Math.min(50000, this.totalScore + pts);
    if (isGood) this.audio?.playStepOK(); else this.audio?.playStepNG();

    this.elFeedback.textContent = msg;
    this.elFeedback.className = `mg-feedback show ${isGood ? 'ok' : 'ng'}`;
    this.feedbackTimer = 1.05;

    this.stepIdx++;
    if (this.stepIdx >= COOK_STEPS_10.length) {
      setTimeout(() => { if (this.active) this._enterResult(); }, 850);
    } else {
      this._initCurrentStep();
    }
  }

  _initCurrentStep() {
    this.subCount = 0;
    this.fillLevel = 0;
    this.heatDial = 0.48;
    this.heatGoodTime = 0;
    this.heatElapsed = 0;
    this.tossProgress = 0;
    this.millSweep = 0;
    this.trail = [];

    this.models.setStepScene(this.stepIdx);
    const step = COOK_STEPS_10[this.stepIdx];
    this.elStepTitle.textContent = `調理工程 ${this.stepIdx + 1} / ${COOK_STEPS_10.length} — ${step.title}`;
    this.elHint.textContent = step.hint;
    this.elProg.style.width = `${(this.stepIdx / COOK_STEPS_10.length) * 100}%`;
  }

  _enterResult() {
    this.mode = 'RESULT';
    const rank = this.totalScore >= 45000 ? 'S+' : this.totalScore >= 37500 ? 'S' : this.totalScore >= 27500 ? 'A' : this.totalScore >= 17500 ? 'B' : 'C';
    this.audio?.playResultJingle(rank);
    this.models.buildFinalAjillo(this.cookResults);
    this.elTop.classList.add('hidden');
    this.elResScreen.classList.remove('hidden');
    this.guideCanvas.style.pointerEvents = 'none';

    this.elResRank.textContent = rank;
    ResultFXManager.applyCardStyle(this.el.querySelector('#cook-res-card'), this.elResRank, this.el.querySelector('#cook-res-ribbon'), rank);
    ResultFXManager.animateScore(this.elResScore, this.totalScore, 750);
    this.resultFX?.start(rank);
    this.elResComment.textContent = getCommentForScore(this.totalScore, 'cooking');
    this.elResDots.innerHTML = this.cookResults.map((v) => {
      const ok = v === true || v === 'ok';
      return `<span class="mg-dot ${ok ? 'ok' : 'ng'}">${ok ? '○' : '×'}</span>`;
    }).join('');
  }

  start() {
    this.active = true;
    this.mode = 'PLAY';
    this.stepIdx = 0;
    this.cookResults = [];
    this.totalScore = 0;
    this.models.resetForCooking();

    this.el.classList.remove('hidden');
    this.elTop.classList.remove('hidden');
    this.elResScreen.classList.add('hidden');
    this.guideCanvas.style.pointerEvents = 'auto';
    this._initCurrentStep();
  }

  hide() {
    this.active = false;
    this.el.classList.add('hidden');
    this.resultFX?.stop();
  }

  _project3D(x, y, z, w, h) {
    this._projVec.set(x, y, z).project(this.camera);
    return { x: (this._projVec.x * 0.5 + 0.5) * w, y: (-this._projVec.y * 0.5 + 0.5) * h };
  }

  _drawChevronTrack(ctx, x1, y1, x2, y2, label) {
    const pulse = 0.55 + 0.45 * Math.sin(this.time * 7.5);
    const angle = Math.atan2(y2 - y1, x2 - x1);

    ctx.save();
    ctx.strokeStyle = `rgba(92, 225, 255, ${0.42 + 0.35 * pulse})`;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.setLineDash([]);

    // Pulsing start ring
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x1, y1, 13 + pulse * 5, 0, Math.PI * 2);
    ctx.stroke();

    // Animated golden chevrons moving along the exact cut line
    for (let k = 0; k < 2; k++) {
      const t = (this.time * 0.9 + k * 0.5) % 1;
      const ax = x1 + (x2 - x1) * t;
      const ay = y1 + (y2 - y1) * t;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(angle);
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.moveTo(12, 0); ctx.lineTo(-8, -10); ctx.lineTo(-4, 0); ctx.lineTo(-8, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    if (label) {
      const mx = (x1 + x2) * 0.5;
      const my = Math.min(y1, y2) - 24;
      ctx.font = 'bold 14px sans-serif';
      const tw = ctx.measureText(label).width + 24;
      ctx.fillStyle = 'rgba(8, 16, 30, 0.88)';
      ctx.beginPath(); ctx.roundRect(mx - tw * 0.5, my - 14, tw, 28, 14); ctx.fill();
      ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, mx, my);
    }
    ctx.restore();
  }

  _drawGuide2D(w, h) {
    if (this.guideCanvas.width !== w || this.guideCanvas.height !== h) {
      this.guideCanvas.width = w;
      this.guideCanvas.height = h;
    }
    const ctx = this.gCtx;
    ctx.clearRect(0, 0, w, h);
    if (this.mode !== 'PLAY' || this.stepIdx >= COOK_STEPS_10.length) return;

    const step = COOK_STEPS_10[this.stepIdx];
    const pulse = 0.55 + 0.45 * Math.sin(this.time * 7.0);

    // Live glowing swipe trail
    if (this.trail.length > 1) {
      ctx.strokeStyle = 'rgba(255, 224, 102, 0.92)';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      this.trail.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x * w, p.y * h);
        else ctx.lineTo(p.x * w, p.y * h);
      });
      ctx.stroke();
    }

    if (step.id === 'score_arm') {
      const p1 = this.subCount === 0
        ? this._project3D(-1.2, 0.65, -0.35, w, h)
        : this._project3D(1.2, 0.65, -0.35, w, h);
      const p2 = this.subCount === 0
        ? this._project3D(1.2, 0.65, 0.75, w, h)
        : this._project3D(-1.2, 0.65, 0.75, w, h);
      this._drawChevronTrack(ctx, p1.x, p1.y, p2.x, p2.y, `斜めにスワイプ！（あと${step.count - this.subCount}回）`);
    } else if (step.type === 'slice_arm') {
      const targetX = -0.90 + this.subCount * 0.45;
      const p1 = this._project3D(targetX, 0.65, -0.65, w, h);
      const p2 = this._project3D(targetX, 0.65, 0.95, w, h);
      this._drawChevronTrack(ctx, p1.x, p1.y, p2.x, p2.y, `縦にカット！（あと${step.count - this.subCount}切れ）`);
    } else if (step.id === 'veggies') {
      const vx = this.subCount === 0 ? -1.05 : (this.subCount === 1 ? 0.0 : 1.05);
      const vLabel = this.subCount === 0 ? '唐辛子をカット！' : (this.subCount === 1 ? 'きのこをカット！' : 'トマトをカット！');
      const p1 = this._project3D(vx, 0.55, -0.55, w, h);
      const p2 = this._project3D(vx, 0.55, 0.95, w, h);
      this._drawChevronTrack(ctx, p1.x, p1.y, p2.x, p2.y, vLabel);
    } else if (step.type === 'multi_tap') {
      const center = this._project3D(0, 0.35, 0.15, w, h);
      ctx.strokeStyle = `rgba(255, 224, 102, ${0.55 + 0.45 * pulse})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(center.x, center.y, 34 + pulse * 14, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(8, 16, 30, 0.88)';
      ctx.beginPath(); ctx.roundRect(center.x - 86, center.y - 68, 172, 30, 15); ctx.fill();
      ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`タップ！（あと${step.count - this.subCount}回）`, center.x, center.y - 53);
    } else if (step.type === 'swipe_up') {
      this._drawChevronTrack(ctx, w * 0.5, h * 0.76, w * 0.5, h * 0.38, '上へスワイプで投入！');
    } else if (step.type === 'hold_fill' || step.type === 'toss_cook') {
      if (step.type === 'toss_cook') {
        // Clear horizontal swipe arrows directly over skillet
        const pL = this._project3D(-1.25, 0.35, 0.1, w, h);
        const pR = this._project3D(1.25, 0.35, 0.1, w, h);
        const dir = Math.sin(this.time * 4.5) >= 0;
        this._drawChevronTrack(ctx, dir ? pL.x : pR.x, pL.y, dir ? pR.x : pL.x, pR.y, '左右スワイプで混ぜる！');
      } else if (!this.pointerDown) {
        const pOil = this._project3D(0.5, 0.5, 0, w, h);
        ctx.fillStyle = 'rgba(8, 16, 30, 0.88)';
        ctx.beginPath(); ctx.roundRect(pOil.x - 95, pOil.y - 20, 190, 34, 17); ctx.fill();
        ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 1.8; ctx.stroke();
        ctx.fillStyle = '#ffe066'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('画面を長押しして注ぐ！', pOil.x, pOil.y - 3);
      }

      const bw = Math.min(320, w * 0.80), bh = 30;
      const bx = (w - bw) * 0.5, by = h * 0.76;
      const minOk = step.type === 'hold_fill' ? 0.56 : 0.72;
      const maxOk = step.type === 'hold_fill' ? 0.86 : 1.08;
      const val = Math.min(1.25, step.type === 'hold_fill' ? this.fillLevel : this.tossProgress);
      const inZone = val >= minOk && val <= maxOk;

      ctx.fillStyle = 'rgba(10, 16, 28, 0.92)';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill();

      // Green target zone
      ctx.fillStyle = inZone ? 'rgba(61, 224, 138, 0.82)' : 'rgba(61, 224, 138, 0.45)';
      ctx.fillRect(bx + (minOk / 1.25) * bw, by, ((maxOk - minOk) / 1.25) * bw, bh);

      // Live fill bar
      ctx.fillStyle = val > maxOk ? '#ff4a4a' : (inZone ? '#3de08a' : '#f5b342');
      ctx.fillRect(bx, by + 4, Math.min(bw, (val / 1.25) * bw), bh - 8);

      ctx.strokeStyle = inZone ? '#3de08a' : '#5ce1ff';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.stroke();

      // Crisp Japanese status label above gauge
      ctx.fillStyle = inZone ? '#3de08a' : (val > maxOk ? '#ff6b6b' : '#ffffff');
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      const statusText = inZone
        ? '★ OKゾーン！今すぐ指を離そう！ ★'
        : (val > maxOk ? (step.type === 'hold_fill' ? '入れすぎ！溢れる！' : '焼きすぎ！焦げる！')
          : (step.type === 'hold_fill' ? '長押しでオイルを注ぐ → 緑ゾーンで離す' : '左右スワイプで加熱 → 緑ゾーンで離す'));
      ctx.fillText(statusText, w * 0.5, by - 12);
    } else if (step.type === 'heat_keep') {
      const bw = Math.min(320, w * 0.80), bh = 30;
      const bx = (w - bw) * 0.5, by = h * 0.76;
      const inZone = this.heatDial >= 0.32 && this.heatDial <= 0.62;

      ctx.fillStyle = 'rgba(10, 16, 28, 0.92)';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill();
      ctx.fillStyle = inZone ? 'rgba(61, 224, 138, 0.75)' : 'rgba(61, 224, 138, 0.45)';
      ctx.fillRect(bx + 0.32 * bw, by, 0.30 * bw, bh);
      ctx.strokeStyle = '#5ce1ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.stroke();

      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.arc(bx + this.heatDial * bw, by + bh * 0.5, 15, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`左右ドラッグで弱火キープ：${Math.min(100, Math.round((this.heatGoodTime / 2.4) * 100))}%`, w * 0.5, by - 12);
    } else if (step.type === 'mill_circle') {
      const cx = w * 0.5, cy = h * 0.50, rad = Math.min(w, h) * 0.18;
      const turns = this.millSweep / (Math.PI * 2);
      const inZone = turns >= 2.6 && turns <= 4.8;

      ctx.strokeStyle = inZone ? '#3de08a' : `rgba(255, 225, 110, ${0.65 + 0.35 * pulse})`;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.stroke();

      // Orbiting arrow showing rotation direction
      const orbitA = this.time * 3.8;
      const ox = cx + Math.cos(orbitA) * rad;
      const oy = cy + Math.sin(orbitA) * rad;
      ctx.fillStyle = '#5ce1ff';
      ctx.beginPath(); ctx.arc(ox, oy, 10, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = 'rgba(8, 16, 30, 0.88)';
      ctx.beginPath(); ctx.roundRect(cx - 125, cy + rad + 16, 250, 32, 16); ctx.fill();
      ctx.strokeStyle = inZone ? '#3de08a' : '#ffe066'; ctx.lineWidth = 1.8; ctx.stroke();
      ctx.fillStyle = inZone ? '#3de08a' : '#ffffff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(inZone ? `${turns.toFixed(1)}回転 — 今すぐ離してOK！` : `${turns.toFixed(1)} 回転（目標 3.0〜4.0回転）`, cx, cy + rad + 32);
    }
  }

  render(renderer, width, height, dt) {
    if (!this.active) return;
    const safeDt = Math.min(0.05, dt);
    this.time += safeDt;
    this.seCooldown = Math.max(0, this.seCooldown - safeDt);

    if (this.feedbackTimer > 0) {
      this.feedbackTimer -= safeDt;
      if (this.feedbackTimer <= 0) this.elFeedback.classList.remove('show');
    }

    if (this.mode === 'PLAY' && this.stepIdx < COOK_STEPS_10.length) {
      const step = COOK_STEPS_10[this.stepIdx];
      if (step.type === 'hold_fill' && this.pointerDown) {
        this.fillLevel = Math.min(1.25, this.fillLevel + safeDt * 0.55);
        this.models.oilLevel = this.fillLevel;
        this.models.oilBottle.rotation.z = 1.15;
        this.models.isPouring = true;
        if (this.seCooldown <= 0) { this.audio?.playOilPour(); this.seCooldown = 0.22; }
      } else {
        this.models.oilBottle.rotation.z = 0.0;
        this.models.isPouring = false;
      }

      if (step.type === 'heat_keep') {
        this.heatElapsed += safeDt;
        this.heatDial = Math.max(0.05, Math.min(1.0, this.heatDial + Math.sin(this.time * 2.4) * safeDt * 0.14));
        this.models.flameLevel = this.heatDial * 1.25;
        this.models.setLiveGarlicHeat(this.heatDial > 0.62 ? Math.min(1.2, this.models.garlicHeat + safeDt * 0.35) : Math.min(0.72, this.heatGoodTime / 2.4 * 0.72));
        if (this.heatDial >= 0.32 && this.heatDial <= 0.62) {
          this.heatGoodTime += safeDt;
          if (this.seCooldown <= 0) { this.audio?.playSimmer(); this.seCooldown = 0.45; }
        }
        if (this.heatGoodTime >= 2.4) this._finishStep(true, Math.round(step.maxScore * 0.96), 'きつね色の極上ガーリックオイル！');
        else if (this.heatElapsed >= 6.5) this._finishStep(false, Math.round(step.maxScore * 0.22), '強火でニンニクが黒焦げ！');
      } else if (step.type === 'toss_cook') {
        this.models.flameLevel = 0.65;
        this.models.isSimmering = true;
      }
    }

    const aspect = width / Math.max(1, height);
    const portraitZoom = aspect < 0.75 ? 1.32 : 1.0;

    if (this.mode === 'RESULT') {
      const a = this.time * 0.35;
      this.camera.position.set(Math.sin(a) * 4.8 * portraitZoom, 3.6 * portraitZoom, Math.cos(a) * 4.8 * portraitZoom);
      this.camera.lookAt(-0.3, 0.25, 0.15);
    } else if (this.stepIdx <= 3) {
      // Cutting board framing
      this.camera.position.set(0, 4.4 * portraitZoom, 3.6 * portraitZoom);
      this.camera.lookAt(0, 0.25, 0.2);
    } else {
      // Skillet framing
      this.camera.position.set(0, 4.6 * portraitZoom, 3.9 * portraitZoom);
      this.camera.lookAt(0, 0.32, 0.05);
    }

    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    this.models.update(safeDt, this.panShakeX, this.millSweep);
    this._drawGuide2D(width, height);

    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, width, height);
    renderer.render(this.scene, this.camera);
  }
}
