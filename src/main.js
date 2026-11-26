import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GiantSquid } from './models/GiantSquid.js';
import { ResearchVessel } from './models/ResearchVessel.js';
import { OceanEnv } from './models/OceanEnv.js';
import { FishingRig } from './models/FishingRig.js';
import { GameEngine } from './systems/GameEngine.js';
import { HUDManager } from './ui/HUDManager.js';
import { applySquidTierVisuals } from './models/GiantSquidTiers.js';
import { GiantSquidColossalModel } from './models/GiantSquidColossalModel.js';
import { ColossalSquidActor } from './models/GiantSquidColossalMotion.js';
import { isColossalLength, readColossalPity, writeColossalPity, calculateColossalProbability } from './data/SquidTiersAndComments.js';
import { FishingResultScene } from './scenes/FishingResultScene.js';
import { ButcherGame } from './games/ButcherGame.js';
import { AjilloCookingGame } from './games/AjilloCookingGame.js';
import { FlowMenuManager } from './ui/FlowMenuManager.js';
import { MiniGameAudio } from './audio/MiniGameAudio.js';
import { ensureAudioContext, unlockAudio, installAudioUnlock, onAudioContextCreated } from './audio/SharedAudio.js';
import { applyStudioEnvironment } from './models/StudioEnv.js';
import { ResultFXManager } from './ui/ResultFX.js';
import { FishingTutorial } from './ui/FishingTutorial.js';
import { GuideStore } from './ui/MiniGameCoach.js';
import { installJapaneseLineBreak } from './ui/JaLineBreak.js';
import { installDeviceProfile } from './ui/DeviceProfile.js';
import { installTouchGuard, setBackGuard } from './ui/TouchGuard.js';
import { finishRankingRun, getPlayerName, isMockRanking, startRankingRun } from './ranking/client.js';

// Tag <html> with the device type (phone / tablet / PC / dual screen) and input (touch / mouse).
installDeviceProfile();
// Stop selection, long-press menus, zoom, edge swipes and "back" from interrupting play.
installTouchGuard();
// Break Japanese text only between phrases everywhere in the game
// (and swap finger words for mouse words on PC).
installJapaneseLineBreak();

