const step = 0.05;
const calmCrest = { phase: Math.PI / 2, roll: 0, pitch: 0 };

export function seededRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function finishFight(engine) {
  let snapshot = engine.getSnapshot();
  for (let frame = 0; frame < 10000 && snapshot.phase === 'FIGHT'; frame++) {
    const { squid, tension, winchTemp } = snapshot;
    const winchPower = squid.state === 'ESCAPE' ? -1 : Number(tension < 83 && winchTemp < 80);
    snapshot = engine.update(step, { winchPower });
  }
  for (let frame = 0; frame < 140 && snapshot.phase === 'LANDING'; frame++) {
    const craneAction = !snapshot.squid.surfaceResisting && snapshot.landing.cooldown === 0;
    snapshot = engine.update(step, { craneAction }, calmCrest);
  }
  for (let frame = 0; frame < 100 && snapshot.phase === 'CAPTURE_SCENE'; frame++) {
    snapshot = engine.update(step);
  }
  return snapshot;
}
