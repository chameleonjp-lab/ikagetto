import { t } from '../i18n/runtime.js';
import * as THREE from 'three';
import { FishermanModel } from '../models/FishermanModel.js';
import { createTieredGiantSquid } from '../models/GiantSquidTiers.js';

// Explicit 30-step (1m..30m) scale & framing presets so the 170cm fisherman head
// aligns cleanly with the 1.7m dashed ruler line and NEVER overlaps the top-left score card!
function buildScalePreset30(lengthMeters) {
  const L = Math.max(1, Math.min(30, Math.round(lengthMeters)));
  let step = 1;
  if (L <= 4) step = 0.5;
  else if (L <= 10) step = 1;
  else if (L <= 20) step = 2;
  else step = 5;

  const maxScaleMeters = Math.max(2.5, Math.ceil((Math.max(L, 2.0) * 1.18) / step) * step);
  // Fisherman is ALWAYS exact 1.70 world units tall (170cm), while horizontal spacing & camera
  // framing are tuned across all 30 sizes so both Fisherman and Giant Squid fit the central safe zone!
  const spreadX = L <= 3 ? 0.65 : L <= 8 ? 1.15 : L <= 15 ? 2.1 : L <= 22 ? 3.2 : 4.4;
  return {
    lengthMeters: L,
    step,
    maxScaleMeters,
    fishermanX: -spreadX,
    squidX: spreadX * 0.92,
    fishermanScale: 1.0 // Exact 1.70m in world units matching ruler Y=1.70
  };
}