// =============================================================================
// 1. PROCEDURAL WEB AUDIO ENGINE
// =============================================================================
class MaritimeAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.started = false;
    this.alarmTimer = 0;
  }

  initOnGesture() {
    unlockAudio();
    const ctx = ensureAudioContext();
    if (!ctx) return;
    this.started = true;
    if (this.ctx !== ctx) this._build(ctx);
  }

  // Builds the always-on sea / engine / winch sound graph on the given context.
  // Called again when the shared context had to be replaced (see SharedAudio.js).
  _build(ctx) {
    this.ctx = ctx;

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.45;
    this.master.connect(this.ctx.destination);

    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 46;
    const engFilter = this.ctx.createBiquadFilter();
    engFilter.type = 'lowpass';
    engFilter.frequency.value = 110;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.14;
    this.engineOsc.connect(engFilter).connect(this.engineGain).connect(this.master);
    this.engineOsc.start();

    const bufLen = this.ctx.sampleRate * 2;
    const noiseBuf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    noiseSrc.loop = true;
    this.waveFilter = this.ctx.createBiquadFilter();
    this.waveFilter.type = 'lowpass';
    this.waveFilter.frequency.value = 260;
    this.waveGain = this.ctx.createGain();
    this.waveGain.gain.value = 0.16;
    noiseSrc.connect(this.waveFilter).connect(this.waveGain).connect(this.master);
    noiseSrc.start();

    this.winchOsc = this.ctx.createOscillator();
    this.winchOsc.type = 'triangle';
    this.winchOsc.frequency.value = 120;
    this.winchGain = this.ctx.createGain();
    this.winchGain.gain.value = 0.0;
    this.winchOsc.connect(this.winchGain).connect(this.master);
    this.winchOsc.start();

    this.creakOsc = this.ctx.createOscillator();
    this.creakOsc.type = 'sawtooth';
    this.creakOsc.frequency.value = 920;
    const creakBand = this.ctx.createBiquadFilter();
    creakBand.type = 'bandpass';
    creakBand.frequency.value = 1150;
    creakBand.Q.value = 6.0;
    this.creakGain = this.ctx.createGain();
    this.creakGain.gain.value = 0.0;
    this.creakOsc.connect(creakBand).connect(this.creakGain).connect(this.master);
    this.creakOsc.start();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.45;
    return this.muted;
  }

  playTone(freq, duration, type = 'sine', vol = 0.25) {
    if (!this.started || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + duration);
  }

  playHookSuccess() {
    this.playTone(520, 0.14, 'triangle', 0.35);
    setTimeout(() => this.playTone(780, 0.24, 'triangle', 0.34), 90);
  }

  playCaptureFanfare() {
    this.playTone(440, 0.18, 'triangle', 0.32);
    setTimeout(() => this.playTone(554, 0.18, 'triangle', 0.32), 140);
    setTimeout(() => this.playTone(659, 0.35, 'triangle', 0.36), 280);
  }

  // Crane press judged OK: mechanical clunk + bright rising chime (higher on each step).
  playCraneSuccess(stage = 1) {
    const lift = [1, 1.122, 1.26][Math.max(0, Math.min(2, stage - 1))];
    this.playTone(110, 0.12, 'square', 0.22);
    this.playTone(660 * lift, 0.12, 'triangle', 0.34);
    setTimeout(() => this.playTone(990 * lift, 0.26, 'triangle', 0.34), 90);
    setTimeout(() => this.playTone(1320 * lift, 0.22, 'sine', 0.18), 180);
  }

  // Crane press missed the timing: low double buzzer ("bu-bu").
  playCraneMiss() {
    this.playTone(190, 0.16, 'square', 0.28);
    setTimeout(() => this.playTone(150, 0.26, 'square', 0.28), 190);
  }

  // Third miss: buzzer, then a sinking tone as the squid slips away.
  playCraneFail() {
    this.playCraneMiss();
    setTimeout(() => {
      this.playTone(300, 0.9, 'sawtooth', 0.22);
      this.playTone(150, 0.9, 'triangle', 0.26);
    }, 480);
  }

  playLineSnap() {
    this.playTone(160, 0.38, 'sawtooth', 0.45);
    this.playTone(880, 0.12, 'square', 0.25);
  }

  update(dt, snap, throttle, time) {
    if (!this.started || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    const engFreq = 44 + Math.abs(throttle) * 28;
    this.engineOsc.frequency.setTargetAtTime(engFreq, now, 0.12);
    this.waveFilter.frequency.setTargetAtTime(220 + Math.sin(time * 0.6) * 110, now, 0.2);

    const wSpd = Math.abs(snap.winchPower);
    this.winchGain.gain.setTargetAtTime(wSpd > 0.05 ? 0.12 : 0.0, now, 0.08);
    this.winchOsc.frequency.setTargetAtTime(110 + wSpd * 140 + (snap.tension * 0.8), now, 0.08);

    if (snap.tension > 75 && snap.phase === 'FIGHT') {
      const k = (snap.tension - 75) / 25;
      this.creakGain.gain.setTargetAtTime(0.08 * k, now, 0.08);
      this.creakOsc.frequency.setTargetAtTime(860 + Math.sin(time * 24) * 180 + k * 320, now, 0.05);
    } else {
      this.creakGain.gain.setTargetAtTime(0.0, now, 0.1);
    }

    if (snap.events.alarmActive) {
      this.alarmTimer -= dt;
      if (this.alarmTimer <= 0) {
        this.alarmTimer = 0.52;
        this.playTone(880, 0.11, 'square', 0.16);
      }
    } else {
      this.alarmTimer = 0;
    }

    if (snap.events.hookSuccess) this.playHookSuccess();
    if (snap.events.lineSnap) this.playLineSnap();
    const crane = snap.events.craneResult;
    if (crane) {
      if (crane.ok) this.playCraneSuccess(crane.stage);
      else if (crane.final) this.playCraneFail();
      else this.playCraneMiss();
    }
  }
}

// =============================================================================
// 2. SCENE, RENDERER, DUAL CAMERAS (SURFACE + DEEP ROV)
// =============================================================================
const appContainer = document.getElementById('app');

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.16;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.className = 'webgl-canvas';
appContainer.appendChild(renderer.domElement);

const surfaceCamera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.2, 420);
surfaceCamera.position.set(16, 12, -24);

const orbitControls = new OrbitControls(surfaceCamera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.06;
orbitControls.maxPolarAngle = Math.PI * 0.49;
orbitControls.minDistance = 4.0;
orbitControls.maxDistance = 60;

const rovCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.08, 120);

const rovSpotLight = new THREE.SpotLight(0xd8f1ff, 72, 38, Math.PI / 4.0, 0.62, 1.3);
scene.add(rovSpotLight, rovSpotLight.target);

// Extra inspection spotlight for celebrating/observing the caught giant squid on deck!
const inspectLight = new THREE.PointLight(0xeef7ff, 0, 22, 1.3);
scene.add(inspectLight);

// =============================================================================
// 3. INSTANTIATE MODULAR COMPONENTS
// =============================================================================
const oceanEnv = new OceanEnv(scene);
const vessel = new ResearchVessel();
scene.add(vessel.getObject3D());

