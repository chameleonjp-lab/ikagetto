import { ResultFXManager } from '../ui/ResultFX.js';
import * as THREE from 'three';
import { CookingStageModels } from '../models/CookingModels.js';
import { getCommentForScore } from '../data/SquidTiersAndComments.js';
import { MiniGameCoach, GuideStore, drawGhostSwipe, drawGhostTap, drawGhostHold, drawGhostShuttle, drawGhostCircle } from '../ui/MiniGameCoach.js';

const COOK_STEPS_10 = [
  { id: 'score_arm', title: 'イカ足の隠し包丁',             hint: 'イカ足を、ななめに2回なぞる',            rule: 'count', type: 'multi_cut',   count: 2, coach: 'intro', maxScore: 4500 },
  { id: 'slice_arm', title: 'イカ足の輪切り',               hint: '光る線を、縦に5回なぞって切る',          rule: 'count', type: 'slice_arm',   count: 5, maxScore: 5200 },
  { id: 'garlic',    title: 'ニンニクをつぶして刻む',       hint: 'ニンニクを3回タップする',                rule: 'count', type: 'multi_tap',   count: 3, maxScore: 4600 },
  { id: 'veggies',   title: '唐辛子・きのこ・トマトの下ごしらえ', hint: '具材を1つずつ、縦になぞって切る', rule: 'count', type: 'multi_cut',   count: 3, maxScore: 4700 },
  { id: 'pour_oil',  title: 'オリーブオイルを注ぐ',         hint: '長押しで注ぎ、緑に入ったら指をはなす',  rule: '長押し', ruleWarn: true, type: 'hold_fill', coach: 'hold', maxScore: 5200 },
  { id: 'aroma',     title: '弱火で香りを出す',             hint: '指を左右に動かして、火を緑の中に保つ',  rule: '時間内', ruleWarn: true, type: 'heat_keep', coach: 'heat', maxScore: 5400 },
  { id: 'drop_in',   title: '具材をスキレットへ',           hint: '下から上へ、勢いよくなぞって入れる',    rule: 'すばやく', ruleWarn: true, type: 'swipe_up', maxScore: 4800 },
  { id: 'toss_cook', title: 'トングで混ぜて火を通す',       hint: '指をはなさずに左右に動かし、緑ではなす', rule: 'はなさない', ruleWarn: true, type: 'toss_cook', coach: 'toss', maxScore: 5600 },
  { id: 'mills',     title: '塩と黒こしょうをひく',         hint: '円にそって3〜4周回し、緑ではなす',      rule: 'はなさない', ruleWarn: true, type: 'mill_circle', coach: 'mill', maxScore: 5200 },
  { id: 'parsley',   title: 'パセリで仕上げ',               hint: 'スキレットを3回タップしてパセリを散らす', rule: 'count', type: 'multi_tap',   count: 3, maxScore: 4800 }
];