export class FishingResultScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x061324);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 240);
    this.time = 0;

    this.scene.add(new THREE.HemisphereLight(0xb2dcff, 0x0b1c30, 1.2));
    const key = new THREE.DirectionalLight(0xfff5e4, 1.7);
    key.position.set(6, 12, 14);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x52c4ff, 0.95);
    rim.position.set(-8, 8, -10);
    this.scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 40),
      new THREE.MeshStandardMaterial({ color: 0x0a1c30, roughness: 0.72, metalness: 0.15 })
    );
    floor.rotation.x = -Math.PI * 0.5;
    this.scene.add(floor);

    this.fisherman = new FishermanModel();
    this.scene.add(this.fisherman.getObject3D());

    this.scaleWall = null;
    this.labelSprites = new THREE.Group();
    this.scene.add(this.labelSprites);
    this.squid = null;
    this.preset = buildScalePreset30(8);
  }

  _makeCrispBadgeSprite(text, fgColor = '#a8dcff', borderColor = 'rgba(92,225,255,0.45)', bgColor = 'rgba(6,18,34,0.82)', worldHeight = 0.24) {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    const fontSize = 44;
    ctx.font = `bold ${fontSize}px "Hiragino Maru Gothic ProN", sans-serif`;
    const padX = 22;
    const textW = Math.ceil(ctx.measureText(text).width);
    c.width = textW + padX * 2;
    c.height = 68;

    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(3, 3, c.width - 6, c.height - 6, 16);
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.font = `bold ${fontSize}px "Hiragino Maru Gothic ProN", sans-serif`;
    ctx.fillStyle = fgColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, c.width * 0.5, c.height * 0.52);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sp = new THREE.Sprite(mat);
    const aspect = c.width / c.height;
    sp.scale.set(worldHeight * aspect, worldHeight, 1);
    return sp;
  }

  _buildScaleWall(maxMeters, stepMeters) {
    if (this.scaleWall) {
      this.scene.remove(this.scaleWall);
      this.scaleWall.geometry.dispose();
      this.scaleWall.material.map.dispose();
      this.scaleWall.material.dispose();
    }
    while (this.labelSprites.children.length > 0) {
      const ch = this.labelSprites.children.pop();
      if (ch.material && ch.material.map) ch.material.map.dispose();
      if (ch.material) ch.material.dispose();
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#07172b';
    ctx.fillRect(0, 0, 512, 1024);

    const pxPerMeter = 920 / maxMeters;
    const baseY = 986;

    for (let m = 0; m <= maxMeters + 0.001; m += stepMeters) {
      const y = baseY - m * pxPerMeter;
      ctx.strokeStyle = m === 0 ? '#5ce1ff' : 'rgba(92, 225, 255, 0.36)';
      ctx.lineWidth = m === 0 ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    // Highlight exact 1.70m (170cm fisherman height) line in amber (lines only — crisp sprite carries the text!)
    const y170 = baseY - 1.7 * pxPerMeter;
    ctx.strokeStyle = 'rgba(245, 179, 66, 0.85)';
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, y170);
    ctx.lineTo(512, y170);
    ctx.stroke();
    ctx.setLineDash([]);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const wallW = Math.max(4.6, maxMeters * 0.85);
    const wallH = maxMeters * (1024 / 920);
    const geo = new THREE.PlaneGeometry(wallW, wallH);
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    this.scaleWall = new THREE.Mesh(geo, mat);
    this.scaleWall.position.set(0, wallH * 0.5 - (38 / 1024) * wallH, -1.8);
    this.scene.add(this.scaleWall);

    // Aspect-ratio-locked crisp 3D Sprite labels (NEVER squashed or stretched!)
    const lblH = Math.max(0.18, maxMeters * 0.052);
    const rightX = Math.min(wallW * 0.40, Math.max(this.preset.squidX + 0.45, wallW * 0.30));
    for (let m = stepMeters; m <= maxMeters + 0.001; m += stepMeters) {
      const txt = `${Math.abs(m - Math.round(m)) < 0.01 ? Math.round(m) : m.toFixed(1)}m`;
      const sp = this._makeCrispBadgeSprite(txt, '#bfe8ff', 'rgba(92,225,255,0.4)', 'rgba(6,18,34,0.72)', lblH);
      sp.position.set(rightX, m, -1.2);
      this.labelSprites.add(sp);
    }

    // Crisp amber pill badge directly above the 170cm Fisherman's head!
    const fisherBadge = this._makeCrispBadgeSprite(t('漁師 170cm'), '#ffe07a', '#f5b342', 'rgba(24,18,8,0.90)', lblH * 1.05);
    fisherBadge.position.set(this.preset.fishermanX, 1.70 + lblH * 0.78, 0.4);
    this.labelSprites.add(fisherBadge);
  }

  configure(specimen) {
    if (this.squid) this.scene.remove(this.squid.getObject3D());
    this.preset = buildScalePreset30(specimen.lengthMeters);
    this.squid = createTieredGiantSquid(specimen);

    const sqObj = this.squid.getObject3D();
    this.scene.add(sqObj);

    const L = this.preset.lengthMeters;
    // Normalize exact vertical span (base squid is ~9.93 units from z=+2.85 to z=-7.08)
    const exactScale = L / 9.93;
    sqObj.scale.set(exactScale, exactScale, exactScale);
    sqObj.rotation.set(-Math.PI * 0.5, 0, 0);
    sqObj.position.set(this.preset.squidX, L * (7.08 / 9.93), 0);

    // 170cm Fisherman standing cleanly at Y = 0 on the left
    const fObj = this.fisherman.getObject3D();
    fObj.scale.setScalar(this.preset.fishermanScale);
    fObj.position.set(this.preset.fishermanX, 0, 0.25);

    this._buildScaleWall(this.preset.maxScaleMeters, this.preset.step);
  }

  render(renderer, width, height, dt) {
    this.time += Math.min(0.05, dt);
    if (this.squid) {
      this.squid.setState('HOVER');
      this.squid.setHooked(false);
      this.squid.update(dt, { cameraPos: this.camera.position, lightIntensity: 0.4 });
    }

    const aspect = width / Math.max(1, height);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    // Frame inside central safe zone (leaving top 22% for compact score card & bottom 14% for footer buttons)
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const totalH = this.preset.maxScaleMeters;
    const fitH = totalH * 1.48;
    let camDist = (fitH * 0.5) / Math.tan(fovRad * 0.5);
    if (aspect < 0.75) camDist *= 1.18;

    // Shift lookAt slightly upward so the 0m..maxM stage sits nicely below the top-left score card
    const centerY = totalH * 0.56;
    this.camera.position.set(0, centerY, camDist);
    this.camera.lookAt(0, centerY, 0);

    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, width, height);
    renderer.render(this.scene, this.camera);
  }
}