const standardSquid = new GiantSquid();
scene.add(standardSquid.getObject3D());
// The squid in the water: the 1-30m GiantSquid, or a 31-50m ColossalSquidActor.
let squid = standardSquid;
let colossalActor = null;
// Camera distance multiplier for the deck shots (1 for 1-30m).
let squidCamScale = 1;

// In the fishing scene a 30m squid is about 19 units long (Tier 6 scale).
// 31-50m keep growing from there instead of using true meters, so the ship,
// the rig and the ROV camera still frame the fight.
const TIER6_VISUAL_LENGTH = 9.93 * 1.92;
function colossalVisualLength(lengthMeters) {
  return TIER6_VISUAL_LENGTH * Math.pow(lengthMeters / 30, 0.55);
}

function useSquidFor(specimen) {
  if (colossalActor) {
    colossalActor.dispose();
    colossalActor = null;
  }
  if (specimen && isColossalLength(specimen.lengthMeters)) {
    const model = new GiantSquidColossalModel(specimen.lengthMeters);
    const visualLength = colossalVisualLength(specimen.lengthMeters);
    const extent = model.measureBodyAxisExtent();
    colossalActor = new ColossalSquidActor(model, { visualScale: visualLength / Math.max(1, extent.length) });
    standardSquid.getObject3D().removeFromParent();
    scene.add(colossalActor.getObject3D());
    squid = colossalActor;
    squidCamScale = (visualLength / TIER6_VISUAL_LENGTH) * 1.25;
  } else {
    if (!standardSquid.getObject3D().parent) scene.add(standardSquid.getObject3D());
    applySquidTierVisuals(standardSquid, specimen);
    squid = standardSquid;
    squidCamScale = 1;
  }
}

// Local test hook: with ?mockRanking=1, ?colossal=31..50 forces that size so the
// 31-50m flow can be checked without touching the real leaderboard.
function debugForcedLength() {
  if (!isMockRanking()) return null;
  const value = Number(new URLSearchParams(globalThis.location?.search).get('colossal'));
  return Number.isInteger(value) && value >= 1 && value <= 50 ? value : null;
}

const fishingRig = new FishingRig(scene);
const engine = new GameEngine();
const audio = new MaritimeAudio();

let userSwappedInFight = false;
let manualSwapToggle = false;
let prevPhase = 'HOME';
let inspectCamInitialized = false;
let activeAppMode = 'FISHING'; // 'FISHING' | 'FISHING_RESULT' | 'BUTCHER' | 'COOKING'
let fishingPlayerName = '';
let fishingRun = null;
let fishingRanking = null;

const miniAudio = new MiniGameAudio();
const resultFX = new ResultFXManager(appContainer);
const tutorial = new FishingTutorial(appContainer);
// When a guide card opens, let go of any held button so the game does not keep
// reeling (or steering) the moment the card is closed.
tutorial.onPauseChange = (paused) => { if (paused) hud.releaseAllInputs(); };
tutorial.onBeforeStep = (step) => { if (step.needGauges) hud.openGauges(); };
const fishingResultScene = new FishingResultScene();

function startFishing() {
  audio.initOnGesture();
  activeAppMode = 'FISHING';
  userSwappedInFight = false;
  manualSwapToggle = false;
  inspectCamInitialized = false;
  fishingPlayerName = getPlayerName();
  fishingRun = startRankingRun('fishing', fishingPlayerName);
  fishingRanking = null;
  tutorial.beginPlay(GuideStore.beginPlay());
  hud.setGuideEnabled(GuideStore.nextEnabled());
  hud.hideAll();
  const snapshot = engine.startGame({ forceLength: debugForcedLength() });
  useSquidFor(snapshot.specimen);
}

function recordFishingResult(result) {
  if (result?.success && fishingRun && !fishingRanking) {
    fishingRanking = finishRankingRun(fishingRun, result.score, result);
  }
  return fishingRanking;
}

const flowMenus = new FlowMenuManager(appContainer, {
  onStartButcher: () => {
    activeAppMode = 'BUTCHER';
    hud.hideAll();
    flowMenus.hideFishingResult();
    butcherGame.start(fishingPlayerName);
  },
  onStartCooking: () => {
    activeAppMode = 'COOKING';
    hud.hideAll();
    flowMenus.hideFishingResult();
    ajilloGame.start(fishingPlayerName);
  },
  onReplayFishing: () => {
    butcherGame.hide();
    ajilloGame.hide();
    flowMenus.hideFishingResult();
    flowMenus.hideMenu();
    startFishing();
  },
  onGoHome: () => {
    activeAppMode = 'FISHING';
    tutorial.closeAll();
    butcherGame.hide();
    ajilloGame.hide();
    flowMenus.hideFishingResult();
    flowMenus.hideMenu();
    engine.reset();
    useSquidFor(engine.specimen);
  }
}, miniAudio, resultFX);


