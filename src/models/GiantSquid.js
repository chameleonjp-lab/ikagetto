import * as THREE from 'three';

function hash2D(x, y) {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return h - Math.floor(h);
}

function valueNoise2D(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3.0 - 2.0 * fx);
  const uy = fy * fy * (3.0 - 2.0 * fy);
  const a = hash2D(ix, iy);
  const b = hash2D(ix + 1, iy);
  const c = hash2D(ix, iy + 1);
  const d = hash2D(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm2D(x, y, octaves = 4) {
  let value = 0.0;
  let amp = 0.5;
  let freq = 1.0;
  for (let i = 0; i < octaves; i++) {
    value += amp * valueNoise2D(x * freq, y * freq);
    freq *= 2.02;
    amp *= 0.5;
  }
  return value;
}

function easeOutExpo(x) {
  return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

const STATES = ['HOVER', 'CRUISE', 'JET_SWIM', 'ESCAPE', 'PROBE', 'FLARE', 'STRIKE', 'WRAP'];

export class GiantSquid {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'GiantSquidRoot';

    // Shared shader uniforms for chromatophore passing-cloud animation
    this.skinUniforms = {
      uTime: { value: 0 },
      uChromaPhase: { value: 0 },
      uChromaContrast: { value: 0.24 },
      uChromaDarkness: { value: 0.0 },
      uPulse: { value: 0 }
    };

    this._createTexturesAndMaterials();
    this._buildMantle();
    this._buildFins();
    this._buildFunnel();
    this._buildHeadAndEyes();
    this._buildArmsAndTentacles();
    this._buildSuckers();
    this._buildJetAndInkParticles();

    // 3-layer motion state
    this.activeState = 'HOVER';
    this.baseState = 'HOVER';
    this.stateElapsed = 0.0;
    this.stateWeights = {
      HOVER: 1.0, CRUISE: 0.0, JET_SWIM: 0.0, ESCAPE: 0.0,
      PROBE: 0.0, FLARE: 0.0, STRIKE: 0.0, WRAP: 0.0
    };

    this.simTime = 0.0;
    this.chromaPhase = 0.0;
    this.jetPhase = 0.0;
    this.escapeJetPhase = 0.0;
    this.smoothedJetThrust = 0.0;
    this.strikeTime = 0.0;
    this.wrapTime = 0.0;
    this.currentRoll = 0.0;
    this.isHooked = false;
    this.hookedWeight = 0.0;
    this.poseMode = 'FREE'; // 'FREE' | 'BITING' | 'HAULING' | 'THRASHING'
    this.poseWeights = { BITING: 0.0, HAULING: 0.0, THRASHING: 0.0 };

    // Eye saccade state
    this.saccadeTimer = 2.5;
    this.saccadeActive = 0.0;
    this.saccadeYaw = 0.0;
    this.saccadePitch = 0.0;

    // Pre-allocated scratch objects (zero allocations inside update)
    this._v1 = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._v3 = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._quat = new THREE.Quaternion();
    this._mat = new THREE.Matrix4();
    this._invHeadMat = new THREE.Matrix4();
    this._localCam = new THREE.Vector3();
    this._localTarget = new THREE.Vector3(0, 0, -5);
    this._targetWorldPos = new THREE.Vector3();
    this._hasTargetWorldPos = false;
    this._suckerPos = new THREE.Vector3();
    this._suckerDir = new THREE.Vector3();
    this._suckerScale = new THREE.Vector3();
    this._nozzlePos = new THREE.Vector3();
    this._nozzleDir = new THREE.Vector3();
  }

  getObject3D() {
    return this.root;
  }

  setState(stateName) {
    if (!STATES.includes(stateName)) return;
    if (this.activeState === stateName) return;
    this.activeState = stateName;
    this.stateElapsed = 0.0;
    if (stateName === 'HOVER' || stateName === 'CRUISE' || stateName === 'JET_SWIM') {
      this.baseState = stateName;
    } else if (stateName === 'STRIKE') {
      this.strikeTime = 0.0;
    } else if (stateName === 'WRAP') {
      this.wrapTime = 0.0;
    }
  }

  triggerAction(actionName, targetWorldPos = null) {
    if (!STATES.includes(actionName)) return;
    this.activeState = actionName;
    this.stateElapsed = 0.0;
    if (actionName === 'STRIKE') this.strikeTime = 0.0;
    if (actionName === 'WRAP') this.wrapTime = 0.0;
    if (targetWorldPos) {
      this._targetWorldPos.copy(targetWorldPos);
      this._hasTargetWorldPos = true;
    } else {
      this._hasTargetWorldPos = false;
    }
  }

  setHooked(flag) {
    this.isHooked = Boolean(flag);
  }

  setPoseMode(mode) {
    if (mode === 'FREE' || mode === 'BITING' || mode === 'HAULING' || mode === 'THRASHING') {
      this.poseMode = mode;
    }
  }

  getMouthWorldPosition(outVec) {
    this.root.updateMatrixWorld(true);
    this.mouthAnchor.getWorldPosition(outVec);
    return outVec;
  }

  _createTexturesAndMaterials() {
    const size = 256;
    const cCanvas = document.createElement('canvas');
    cCanvas.width = size; cCanvas.height = size;
    const cCtx = cCanvas.getContext('2d');

    const bCanvas = document.createElement('canvas');
    bCanvas.width = size; bCanvas.height = size;
    const bCtx = bCanvas.getContext('2d');

    const cImg = cCtx.createImageData(size, size);
    const bImg = bCtx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const idx = (y * size + x) * 4;
        const ang = u * Math.PI * 2;
        const nx = Math.cos(ang) * 2.4 + 5.0;
        const ny = Math.sin(ang) * 2.4 + 5.0;
        const macro = fbm2D(nx + v * 1.2, ny + v * 3.8, 3);
        const detail = fbm2D(nx * 4.2 + 9.0, ny * 4.2 + v * 12.0, 2);
        const dorsal = 0.5 + 0.5 * Math.sin(ang);
        const redMix = Math.min(1, Math.max(0, 0.34 + macro * 0.54 + dorsal * 0.22 - Math.pow(v, 1.8) * 0.2));

        cImg.data[idx]     = 232 * (1 - redMix) + 148 * redMix;
        cImg.data[idx + 1] = 196 * (1 - redMix) + 46 * redMix;
        cImg.data[idx + 2] = 192 * (1 - redMix) + 52 * redMix;
        cImg.data[idx + 3] = 255;

        const bv = Math.floor((0.5 * detail + 0.5 * macro) * 255);
        bImg.data[idx] = bv; bImg.data[idx + 1] = bv; bImg.data[idx + 2] = bv; bImg.data[idx + 3] = 255;
      }
    }
    cCtx.putImageData(cImg, 0, 0);
    bCtx.putImageData(bImg, 0, 0);

    // Chromatophore micro-speckles
    let seed = 4219;
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    for (let i = 0; i < 1800; i++) {
      const cx = rand() * size;
      const cy = rand() * size;
      const rad = 0.5 + rand() * 1.9;
      const t = rand();
      cCtx.fillStyle = t < 0.55
        ? `rgba(115,22,28,${(0.2 + rand() * 0.4).toFixed(2)})`
        : t < 0.82
          ? `rgba(195,78,56,${(0.15 + rand() * 0.3).toFixed(2)})`
          : `rgba(245,225,228,${(0.14 + rand() * 0.25).toFixed(2)})`;
      cCtx.beginPath();
      cCtx.arc(cx, cy, rad, 0, Math.PI * 2);
      cCtx.fill();
    }

    const colorMap = new THREE.CanvasTexture(cCanvas);
    colorMap.colorSpace = THREE.SRGBColorSpace;
    colorMap.wrapS = THREE.RepeatWrapping;

    const bumpMap = new THREE.CanvasTexture(bCanvas);
    bumpMap.wrapS = THREE.RepeatWrapping;

    const makeSkin = (tint, iridescence = 0.36) => {
      const mat = new THREE.MeshPhysicalMaterial({
        map: colorMap,
        bumpMap,
        bumpScale: 0.016,
        roughness: 0.2,
        metalness: 0.02,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        iridescence,
        iridescenceIOR: 1.34,
        sheen: 0.45,
        sheenColor: new THREE.Color(0xff9c8e),
        color: new THREE.Color(tint)
      });
      const uniforms = this.skinUniforms;
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = uniforms.uTime;
        shader.uniforms.uChromaPhase = uniforms.uChromaPhase;
        shader.uniforms.uChromaContrast = uniforms.uChromaContrast;
        shader.uniforms.uChromaDarkness = uniforms.uChromaDarkness;
        shader.uniforms.uPulse = uniforms.uPulse;

        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vLocalPos;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalPos = position;');

        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
             uniform float uTime;
             uniform float uChromaPhase;
             uniform float uChromaContrast;
             uniform float uChromaDarkness;
             uniform float uPulse;
             varying vec3 vLocalPos;`
          )
          .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
             float cloudWave = sin(vLocalPos.z * 2.1 + uChromaPhase) * 0.5 + 0.5;
             float cloudRipple = sin(vLocalPos.z * 5.0 + uChromaPhase * 1.4 + vLocalPos.y * 2.2) * 0.5 + 0.5;
             float passing = mix(cloudWave, cloudRipple, 0.45);
             vec3 paleFlush = diffuseColor.rgb * vec3(1.24, 1.16, 1.14);
             vec3 crimsonFlush = diffuseColor.rgb * vec3(1.12, 0.44, 0.42);
             diffuseColor.rgb = mix(diffuseColor.rgb, mix(paleFlush, crimsonFlush, passing), clamp(uChromaContrast + uPulse * 0.22, 0.0, 0.92));
             vec3 threatColor = diffuseColor.rgb * vec3(0.42, 0.09, 0.10);
             float threatPulse = 0.65 + 0.35 * sin(uChromaPhase * 3.6 + vLocalPos.z * 3.0);
             diffuseColor.rgb = mix(diffuseColor.rgb, threatColor, clamp(uChromaDarkness * threatPulse, 0.0, 0.88));`
          )
          .replace(
            '#include <dithering_fragment>',
            `vec3 viewDir = normalize(vViewPosition);
             float fresnel = pow(1.0 - clamp(abs(dot(normal, viewDir)), 0.0, 1.0), 2.7);
             gl_FragColor.rgb += (vec3(0.42, 0.13, 0.14) * (0.45 + 0.25 * uPulse) + vec3(0.10, 0.22, 0.36) * 0.5) * fresnel;
             #include <dithering_fragment>`
          );
      };
      return mat;
    };

    this.mantleMat = makeSkin(0xf7e6e4, 0.42);
    this.finMat = makeSkin(0xf0cfcc, 0.5);
    this.headMat = makeSkin(0xedd6d4, 0.34);
    this.armMat = makeSkin(0xf4dad7, 0.3);
    this.tentacleMat = makeSkin(0xf9e5e3, 0.35);

    this.cavityMat = new THREE.MeshStandardMaterial({
      color: 0x2a090d, roughness: 0.45, side: THREE.BackSide
    });
    this.suckerMat = new THREE.MeshPhysicalMaterial({
      color: 0xeed9d2, roughness: 0.24, clearcoat: 0.85, clearcoatRoughness: 0.12
    });

    // Iris texture
    const iCanvas = document.createElement('canvas');
    iCanvas.width = 128; iCanvas.height = 128;
    const iCtx = iCanvas.getContext('2d');
    const h = 64;
    const grad = iCtx.createRadialGradient(h, h, h * 0.25, h, h, h);
    grad.addColorStop(0.0, '#050810');
    grad.addColorStop(0.45, '#0a1222');
    grad.addColorStop(0.55, '#729bb8');
    grad.addColorStop(0.75, '#c6d9e8');
    grad.addColorStop(1.0, '#1a2736');
    iCtx.fillStyle = grad;
    iCtx.fillRect(0, 0, 128, 128);
    this.irisTex = new THREE.CanvasTexture(iCanvas);
    this.irisTex.colorSpace = THREE.SRGBColorSpace;
  }

  _buildMantle() {
    this.mantle = new THREE.Group();
    this.mantle.name = 'mantle';
    this.root.add(this.mantle);

    this.MANTLE_LENGTH = 2.85;
    const radSegs = 36;
    const axSegs = 34;
    const vertCount = (axSegs + 1) * (radSegs + 1);
    const positions = new Float32Array(vertCount * 3);
    const basePositions = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const indices = [];

    let p = 0, uvp = 0;
    for (let iy = 0; iy <= axSegs; iy++) {
      const t = iy / axSegs;
      const z = t * this.MANTLE_LENGTH;
      let rBase;
      if (t < 0.05) {
        rBase = 0.31 + 0.045 * Math.sin((t / 0.05) * Math.PI * 0.5);
      } else {
        const s = (t - 0.05) / 0.95;
        rBase = Math.max(0.004, 0.355 * (1.0 - Math.pow(s, 1.55)) + 0.145 * Math.sin(Math.pow(s, 0.72) * Math.PI));
      }
      for (let ix = 0; ix <= radSegs; ix++) {
        const u = ix / radSegs;
        const th = u * Math.PI * 2;
        const cosT = Math.cos(th), sinT = Math.sin(th);
        const x = cosT * rBase * 0.96;
        const y = sinT * rBase * (1.03 + 0.04 * Math.max(0, sinT));
        const zOff = (t < 0.12 && sinT < 0) ? (1.0 - t / 0.12) * (-sinT) * 0.08 : 0;
        positions[p] = x; positions[p + 1] = y; positions[p + 2] = z + zOff;
        basePositions[p] = x; basePositions[p + 1] = y; basePositions[p + 2] = z + zOff;
        p += 3;
        uvs[uvp++] = u; uvs[uvp++] = t;
      }
    }

    const stride = radSegs + 1;
    for (let iy = 0; iy < axSegs; iy++) {
      for (let ix = 0; ix < radSegs; ix++) {
        const a = iy * stride + ix;
        const b = a + 1;
        const c = (iy + 1) * stride + ix;
        const d = c + 1;
        indices.push(a, b, c, b, d, c);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    this.mantleMesh = new THREE.Mesh(geo, this.mantleMat);
    this.mantleMesh.userData.basePositions = basePositions;
    this.mantle.add(this.mantleMesh);

    const collarGeo = new THREE.TorusGeometry(0.312, 0.028, 12, 32);
    collarGeo.scale(0.96, 1.03, 1.0);
    this.collarRim = new THREE.Mesh(collarGeo, this.mantleMat);
    this.collarRim.position.z = 0.025;
    this.mantle.add(this.collarRim);

    const cavGeo = new THREE.CylinderGeometry(0.28, 0.25, 0.55, 22, 1, true);
    cavGeo.rotateX(Math.PI * 0.5);
    const cav = new THREE.Mesh(cavGeo, this.cavityMat);
    cav.position.z = 0.28;
    this.mantle.add(cav);
  }

  _buildFins() {
    this.fins = new THREE.Group();
    this.fins.name = 'fins';
    this.fins.position.set(0, 0.04, 2.02);
    this.mantle.add(this.fins);

    const makeFin = (sideSign) => {
      const lenSegs = 18, spanSegs = 10;
      const rows = lenSegs + 1, cols = spanSegs + 1;
      const half = rows * cols;
      const pos = new Float32Array(half * 2 * 3);
      const base = new Float32Array(half * 2 * 3);
      const uvs = new Float32Array(half * 2 * 2);
      const indices = [];

      for (let side = 0; side < 2; side++) {
        const ySign = side === 0 ? 1 : -1;
        for (let r = 0; r < rows; r++) {
          const u = r / lenSegs;
          const z = u * 0.84;
          const span = 0.44 * (0.12 + 0.92 * Math.sin(Math.pow(u, 0.72) * Math.PI));
          const rootX = 0.04 + (1.0 - u) * 0.13;
          for (let c = 0; c < cols; c++) {
            const v = c / spanSegs;
            const idx = side * half + r * cols + c;
            const x = sideSign * (rootX + v * span);
            const thick = 0.026 * Math.sqrt(Math.max(0, 1 - v * v)) * (0.25 + 0.75 * Math.sin(u * Math.PI));
            const y = ySign * thick;
            const zf = z - v * 0.09 * Math.sin(u * Math.PI);
            pos[idx * 3] = x; pos[idx * 3 + 1] = y; pos[idx * 3 + 2] = zf;
            base[idx * 3] = x; base[idx * 3 + 1] = y; base[idx * 3 + 2] = zf;
            uvs[idx * 2] = v; uvs[idx * 2 + 1] = u;
          }
        }
      }
      for (let side = 0; side < 2; side++) {
        const off = side * half;
        const flip = (side === 1) !== (sideSign < 0);
        for (let r = 0; r < lenSegs; r++) {
          for (let c = 0; c < spanSegs; c++) {
            const a = off + r * cols + c, b = a + 1, d = off + (r + 1) * cols + c, e = d + 1;
            if (flip) indices.push(a, b, d, b, e, d);
            else indices.push(a, d, b, b, d, e);
          }
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, this.finMat);
      m.userData = { basePositions: base, sideSign, rows, cols, halfVerts: half };
      return m;
    };

    this.rightFin = makeFin(1);
    this.leftFin = makeFin(-1);
    this.fins.add(this.rightFin, this.leftFin);
  }

  _buildFunnel() {
    this.funnel = new THREE.Group();
    this.funnel.name = 'funnel';
    this.funnel.position.set(0, -0.24, -0.02);
    this.funnel.rotation.x = 0.24;
    this.root.add(this.funnel);

    const fGeo = new THREE.CylinderGeometry(0.068, 0.115, 0.34, 18, 4, true);
    fGeo.rotateX(Math.PI * 0.5);
    const fMesh = new THREE.Mesh(fGeo, this.headMat);
    fMesh.position.z = -0.09;
    this.funnel.add(fMesh);

    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.014, 8, 18), this.headMat);
    lip.position.z = -0.26;
    this.funnel.add(lip);

    this.funnelNozzle = new THREE.Object3D();
    this.funnelNozzle.position.set(0, 0, -0.27);
    this.funnel.add(this.funnelNozzle);
  }

  _buildHeadAndEyes() {
    this.head = new THREE.Group();
    this.head.name = 'head';
    this.head.position.set(0, 0, -0.02);
    this.root.add(this.head);

    const pts = [
      new THREE.Vector2(0.11, -0.74),
      new THREE.Vector2(0.24, -0.68),
      new THREE.Vector2(0.29, -0.52),
      new THREE.Vector2(0.33, -0.34),
      new THREE.Vector2(0.31, -0.18),
      new THREE.Vector2(0.25, 0.02),
      new THREE.Vector2(0.24, 0.14)
    ];
    const hGeo = new THREE.LatheGeometry(pts, 26);
    hGeo.rotateX(Math.PI * 0.5);
    hGeo.scale(1.02, 0.88, 1.0);
    this.head.add(new THREE.Mesh(hGeo, this.headMat));

    // Articulated Upper & Lower Parrot Beak (Karastonbi) that opens & chomps when BITING!
    const beakMat = new THREE.MeshStandardMaterial({ color: 0x160a08, roughness: 0.24, metalness: 0.18 });
    const uBeakGeo = new THREE.ConeGeometry(0.062, 0.14, 10);
    uBeakGeo.rotateX(-Math.PI * 0.5);
    this.upperBeak = new THREE.Mesh(uBeakGeo, beakMat);
    this.upperBeak.position.set(0, 0.025, -0.74);
    const lBeakGeo = new THREE.ConeGeometry(0.052, 0.12, 10);
    lBeakGeo.rotateX(-Math.PI * 0.5);
    this.lowerBeak = new THREE.Mesh(lBeakGeo, beakMat);
    this.lowerBeak.position.set(0, -0.025, -0.73);
    this.head.add(this.upperBeak, this.lowerBeak);

    // Visible Bitten Bait (Silver Mackerel protruding from mouth in BITING / HAULING modes)
    this.bittenBait = new THREE.Group();
    const fishBody = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.048, 0.24, 6, 12),
      new THREE.MeshPhysicalMaterial({ color: 0x9ec4e0, metalness: 0.72, roughness: 0.18, clearcoat: 1.0 })
    );
    fishBody.rotation.x = Math.PI * 0.5;
    const fishTail = new THREE.Mesh(
      new THREE.ConeGeometry(0.065, 0.12, 4),
      new THREE.MeshStandardMaterial({ color: 0x5c7c98, roughness: 0.35 })
    );
    fishTail.rotation.x = Math.PI * 0.5;
    fishTail.position.z = -0.18;
    this.bittenBait.add(fishBody, fishTail);
    this.bittenBait.position.set(0, -0.01, -0.85);
    this.bittenBait.visible = false;
    this.head.add(this.bittenBait);

    this.mouthAnchor = new THREE.Object3D();
    this.mouthAnchor.position.set(0, 0, -0.82);
    this.head.add(this.mouthAnchor);

    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x020308, roughness: 0.08 });
    const irisMat = new THREE.MeshPhysicalMaterial({
      map: this.irisTex, color: 0xc2daf0, metalness: 0.78, roughness: 0.2,
      iridescence: 0.88, emissive: new THREE.Color(0x0b1f33), emissiveIntensity: 0.35
    });
    const corneaMat = new THREE.MeshPhysicalMaterial({
      color: 0xdff2ff, transparent: true, opacity: 0.24, roughness: 0.02,
      clearcoat: 1.0, clearcoatRoughness: 0.02, ior: 1.44, depthWrite: false
    });

    const makeEye = (sideSign) => {
      const socket = new THREE.Group();
      socket.name = sideSign < 0 ? 'leftEye' : 'rightEye';
      socket.position.set(sideSign * 0.275, 0.015, -0.34);
      socket.rotation.y = sideSign * (Math.PI * 0.44);

      const lid = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.032, 12, 24), this.headMat);
      lid.position.z = 0.02;
      socket.add(lid);

      const eyeball = new THREE.Group();
      socket.add(eyeball);

      const iGeo = new THREE.SphereGeometry(0.142, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.48);
      iGeo.rotateX(Math.PI * 0.5); iGeo.scale(1, 1, 0.42);
      const iris = new THREE.Mesh(iGeo, irisMat);
      iris.position.z = 0.018;
      eyeball.add(iris);

      const pGeo = new THREE.SphereGeometry(0.082, 18, 14);
      pGeo.scale(1, 1, 0.38);
      const pupil = new THREE.Mesh(pGeo, pupilMat);
      pupil.position.z = 0.052;
      eyeball.add(pupil);

      const cGeo = new THREE.SphereGeometry(0.148, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.52);
      cGeo.rotateX(Math.PI * 0.5); cGeo.scale(1, 1, 0.58);
      const cornea = new THREE.Mesh(cGeo, corneaMat);
      cornea.position.z = 0.025;
      eyeball.add(cornea);

      socket.userData = { eyeball, sideSign, yaw: 0, pitch: 0 };
      return socket;
    };

    this.leftEye = makeEye(-1);
    this.rightEye = makeEye(1);
    this.head.add(this.leftEye, this.rightEye);
  }

  _createLimbGeo(segs, radSegs) {
    const vCount = (segs + 1) * (radSegs + 1);
    const pos = new Float32Array(vCount * 3);
    const norm = new Float32Array(vCount * 3);
    const uvs = new Float32Array(vCount * 2);
    const indices = [];
    let uvp = 0;
    for (let i = 0; i <= segs; i++) {
      for (let j = 0; j <= radSegs; j++) {
        uvs[uvp++] = j / radSegs;
        uvs[uvp++] = i / segs;
      }
    }
    const stride = radSegs + 1;
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < radSegs; j++) {
        const a = i * stride + j, b = a + 1, c = (i + 1) * stride + j, d = c + 1;
        indices.push(a, b, c, b, d, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return geo;
  }

  _buildArmsAndTentacles() {
    this.ARM_SEGS = 22;
    this.ARM_RAD = 8;
    const armConfigs = [
      { angle: Math.PI * 0.38,  length: 2.65, baseR: 0.080, phase: 0.0, freq: 1.00, spread: 0.19, isProbe: true },
      { angle: Math.PI * 0.62,  length: 2.65, baseR: 0.080, phase: 1.1, freq: 1.05, spread: 0.19, isProbe: false },
      { angle: Math.PI * 0.14,  length: 2.95, baseR: 0.086, phase: 2.3, freq: 0.94, spread: 0.21, isProbe: false },
      { angle: Math.PI * 0.86,  length: 2.95, baseR: 0.086, phase: 3.4, freq: 1.09, spread: 0.21, isProbe: true },
      { angle: -Math.PI * 0.14, length: 3.05, baseR: 0.088, phase: 4.5, freq: 0.91, spread: 0.21, isProbe: false },
      { angle: -Math.PI * 0.86, length: 3.05, baseR: 0.088, phase: 5.2, freq: 1.03, spread: 0.21, isProbe: false },
      { angle: -Math.PI * 0.38, length: 2.75, baseR: 0.082, phase: 1.8, freq: 1.12, spread: 0.19, isProbe: false },
      { angle: -Math.PI * 0.62, length: 2.75, baseR: 0.082, phase: 3.9, freq: 0.97, spread: 0.19, isProbe: false }
    ];

    this.arms = armConfigs.map((cfg, idx) => {
      const geo = this._createLimbGeo(this.ARM_SEGS, this.ARM_RAD);
      const mesh = new THREE.Mesh(geo, this.armMat);
      mesh.name = `arm_${idx}`;
      mesh.frustumCulled = false;
      this.head.add(mesh);

      const spine = [], tangents = [], normals = [], binormals = [], lagOffsets = [];
      for (let i = 0; i <= this.ARM_SEGS; i++) {
        spine.push(new THREE.Vector3());
        tangents.push(new THREE.Vector3());
        normals.push(new THREE.Vector3());
        binormals.push(new THREE.Vector3());
        lagOffsets.push(new THREE.Vector3());
      }
      return { cfg, mesh, geo, spine, tangents, normals, binormals, lagOffsets, rootDirX: Math.cos(cfg.angle), rootDirY: Math.sin(cfg.angle), suckerCountPerRow: 18 };
    });

    this.TENT_SEGS = 32;
    this.TENT_RAD = 8;
    const tentConfigs = [
      { side: 1,  angle: -Math.PI * 0.26, length: 6.4, baseR: 0.044, phase: 0.6, freq: 0.58 },
      { side: -1, angle: -Math.PI * 0.74, length: 6.4, baseR: 0.044, phase: 2.9, freq: 0.53 }
    ];

    this.tentacles = tentConfigs.map((cfg, idx) => {
      const geo = this._createLimbGeo(this.TENT_SEGS, this.TENT_RAD);
      const mesh = new THREE.Mesh(geo, this.tentacleMat);
      mesh.name = `tentacle_${idx}`;
      mesh.frustumCulled = false;
      this.head.add(mesh);

      const spine = [], tangents = [], normals = [], binormals = [], lagOffsets = [];
      for (let i = 0; i <= this.TENT_SEGS; i++) {
        spine.push(new THREE.Vector3());
        tangents.push(new THREE.Vector3());
        normals.push(new THREE.Vector3());
        binormals.push(new THREE.Vector3());
        lagOffsets.push(new THREE.Vector3());
      }
      return { cfg, mesh, geo, spine, tangents, normals, binormals, lagOffsets, rootDirX: Math.cos(cfg.angle), rootDirY: Math.sin(cfg.angle) };
    });
  }

  _buildSuckers() {
    const pts = [
      new THREE.Vector2(0.002, 0.0),
      new THREE.Vector2(0.28, 0.06),
      new THREE.Vector2(0.26, 0.28),
      new THREE.Vector2(0.88, 0.58),
      new THREE.Vector2(1.0, 0.88),
      new THREE.Vector2(0.8, 1.0),
      new THREE.Vector2(0.5, 0.75),
      new THREE.Vector2(0.002, 0.35)
    ];
    const geo = new THREE.LatheGeometry(pts, 8);
    const total = this.arms.length * 2 * 18 + this.tentacles.length * 4 * 14; // 288 + 112 = 400
    this.suckersMesh = new THREE.InstancedMesh(geo, this.suckerMat, total);
    this.suckersMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.suckersMesh.frustumCulled = false;
    this.head.add(this.suckersMesh);
  }

  _buildJetAndInkParticles() {
    this.JET_COUNT = 220;
    this.jetPos = new Float32Array(this.JET_COUNT * 3);
    this.jetVel = new Float32Array(this.JET_COUNT * 3);
    this.jetAge = new Float32Array(this.JET_COUNT);
    this.jetLife = new Float32Array(this.JET_COUNT);
    this.jetCol = new Float32Array(this.JET_COUNT * 3);
    for (let i = 0; i < this.JET_COUNT; i++) {
      this.jetAge[i] = 99;
      this.jetLife[i] = 1;
      this.jetPos[i * 3 + 1] = -9999;
    }

    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(220,242,255,0.92)');
    g.addColorStop(1, 'rgba(80,160,220,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.jetPos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.jetCol, 3));
    const mat = new THREE.PointsMaterial({
      map: new THREE.CanvasTexture(c),
      size: 0.17,
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.jetPoints = new THREE.Points(geo, mat);
    this.jetPoints.frustumCulled = false;
    this.root.add(this.jetPoints);
    this.jetCursor = 0;
    this.jetSpawnAccum = 0;
  }

  _evalJet(u) {
    const split = 2.2 / 3.5;
    if (u < split) {
      const p = u / split;
      const ease = 0.5 - 0.5 * Math.cos(p * Math.PI);
      return { radial: -0.10 + 0.22 * ease, axial: 0.05 - 0.10 * ease, thrust: 0.0 };
    }
    const p = (u - split) / (1.0 - split);
    const k = Math.pow(Math.sin(p * Math.PI * 0.5), 0.72);
    const s = Math.sin(p * Math.PI);
    return { radial: 0.12 - 0.22 * k, axial: -0.05 + 0.10 * k, thrust: s * s };
  }

  _updateTube(limb, segs, radSegs, radiusFn, clubFlatten) {
    const { spine, tangents, normals, binormals, geo } = limb;
    const pArr = geo.attributes.position.array;
    const nArr = geo.attributes.normal.array;

    for (let i = 0; i <= segs; i++) {
      if (i === 0) tangents[i].subVectors(spine[1], spine[0]).normalize();
      else if (i === segs) tangents[i].subVectors(spine[segs], spine[segs - 1]).normalize();
      else tangents[i].subVectors(spine[i + 1], spine[i - 1]).normalize();
    }

    this._v1.set(-limb.rootDirX, -limb.rootDirY, 0).normalize();
    const d0 = this._v1.dot(tangents[0]);
    normals[0].copy(this._v1).addScaledVector(tangents[0], -d0).normalize();
    binormals[0].crossVectors(tangents[0], normals[0]).normalize();

    for (let i = 1; i <= segs; i++) {
      this._v2.crossVectors(tangents[i - 1], tangents[i]);
      const sinA = this._v2.length();
      if (sinA > 1e-5) {
        this._v2.divideScalar(sinA);
        const ang = Math.acos(Math.min(1, Math.max(-1, tangents[i - 1].dot(tangents[i]))));
        this._quat.setFromAxisAngle(this._v2, ang);
        normals[i].copy(normals[i - 1]).applyQuaternion(this._quat).normalize();
      } else {
        normals[i].copy(normals[i - 1]);
      }
      const d = normals[i].dot(tangents[i]);
      normals[i].addScaledVector(tangents[i], -d).normalize();
      binormals[i].crossVectors(tangents[i], normals[i]).normalize();
    }

    let ptr = 0;
    for (let i = 0; i <= segs; i++) {
      const s = i / segs;
      const r = radiusFn(s);
      const sp = spine[i], nm = normals[i], bn = binormals[i];
      let sN = 1, sB = 1;
      if (clubFlatten && s > 0.76) {
        const cf = Math.sin(((s - 0.76) / 0.24) * Math.PI);
        sN = 1 - 0.56 * cf;
        sB = 1 + 1.55 * cf;
      }
      for (let j = 0; j <= radSegs; j++) {
        const th = (j / radSegs) * Math.PI * 2;
        const cosT = Math.cos(th), sinT = Math.sin(th);
        const keel = (!clubFlatten && cosT < -0.5) ? 1.12 : 1.0;
        const nx = nm.x * cosT * sN * keel + bn.x * sinT * sB;
        const ny = nm.y * cosT * sN * keel + bn.y * sinT * sB;
        const nz = nm.z * cosT * sN * keel + bn.z * sinT * sB;
        pArr[ptr] = sp.x + nx * r;
        pArr[ptr + 1] = sp.y + ny * r;
        pArr[ptr + 2] = sp.z + nz * r;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nArr[ptr] = nx / nl; nArr[ptr + 1] = ny / nl; nArr[ptr + 2] = nz / nl;
        ptr += 3;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
  }

  update(dt, ctx = {}) {
    const safeDt = Math.min(0.05, Math.max(0.001, dt));
    this.simTime += safeDt;
    this.stateElapsed += safeDt;

    const cameraPos = ctx.cameraPos || null;
    const lightIntensity = ctx.lightIntensity ?? 0.4;
    const angVel = ctx.angularVelocity || this._v3.set(0, 0, 0);
    const pullForce = ctx.pullForce ?? 0.0;

    if (this.activeState === 'STRIKE') this.strikeTime += safeDt;
    if (this.activeState === 'WRAP') this.wrapTime += safeDt;

    // Cross-fade weights smoothly over 1.0 - 1.5s
    for (let i = 0; i < STATES.length; i++) {
      const k = STATES[i];
      const target = this.activeState === k ? 1.0 : 0.0;
      const rate = ((k === 'ESCAPE' || k === 'STRIKE') && target > 0.5) ? 4.4 : 2.3;
      this.stateWeights[k] = THREE.MathUtils.lerp(this.stateWeights[k], target, 1.0 - Math.exp(-safeDt * rate));
    }

    const wH = this.stateWeights.HOVER;
    const wC = this.stateWeights.CRUISE;
    const wJ = this.stateWeights.JET_SWIM;
    const wE = this.stateWeights.ESCAPE;
    const wP = this.stateWeights.PROBE;
    const wF = this.stateWeights.FLARE;
    const wS = this.stateWeights.STRIKE;
    const wW = this.stateWeights.WRAP;

    // Smoothly blend hooked & dedicated anatomical pose modes (BITING / HAULING / THRASHING)
    const targetHooked = this.isHooked ? 1.0 : 0.0;
    this.hookedWeight = THREE.MathUtils.lerp(this.hookedWeight, targetHooked, 1.0 - Math.exp(-safeDt * 4.5));
    const wHooked = this.hookedWeight;
    const poseRate = 1.0 - Math.exp(-safeDt * 5.0);
    this.poseWeights.BITING    = THREE.MathUtils.lerp(this.poseWeights.BITING,    this.poseMode === 'BITING'    ? 1.0 : 0.0, poseRate);
    this.poseWeights.HAULING   = THREE.MathUtils.lerp(this.poseWeights.HAULING,   this.poseMode === 'HAULING'   ? 1.0 : 0.0, poseRate);
    this.poseWeights.THRASHING = THREE.MathUtils.lerp(this.poseWeights.THRASHING, this.poseMode === 'THRASHING' ? 1.0 : 0.0, poseRate);
    const wBite = this.poseWeights.BITING;
    const wHaul = this.poseWeights.HAULING;
    const wThrash = this.poseWeights.THRASHING;

    // Articulated Beak Chomp & Bitten Bait Visibility
    const chomp = (wBite > 0.05) ? (0.28 + 0.24 * Math.abs(Math.sin(this.simTime * 5.2))) * wBite : (wThrash * 0.32);
    this.upperBeak.rotation.x = chomp;
    this.lowerBeak.rotation.x = -chomp;
    this.bittenBait.visible = (wBite + wHaul > 0.15);
    if (this.bittenBait.visible) {
      this.bittenBait.rotation.y = Math.sin(this.simTime * 6.5) * 0.14 * wBite;
      this.bittenBait.position.z = -0.82 - 0.04 * Math.sin(this.simTime * 5.2) * wBite;
    }

    // Jet cycles
    this.jetPhase = (this.jetPhase + safeDt / 3.5) % 1.0;
    this.escapeJetPhase = (this.escapeJetPhase + safeDt / 1.55) % 1.0;
    const jNorm = this._evalJet(this.jetPhase);
    const jEsc = this._evalJet(this.escapeJetPhase);
    const jetW = Math.min(1.0, wJ + wE);
    const jRad = (jNorm.radial * wJ + jEsc.radial * wE) / Math.max(0.001, jetW);
    const jAx = (jNorm.axial * wJ + jEsc.axial * wE) / Math.max(0.001, jetW);
    const thrust = jNorm.thrust * wJ + jEsc.thrust * wE * 1.8;
    this.smoothedJetThrust += (thrust - this.smoothedJetThrust) * Math.min(1.0, safeDt * 8.0);

    // Chromatophores
    const excitement = Math.min(1.0, wE * 1.3 + wF * 1.1 + wThrash * 1.4 + this.smoothedJetThrust * 0.5 + pullForce * 0.4 + Math.max(0, lightIntensity - 0.65));
    this.chromaPhase += safeDt * (1.1 + 3.2 * excitement);
    this.skinUniforms.uTime.value = this.simTime;
    this.skinUniforms.uChromaPhase.value = this.chromaPhase;
    this.skinUniforms.uChromaContrast.value = 0.24 + 0.5 * excitement;
    this.skinUniforms.uChromaDarkness.value = Math.min(1.0, wF * 0.92 + wE * 0.55 + wThrash * 0.85);
    this.skinUniforms.uPulse.value = this.smoothedJetThrust;

    // Layer 1 + 2 Mantle breathing & jet deformation
    const breath = Math.sin((this.simTime / 4.5) * Math.PI * 2.0);
    const thrashPulse = Math.sin(this.simTime * 9.5) * 0.16 * wThrash;
    const totRad = 0.04 * breath + jRad * jetW - 0.10 * wHaul + thrashPulse;
    const totAx = -0.012 * breath + jAx * jetW + 0.16 * wHaul - thrashPulse * 0.6;
    const mArr = this.mantleMesh.geometry.attributes.position.array;
    const mBase = this.mantleMesh.userData.basePositions;
    for (let i = 0; i < mArr.length; i += 3) {
      const bz = mBase[i + 2];
      const t = Math.min(1, Math.max(0, bz / this.MANTLE_LENGTH));
      const bw = Math.sin(Math.pow(t, 0.72) * Math.PI) * 0.85 + (1 - t) * 0.25;
      const rs = 1.0 + totRad * bw;
      mArr[i] = mBase[i] * rs;
      mArr[i + 1] = mBase[i + 1] * rs;
      mArr[i + 2] = bz * (1.0 + totAx);
    }
    this.mantleMesh.geometry.attributes.position.needsUpdate = true;
    this.mantleMesh.geometry.computeVertexNormals();
    this.fins.position.z = 2.02 * (1.0 + totAx);
    const cs = 1.0 + (0.036 * breath + jRad * jetW * 0.35);
    this.collarRim.scale.set(cs, cs, 1.0);

    // Fins undulation
    const yawRate = THREE.MathUtils.clamp(angVel.y || 0, -1.8, 1.8);
    const pitchRate = THREE.MathUtils.clamp(angVel.x || 0, -1.2, 1.2);
    const updateFin = (fin) => {
      const arr = fin.geometry.attributes.position.array;
      const { basePositions, sideSign, rows, cols, halfVerts } = fin.userData;
      const steer = Math.max(0.45, Math.min(1.65, 1.0 - sideSign * yawRate * 0.55));
      const amp = (wH * 0.055 + wC * 0.135 + wJ * 0.085 + wE * 0.012) * steer;
      const freq = wH * 2.6 + wC * 5.2 + wJ * 6.4 + wE * 9.0;
      const ph = sideSign < 0 ? (0.45 * wH + 0.18 * wC) : 0;
      for (let s = 0; s < 2; s++) {
        for (let r = 0; r < rows; r++) {
          const u = r / (rows - 1);
          const wave = Math.sin(4.8 * u - this.simTime * freq + ph);
          for (let c = 0; c < cols; c++) {
            const v = c / (cols - 1);
            const idx = (s * halfVerts + r * cols + c) * 3;
            arr[idx] = basePositions[idx];
            arr[idx + 1] = basePositions[idx + 1] + wave * amp * Math.pow(v, 1.45) - wE * 0.06 * v;
            arr[idx + 2] = basePositions[idx + 2];
          }
        }
      }
      fin.geometry.attributes.position.needsUpdate = true;
      fin.geometry.computeVertexNormals();
    };
    updateFin(this.rightFin);
    updateFin(this.leftFin);

    // Funnel thrust vectoring & dilation
    const fDil = 1.0 + 0.25 * Math.min(1.5, this.smoothedJetThrust);
    this.funnel.scale.set(fDil, fDil, 1.0 - 0.1 * Math.min(1, this.smoothedJetThrust));
    this.funnel.rotation.y = THREE.MathUtils.clamp(-yawRate * 0.36, -0.45, 0.45);
    this.funnel.rotation.x = 0.24 + THREE.MathUtils.clamp(pitchRate * 0.28, -0.32, 0.32);

    // Subtle body roll from turning
    this.currentRoll = THREE.MathUtils.lerp(this.currentRoll, THREE.MathUtils.clamp(-yawRate * 0.35, -0.4, 0.4), Math.min(1, safeDt * 4));
    this.mantle.rotation.z = this.currentRoll;
    this.head.rotation.z = this.currentRoll * 0.85;

    // Eye tracking + 2-5s saccades
    this.saccadeTimer -= safeDt;
    if (this.saccadeTimer <= 0) {
      this.saccadeTimer = 2.0 + Math.random() * 3.0;
      this.saccadeActive = 0.22;
      this.saccadeYaw = (Math.random() - 0.5) * 0.22;
      this.saccadePitch = (Math.random() - 0.5) * 0.16;
    }
    if (this.saccadeActive > 0) this.saccadeActive = Math.max(0, this.saccadeActive - safeDt);
    const sacF = this.saccadeActive > 0 ? Math.sin((this.saccadeActive / 0.22) * Math.PI) : 0;

    this.head.updateMatrixWorld();
    this._invHeadMat.copy(this.head.matrixWorld).invert();
    if (cameraPos) {
      this._localCam.copy(cameraPos).applyMatrix4(this._invHeadMat);
    } else {
      this._localCam.set(2, 0.5, -3);
    }
    if (this._hasTargetWorldPos) {
      this._localTarget.copy(this._targetWorldPos).applyMatrix4(this._invHeadMat);
    } else {
      this._localTarget.copy(this._localCam);
    }

    const eyes = [this.leftEye, this.rightEye];
    for (let i = 0; i < 2; i++) {
      const eye = eyes[i];
      const { eyeball, sideSign } = eye.userData;
      this._v1.subVectors(this._localCam, eye.position).normalize();
      const sa = sideSign * (Math.PI * 0.44);
      const ca = Math.cos(-sa), sna = Math.sin(-sa);
      const lx = this._v1.x * ca + this._v1.z * sna;
      const lz = -this._v1.x * sna + this._v1.z * ca;
      let dy = THREE.MathUtils.clamp(Math.atan2(lx, Math.max(0.15, lz)), -0.42, 0.42) + this.saccadeYaw * sacF;
      let dp = THREE.MathUtils.clamp(Math.atan2(-this._v1.y, Math.max(0.15, Math.hypot(lx, lz))), -0.34, 0.34) + this.saccadePitch * sacF;
      const spd = sacF > 0.01 ? Math.min(1, safeDt * 22) : Math.min(1, safeDt * 6);
      eye.userData.yaw = THREE.MathUtils.lerp(eye.userData.yaw, dy, spd);
      eye.userData.pitch = THREE.MathUtils.lerp(eye.userData.pitch, dp, spd);
      eyeball.rotation.set(eye.userData.pitch, eye.userData.yaw, 0);
    }

    // Strike & Wrap curves
    let strikeExt = 0, clubFlare = 0;
    if (wS > 0.005) {
      if (this.strikeTime < 0.4) strikeExt = easeOutExpo(this.strikeTime / 0.4);
      else strikeExt = 1.0 - (0.5 - 0.5 * Math.cos(Math.min(1, (this.strikeTime - 0.4) / 1.8) * Math.PI));
      clubFlare = Math.sin(strikeExt * Math.PI) * wS;
    }
    let wrapCurl = 0;
    if (wW > 0.005) {
      wrapCurl = Math.min(1, Math.sin(Math.min(1, this.wrapTime / 3.8) * Math.PI) * 1.15) * wW;
    }

    // Update 8 Arms & 2 Tentacles + Suckers InstancedMesh
    let suckerIdx = 0;
    const jetStreamline = 1.0 - (0.48 * this.smoothedJetThrust * wJ) - (0.78 * wE);
    const glideBloom = (1.0 - this.smoothedJetThrust) * 0.14 * wJ;
    const lagRelax = Math.min(1.0, safeDt * 3.2);

    for (let a = 0; a < this.arms.length; a++) {
      const arm = this.arms[a];
      const cfg = arm.cfg;
      const probeW = cfg.isProbe ? wP : 0;
      const omega = 2.65 * cfg.freq;
      const tanX = -arm.rootDirY, tanY = arm.rootDirX;

      for (let i = 0; i <= this.ARM_SEGS; i++) {
        const s = i / this.ARM_SEGS;
        const s2 = s * s;

        const ambR = (Math.sin(this.simTime * 0.95 + cfg.phase + s * 2.4) + 0.5 * Math.sin(this.simTime * 1.62 + s * 4.1)) * 0.045 * s;
        const ambT = (Math.cos(this.simTime * 0.82 + cfg.phase + s * 2.1) + 0.5 * Math.cos(this.simTime * 1.38 + s * 3.7)) * 0.038 * s;

        const waveStr = (wH * 0.7 + wC * 1.0 + wJ * (1.0 - 0.55 * this.smoothedJetThrust) + wE * 0.08);
        const radW = (Math.sin(5.2 * s - this.simTime * omega + cfg.phase) + 0.35 * Math.sin(8.5 * s - this.simTime * omega * 1.28 + cfg.phase)) * 0.22 * s2 * waveStr + ambR;
        const latW = Math.cos(4.6 * s - this.simTime * omega * 0.85 + cfg.phase) * 0.15 * s2 * waveStr + ambT;

        const flareSp = wF * (1.28 * Math.sin(s * Math.PI * 0.62) + 0.32 * s);
        const normSp = (cfg.spread + glideBloom) * Math.sin(s * Math.PI * 0.78) * Math.max(0.15, jetStreamline);
        const rSp = 0.165 + normSp * (1.0 - wF * 0.5) + flareSp;
        const hoverDroop = -wH * 0.40 * s2;

        let pOut = 0, pSpi = 0, pZ = 0;
        if (probeW > 0.005) {
          pOut = probeW * (0.42 * s + 0.18 * Math.sin(this.simTime * 3.1 + s * 6.5 + cfg.phase) * s2);
          pSpi = probeW * Math.cos(this.simTime * 2.7 + s * 7.0) * 0.22 * s2;
          pZ = probeW * 0.35 * s;
        }
        let wIn = 0, wTan = 0, wZ = 0;
        if (wrapCurl > 0.005) {
          wIn = -wrapCurl * (0.38 * Math.sin(s * Math.PI * 0.85) + 0.22 * s2);
          wTan = wrapCurl * 0.42 * Math.sin(s * Math.PI);
          wZ = wrapCurl * 0.65 * s2;
        }

        const prevLag = i > 0 ? arm.lagOffsets[i - 1] : arm.lagOffsets[0];
        const sd = Math.max(0.04, lagRelax * (1.15 - 0.65 * s));
        arm.lagOffsets[i].x += ((-yawRate * 0.72 * s2 * 0.65 + prevLag.x * 0.38) - arm.lagOffsets[i].x) * sd;
        arm.lagOffsets[i].y += ((pitchRate * 0.58 * s2 * 0.65 + prevLag.y * 0.38) - arm.lagOffsets[i].y) * sd;

        const rFin = Math.max(0.04, rSp + radW + pOut + wIn);
        const tFin = latW + pSpi + wTan;
        let px = arm.rootDirX * rFin + tanX * tFin + arm.lagOffsets[i].x;
        let py = arm.rootDirY * rFin + tanY * tFin + hoverDroop + arm.lagOffsets[i].y;
        const bend = Math.abs(radW) + Math.abs(latW) + wF * 0.45 + wrapCurl * 0.55;
        let pz = -0.68 - s * cfg.length * Math.max(0.45, 1.0 - 0.14 * bend) + pZ + wZ;

        // HOOKED BAIT-GRIPPING POSTURE:
        // Inner 4 arms (a=0,1,6,7) curl tightly around the bait & kanna at z=-0.82;
        // Outer 4 arms (a=2,3,4,5) flair & thrash violently with pullForce!
        // 1) BITING POSE: All 8 arms form a tight feeding cage hugging the bait directly into the beak!
        if (wBite > 0.005) {
          const cageArc = Math.sin(s * Math.PI * 0.92);
          const cageR = (0.12 + 0.26 * cageArc) * (1.0 + 0.08 * Math.sin(this.simTime * 5.0 + a));
          const twist = (a % 2 === 0 ? 1 : -1) * 0.22 * s;
          const bx = arm.rootDirX * cageR + tanX * twist;
          const by = arm.rootDirY * cageR + tanY * twist;
          const bz = -0.68 - Math.sin(s * Math.PI * 0.65) * 0.58 - (s > 0.6 ? (s - 0.6) * 0.28 : 0);
          px = THREE.MathUtils.lerp(px, bx, wBite);
          py = THREE.MathUtils.lerp(py, by, wBite);
          pz = THREE.MathUtils.lerp(pz, bz, wBite);
        }
        // 2) HAULING POSE: Pulled upward by mouth/kanna -> inner arms clenched on hook, outer arms swept back along body by drag!
        if (wHaul > 0.005) {
          const isInner = (a === 0 || a === 1 || a === 6 || a === 7);
          if (isInner) {
            const hx = arm.rootDirX * (0.13 + 0.14 * Math.sin(s * Math.PI));
            const hy = arm.rootDirY * (0.13 + 0.14 * Math.sin(s * Math.PI));
            const hz = -0.68 - Math.sin(s * Math.PI * 0.72) * 0.55;
            px = THREE.MathUtils.lerp(px, hx, wHaul);
            py = THREE.MathUtils.lerp(py, hy, wHaul);
            pz = THREE.MathUtils.lerp(pz, hz, wHaul);
          } else {
            // Swept trailing backward (+Z) along the head/mantle under heavy vertical hauling drag!
            const dragWave = Math.sin(this.simTime * 4.5 - s * 5.0 + a) * 0.14 * s2;
            const hx = arm.rootDirX * (0.28 + 0.22 * Math.sin(s * Math.PI * 0.6)) + dragWave;
            const hy = arm.rootDirY * (0.28 + 0.22 * Math.sin(s * Math.PI * 0.6)) + dragWave * 0.7;
            const hz = -0.64 + s * cfg.length * 0.78;
            px = THREE.MathUtils.lerp(px, hx, wHaul);
            py = THREE.MathUtils.lerp(py, hy, wHaul);
            pz = THREE.MathUtils.lerp(pz, hz, wHaul);
          }
        }
        // 3) THRASHING POSE: Violent radial flaring & whipping across all 8 arms!
        if (wThrash > 0.005) {
          const tFreq = 6.8 + pullForce * 4.2;
          const flareR = 0.24 + 1.15 * Math.sin(s * Math.PI * 0.68) + Math.sin(this.simTime * tFreq + a * 1.9 - s * 6.5) * 0.52 * s2;
          const whipT = Math.cos(this.simTime * tFreq * 1.15 + a * 1.3 - s * 5.5) * 0.62 * s2;
          const tx = arm.rootDirX * flareR + tanX * whipT;
          const ty = arm.rootDirY * flareR + tanY * whipT;
          const tz = -0.66 - s * cfg.length * 0.76 + Math.sin(this.simTime * tFreq * 0.8 + a) * 0.42 * s2;
          px = THREE.MathUtils.lerp(px, tx, wThrash);
          py = THREE.MathUtils.lerp(py, ty, wThrash);
          pz = THREE.MathUtils.lerp(pz, tz, wThrash);
        }
        arm.spine[i].set(px, py, pz);
      }

      this._updateTube(arm, this.ARM_SEGS, this.ARM_RAD, (s) => cfg.baseR * Math.pow(1.0 - s * 0.92, 1.38), false);

      const nRow = arm.suckerCountPerRow;
      for (let row = 0; row < 2; row++) {
        const rs = row === 0 ? -1 : 1;
        for (let k = 0; k < nRow; k++) {
          const s = 0.07 + (k + row * 0.5) / (nRow + 1.2) * 0.84;
          const sf = s * this.ARM_SEGS;
          const i0 = Math.min(this.ARM_SEGS - 1, Math.floor(sf));
          const fr = sf - i0;
          this._v1.lerpVectors(arm.spine[i0], arm.spine[i0 + 1], fr);
          this._v2.lerpVectors(arm.normals[i0], arm.normals[i0 + 1], fr).normalize();
          this._v3.lerpVectors(arm.binormals[i0], arm.binormals[i0 + 1], fr).normalize();
          const armR = cfg.baseR * Math.pow(1.0 - s * 0.92, 1.38);
          const pulse = 1.0 + 0.08 * Math.sin(this.simTime * 2.8 + k * 0.65 + a * 1.1 + row * 1.5);
          const sr = armR * 0.44 * (1.0 - s * 0.25) * pulse;
          this._suckerDir.copy(this._v2).addScaledVector(this._v3, rs * 0.42).normalize();
          this._suckerPos.copy(this._v1).addScaledVector(this._suckerDir, armR * 0.86);
          this._quat.setFromUnitVectors(this._up, this._suckerDir);
          this._suckerScale.set(sr, sr * 1.15, sr);
          this._mat.compose(this._suckerPos, this._quat, this._suckerScale);
          this.suckersMesh.setMatrixAt(suckerIdx++, this._mat);
        }
      }
    }

    const strikeBlend = wS * strikeExt;
    this._v1.copy(this._localTarget).normalize();
    const aimX = this._v1.x, aimY = this._v1.y;

    for (let t = 0; t < this.tentacles.length; t++) {
      const tent = this.tentacles[t];
      const cfg = tent.cfg;
      const omega = 1.65 * cfg.freq;
      const tStream = 1.0 - (0.55 * this.smoothedJetThrust * wJ) - (0.9 * wE);
      const dynLen = cfg.length * (1.0 + 0.8 * strikeBlend);

      for (let i = 0; i <= this.TENT_SEGS; i++) {
        const s = i / this.TENT_SEGS;
        const s2 = s * s;
        const ambX = (Math.sin(this.simTime * 0.74 + cfg.phase + s * 2.0) + 0.5 * Math.sin(this.simTime * 1.25 + s * 3.5)) * 0.08 * s;
        const ambY = (Math.cos(this.simTime * 0.66 + cfg.phase + s * 1.8) + 0.5 * Math.cos(this.simTime * 1.15 + s * 3.2)) * 0.07 * s;
        const tw = (1.0 - 0.85 * wE) * (1.0 - 0.72 * strikeBlend);
        const wx = Math.sin(3.8 * s - this.simTime * omega + cfg.phase) * 0.55 * s2 * tw + ambX;
        const wy = Math.cos(3.1 * s - this.simTime * omega * 0.88 + cfg.phase) * 0.38 * s2 * tw + ambY;

        const prevLag = i > 0 ? tent.lagOffsets[i - 1] : tent.lagOffsets[0];
        const sd = Math.max(0.025, lagRelax * (1.15 - 0.74 * s));
        tent.lagOffsets[i].x += ((-yawRate * 2.5 * s2 * 0.65 + prevLag.x * 0.42) - tent.lagOffsets[i].x) * sd;
        tent.lagOffsets[i].y += ((pitchRate * 1.9 * s2 * 0.65 + prevLag.y * 0.42) - tent.lagOffsets[i].y) * sd;

        const bx = tent.rootDirX * 0.145 + cfg.side * 0.25 * Math.sin(s * Math.PI * 0.65) * Math.max(0.05, tStream);
        const by = tent.rootDirY * 0.145 - (0.12 + 0.35 * wH) * s;
        const clubOpen = cfg.side * 0.34 * clubFlare * Math.pow(s, 1.8);

        const px = bx * (1 - 0.6 * strikeBlend) + wx + tent.lagOffsets[i].x * (1 - 0.7 * strikeBlend) + clubOpen + aimX * strikeBlend * s * 1.2;
        const py = by * (1 - 0.6 * strikeBlend) + wy + tent.lagOffsets[i].y * (1 - 0.7 * strikeBlend) + aimY * strikeBlend * s * 1.2;
        // Extra energetic whipping on tentacles when hooked!
        let fPx = px, fPy = py, fPz = -0.68 - s * dynLen;
        if (wBite > 0.005) {
          // Tentacles coil in tighter around prey during BITING
          const bPx = cfg.side * (0.28 + 0.35 * Math.sin(s * Math.PI));
          const bPy = -0.15 - 0.35 * s2;
          const bPz = -0.72 - s * cfg.length * 0.48;
          fPx = THREE.MathUtils.lerp(fPx, bPx, wBite);
          fPy = THREE.MathUtils.lerp(fPy, bPy, wBite);
          fPz = THREE.MathUtils.lerp(fPz, bPz, wBite);
        }
        if (wHaul > 0.005) {
          // Tentacles stream dramatically backward along the hauled body!
          const hPx = cfg.side * (0.34 + 0.25 * s) + Math.sin(this.simTime * 3.8 - s * 5.5 + cfg.phase) * 0.22 * s2;
          const hPy = -0.22 * s + Math.cos(this.simTime * 3.2 - s * 4.8) * 0.16 * s2;
          const hPz = -0.60 + s * cfg.length * 0.82;
          fPx = THREE.MathUtils.lerp(fPx, hPx, wHaul);
          fPy = THREE.MathUtils.lerp(fPy, hPy, wHaul);
          fPz = THREE.MathUtils.lerp(fPz, hPz, wHaul);
        }
        if (wThrash > 0.005) {
          // Giant violent S-wave lashing across the frame!
          const whip = (1.15 + pullForce * 0.75) * s2 * wThrash;
          fPx += Math.sin(this.simTime * (5.8 + pullForce * 3.0) - s * 6.5 + cfg.phase) * whip;
          fPy += Math.cos(this.simTime * (5.1 + pullForce * 2.8) - s * 5.8 + cfg.phase) * whip;
        }
        tent.spine[i].set(fPx, fPy, fPz);
      }

      this._updateTube(tent, this.TENT_SEGS, this.TENT_RAD, (s) => {
        if (s < 0.76) return cfg.baseR * (1.0 - 0.28 * (s / 0.76));
        const c = (s - 0.76) / 0.24;
        return Math.max(0.006, cfg.baseR * (0.45 * (1 - c) + 1.15 * Math.sin(Math.pow(c, 0.78) * Math.PI)));
      }, true);

      for (let row = 0; row < 4; row++) {
        const rn = (row - 1.5) / 1.5;
        for (let k = 0; k < 14; k++) {
          const c = (k + (row % 2) * 0.45) / 14.5;
          const s = 0.78 + c * 0.19;
          const sf = s * this.TENT_SEGS;
          const i0 = Math.min(this.TENT_SEGS - 1, Math.floor(sf));
          const fr = sf - i0;
          this._v1.lerpVectors(tent.spine[i0], tent.spine[i0 + 1], fr);
          this._v2.lerpVectors(tent.normals[i0], tent.normals[i0 + 1], fr).normalize();
          this._v3.lerpVectors(tent.binormals[i0], tent.binormals[i0 + 1], fr).normalize();
          const cp = Math.sin(Math.pow(Math.min(1, Math.max(0, (s - 0.76) / 0.24)), 0.78) * Math.PI);
          const bcr = cfg.baseR * (0.45 * (1 - c) + 1.15 * cp);
          const sr = bcr * 0.36 * ((row === 1 || row === 2) ? 1.3 : 0.78) * (0.45 + 0.55 * cp);
          this._suckerPos.copy(this._v1).addScaledVector(this._v2, bcr * 0.48).addScaledVector(this._v3, rn * bcr * 1.45);
          this._quat.setFromUnitVectors(this._up, this._v2);
          this._suckerScale.set(sr, sr * 1.1, sr);
          this._mat.compose(this._suckerPos, this._quat, this._suckerScale);
          this.suckersMesh.setMatrixAt(suckerIdx++, this._mat);
        }
      }
    }
    this.suckersMesh.instanceMatrix.needsUpdate = true;

    // Local-space jet particles from funnel nozzle
    const activeThrust = Math.max(thrust, wThrash * 1.45);
    if (activeThrust > 0.08) {
      this.jetSpawnAccum += 130 * activeThrust * safeDt;
      while (this.jetSpawnAccum >= 1.0) {
        this.jetSpawnAccum -= 1.0;
        const idx = this.jetCursor;
        this.jetCursor = (this.jetCursor + 1) % this.JET_COUNT;
        const i3 = idx * 3;
        this.jetPos[i3]     = (Math.random() - 0.5) * 0.07;
        this.jetPos[i3 + 1] = -0.26 + (Math.random() - 0.5) * 0.06;
        this.jetPos[i3 + 2] = -0.32;
        const spd = 2.0 + Math.random() * 2.2;
        this.jetVel[i3]     = Math.sin(this.funnel.rotation.y) * spd * 0.7 + (Math.random() - 0.5) * 0.4;
        this.jetVel[i3 + 1] = -0.25 * spd + (Math.random() - 0.5) * 0.4;
        this.jetVel[i3 + 2] = -spd;
        this.jetAge[idx] = 0;
        this.jetLife[idx] = 0.75 + Math.random() * 0.85;
      }
    }
    const drag = Math.exp(-2.2 * safeDt);
    for (let i = 0; i < this.JET_COUNT; i++) {
      if (this.jetAge[i] >= this.jetLife[i]) continue;
      this.jetAge[i] += safeDt;
      const i3 = i * 3;
      if (this.jetAge[i] >= this.jetLife[i]) {
        this.jetPos[i3 + 1] = -9999;
        this.jetCol[i3] = this.jetCol[i3 + 1] = this.jetCol[i3 + 2] = 0;
        continue;
      }
      this.jetVel[i3] *= drag;
      this.jetVel[i3 + 1] *= drag;
      this.jetVel[i3 + 2] *= drag;
      this.jetPos[i3] += this.jetVel[i3] * safeDt;
      this.jetPos[i3 + 1] += this.jetVel[i3 + 1] * safeDt;
      this.jetPos[i3 + 2] += this.jetVel[i3 + 2] * safeDt;
      const f = Math.pow(1.0 - this.jetAge[i] / this.jetLife[i], 2);
      this.jetCol[i3] = 0.55 * f;
      this.jetCol[i3 + 1] = 0.84 * f;
      this.jetCol[i3 + 2] = 1.0 * f;
    }
    this.jetPoints.geometry.attributes.position.needsUpdate = true;
    this.jetPoints.geometry.attributes.color.needsUpdate = true;
  }
}