// Pause cards only for rules that a first-time player cannot guess from the screen.
const COOK_COACH_CARDS = {
  intro: {
    id: 'intro', demo: 'swipe',
    title: '光る線を、矢印の向きになぞろう',
    html: '黄色い丸がスタート地点です。いまやることは、いつも画面の上に出ます。'
  },
  hold: {
    id: 'hold', demo: 'hold',
    title: '長押しで注いで、緑で指をはなす',
    html: '押している間だけオイルが出ます。下のゲージが<b>緑</b>に入ったら指をはなそう。入れすぎると溢れます。'
  },
  heat: {
    id: 'heat', demo: 'shuttle',
    title: '火の強さを、緑の中に保つ',
    html: '火は勝手にゆれ動きます。指を置いたまま左右に動かし、黄色の丸を<b>緑</b>の中に入れ続けよう。時間がかかりすぎると焦げます。'
  },
  toss: {
    id: 'toss', demo: 'shuttle',
    title: '指をはなさずに、左右に動かし続ける',
    html: '動かすほど火が通ります。ゲージが<b>緑</b>に入ったら指をはなそう。指をはなした時点の焼き加減で決まります。'
  },
  mill: {
    id: 'mill', demo: 'circle',
    title: '指をはなさずに、円をなぞって回す',
    html: '<b>3〜4周</b>回して、文字が緑になったら指をはなします。指をはなした時点の回数で決まります。'
  }
};

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
    this.touchedThisStep = false;
    this.stepIdle = 0;

    this._buildUI();
    this.coach = new MiniGameCoach(rootContainer, 'cook');
  }

  _buildUI() {
    this.el = document.createElement('div');
    this.el.className = 'mg-overlay hidden';
    this.el.innerHTML = `
      <canvas class="mg-gesture-canvas" id="cook-guide-canvas"></canvas>
      <div class="mg-top-card" id="cook-top">
        <div class="mg-step-badge" id="cook-step-title">調理工程 1 / 10</div>
        <div class="mg-hint-row">
          <span class="mg-rule-chip hidden" id="cook-rule"></span>
          <div class="mg-hint-text" id="cook-hint">光る線にそってなぞろう</div>
        </div>
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
    this.elRule = this.el.querySelector('#cook-rule');
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
      if (!this.active || this.mode !== 'PLAY' || this.coach.isBlocking()) return;
      e.preventDefault();
      const pt = toNorm(e);
      this.pointerDown = true;
      this.touchedThisStep = true;
      this.stepIdle = 0;
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
          this._refreshRuleChip();
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
            this._refreshRuleChip();
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

    this.touchedThisStep = false;
    this.stepIdle = 0;

    this.models.setStepScene(this.stepIdx);
    const step = COOK_STEPS_10[this.stepIdx];
    this.elStepTitle.textContent = `調理 ${this.stepIdx + 1} / ${COOK_STEPS_10.length} ・ ${step.title}`;
    this.elHint.textContent = step.hint;
    this._refreshRuleChip();
    // The swipe basics were already taught in the butcher game; skip repeating them.
    const skipIntro = step.coach === 'intro' && GuideStore.has('butcher:intro');
    if (step.coach && !skipIntro) this.coach.request(COOK_COACH_CARDS[step.coach], this.stepIdx === 0 ? 0.6 : 1.1);
    this.elProg.style.width = `${(this.stepIdx / COOK_STEPS_10.length) * 100}%`;
  }

  _refreshRuleChip() {
    const step = COOK_STEPS_10[this.stepIdx];
    if (!step || !step.rule) {
      this.elRule.classList.add('hidden');
      return;
    }
    this.elRule.textContent = step.rule === 'count' ? `あと ${step.count - this.subCount} 回` : step.rule;
    this.elRule.classList.toggle('warn', !!step.ruleWarn);
    this.elRule.classList.remove('hidden');
  }

  _enterResult() {
    this.mode = 'RESULT';
    this.coach.cancel();
    this.coach.markDone();
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
    this.pointerDown = false;
    this.coach.cancel();
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
    this._drawGuideBody(w, h);
    if (this.mode !== 'PLAY' || this.stepIdx >= COOK_STEPS_10.length) return;
    if (this.coach.shouldShowGhost(this.touchedThisStep, this.stepIdle, this.pointerDown)) {
      this._drawGhost(this.gCtx, COOK_STEPS_10[this.stepIdx], w, h);
    }
  }

  // Looping "ghost finger" that shows the exact motion on the real target.
  _drawGhost(ctx, step, w, h) {
    const t = this.time;
    if (step.id === 'score_arm') {
      const a = this.subCount === 0 ? this._project3D(-1.2, 0.65, -0.35, w, h) : this._project3D(1.2, 0.65, -0.35, w, h);
      const b = this.subCount === 0 ? this._project3D(1.2, 0.65, 0.75, w, h) : this._project3D(-1.2, 0.65, 0.75, w, h);
      drawGhostSwipe(ctx, a, b, t);
    } else if (step.type === 'slice_arm') {
      const x = -0.90 + this.subCount * 0.45;
      drawGhostSwipe(ctx, this._project3D(x, 0.65, -0.65, w, h), this._project3D(x, 0.65, 0.95, w, h), t);
    } else if (step.id === 'veggies') {
      const x = this.subCount === 0 ? -1.05 : (this.subCount === 1 ? 0.0 : 1.05);
      drawGhostSwipe(ctx, this._project3D(x, 0.55, -0.55, w, h), this._project3D(x, 0.55, 0.95, w, h), t);
    } else if (step.type === 'multi_tap') {
      drawGhostTap(ctx, this._project3D(0, 0.35, 0.15, w, h), t);
    } else if (step.type === 'swipe_up') {
      drawGhostSwipe(ctx, { x: w * 0.5, y: h * 0.76 }, { x: w * 0.5, y: h * 0.38 }, t, 1.8);
    } else if (step.type === 'hold_fill') {
      drawGhostHold(ctx, { x: w * 0.5, y: h * 0.6 }, t);
    } else if (step.type === 'heat_keep') {
      // Sit on the heat bar itself so the finger visibly drives the yellow dial.
      const bw = Math.min(320, w * 0.80), bx = (w - bw) * 0.5, y = h * 0.76 + 15;
      drawGhostShuttle(ctx, { x: bx + bw * 0.37, y }, { x: bx + bw * 0.57, y }, t);
    } else if (step.type === 'toss_cook') {
      drawGhostShuttle(ctx, this._project3D(-1.1, 0.35, 0.1, w, h), this._project3D(1.1, 0.35, 0.1, w, h), t);
    } else if (step.type === 'mill_circle') {
      drawGhostCircle(ctx, { x: w * 0.5, y: h * 0.5 }, Math.min(w, h) * 0.18, t);
    }
  }

  _drawGuideBody(w, h) {
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
      this._drawChevronTrack(ctx, p1.x, p1.y, p2.x, p2.y, `ななめになぞる（あと${step.count - this.subCount}回）`);
    } else if (step.type === 'slice_arm') {
      const targetX = -0.90 + this.subCount * 0.45;
      const p1 = this._project3D(targetX, 0.65, -0.65, w, h);
      const p2 = this._project3D(targetX, 0.65, 0.95, w, h);
      this._drawChevronTrack(ctx, p1.x, p1.y, p2.x, p2.y, `縦になぞる（あと${step.count - this.subCount}切れ）`);
    } else if (step.id === 'veggies') {
      const vx = this.subCount === 0 ? -1.05 : (this.subCount === 1 ? 0.0 : 1.05);
      const vLabel = this.subCount === 0 ? '唐辛子を切る' : (this.subCount === 1 ? 'きのこを切る' : 'トマトを切る');
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
      this._drawChevronTrack(ctx, w * 0.5, h * 0.76, w * 0.5, h * 0.38, '上へ一気になぞる');
    } else if (step.type === 'hold_fill' || step.type === 'toss_cook') {
      if (step.type === 'toss_cook') {
        // Clear horizontal swipe arrows directly over skillet
        const pL = this._project3D(-1.25, 0.35, 0.1, w, h);
        const pR = this._project3D(1.25, 0.35, 0.1, w, h);
        const dir = Math.sin(this.time * 4.5) >= 0;
        this._drawChevronTrack(ctx, dir ? pL.x : pR.x, pL.y, dir ? pR.x : pL.x, pR.y, '左右に動かして混ぜる');
      } else if (!this.pointerDown) {
        const pOil = this._project3D(0.5, 0.5, 0, w, h);
        ctx.fillStyle = 'rgba(8, 16, 30, 0.88)';
        ctx.beginPath(); ctx.roundRect(pOil.x - 95, pOil.y - 20, 190, 34, 17); ctx.fill();
        ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 1.8; ctx.stroke();
        ctx.fillStyle = '#ffe066'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('画面を長押しして注ぐ', pOil.x, pOil.y - 3);
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
        ? '★ 今だ！指をはなそう ★'
        : (val > maxOk ? (step.type === 'hold_fill' ? '入れすぎ！溢れる！' : '焼きすぎ！焦げる！')
          : (step.type === 'hold_fill' ? '長押しで注ぐ → 緑で指をはなす' : '左右に動かして加熱 → 緑で指をはなす'));
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
      ctx.fillText(`弱火キープ：${Math.min(100, Math.round((this.heatGoodTime / 2.4) * 100))}%`, w * 0.5, by - 12);
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
      ctx.fillText(inZone ? `${turns.toFixed(1)}回転 — 今だ！指をはなそう` : `${turns.toFixed(1)} 回転（目標 3.0〜4.0回転）`, cx, cy + rad + 32);
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

    const coachHold = this.coach.isBlocking();
    if (this.mode === 'PLAY' && !coachHold && !this.pointerDown) this.stepIdle += safeDt;

    if (this.mode === 'PLAY' && this.stepIdx < COOK_STEPS_10.length && !coachHold) {
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
