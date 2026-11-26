import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateColossalProbability, rollColossalEncounter, writeColossalPity } from '../../src/data/SquidTiersAndComments.js';
import { circleDeviation, judgeLine, scoreRatio } from '../../src/games/SwipeJudge.js';
import { GameEngine } from '../../src/systems/GameEngine.js';
import { finishFight, seededRandom } from './fishing-fixture.js';

function lowerRig(engine) {
  const snapshot = engine.getSnapshot();
  Object.assign(engine.ship, { x: snapshot.hotspot.x, z: snapshot.hotspot.z });
  for (let frame = 0; frame < 160; frame++) {
    const next = engine.update(0.05, { winchPower: -1 });
    if (next.phase !== 'SEARCH') return next;
  }
  throw new Error('The rig did not reach the squid');
}

test('standard and five colossal classes can be hooked, landed and scored', (t) => {
  const random = t.mock.method(Math, 'random', seededRandom(103249));
  for (const [length, warning] of [[1, 0], [30, 0], [31, 1], [35, 2], [40, 3], [45, 4], [50, 5]]) {
    random.mock.mockImplementation(seededRandom(103248 + length));
    const engine = new GameEngine();
    engine.startGame({ forceLength: length });
    let snapshot = lowerRig(engine);
    assert.equal(snapshot.phase, 'LURE_HOOK', `${length} m`);
    assert.equal(snapshot.events.colossalAlert, warning);
    assert.ok(snapshot.depth >= 600);
    for (let frame = 0; frame < 240 && snapshot.squid.lureStage !== 'WRAP'; frame++) {
      snapshot = engine.update(0.05);
      assert.equal(snapshot.events.colossalAlert, 0, 'the discovery warning fires once');
    }
    assert.equal(snapshot.squid.lureStage, 'WRAP');
    snapshot = engine.update(0.05, { hookAction: true });
    assert.equal(snapshot.phase, 'FIGHT');
    assert.equal(snapshot.events.hookSuccess, true);
    snapshot = finishFight(engine);
    assert.equal(snapshot.phase, 'INSPECT', `${length} m: ${snapshot.failureCode}`);
    assert.equal(snapshot.result.success, true);
    assert.equal(snapshot.result.lengthMeters, length);
    assert.ok(snapshot.result.elapsedTime > 0);
    assert.ok(snapshot.result.weightKg > 0);
    assert.ok(warning ? snapshot.result.score > 50000 && snapshot.result.score <= 80000 : snapshot.result.score <= 50000);
    if (length === 50) assert.equal(snapshot.result.rank, 'EX');
    engine.openResultScreen();
    assert.equal(engine.getSnapshot().phase, 'SUCCESS');
  }
});

test('hooking early fails and retry clears the previous result', (t) => {
  t.mock.method(Math, 'random', seededRandom(50328));
  const engine = new GameEngine();
  engine.startGame({ forceLength: 31 });
  let snapshot = lowerRig(engine);
  for (let frame = 0; frame < 160 && snapshot.squid.lureStage !== 'PROBE'; frame++) snapshot = engine.update(0.05);
  assert.equal(snapshot.squid.lureStage, 'PROBE');
  snapshot = engine.update(0.05, { hookAction: true });
  assert.equal(snapshot.events.hookSuccess, false);
  for (let frame = 0; frame < 65 && snapshot.phase !== 'GAMEOVER'; frame++) snapshot = engine.update(0.05);
  assert.equal(snapshot.failureCode, 'SCARED_AWAY');
  snapshot = engine.startGame({ forceLength: 31 });
  assert.equal(snapshot.phase, 'SEARCH');
  assert.equal(snapshot.elapsedTime, 0);
  assert.equal(snapshot.result, null);
});

test('colossal encounter odds reach 40 percent and reset after a hit', () => {
  writeColossalPity(1);
  assert.deepEqual(rollColossalEncounter(() => 0), { hit: false, attemptCount: 1, probability: 0 });
  assert.deepEqual(rollColossalEncounter(() => 0.05), { hit: false, attemptCount: 2, probability: 0.05 });
  writeColossalPity(8);
  assert.ok(calculateColossalProbability(8) < 0.40);
  rollColossalEncounter(() => 0.99);
  assert.deepEqual(rollColossalEncounter(() => 0.39), { hit: true, attemptCount: 9, probability: 0.40 });
  assert.deepEqual(rollColossalEncounter(() => 0.99), { hit: false, attemptCount: 2, probability: 0.05 });
});

test('the shared cutting and cooking judge distinguishes clean, reversed, short and off-guide strokes', () => {
  const start = { x: 0, y: 0 };
  const end = { x: 100, y: 0 };
  const clean = [start, { x: 50, y: 0 }, end];
  assert.deepEqual(judgeLine(clean, start, end), { ok: true, reason: null, accuracy: 1 });
  assert.equal(judgeLine([end, start], start, end).reason, 'reverse');
  assert.equal(judgeLine([end, start], start, end, { directional: false }).ok, true);
  assert.equal(judgeLine([start, { x: 30, y: 0 }], start, end).reason, 'short');
  assert.equal(judgeLine([start, { x: 50, y: 70 }, end], start, end).reason, 'off');
  assert.equal(judgeLine([start, { x: 150, y: 0 }], start, end).reason, 'over');
  assert.equal(circleDeviation([{ x: 0, y: 50 }, { x: -50, y: 0 }], start, 50), 0);
  assert.ok(scoreRatio(1) > scoreRatio(0));
});

test('the crane forgives two mistimed presses and loses the squid on the third', (t) => {
  t.mock.method(Math, 'random', seededRandom(7711));
  const trough = { phase: -Math.PI / 2, roll: 0, pitch: 0 };
  const crest = { phase: Math.PI / 2, roll: 0, pitch: 0 };
  const toLanding = () => {
    const engine = new GameEngine();
    engine.startGame({ forceLength: 10 });
    Object.assign(engine, { phase: 'LANDING', depth: 0 });
    Object.assign(engine.squid, { surfaceResisting: false, surfaceResistTimer: 99 });
    return engine;
  };
  const press = (engine, wave) => {
    engine.landing.cooldown = 0;
    return engine.update(0.05, { craneAction: true }, wave);
  };

  // Two misses are forgiven, and a good press still counts after them.
  let engine = toLanding();
  let snapshot = press(engine, trough);
  assert.deepEqual(
    { ...snapshot.events.craneResult },
    { ok: false, reason: 'wave', misses: 1, left: 1, final: false, stage: 0 },
  );
  snapshot = press(engine, trough);
  assert.equal(snapshot.phase, 'LANDING');
  assert.equal(snapshot.events.craneResult.left, 0);
  snapshot = press(engine, crest);
  assert.equal(snapshot.events.craneResult.ok, true);
  assert.equal(snapshot.landing.stage, 1);

  // The third miss ends the landing.
  snapshot = press(engine, trough);
  assert.equal(snapshot.events.craneResult.final, true);
  assert.equal(snapshot.phase, 'GAMEOVER');
  assert.equal(snapshot.failureCode, 'LANDING_FAIL');

  // A struggling squid is a miss too, not an instant loss.
  engine = toLanding();
  engine.squid.surfaceResisting = true;
  snapshot = press(engine, crest);
  assert.equal(snapshot.phase, 'LANDING');
  assert.equal(snapshot.events.craneResult.reason, 'squid');
});
