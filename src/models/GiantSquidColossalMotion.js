import * as THREE from 'three';
import { getTierForLength } from '../data/SquidTiersAndComments.js';

// =============================================================================
// 31m-50m Colossal class giant squid: procedural animation controller.
// Ported from giant_squid_reviewer.html. Moves: HOVER, CRUISE, JET_SWIM, ESCAPE.
// Actions: PROBE, FLARE, STRIKE, WRAP + boss actions SHIP_GRAB, INK_BURST,
// ABYSSAL_PULSE, BEAK_SNAP.
// =============================================================================

export const COLOSSAL_BOSS_ACTIONS = ['SHIP_GRAB', 'INK_BURST', 'ABYSSAL_PULSE', 'BEAK_SNAP'];

// Jet cycle per the spec: 31-34m 7.6-8.5s, 35-39m 8.7-9.8s, 40-44m 10.0-11.0s,
// 45-49m 11.2-12.1s, 50m 12.2-12.5s (middle value for the single 50m size).
export function colossalJetPeriod(lengthMeters) {
  const L = Math.max(31, Math.min(50, Math.round(lengthMeters) || 31));
  const tierDef = getTierForLength(L);
  const [lo, hi] = tierDef.jetPeriodRange || [7.6, 8.5];
  const span = tierDef.maxLen - tierDef.minLen;
  const k = span > 0 ? (L - tierDef.minLen) / span : 0.5;
  return lo + (hi - lo) * k;
}

export function computeColossalMotionParams(lengthMeters) {
  const L = Math.max(30, Math.min(50, Math.round(lengthMeters)));
  const ratio = L / 10;

  return {
    lengthMeters: L,
    jetPeriod: colossalJetPeriod(L),
    breathPeriod: 5.2 * Math.pow(ratio, 0.55),
    finFreq: 2.2 * Math.pow(ratio, -0.52),
    finAmp: 0.22 * Math.pow(ratio, 0.88),
    armWaveFreq: 1.7 * Math.pow(ratio, -0.48),
    armWaveAmp: 0.095,
    strikeDuration: 0.48 * Math.pow(ratio, 0.58),
    inertiaGain: 0.85 + 0.45 * ((L - 30) / 20),
    stateBlendSpeed: Math.max(0.32, 0.75 - 0.35 * ((L - 30) / 20))
  };
}

export class GiantSquidColossalMotion {
  constructor(colossalModel, { measurementPose = false } = {}) {
    this.model = colossalModel;
    this.measurementPose = measurementPose;
    this.params = computeColossalMotionParams(colossalModel.profile.lengthMeters);
    this.time = 0;

    this.moveState = 'CRUISE';
    this.ambientPulse = 0;
    this.activeAction = null;
    this.actionTimer = 0;

    this.weights = {
      hover: 0,
      cruise: 1,
      jet: 0,
      escape: 0,
      flare: 0,
      wrap: 0,
      probe: 0,
      shipGrab: 0,
      abyssalPulse: 0,
      beakSnap: 0
    };

    this._laggedAngVel = new Float32Array(28);
    this._saccadeTimer = 3.5;
    this._saccadeOffset = new THREE.Vector2();
    this._tmpTargetLocal = new THREE.Vector3();
    this._probeArmIndex = 0;
    this._inkColor = new THREE.Color(0x66e0ff);
    this._alertColor = new THREE.Color(0xff2a55);
  }

  setState(stateName) {
    this.moveState = stateName;
  }

  triggerAction(actionName) {
    this.activeAction = actionName;
    this.actionTimer = 0;
    if (actionName === 'PROBE') {
      this._probeArmIndex = Math.floor(Math.random() * 8);
    } else if (actionName === 'INK_BURST') {
      this._emitInkBurst();
    }
  }

  isBossActionRunning() {
    return COLOSSAL_BOSS_ACTIONS.includes(this.activeAction);
  }

  clearAction() {
    this.activeAction = null;
  }

