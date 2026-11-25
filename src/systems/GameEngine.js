import { generateSquidSpecimen, calculateFishingScore, getCommentForScore } from '../data/SquidTiersAndComments.js';
// Pure JavaScript Simulation Engine (Rendering-Independent)
// Phases: HOME, SEARCH, LURE_HOOK, FIGHT, LANDING, CAPTURE_SCENE, INSPECT, SUCCESS, GAMEOVER

export const WIRE_TYPES = {
  standard_pe:      { label: '標準PE複合',       cost: 180000, time: 2, strength: 1.00, dragCoeff: 0.78 },
  reinforced_steel: { label: '強化スチール細径', cost: 480000, time: 3, strength: 1.38, dragCoeff: 0.85 },
  heavy_wire:       { label: '極太ワイヤー',     cost: 300000, time: 3, strength: 1.65, dragCoeff: 1.48 }
};

export const KANNA_TYPES = {
  standard:   { label: '標準サイズ',         cost: 120000, time: 1, hookWindowBonus: 0.35, tearResist: 0.82 },
  heavy_deep: { label: '深海大型強化カンナ', cost: 280000, time: 2, hookWindowBonus: 0.0,  tearResist: 1.35 }
};

export const BAIT_TYPES = {
  normal:  { label: '通常鮮度（ソデイカ）', cost: 90000,  time: 1, attractRate: 1.0,  strikeChance: 1.0 },
  premium: { label: '極上活き餌',           cost: 240000, time: 2, attractRate: 1.55, strikeChance: 1.45 }
};

export const RECOMMENDED_CONFIG = {
  wire: 'reinforced_steel',
  kanna: 'heavy_deep',
  bait: 'premium',
  lightPower: 0.45,
  winchInspected: true
};

export const FAILURE_DETAILS = {
  LINE_BREAK: {
    title: 'ワイヤー破断（LINE BREAK）',
    reason: 'ライン張力が限界（100%）を超過し、ワイヤーが破断しました。',
    advice: 'イカの高速ダッシュ（ESCAPE）時は「↑ 巻上」を一時停止し、船をイカの逃走方向へ追従操舵して張力を逃がしてください。'
  },
  HOOK_OUT: {
    title: 'フック外れ（BARED）',
    reason: '急激な負荷によりカンナが外れてしまいました。',
    advice: '張力75%以上の維持や急激な巻き上げ（減圧超過）を避け、落ち着いて巻き上げてください。'
  },
  PROPELLER_TANGLE: {
    title: 'ライン絡み（LINE TANGLE）',
    reason: 'ワイヤーが大きく潜り込み切断されてしまいました。',
    advice: '潮流に対して360°操舵スティックで船の向きと位置を調整し、ワイヤー角度を安全域に保ってください。'
  },
  SCARED_AWAY: {
    title: '警戒逃亡（SCARED AWAY）',
    reason: 'ダイオウイカが警戒して深海へ逃亡しました。',
    advice: '腕で探っている（PROBE）段階での早合わせを避け、完全に抱え込んで「HOOK UP!!」が出てからフッキングしてください。'
  },
  WINCH_OVERHEAT: {
    title: 'ウインチ焼き付き（WINCH OVERHEAT）',
    reason: '油圧ウインチ温度が115℃を超過し、巻上機構が焼き付きました。',
    advice: '高負荷時は「↑ 巻上」を一時停止してウインチの油圧温度を冷却してください。'
  },
  LANDING_FAIL: {
    title: 'ランディング失敗（LANDING FAIL）',
    reason: '波による激しい横揺れ（ロール18度以上）またはイカの抵抗中に強行吊り上げを行い、取り逃がしました。',
    advice: 'ロール18°未満・イカ静止・波頂点OKの3条件が揃ってクレーンボタンが光った瞬間に押してください。'
  }
};