const butcherGame = new ButcherGame(appContainer, miniAudio, {
  onComplete: () => {
    flowMenus.showPostButcherMenu();
  }
}, resultFX);

applyStudioEnvironment(renderer, fishingResultScene.scene, false);
applyStudioEnvironment(renderer, butcherGame.scene, false);

const ajilloGame = new AjilloCookingGame(appContainer, miniAudio, {
  onReturnHome: () => {
    activeAppMode = 'FISHING';
    engine.reset();
    useSquidFor(engine.specimen);
  }
}, resultFX);

applyStudioEnvironment(renderer, ajilloGame.scene, true);

const hud = new HUDManager(appContainer, {
  onStartGame: () => {
    if (engine.phase === 'HOME') startFishing();
  },
  onOpenResult: () => {
    if (engine.phase !== 'INSPECT') return;
    engine.openResultScreen();
    const s = engine.getSnapshot();
    activeAppMode = 'FISHING_RESULT';
    hud.hideAll();
    fishingResultScene.configure(s.specimen);
    flowMenus.showFishingResult(s.result, recordFishingResult(s.result), fishingPlayerName);
  },
  onRetry: () => {
    if (engine.phase === 'GAMEOVER' || engine.phase === 'INSPECT') startFishing();
  },
  onSwapView: () => {
    audio.initOnGesture();
    if (engine.phase === 'FIGHT') userSwappedInFight = !userSwappedInFight;
    else manualSwapToggle = !manualSwapToggle;
  },
  onToggleGuides: () => hud.setGuideEnabled(GuideStore.toggleNext()),
  onToggleMute: () => {
    audio.initOnGesture();
    const m = audio.toggleMute();
    miniAudio.setMuted(m);
    return m;
  }
});

// Wake the shared audio on every tap (not only the first one), so sound comes back
// after the page was hidden, the phone was locked, or a game was replayed.
installAudioUnlock();
window.addEventListener('pointerdown', () => audio.initOnGesture(), { capture: true });
onAudioContextCreated((ctx) => { if (audio.started) audio._build(ctx); });
hud.setGuideEnabled(GuideStore.nextEnabled());
// Tapping the 31m-50m warning fades the picture and the alarm out together.
hud.colossalAlert.onSkip = () => miniAudio.stopColossalAlert();

// Test-only hook (only with ?mockRanking=1, so it never exists for real players):
//   ikagettoDebug.getPity() / ikagettoDebug.setPity(1..9) / ikagettoDebug.engine
if (isMockRanking()) {
  window.ikagettoDebug = {
    engine,
    getPity: () => {
      const pity = readColossalPity();
      return { ...pity, nextProbability: calculateColossalProbability(pity.attemptCount) };
    },
    setPity: (attemptCount) => writeColossalPity(attemptCount)
  };
}

// =============================================================================
// 4. PRE-ALLOCATED SCRATCH VECTORS & MAIN LOOP
// =============================================================================
const _sheavePos = new THREE.Vector3();
const _rigEndPos = new THREE.Vector3();
const _rovCamPos = new THREE.Vector3();
const _squidWorldPos = new THREE.Vector3();
const _squidLookAt = new THREE.Vector3();
const _vesselPos = new THREE.Vector3();
const _prevVesselPos = new THREE.Vector3();
const _vesselDelta = new THREE.Vector3();
const _angVel = new THREE.Vector3();
const _deckAnchor = new THREE.Vector3();
const _captureCamGoal = new THREE.Vector3();
const _mouthWorldPos = new THREE.Vector3();
const _mouthOffset = new THREE.Vector3();

// Welds the squid's mouthAnchor millimeter-perfect onto targetPos (live bait & kanna)
function lockSquidMouthTo(targetPos) {
  squid.getMouthWorldPosition(_mouthWorldPos);
  _mouthOffset.subVectors(targetPos, _mouthWorldPos);
  squid.getObject3D().position.add(_mouthOffset);
  _squidWorldPos.copy(squid.getObject3D().position);
}

let lastTime = performance.now();
let totalTime = 0;

function isROVMainCamera(phase) {
  if (phase === 'HOME' || phase === 'CAPTURE_SCENE' || phase === 'INSPECT' || phase === 'SUCCESS') return false;
  let baseROV = (phase === 'LURE_HOOK');
  if (phase === 'FIGHT') baseROV = !userSwappedInFight;
  else if (manualSwapToggle && (phase === 'SEARCH' || phase === 'LANDING')) baseROV = true;
  return baseROV;
}