  _emitInkBurst() {
    const ink = this.model.parts.inkSystem;
    const funnelPos = this.model.parts.funnel.position;
    const scale = this.model.profile.mantleRadius;

    for (let i = 0; i < ink.count; i++) {
      const idx = i * 3;
      ink.positions[idx] = funnelPos.x + (Math.random() - 0.5) * scale * 0.4;
      ink.positions[idx + 1] = funnelPos.y + (Math.random() - 0.5) * scale * 0.4;
      ink.positions[idx + 2] = funnelPos.z;

      ink.velocities[idx] = (Math.random() - 0.5) * scale * 2.2;
      ink.velocities[idx + 1] = (Math.random() - 0.5) * scale * 2.2;
      ink.velocities[idx + 2] = -(scale * 3.5 + Math.random() * scale * 4.5);
      ink.life[i] = 2.5 + Math.random() * 2.5;
    }
    ink.points.geometry.attributes.position.needsUpdate = true;
  }

  _updateInkParticles(dt) {
    const ink = this.model.parts.inkSystem;
    let activeCount = 0;
    for (let i = 0; i < ink.count; i++) {
      if (ink.life[i] > 0) {
        activeCount++;
        ink.life[i] -= dt;
        const idx = i * 3;
        const drag = Math.exp(-dt * 1.4);
        ink.velocities[idx] *= drag;
        ink.velocities[idx + 1] *= drag;
        ink.velocities[idx + 2] *= drag;

        ink.positions[idx] += ink.velocities[idx] * dt;
        ink.positions[idx + 1] += ink.velocities[idx + 1] * dt;
        ink.positions[idx + 2] += ink.velocities[idx + 2] * dt;
      } else {
        ink.positions[i * 3 + 1] = -9999;
      }
    }
    if (activeCount > 0) {
      ink.points.geometry.attributes.position.needsUpdate = true;
    }
  }