export class GameEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.phase = 'HOME';
    this.elapsedTime = 0;

    // Recommended optimal default setup
    this.prepConfig = { ...RECOMMENDED_CONFIG };
    this.stats = {
      wireStrength: WIRE_TYPES.reinforced_steel.strength,
      wireDrag: WIRE_TYPES.reinforced_steel.dragCoeff,
      tearResist: KANNA_TYPES.heavy_deep.tearResist,
      hookWindowBonus: 0.25,
      attractRate: BAIT_TYPES.premium.attractRate,
      strikeChance: BAIT_TYPES.premium.strikeChance,
      coolingEfficiency: 1.0,
      heatRiseMult: 1.0
    };

    const curAng = Math.random() * Math.PI * 2;
    const curSpd = 0.65 + Math.random() * 0.55;
    this.currentVec = { x: Math.cos(curAng) * curSpd, z: Math.sin(curAng) * curSpd };
    const windAng = curAng + (Math.random() - 0.5) * 1.1;
    const windSpd = 0.35 + Math.random() * 0.45;
    this.windVec = { x: Math.cos(windAng) * windSpd, z: Math.sin(windAng) * windSpd };

    this.ship = {
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      heading: 0,
      angVel: 0,
      rollDeg: 0,
      pitchDeg: 0
    };

    // Place hotspot ahead-ish within 26-40m for snappy, fun navigation
    const tgtAng = (Math.random() - 0.5) * 1.6;
    const tgtDist = 26 + Math.random() * 14;
    this.hotspot = {
      x: Math.sin(tgtAng) * tgtDist,
      z: Math.cos(tgtAng) * tgtDist,
      depth: 740 + Math.round(Math.random() * 70)
    };

    this.depth = 0;
    this.targetDepth = this.hotspot.depth;
    this.lightPower = RECOMMENDED_CONFIG.lightPower;
    this.tension = 0;
    this.tear = 0;
    this.winchTemp = 26;
    this.dragLevel = 0.55;
    this.winchPower = 0;
    this.lineAngleDeg = 0;
    this.tangleRisk = 0;
    this.tangleTimer = 0;
    this.overTensionTimer = 0;
    this.followBonus = 0;

    this.specimen = generateSquidSpecimen();
    this.maxWinchTemp = 26;
    this.squid = {
      state: 'HOVER',
      stamina: this.specimen.tierDef.staminaMax,
      staminaMax: this.specimen.tierDef.staminaMax,
      distanceToBait: 7.5,
      lureStage: 'APPROACH',
      stageTimer: 0,
      wrapWindowLeft: 0,
      fleeVecX: 0,
      fleeVecZ: 1,
      aiTimer: 3.2,
      surfaceResisting: false,
      surfaceResistTimer: 2.8,
      lengthMeters: this.specimen.lengthMeters,
      weightKg: this.specimen.weightKg,
      tier: this.specimen.tier,
      tierName: this.specimen.tierDef.name
    };

    this.landing = {
      stage: 0,
      craneNormalized: 0,
      waveCrestReady: false,
      waveSin: 0,
      cooldown: 0
    };

    this.captureTimer = 0;

    this.events = {
      hookSuccess: false,
      lineSnap: false,
      alarmActive: false,
      alarmType: '',
      statusMessage: '深海調査船 出港待機中'
    };

    this.failureCode = null;
    this.result = null;
  }

  startGame() {
    this.reset();
    this.phase = 'SEARCH';
    this.events.statusMessage = 'ソナー反応地点へ操船し、22m以内で「↓ 繰出/投下」を押してください。';
    return this.getSnapshot();
  }

  openResultScreen() {
    if (this.phase === 'INSPECT' || this.phase === 'CAPTURE_SCENE') {
      this.phase = 'SUCCESS';
    }
  }

  _fail(code) {
    if (this.phase === 'GAMEOVER' || this.phase === 'SUCCESS' || this.phase === 'INSPECT' || this.phase === 'CAPTURE_SCENE') return;
    this.phase = 'GAMEOVER';
    this.failureCode = code;
    if (code === 'LINE_BREAK' || code === 'PROPELLER_TANGLE') {
      this.events.lineSnap = true;
    }
    const detail = FAILURE_DETAILS[code] || { title: code, reason: '', advice: '' };
    this.result = {
      success: false,
      code,
      title: detail.title,
      reason: detail.reason,
      advice: detail.advice,
      elapsedTime: this.elapsedTime
    };
    this.events.statusMessage = detail.title;
  }

  _beginCaptureScene() {
    this.phase = 'CAPTURE_SCENE';
    this.captureTimer = 0;
    this.squid.state = 'HOVER';

    const scored = calculateFishingScore({
      lengthMeters: this.specimen.lengthMeters,
      weightKg: this.specimen.weightKg,
      elapsedTime: this.elapsedTime,
      tear: this.tear,
      maxWinchTemp: this.maxWinchTemp
    });

    this.result = {
      success: true,
      lengthMeters: this.specimen.lengthMeters,
      weightKg: this.specimen.weightKg,
      elapsedTime: this.elapsedTime,
      score: scored.score,
      rank: scored.rank,
      tier: this.specimen.tier,
      tierName: this.specimen.tierDef.name,
      comment: getCommentForScore(scored.score, 'fishing'),
      specimen: this.specimen
    };
    this.events.statusMessage = 'ダイオウイカ揚収成功！クレーンで甲板へ引き揚げています...';
  }

  _updateVesselPhysics(dt, controls, waveState) {
    const throttle = controls.throttle || 0;
    const rudder = controls.rudder || 0;
    const thruster = controls.bowThruster || 0;

    const turnTorque = rudder * 0.72 + thruster * 0.22;
    this.ship.angVel += (turnTorque - this.ship.angVel * 2.2) * dt;
    this.ship.heading += this.ship.angVel * dt;

    const fwdX = Math.sin(this.ship.heading);
    const fwdZ = Math.cos(this.ship.heading);
    const rightX = Math.cos(this.ship.heading);
    const rightZ = -Math.sin(this.ship.heading);

    const accelX = fwdX * throttle * 5.6 + rightX * thruster * 2.9 + (this.currentVec.x * 0.48 + this.windVec.x * 0.30);
    const accelZ = fwdZ * throttle * 5.6 + rightZ * thruster * 2.9 + (this.currentVec.z * 0.48 + this.windVec.z * 0.30);

    this.ship.vx += (accelX - this.ship.vx * 0.92) * dt;
    this.ship.vz += (accelZ - this.ship.vz * 0.92) * dt;
    this.ship.x += this.ship.vx * dt;
    this.ship.z += this.ship.vz * dt;

    const waveDirX = 0.853, waveDirZ = 0.522;
    const beamFactor = Math.abs(fwdX * (-waveDirZ) + fwdZ * waveDirX);
    const baseRollRad = (waveState ? waveState.roll : 0) * (0.45 + 1.45 * beamFactor);
    const basePitchRad = (waveState ? waveState.pitch : 0) * (1.2 - 0.5 * beamFactor);

    this.ship.rollDeg = (baseRollRad * 180) / Math.PI;
    this.ship.pitchDeg = (basePitchRad * 180) / Math.PI;

    if (this.depth > 20 && (this.phase === 'SEARCH' || this.phase === 'LURE_HOOK' || this.phase === 'FIGHT')) {
      let wireDriftX = this.currentVec.x * this.stats.wireDrag;
      let wireDriftZ = this.currentVec.z * this.stats.wireDrag;
      if (this.phase === 'FIGHT') {
        wireDriftX += this.squid.fleeVecX * 1.4;
        wireDriftZ += this.squid.fleeVecZ * 1.4;
      }
      const relFwd = (wireDriftX - this.ship.vx * 0.65) * fwdX + (wireDriftZ - this.ship.vz * 0.65) * fwdZ;
      const lateral = Math.abs((wireDriftX - this.ship.vx * 0.65) * rightX + (wireDriftZ - this.ship.vz * 0.65) * rightZ);
      const rawAngle = Math.max(0, relFwd * 22 + lateral * 6);
      this.lineAngleDeg += (Math.min(58, rawAngle) - this.lineAngleDeg) * Math.min(1, dt * 2.5);

      this.tangleRisk = Math.min(1, Math.max(0, (this.lineAngleDeg - 18) / 17));
      // Propeller tangle removed per v2.0 streamlined controls
      if (false) {
        this.tangleTimer += dt;
      } else {
        this.tangleTimer = Math.max(0, this.tangleTimer - dt * 1.2);
      }
    } else {
      this.lineAngleDeg = Math.max(0, this.lineAngleDeg - dt * 20);
      this.tangleRisk = 0;
      this.tangleTimer = 0;
    }
  }

  _updateSearchPhase(dt, controls) {
    const distToSpot = Math.hypot(this.ship.x - this.hotspot.x, this.ship.z - this.hotspot.z);

    if (controls.winchPower < -0.1 || controls.dropRig) {
      if (distToSpot < 22 || this.depth > 5) {
        this.depth = Math.min(this.targetDepth, this.depth + dt * 145);
      } else {
        this.events.statusMessage = `ポイントまで残り ${Math.round(distToSpot)}m。22m以内に船を寄せてから投下してください。`;
      }
    } else if (controls.winchPower > 0.1) {
      this.depth = Math.max(0, this.depth - dt * 80);
    }

    if (distToSpot < 22 && this.depth < 10) {
      this.events.statusMessage = '反応真上に到達！光っている「↓ 繰出/投下」を長押しして仕掛けを降ろしてください！';
    } else if (this.depth > 10) {
      this.events.statusMessage = `仕掛け降下中... 水深 ${Math.round(this.depth)}m / 目標 ${this.targetDepth}m`;
    }

    if (this.depth >= 600) {
      this.phase = 'LURE_HOOK';
      this.squid.lureStage = 'APPROACH';
      this.squid.state = 'CRUISE';
      this.squid.stageTimer = 0;
      this.squid.distanceToBait = 7.4;
      this.events.statusMessage = '深海到達！ダイオウイカが接近中。抱え込み（WRAP）の瞬間に「フッキング」を押してください！';
    }
  }

  _updateLureHookPhase(dt, controls) {
    const s = this.squid;
    s.stageTimer += dt;

    if (controls.winchPower < -0.1) this.depth = Math.min(860, this.depth + dt * 14);
    else if (controls.winchPower > 0.1 && !controls.hookAction) this.depth = Math.max(580, this.depth - dt * 14);

    if (this.lightPower >= 0.70) {
      this.events.alarmActive = true;
      this.events.alarmType = '警戒中！静かに待て！';
      if (s.stageTimer > 1.8 && s.lureStage !== 'FLEE') {
        s.lureStage = 'FLEE';
        s.state = 'FLARE';
        s.stageTimer = 0;
        this.events.statusMessage = 'ダイオウイカが警戒（FLARE）しています！静かに待ちましょう！';
      }
    }

    const lightOptimal = (this.lightPower >= 0.25 && this.lightPower <= 0.60) ? 1.25 : 0.7;

    if (s.lureStage === 'APPROACH') {
      s.state = 'CRUISE';
      s.distanceToBait = Math.max(3.3, s.distanceToBait - dt * 1.45 * this.stats.attractRate * lightOptimal);
      if (s.distanceToBait <= 3.35) {
        s.lureStage = 'HOVER';
        s.state = 'HOVER';
        s.stageTimer = 0;
        this.events.statusMessage = 'ダイオウイカが餌の目の前でホバリング中...';
      }
    } else if (s.lureStage === 'HOVER') {
      s.state = 'HOVER';
      s.distanceToBait += (3.1 - s.distanceToBait) * Math.min(1, dt * 2.5);
      if (s.stageTimer >= 2.3) {
        s.lureStage = 'PROBE';
        s.state = 'PROBE';
        s.stageTimer = 0;
        this.events.statusMessage = '腕で餌を探っています（PROBE）！早合わせせず待ってください！';
      }
    } else if (s.lureStage === 'PROBE') {
      s.state = 'PROBE';
      s.distanceToBait += (2.55 - s.distanceToBait) * Math.min(1, dt * 3.0);
      if (controls.hookAction) {
        s.lureStage = 'FLEE';
        s.state = 'FLARE';
        s.stageTimer = 0;
        this.events.statusMessage = '早合わせ！ダイオウイカが驚いて逃亡態勢に入りました！';
        return;
      }
      if (s.stageTimer >= 2.6) {
        s.lureStage = 'STRIKE';
        s.state = 'STRIKE';
        s.stageTimer = 0;
        this.events.statusMessage = '触腕を高速射出（STRIKE）！餌を掴みました！';
      }
    } else if (s.lureStage === 'STRIKE') {
      s.state = 'STRIKE';
      // Rapidly pull right up to the bait!
      s.distanceToBait = Math.max(0.95, s.distanceToBait - dt * 2.1);
      if (s.stageTimer >= 0.95) {
        s.lureStage = 'WRAP';
        s.state = 'WRAP';
        s.stageTimer = 0;
        s.wrapWindowLeft = 2.6 + this.stats.hookWindowBonus;
        this.events.statusMessage = '今だ！抱え込み（WRAP）確認！光る「フッキング」を押せ！';
      }
    } else if (s.lureStage === 'WRAP') {
      s.state = 'WRAP';
      s.distanceToBait += (0.85 - s.distanceToBait) * Math.min(1, dt * 6.0);
      s.wrapWindowLeft = Math.max(0, s.wrapWindowLeft - dt);
      if (controls.hookAction) {
        this.phase = 'FIGHT';
        this.events.hookSuccess = true;
        this.squid.state = 'ESCAPE';
        this.squid.aiTimer = 2.2;
        this.tension = 46;
        this.events.statusMessage = 'フッキング成功！上部計器を確認しながら「↑ 巻上」で引き上げてください！';
        return;
      }
      if (s.wrapWindowLeft <= 0) {
        s.lureStage = 'HOVER';
        s.state = 'HOVER';
        s.stageTimer = 0;
        s.distanceToBait = 3.4;
        this.events.statusMessage = 'フッキングのタイミングを逃しました！再び接近を待ちます。';
      }
    } else if (s.lureStage === 'FLEE') {
      if (s.stageTimer < 1.1) s.state = 'FLARE';
      else {
        s.state = 'ESCAPE';
        s.distanceToBait += dt * 9.0;
      }
      if (s.stageTimer >= 2.4) this._fail('SCARED_AWAY');
    }
  }

  _updateFightPhase(dt, controls) {
    const s = this.squid;
    const winch = controls.winchPower || 0;
    const drag = this.dragLevel;

    s.aiTimer -= dt;
    if (s.aiTimer <= 0) {
      const r = Math.random();
      if (s.stamina > 32 && r < 0.35) {
        s.state = 'ESCAPE';
        s.aiTimer = 2.0 + Math.random() * 1.4;
        const ang = Math.random() * Math.PI * 2;
        s.fleeVecX = Math.cos(ang);
        s.fleeVecZ = Math.sin(ang);
      } else if (s.stamina > 10 && r < 0.78) {
        s.state = 'JET_SWIM';
        s.aiTimer = 2.6 + Math.random() * 1.8;
        const ang = Math.random() * Math.PI * 2;
        s.fleeVecX = Math.cos(ang);
        s.fleeVecZ = Math.sin(ang);
      } else {
        s.state = 'HOVER';
        s.aiTimer = 2.4 + Math.random() * 1.6;
      }
    }

    if (s.state === 'ESCAPE') s.stamina = Math.max(0, s.stamina - dt * 6.0);
    else if (s.state === 'JET_SWIM') s.stamina = Math.max(0, s.stamina - dt * 2.8);
    else s.stamina = Math.min(100, s.stamina + dt * 0.5);

    const shipSpd = Math.hypot(this.ship.vx, this.ship.vz);
    let align = 0;
    if (shipSpd > 0.3) {
      align = Math.max(0, (this.ship.vx * s.fleeVecX + this.ship.vz * s.fleeVecZ) / shipSpd);
    }
    this.followBonus = align * Math.min(1, shipSpd / 2.6) * 0.40;

    const td = this.specimen.tierDef;
    this.maxWinchTemp = Math.max(this.maxWinchTemp, this.winchTemp);
    const baseLoad = (14 + Math.min(24, Math.pow(s.weightKg / 220, 0.45) * 11) + Math.hypot(this.currentVec.x, this.currentVec.z) * 5.0 * this.stats.wireDrag) * (0.72 + 0.28 * td.tensionMult);
    const staminaFactor = 0.45 + 0.55 * (s.stamina / Math.max(1, s.staminaMax || 100));
    const isThrashing = (s.state === 'ESCAPE' || s.state === 'JET_SWIM');
    const squidPull = (s.state === 'ESCAPE' ? 68 : s.state === 'JET_SWIM' ? 40 : 10) * staminaFactor * (0.78 + 0.22 * td.tensionMult);
    // Reeling IN while giant squid thrashes spikes tension sharply!
    // Counterplay: release reel-in (winch === 0) to settle tension, or hold reel-out (winch < 0) to dump tension rapidly!
    let reelLoad = 0;
    if (winch > 0) {
      const thrashPenalty = s.state === 'ESCAPE' ? 48 : (s.state === 'JET_SWIM' ? 24 : 0);
      reelLoad = winch * (26 + thrashPenalty);
    } else if (winch < 0) {
      // Paying out line (↓繰出) immediately dumps line tension!
      reelLoad = winch * 56;
    }

    const rawTension = ((baseLoad + squidPull + reelLoad) * (1.0 - this.followBonus)) / this.stats.wireStrength;
    const targetTension = Math.max(4, Math.min(118, rawTension));
    const responseRate = winch < 0 ? 7.5 : (isThrashing && winch > 0 ? 5.8 : 4.2);
    this.tension += (targetTension - this.tension) * Math.min(1, dt * responseRate);

    if (this.tension >= 99.5) {
      this.overTensionTimer += dt;
      this.events.alarmActive = true;
      this.events.alarmType = '張力限界！巻上を止めるか↓繰出！';
      if (this.overTensionTimer >= 1.15) { this._fail('LINE_BREAK'); return; }
    } else if (this.tension >= 82 && isThrashing) {
      this.events.alarmActive = true;
      this.events.alarmType = '大暴れ中！巻上を止めるか↓繰出！';
      this.overTensionTimer = Math.max(0, this.overTensionTimer - dt * 1.4);
    } else {
      this.overTensionTimer = Math.max(0, this.overTensionTimer - dt * 1.8);
    }

    this.tear = 0;

    if (winch > 0.1 && this.tension > 35) {
      this.winchTemp = Math.min(122, this.winchTemp + (this.tension / 100) * winch * 9.0 * this.stats.heatRiseMult * dt);
    } else {
      this.winchTemp = Math.max(24, this.winchTemp - (winch <= 0 ? 7.8 : 2.5) * this.stats.coolingEfficiency * dt);
    }
    if (this.winchTemp >= 95) {
      this.events.alarmActive = true;
      this.events.alarmType = 'ウインチ過熱警告！';
    }
    if (this.winchTemp >= 115) { this._fail('WINCH_OVERHEAT'); return; }

    const reelSpeed = winch > 0 ? winch * (28 + 20 * drag) * (1.0 - Math.min(0.62, squidPull / 110)) : winch * 22;
    const stripSpeed = (s.state === 'ESCAPE' ? 26 : s.state === 'JET_SWIM' ? 9 : 0) * (1.0 - drag * 0.78) * staminaFactor;
    this.depth = Math.max(0, Math.min(920, this.depth - (reelSpeed - stripSpeed) * dt));

    if (s.state === 'ESCAPE') {
      this.events.statusMessage = 'ダイオウイカが大暴れ！張力急上昇！「↑ 巻上」を止めるか「↓ 繰出」で逃がせ！';
    } else if (this.winchTemp >= 95) {
      this.events.statusMessage = 'ウインチ油圧温度が危険域！巻上を止めて冷却してください！';
    } else if (s.stamina < 30) {
      this.events.statusMessage = 'イカの体力が低下！一気に「↑ 巻上」で引き上げましょう！';
    } else {
      this.events.statusMessage = `ファイト中 — 残り水深 ${Math.round(this.depth)}m（追従軽減 ${Math.round(this.followBonus * 100)}%）`;
    }

    if (this.depth <= 0.5) {
      this.depth = 0;
      this.phase = 'LANDING';
      this.landing.stage = 0;
      this.landing.craneNormalized = 0.85;
      this.squid.surfaceResisting = false;
      this.squid.surfaceResistTimer = 3.2;
      this.squid.state = 'HOVER';
      this.events.statusMessage = '海面到達！ロール・静止・波頂点の3条件が揃って大型クレーンボタンが光ったら押してください！';
    }
  }

  _updateLandingPhase(dt, controls, waveState) {
    const s = this.squid;
    const l = this.landing;
    l.cooldown = Math.max(0, l.cooldown - dt);

    s.surfaceResistTimer -= dt;
    if (s.surfaceResistTimer <= 0) {
      s.surfaceResisting = !s.surfaceResisting;
      s.surfaceResistTimer = s.surfaceResisting ? (2.0 + Math.random() * 1.1) : (3.8 + Math.random() * 1.4);
      s.state = s.surfaceResisting ? 'FLARE' : 'HOVER';
    }

    const phase = waveState ? waveState.phase : 0;
    l.waveSin = Math.sin(phase);
    l.waveCrestReady = l.waveSin > 0.22;

    const absRoll = Math.abs(this.ship.rollDeg);
    if (absRoll >= 18) {
      this.events.alarmActive = true;
      this.events.alarmType = '横揺れ危険（18°超）！';
    }

    if (controls.craneAction && l.cooldown <= 0) {
      l.cooldown = 0.65;
      if (absRoll >= 18 || s.surfaceResisting) {
        this._fail('LANDING_FAIL');
        return;
      }
      if (!l.waveCrestReady) {
        this.events.statusMessage = '波の谷間です！波ゲージが緑色の「波頂点OK」に入った瞬間に押してください。';
        return;
      }

      l.stage += 1;
      if (l.stage === 1) {
        l.craneNormalized = 0.95;
        this.events.statusMessage = '第1段階完了（スリング確保）！次の波頂点でクレーン巻上！';
      } else if (l.stage === 2) {
        l.craneNormalized = 0.45;
        this.events.statusMessage = '第2段階完了（クレーン巻上）！最後の波頂点で甲板収容！';
      } else if (l.stage >= 3) {
        l.craneNormalized = 0.08;
        this._beginCaptureScene();
      }
    }
  }

  _updateCaptureScene(dt) {
    this.captureTimer += dt;
    if (this.captureTimer >= 4.2) {
      this.phase = 'INSPECT';
      this.events.statusMessage = '釣り上げたダイオウイカを自由に360°回転・拡大して観察できます！';
    }
  }

  update(dt, controls = {}, waveState = null) {
    const safeDt = Math.min(0.05, Math.max(0.001, dt));

    this.events.hookSuccess = false;
    this.events.lineSnap = false;
    this.events.alarmActive = false;
    this.events.alarmType = '';

    // Paused (a guide card is open): do not advance anything at all.
    // Without this, the clamp below still moved the game 0.001s every frame.
    if (!(dt > 0)) return this.getSnapshot();

    this.lightPower = 0.45;
    this.dragLevel = (this.phase === 'FIGHT' && this.squid.state === 'ESCAPE') ? 0.35 : 0.62;
    this.winchPower = controls.winchPower || 0;

    if (this.phase === 'HOME' || this.phase === 'SUCCESS' || this.phase === 'GAMEOVER') {
      return this.getSnapshot();
    }

    if (this.phase === 'CAPTURE_SCENE') {
      this._updateCaptureScene(safeDt);
      return this.getSnapshot();
    }

    if (this.phase === 'INSPECT') {
      return this.getSnapshot();
    }

    this.elapsedTime += safeDt;
    this._updateVesselPhysics(safeDt, controls, waveState);
    if (this.phase === 'GAMEOVER') return this.getSnapshot();

    if (this.phase === 'SEARCH') this._updateSearchPhase(safeDt, controls);
    else if (this.phase === 'LURE_HOOK') this._updateLureHookPhase(safeDt, controls);
    else if (this.phase === 'FIGHT') this._updateFightPhase(safeDt, controls);
    else if (this.phase === 'LANDING') this._updateLandingPhase(safeDt, controls, waveState);

    return this.getSnapshot();
  }

  getSnapshot() {
    const dx = this.hotspot.x - this.ship.x;
    const dz = this.hotspot.z - this.ship.z;
    const distToSpot = Math.hypot(dx, dz);
    // Relative angle from ship bow (+heading) to hotspot (-PI..+PI)
    const worldAngle = Math.atan2(dx, dz);
    let relBearing = worldAngle - this.ship.heading;
    while (relBearing > Math.PI) relBearing -= Math.PI * 2;
    while (relBearing < -Math.PI) relBearing += Math.PI * 2;

    return {
      phase: this.phase,
      elapsedTime: this.elapsedTime,
      captureTimer: this.captureTimer,
      prepConfig: this.prepConfig,
      currentVec: this.currentVec,
      windVec: this.windVec,
      ship: { ...this.ship },
      hotspot: { ...this.hotspot, distance: distToSpot, relBearing },
      depth: this.depth,
      targetDepth: this.targetDepth,
      lightPower: this.lightPower,
      tension: this.tension,
      tear: this.tear,
      winchTemp: this.winchTemp,
      dragLevel: this.dragLevel,
      winchPower: this.winchPower,
      lineAngleDeg: this.lineAngleDeg,
      tangleRisk: this.tangleRisk,
      followBonus: this.followBonus,
      specimen: this.specimen,
      squid: { ...this.squid },
      landing: { ...this.landing },
      events: { ...this.events },
      failureCode: this.failureCode,
      result: this.result
    };
  }
}