function renderCameraViewport(cam, x, y, w, h, isDeep) {
  oceanEnv.setFogForView(isDeep);
  cam.aspect = w / Math.max(1, h);
  cam.updateProjectionMatrix();
  renderer.setViewport(x, y, w, h);
  renderer.setScissor(x, y, w, h);
  renderer.render(scene, cam);
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) * 0.001));
  lastTime = now;
  totalTime += dt;

  // While playing (anything but the home screen), "back" keeps the player in the game.
  setBackGuard(activeAppMode !== 'FISHING' || engine.phase !== 'HOME');

  // Dispatch active secondary 3D stage (Comparison Result / Butcher Game / Ajillo Cooking Game)
  if (activeAppMode === 'FISHING_RESULT') {
    fishingResultScene.render(renderer, window.innerWidth, window.innerHeight, dt);
    return;
  }
  if (activeAppMode === 'BUTCHER') {
    butcherGame.render(renderer, window.innerWidth, window.innerHeight, dt);
    return;
  }
  if (activeAppMode === 'COOKING') {
    ajilloGame.render(renderer, window.innerWidth, window.innerHeight, dt);
    return;
  }

  const controls = hud.pollControls();
  const wave = oceanEnv.getWaveStateAt(engine.ship.x, engine.ship.z, totalTime);
  const simDt = tutorial.isPaused() ? 0 : dt;
  const snap = engine.update(simDt, controls, wave);
  recordFishingResult(snap.result);

  if (snap.phase === 'CAPTURE_SCENE' && prevPhase !== 'CAPTURE_SCENE') {
    audio.playCaptureFanfare();
    inspectCamInitialized = false;
  }
  // 31m-50m: size-based full-screen warning when the rig reaches 600m (ROV view).
  if (snap.events.colossalAlert) {
    hud.showColossalAlert(snap.specimen.lengthMeters, snap.events.colossalAlert);
    miniAudio.playColossalAlert(snap.events.colossalAlert);
  }
  // 31m-50m boss actions (visual and sound only).
  if (snap.events.colossalAction && colossalActor) {
    colossalActor.triggerBossAction(snap.events.colossalAction);
    hud.showColossalAction(snap.events.colossalAction);
    miniAudio.playColossalAction(snap.events.colossalAction);
  }
  prevPhase = snap.phase;

  // 1. Sync ResearchVessel
  _prevVesselPos.copy(vessel.getObject3D().position);
  vessel.getObject3D().position.set(snap.ship.x, 0, snap.ship.z);
  vessel.getObject3D().rotation.y = snap.ship.heading;
  vessel.setWinchState(snap.winchPower, (snap.winchTemp - 20) / 100);

  let craneNorm = 0.2;
  if (snap.phase === 'LANDING') craneNorm = snap.landing.craneNormalized;
  else if (snap.phase === 'CAPTURE_SCENE') {
    const p = Math.min(1, snap.captureTimer / 3.2);
    craneNorm = THREE.MathUtils.lerp(0.88, 0.06, p * p * (3 - 2 * p));
  } else if (snap.phase === 'INSPECT' || snap.phase === 'SUCCESS') {
    craneNorm = 0.06;
  }
  vessel.setCraneAngle(craneNorm);
  vessel.update(dt, wave.height, (snap.ship.pitchDeg * Math.PI) / 180, (snap.ship.rollDeg * Math.PI) / 180);

  _vesselPos.copy(vessel.getObject3D().position);
  _vesselDelta.subVectors(_vesselPos, _prevVesselPos);
  vessel.getSheaveWorldPosition(_sheavePos);

  // 2. Rig & GiantSquid Positioning + Rich Fighting/Hookup Motions
  const fwdX = Math.sin(snap.ship.heading);
  const fwdZ = Math.cos(snap.ship.heading);

  if (snap.phase === 'CAPTURE_SCENE' || snap.phase === 'INSPECT' || snap.phase === 'SUCCESS') {
    // Hoist Giant Squid up out of the waves onto the illuminated aft deck / stern hoist!
    const liftT = snap.phase === 'CAPTURE_SCENE' ? Math.min(1, snap.captureTimer / 3.6) : 1.0;
    const ease = liftT * liftT * (3 - 2 * liftT);

    // Aft deck hero display position (suspended cleanly above aft deck under floodlights)
    _deckAnchor.set(
      _vesselPos.x - fwdX * 7.6,
      wave.height + 3.2,
      _vesselPos.z - fwdZ * 7.6
    );
    _rigEndPos.set(
      THREE.MathUtils.lerp(_sheavePos.x, _deckAnchor.x, ease),
      THREE.MathUtils.lerp(wave.height + 0.4, _deckAnchor.y + 1.6, ease),
      THREE.MathUtils.lerp(_sheavePos.z, _deckAnchor.z, ease)
    );

    _squidWorldPos.set(_rigEndPos.x, _rigEndPos.y - 1.1, _rigEndPos.z);
    squid.getObject3D().position.copy(_squidWorldPos);
    // Display giant squid gracefully angled so mantle, huge eyes, arms & tentacles are clearly visible!
    squid.getObject3D().rotation.set(
      THREE.MathUtils.lerp(0.3, -0.38, ease),
      snap.ship.heading + Math.PI * 0.5,
      Math.sin(totalTime * 0.9) * 0.06
    );
    squid.setState('HOVER');
    squid.setHooked(true);
    squid.setPoseMode('HAULING');
    lockSquidMouthTo(_rigEndPos);

    inspectLight.intensity = 42 * ease;
    inspectLight.position.set(_squidWorldPos.x + 2.8, _squidWorldPos.y + 3.4, _squidWorldPos.z + 2.8);
  } else {
    inspectLight.intensity = 0;

    const visualSubmergeY = snap.phase === 'LANDING'
      ? (wave.height - 0.5 + snap.landing.stage * 1.45)
      : -Math.min(72, 2.5 + snap.depth * 0.085);

    const wirePullBack = snap.depth > 5 ? Math.sin((snap.lineAngleDeg * Math.PI) / 180) * 4.2 : 0;
    _rigEndPos.set(
      _sheavePos.x + fwdX * wirePullBack,
      visualSubmergeY,
      _sheavePos.z + fwdZ * wirePullBack
    );

    squid.setState(snap.squid.state);

    if (snap.phase === 'LURE_HOOK') {
      // Position squid so its mouth & arms (-Z) face & reach DIRECTLY onto the live bait (_rigEndPos)!
      const d = snap.squid.distanceToBait;
      const stage = snap.squid.lureStage;
      const orbitA = stage === 'WRAP' ? 0.35 : (totalTime * (stage === 'APPROACH' ? 0.42 : 0.22));
      const vertBob = stage === 'WRAP' ? 0.0 : Math.sin(totalTime * 1.3) * 0.32;
      const lateralOffset = stage === 'WRAP' ? 0.15 : Math.sin(orbitA) * d * 0.48;
      const depthOffset = stage === 'WRAP' ? d : Math.cos(orbitA) * d * 0.88;

      _squidWorldPos.set(
        _rigEndPos.x + lateralOffset,
        _rigEndPos.y - 0.15 + vertBob,
        _rigEndPos.z + Math.max(0.75, Math.abs(depthOffset))
      );
      squid.getObject3D().position.copy(_squidWorldPos);

      // +Z points away from bait so -Z (head, eyes, 8 arms, 2 tentacles) aims directly AT the bait!
      _squidLookAt.copy(_squidWorldPos).multiplyScalar(2).sub(_rigEndPos);
      if (stage === 'PROBE') {
        _squidLookAt.y += Math.sin(totalTime * 2.2) * 0.5;
      }
      squid.getObject3D().lookAt(_squidLookAt);
      squid.setHooked(stage === 'WRAP');
      squid.setPoseMode(stage === 'WRAP' ? 'BITING' : 'FREE');
      if (stage === 'WRAP') {
        // Gripping roll while arms lock directly around the bait!
        squid.getObject3D().rotateZ(Math.sin(totalTime * 3.8) * 0.22);
        lockSquidMouthTo(_rigEndPos);
      }
    } else if (snap.phase === 'FIGHT') {
      // Dynamic multi-axis 3D fighting! Mouth stays hooked near _rigEndPos while body plunges, thrashes, & rolls!
      const st = snap.squid.state;
      const hookDist = 0.95;
      if (st === 'ESCAPE') {
        // Steep downward jet-propulsion plunge + violent twisting!
        const dartX = Math.sin(totalTime * 2.9) * 1.1 + snap.squid.fleeVecX * 0.8;
        const dartZ = Math.cos(totalTime * 2.3) * 1.1 + snap.squid.fleeVecZ * 0.8;
        _squidWorldPos.set(_rigEndPos.x + dartX * 0.45, _rigEndPos.y - 1.35, _rigEndPos.z + dartZ * 0.45);
        squid.getObject3D().position.copy(_squidWorldPos);
        // Point mantle (+Z) steeply downward and outward (diving away from the hook!)
        _squidLookAt.set(
          _squidWorldPos.x + dartX * 2.5,
          _squidWorldPos.y - 4.2,
          _squidWorldPos.z + dartZ * 2.5
        );
        squid.getObject3D().lookAt(_squidLookAt);
        squid.getObject3D().rotateZ(Math.sin(totalTime * 5.2) * 0.55);
      } else if (st === 'JET_SWIM') {
        // Sweeping figure-8 lateral darting + pitching + barrel-rolling!
        const figX = Math.sin(totalTime * 1.8) * 1.65;
        const figY = Math.sin(totalTime * 2.6) * 0.85 - 0.85;
        const figZ = Math.sin(totalTime * 0.9) * 1.35;
        _squidWorldPos.set(_rigEndPos.x + figX * 0.55, _rigEndPos.y + figY, _rigEndPos.z + figZ * 0.55);
        squid.getObject3D().position.copy(_squidWorldPos);
        _squidLookAt.set(
          _squidWorldPos.x + Math.cos(totalTime * 1.8) * 3.2,
          _squidWorldPos.y - 1.4 + Math.cos(totalTime * 2.6) * 1.4,
          _squidWorldPos.z + Math.cos(totalTime * 0.9) * 2.8
        );
        squid.getObject3D().lookAt(_squidLookAt);
        squid.getObject3D().rotateZ(Math.sin(totalTime * 2.8) * 0.45);
      } else {
        // Exhausted HOVER: pitched upward being hauled toward the surface, gently rotating!
        _squidWorldPos.set(
          _rigEndPos.x + Math.sin(totalTime * 0.9) * 0.4,
          _rigEndPos.y - hookDist,
          _rigEndPos.z + Math.cos(totalTime * 0.8) * 0.4
        );
        squid.getObject3D().position.copy(_squidWorldPos);
        _squidLookAt.set(_rigEndPos.x, _rigEndPos.y - 3.5, _rigEndPos.z + 1.2);
        squid.getObject3D().lookAt(_squidLookAt);
        squid.getObject3D().rotateZ(Math.sin(totalTime * 1.1) * 0.18);
      }
      // Switch cleanly between THRASHING (violent escape/jet rage) and HAULING (being dragged upward)!
      squid.setHooked(true);
      squid.setPoseMode((st === 'ESCAPE' || st === 'JET_SWIM') ? 'THRASHING' : 'HAULING');
      lockSquidMouthTo(_rigEndPos);
    } else if (snap.phase === 'LANDING') {
      _squidWorldPos.set(_rigEndPos.x, _rigEndPos.y - 0.85, _rigEndPos.z - 0.4);
      squid.getObject3D().position.copy(_squidWorldPos);
      const thrash = snap.squid.surfaceResisting ? Math.sin(totalTime * 9.0) * 0.35 : Math.sin(totalTime * 1.4) * 0.08;
      squid.getObject3D().rotation.set(0.28 + thrash * 0.5, snap.ship.heading + thrash, thrash * 0.6);
      squid.setHooked(true);
      squid.setPoseMode(snap.squid.surfaceResisting ? 'THRASHING' : 'HAULING');
      lockSquidMouthTo(_rigEndPos);
    } else {
      squid.setHooked(false);
      squid.setPoseMode('FREE');
      _squidWorldPos.set(_rigEndPos.x + 2, -68, _rigEndPos.z + 5);
      squid.getObject3D().position.copy(_squidWorldPos);
    }
  }

  fishingRig.update(dt, _sheavePos, _rigEndPos, snap.tension / 100, snap.lightPower);

  // 3. Camera Framing (Home Cinematic / Active Surface / Capture Cutscene / Free Inspection)
  if (snap.phase === 'HOME') {
    const a = totalTime * 0.16;
    surfaceCamera.position.set(Math.sin(a) * 26, 9.5 + Math.sin(totalTime * 0.3) * 1.5, Math.cos(a) * 26);
    surfaceCamera.lookAt(0, 2.2, 0);
  } else if (snap.phase === 'CAPTURE_SCENE') {
    // Cinematic orbiting hero shot around the A-Frame hoisting the Giant Squid!
    const a = snap.ship.heading + 0.6 + snap.captureTimer * 0.38;
    _captureCamGoal.set(
      _squidWorldPos.x + Math.sin(a) * 9.5 * squidCamScale * (colossalActor ? 1.35 : 1),
      _squidWorldPos.y + 2.2 * squidCamScale,
      _squidWorldPos.z + Math.cos(a) * 9.5 * squidCamScale * (colossalActor ? 1.35 : 1)
    );
    surfaceCamera.position.lerp(_captureCamGoal, Math.min(1, dt * 3.0));
    orbitControls.target.lerp(_squidWorldPos, Math.min(1, dt * 4.0));
    surfaceCamera.lookAt(orbitControls.target);
  } else if (snap.phase === 'INSPECT' || snap.phase === 'SUCCESS') {
    // Free 360° Orbit & Zoom Inspection of the caught Giant Squid!
    if (!inspectCamInitialized) {
      inspectCamInitialized = true;
      orbitControls.target.copy(_squidWorldPos);
      surfaceCamera.position.set(
        _squidWorldPos.x + 6.5 * squidCamScale,
        _squidWorldPos.y + 1.8 * squidCamScale,
        _squidWorldPos.z + 6.5 * squidCamScale
      );
      orbitControls.minDistance = 2.2;
      orbitControls.maxDistance = 24.0 * squidCamScale;
    }
    orbitControls.target.lerp(_squidWorldPos, Math.min(1, dt * 5.0));
    orbitControls.update();
  } else {
    orbitControls.minDistance = 12;
    orbitControls.maxDistance = 60;
    surfaceCamera.position.add(_vesselDelta);
    orbitControls.target.set(_vesselPos.x, 2.2, _vesselPos.z);
    orbitControls.update();
  }

  // Dynamic ROV camera: close-up during LURE_HOOK biting, then smoothly PULLS BACK during FIGHT/LANDING
  // scaled to the specimen's actual length (1m-50m) so the player feels the colossal scale of the Giant Squid!
  const specLen = snap.specimen ? snap.specimen.lengthMeters : 8;
  const isPullingBack = (snap.phase === 'FIGHT' || snap.phase === 'LANDING');
  // 31m-50m: pull the camera further back in proportion to the bigger body.
  const baseZoom = isPullingBack ? (1.42 + (Math.min(30, specLen) / 30) * 0.95) : 1.0;
  const sizeZoom = colossalActor ? baseZoom * squidCamScale * (isPullingBack ? 1.0 : 1.7) : baseZoom;
  const rovOrbit = snap.phase === 'FIGHT' ? Math.sin(totalTime * 0.32) * 3.0 * sizeZoom : Math.sin(totalTime * 0.18) * 1.4;
  _rovCamPos.set(
    _rigEndPos.x + (2.9 * sizeZoom) + rovOrbit,
    _rigEndPos.y + (1.45 * sizeZoom) + Math.cos(totalTime * 0.25) * 0.55,
    _rigEndPos.z - (4.4 * sizeZoom)
  );
  rovCamera.position.lerp(_rovCamPos, Math.min(1, dt * 2.4));
  // Frame midway between bait & squid during hookup, or directly on squid during fight
  if (snap.phase === 'LURE_HOOK') {
    _squidLookAt.lerpVectors(_rigEndPos, _squidWorldPos, 0.55);
  } else {
    _squidLookAt.copy(_squidWorldPos);
  }
  rovCamera.lookAt(_squidLookAt);

  rovSpotLight.position.copy(rovCamera.position);
  rovSpotLight.target.position.copy(_squidWorldPos);
  rovSpotLight.target.updateMatrixWorld();
  rovSpotLight.intensity = 28 + snap.lightPower * 95;

  // Update GiantSquid 3-layer motion
  const fightIntensity = snap.phase === 'FIGHT' ? 1.5 : 0.7;
  _angVel.set(Math.sin(totalTime * 1.2) * 0.45 * fightIntensity, Math.cos(totalTime * 0.9) * 0.65 * fightIntensity, 0);
  squid.update(dt, {
    cameraPos: (snap.phase === 'INSPECT' || snap.phase === 'CAPTURE_SCENE') ? surfaceCamera.position : rovCamera.position,
    lightIntensity: snap.lightPower,
    angularVelocity: _angVel,
    pullForce: snap.tension / 100
  });

  oceanEnv.update(dt, _vesselPos, rovCamera.position, _squidWorldPos, snap.lightPower);

  // 4. Dual-Camera Rendering via setScissorTest(true)
  const W = window.innerWidth;
  const H = window.innerHeight;
  const rovMain = isROVMainCamera(snap.phase);

  renderer.setScissorTest(true);
  renderer.autoClear = true;

  if (rovMain) {
    renderCameraViewport(rovCamera, 0, 0, W, H, true);
  } else {
    renderCameraViewport(surfaceCamera, 0, 0, W, H, false);
  }

  const showPiP = snap.phase !== 'HOME' && snap.phase !== 'CAPTURE_SCENE' && snap.phase !== 'INSPECT' && snap.phase !== 'SUCCESS' && snap.phase !== 'LANDING' && hud.isPiPVisible();
  if (showPiP) {
    const isNarrow = W <= 768;
    const pipW = Math.round(isNarrow ? Math.min(150, W * 0.36) : Math.min(260, W * 0.26));
    const pipH = Math.round(pipW * 0.62);
    const pipX = W - pipW - (isNarrow ? 10 : 12);
    const pipY = H - pipH - (isNarrow ? 122 : 82);
    renderer.clearDepth();
    if (rovMain) {
      renderCameraViewport(surfaceCamera, pipX, pipY, pipW, pipH, false);
    } else {
      renderCameraViewport(rovCamera, pipX, pipY, pipW, pipH, true);
    }
  }
  renderer.setScissorTest(false);

  hud.update(snap, dt, rovMain);
  if (!tutorial.isPaused()) tutorial.checkTriggers(snap);
  audio.update(dt, snap, controls.throttle, totalTime);
}

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
});

requestAnimationFrame(animate);