  update(dt, env = {}) {
    this.time += dt;
    const p = this.params;
    const parts = this.model.parts;
    const blend = Math.min(1, dt * p.stateBlendSpeed);

    const angVel = env.angularVelocity || 0;
    for (let i = this._laggedAngVel.length - 1; i > 0; i--) {
      this._laggedAngVel[i] = THREE.MathUtils.lerp(this._laggedAngVel[i], this._laggedAngVel[i - 1], Math.min(1, dt * 4.5));
    }
    this._laggedAngVel[0] = angVel;

    const targetMove = {
      hover: this.moveState === 'HOVER' ? 1 : 0,
      cruise: this.moveState === 'CRUISE' ? 1 : 0,
      jet: this.moveState === 'JET_SWIM' ? 1 : 0,
      escape: this.moveState === 'ESCAPE' ? 1 : 0
    };
    for (const k of Object.keys(targetMove)) {
      this.weights[k] = THREE.MathUtils.lerp(this.weights[k], targetMove[k], blend);
    }

    if (this.activeAction) {
      this.actionTimer += dt;
      if (this.activeAction === 'STRIKE' && this.actionTimer > p.strikeDuration + 2.8) this.activeAction = null;
      else if (this.activeAction === 'PROBE' && this.actionTimer > 5.0) this.activeAction = null;
      else if (this.activeAction === 'INK_BURST' && this.actionTimer > 3.0) this.activeAction = null;
      else if (this.activeAction === 'ABYSSAL_PULSE' && this.actionTimer > 4.5) this.activeAction = null;
      else if (this.activeAction === 'BEAK_SNAP' && this.actionTimer > 3.2) this.activeAction = null;
      else if (this.activeAction === 'SHIP_GRAB' && this.actionTimer > 4.8) this.activeAction = null;
    }

    this.weights.flare = THREE.MathUtils.lerp(this.weights.flare, this.activeAction === 'FLARE' ? 1 : 0, blend * 1.4);
    this.weights.wrap = THREE.MathUtils.lerp(this.weights.wrap, this.activeAction === 'WRAP' ? 1 : 0, blend * 1.5);
    this.weights.probe = THREE.MathUtils.lerp(this.weights.probe, this.activeAction === 'PROBE' ? 1 : 0, blend * 1.4);
    this.weights.shipGrab = THREE.MathUtils.lerp(this.weights.shipGrab, this.activeAction === 'SHIP_GRAB' ? 1 : 0, blend * 1.1);
    this.weights.abyssalPulse = THREE.MathUtils.lerp(this.weights.abyssalPulse, this.activeAction === 'ABYSSAL_PULSE' ? 1 : 0, blend * 2.0);
    this.weights.beakSnap = THREE.MathUtils.lerp(this.weights.beakSnap, this.activeAction === 'BEAK_SNAP' ? 1 : 0, blend * 2.2);

    const jetSpeedMult = 1.0 + this.weights.escape * 1.05;
    const jetPhase = ((this.time * jetSpeedMult) % p.jetPeriod) / p.jetPeriod;
    let jetPulse = jetPhase < 0.65
      ? -Math.sin((jetPhase / 0.65) * Math.PI)
      : Math.sin(((jetPhase - 0.65) / 0.35) * Math.PI);

    const inkSqueeze = (this.activeAction === 'INK_BURST' && this.actionTimer < 0.9)
      ? Math.sin((this.actionTimer / 0.9) * Math.PI) * 1.4
      : 0;

    const breath = Math.sin((this.time / p.breathPeriod) * Math.PI * 2) * 0.04;
    const jetActive = this.weights.jet + this.weights.escape * 1.25;
    const radialScale = 1.0 + breath - (jetPulse * 0.12 * jetActive) - inkSqueeze * 0.14;
    const axialScale = 1.0 - breath * 0.4 + (jetPulse * 0.055 * jetActive) + inkSqueeze * 0.07;
    parts.mantleMesh.scale.set(radialScale, radialScale, this.measurementPose ? 1 : axialScale);

    parts.funnel.rotation.y = THREE.MathUtils.clamp(-angVel * 0.7, -0.55, 0.55);
    const funnelExpand = 1.0 + Math.max(0, jetPulse) * 0.28 * jetActive + inkSqueeze * 0.45;
    parts.funnel.scale.set(funnelExpand, funnelExpand, 1.0);

    const finAmpEff = p.finAmp * (1.0 - this.weights.escape * 0.88) * (0.45 + 0.55 * this.weights.cruise + 0.35 * this.weights.hover);
    this._updateFinGeometry(parts.leftFin, -1, finAmpEff);
    this._updateFinGeometry(parts.rightFin, 1, finAmpEff);

    const snapCycle = this.weights.beakSnap * Math.pow(Math.abs(Math.sin(this.time * 5.2)), 2);
    const openAngle = 0.08 + this.weights.wrap * 0.25 + snapCycle * 0.55;
    parts.beakUpper.rotation.x = openAngle;
    parts.beakLower.rotation.x = -openAngle;

    const streamline = Math.max(0, jetPulse) * 0.48 * this.weights.jet + this.weights.escape * 0.88;
    for (let i = 0; i < parts.arms.length; i++) {
      const chain = parts.arms[i];
      const baseAngle = chain[0].userData.radialAngle;
      const phaseOffset = i * 0.78;
      const isProbingArm = (i === this._probeArmIndex) ? this.weights.probe : 0;
      const isUpperArm = Math.sin(baseAngle) > 0;

      for (let s = 0; s < chain.length; s++) {
        const u = s / chain.length;
        const wave = Math.sin(u * 3.8 - this.time * p.armWaveFreq + phaseOffset) * p.armWaveAmp * (0.18 + u * u * 1.9);

        let spread = 0;
        if (s === 0) {
          spread = this.weights.flare * 0.92
            + this.weights.beakSnap * 0.55
            - streamline * 0.34
            + this.weights.hover * 0.14;
        } else {
          spread = -this.weights.wrap * 0.24 + this.weights.flare * 0.05;
        }

        const grabPitch = this.weights.shipGrab * (isUpperArm ? 0.11 : 0.06) * (0.4 + u * 0.8);
        const droop = this.weights.hover * 0.045 * (0.3 + u);
        const laggedVel = this._laggedAngVel[Math.min(s, this._laggedAngVel.length - 1)];
        const inertiaYaw = -laggedVel * p.inertiaGain * (0.2 + u * 0.65);
        const probeCurl = isProbingArm * Math.sin(this.time * p.armWaveFreq * 2.0 - u * 4.8) * 0.30 * u;

        const radialRot = spread + wave + probeCurl;
        chain[s].rotation.x = Math.sin(baseAngle) * radialRot - droop + grabPitch;
        chain[s].rotation.y = -Math.cos(baseAngle) * radialRot + inertiaYaw;
      }
    }

    if (!this.measurementPose) this._updateTentacles(parts, p);

    // ambientPulse: a faint, always-on photophore wave (used on the result screen).
    const pulseBoost = this.weights.abyssalPulse + this.weights.flare * 0.6 + this.weights.escape * 0.5 + this.ambientPulse;
    this.model.photophoreMaterial.color.lerpColors(this._inkColor, this._alertColor, Math.min(1, this.weights.flare + this.weights.abyssalPulse * 0.8));
    const chroma = 0.5 + 0.5 * Math.sin(this.time * (1.5 + pulseBoost * 4.0));
    this.model.skinMaterial.emissiveIntensity = 0.14 + chroma * (0.16 + pulseBoost * 0.45);

    this._updateEyes(dt, env.cameraPos);
    this._updateInkParticles(dt);
    const suckerPulse = 1.0 + Math.sin(this.time * 2.8) * 0.045;
    this.model.syncDynamicDetails(suckerPulse, this.time, pulseBoost);
  }

  _updateTentacles(parts, p) {
    let strikeStretch = 1.0;
    if (this.activeAction === 'STRIKE') {
      if (this.actionTimer < p.strikeDuration) {
        const k = this.actionTimer / p.strikeDuration;
        strikeStretch = 1.0 + (1 - Math.pow(2, -9 * k)) * 0.72;
      } else {
        const k = Math.min(1, (this.actionTimer - p.strikeDuration) / 2.6);
        strikeStretch = 1.72 - k * 0.72;
      }
    }

    for (let i = 0; i < parts.tentacles.length; i++) {
      const chain = parts.tentacles[i];
      const side = chain[0].userData.side;
      for (let s = 0; s < chain.length; s++) {
        const u = s / chain.length;
        const slowWave = Math.sin(u * 2.8 - this.time * p.armWaveFreq * 0.58 + i * 1.6) * (0.12 * u * u);
        const dampByStrike = 1.0 - (strikeStretch - 1.0) * 1.1;
        const laggedVel = this._laggedAngVel[Math.min(s, this._laggedAngVel.length - 1)];
        const grabLift = this.weights.shipGrab * 0.095 * (0.5 + u);

        chain[s].rotation.y = (slowWave + side * (0.025 + this.weights.shipGrab * 0.03) - laggedVel * p.inertiaGain * (0.25 + u * 0.75)) * Math.max(0.12, dampByStrike);
        chain[s].rotation.x = (-this.weights.hover * 0.055 * u + grabLift) * Math.max(0.15, dampByStrike);
        chain[s].scale.z = strikeStretch;
      }
    }
  }

  _updateFinGeometry(finMesh, side, amp) {
    const pos = finMesh.geometry.attributes.position;
    const base = finMesh.geometry.userData.basePositions;
    const len = this.model.profile.mantleLength * 0.36;
    const freq = this.params.finFreq;

    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3];
      const bz = base[i * 3 + 2];
      const distOut = Math.abs(bx) / (this.model.profile.mantleRadius * 1.55 + 0.001);
      const wave1 = Math.sin((bz / len) * 5.2 - this.time * freq + (side > 0 ? 0.3 : 0));
      const wave2 = Math.sin((bz / len) * 9.5 - this.time * freq * 1.6) * 0.22;
      pos.setY(i, (wave1 + wave2) * amp * distOut);
    }
    pos.needsUpdate = true;
    finMesh.geometry.computeVertexNormals();
  }

  _updateEyes(dt, cameraPos) {
    this._saccadeTimer -= dt;
    if (this._saccadeTimer <= 0) {
      this._saccadeTimer = 2.5 + Math.random() * 3.5;
      this._saccadeOffset.set((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12);
    }
    if (!cameraPos) return;

    this._tmpTargetLocal.copy(cameraPos);
    this.model.parts.headGroup.worldToLocal(this._tmpTargetLocal);
    const yaw = THREE.MathUtils.clamp(Math.atan2(this._tmpTargetLocal.x, -this._tmpTargetLocal.z) * 0.24, -0.35, 0.35);
    const pitch = THREE.MathUtils.clamp(Math.atan2(this._tmpTargetLocal.y, -this._tmpTargetLocal.z) * 0.24, -0.25, 0.25);

    this.model.parts.leftEye.rotation.y = yaw + this._saccadeOffset.x;
    this.model.parts.leftEye.rotation.x = pitch + this._saccadeOffset.y;
    this.model.parts.rightEye.rotation.y = yaw + this._saccadeOffset.x;
    this.model.parts.rightEye.rotation.x = pitch + this._saccadeOffset.y;
  }
}

// -----------------------------------------------------------------------------
// Game-facing wrapper with the same calls main.js uses on GiantSquid
// (setState / setHooked / setPoseMode / triggerAction / getMouthWorldPosition / update).
// -----------------------------------------------------------------------------
const MOVE_STATES = new Set(['HOVER', 'CRUISE', 'JET_SWIM', 'ESCAPE']);
const ACTION_STATES = new Set(['PROBE', 'FLARE', 'STRIKE', 'WRAP']);

export class ColossalSquidActor {
  constructor(model, { visualScale = 1 } = {}) {
    this.model = model;
    this.motion = new GiantSquidColossalMotion(model);
    this.root = model.getObject3D();
    this.root.scale.setScalar(visualScale);
    this.lengthMeters = model.profile.lengthMeters;
    this.state = 'CRUISE';
    this.hooked = false;
    this.poseMode = 'FREE';
  }

  get isColossal() { return true; }

  getObject3D() {
    return this.root;
  }

  setState(stateName) {
    if (stateName === this.state) return;
    const prev = this.state;
    this.state = stateName;
    if (MOVE_STATES.has(stateName)) {
      this.motion.setState(stateName);
      if (ACTION_STATES.has(prev) && !this.motion.isBossActionRunning()) this.motion.clearAction();
    } else if (ACTION_STATES.has(stateName)) {
      this.motion.setState(stateName === 'FLARE' ? 'HOVER' : 'CRUISE');
      if (!this.motion.isBossActionRunning()) this.motion.triggerAction(stateName);
    }
  }

  triggerAction(actionName) {
    this.motion.triggerAction(actionName);
  }

  triggerBossAction(actionName) {
    if (COLOSSAL_BOSS_ACTIONS.includes(actionName)) this.motion.triggerAction(actionName);
  }

  setHooked(flag) {
    this.hooked = Boolean(flag);
  }

  setPoseMode(mode) {
    this.poseMode = mode;
  }

  getMouthWorldPosition(outVec) {
    this.root.updateMatrixWorld(true);
    return this.model.getMouthWorldPosition(outVec);
  }

  update(dt, ctx = {}) {
    const av = ctx.angularVelocity;
    const angularVelocity = typeof av === 'number' ? av : (av ? av.y * 0.6 : 0);
    // Thrashing on the line reads as ESCAPE-like streamlining with a stronger yaw.
    const thrash = this.poseMode === 'THRASHING' ? 1.6 : 1.0;
    this.motion.update(dt, { angularVelocity: angularVelocity * thrash, cameraPos: ctx.cameraPos });
  }

  dispose() {
    this.model.dispose();
  }
}
