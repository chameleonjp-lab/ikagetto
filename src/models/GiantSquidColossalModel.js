import * as THREE from 'three';

// =============================================================================
// 31m-50m Colossal / Abyssal class giant squid: procedural 3D model.
// Ported from giant_squid_reviewer.html (shared design review tool).
// Axis convention matches GiantSquid.js: mantle toward +Z, head / arms toward -Z.
// Sizes are in real meters (1 world unit = 1 m). Callers scale the root as needed.
// =============================================================================

export function createColossalProfile(lengthMeters) {
  const L = Math.max(30, Math.min(50, Math.round(lengthMeters) || 30));
  const t = (L - 30) / 20;

  const mantleLength = L * (0.31 + 0.03 * t);
  const mantleRadius = mantleLength * (0.185 + 0.035 * t);
  const finScale = 0.90 - 0.08 * t;
  const eyeRadius = mantleRadius * (0.25 - 0.03 * t);
  const armLength = L * (0.33 - 0.01 * t);
  const tentacleLength = L * (0.66 - 0.01 * t);

  const armSegments = L >= 40 ? 22 : 18;
  const tentacleSegments = L >= 40 ? 26 : 22;

  const massKg = Math.round(250 * Math.pow(L / 10, 3));

  return {
    lengthMeters: L,
    t,
    massKg,
    mantleLength,
    mantleRadius,
    finScale,
    eyeRadius,
    armLength,
    tentacleLength,
    armSegments,
    tentacleSegments,
    scarCount: Math.round(14 + 22 * t),
    photophoreBaseGlow: 0.35 + 0.45 * t
  };
}

function createColossalSkinTexture(profile) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, '#3a0b12');
  grad.addColorStop(0.5, '#68161f');
  grad.addColorStop(1, '#8c3138');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.strokeStyle = 'rgba(25, 4, 8, 0.22)';
  ctx.lineWidth = 6;
  for (let x = 0; x < 1024; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (Math.random() - 0.5) * 18, 1024);
    ctx.stroke();
  }

  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const r = 1.5 + Math.random() * 6.5;
    ctx.fillStyle = Math.random() > 0.25
      ? `rgba(45, 5, 10, ${0.2 + Math.random() * 0.4})`
      : `rgba(220, 140, 130, ${0.08 + Math.random() * 0.16})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < profile.scarCount; i++) {
    const sx = Math.random() * 1024;
    const sy = Math.random() * 1024;
    const len = 45 + Math.random() * 110;
    const angle = (Math.random() - 0.5) * 1.4;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle);
    ctx.strokeStyle = `rgba(230, 210, 205, ${0.28 + Math.random() * 0.28})`;
    ctx.lineWidth = 2 + Math.random() * 4;
    ctx.beginPath();
    ctx.moveTo(-len * 0.5, 0);
    ctx.quadraticCurveTo(0, (Math.random() - 0.5) * 18, len * 0.5, 0);
    ctx.stroke();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export class GiantSquidColossalModel {
  constructor(lengthMeters = 35) {
    this.profile = createColossalProfile(lengthMeters);
    this.root = new THREE.Group();
    this.root.name = `GiantSquidColossal_${this.profile.lengthMeters}m`;

    this.parts = {
      mantleGroup: new THREE.Group(),
      mantleMesh: null,
      leftFin: null,
      rightFin: null,
      funnel: null,
      headGroup: new THREE.Group(),
      leftEye: null,
      rightEye: null,
      beakUpper: null,
      beakLower: null,
      mouthMarker: new THREE.Object3D(),
      arms: [],
      tentacles: [],
      suckerInstanced: null,
      suckerBindings: [],
      photophoreInstanced: null,
      photophoreBindings: [],
      inkSystem: null
    };

    this._invRoot = new THREE.Matrix4();
    this._tmpMat = new THREE.Matrix4();
    this._localOffset = new THREE.Matrix4();

    this._initMaterials();
    this._buildMantleAndFins();
    this._buildHeadEyesAndBeak();
    this._buildArmsAndTentacles();
    this._buildInstancedDetails();
    this._buildInkParticles();
  }

  _initMaterials() {
    const skinTex = createColossalSkinTexture(this.profile);

    this.skinMaterial = new THREE.MeshPhysicalMaterial({
      map: skinTex,
      roughness: 0.18,
      metalness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.10,
      iridescence: 0.35,
      iridescenceIOR: 1.4,
      emissive: new THREE.Color(0x280614),
      emissiveIntensity: 0.18,
      side: THREE.DoubleSide
    });

    this.suckerMaterial = new THREE.MeshStandardMaterial({
      color: 0xd9c2b8,
      roughness: 0.32,
      metalness: 0.15
    });

    this.beakMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0b080a,
      roughness: 0.12,
      metalness: 0.25,
      clearcoat: 1.0
    });

    this.photophoreMaterial = new THREE.MeshBasicMaterial({
      color: 0x66e0ff,
      transparent: true,
      opacity: 0.9
    });
  }

  _buildMantleAndFins() {
    const p = this.profile;

    const radialSegs = 36;
    const heightSegs = 28;
    const geo = new THREE.CylinderGeometry(1, 1, p.mantleLength, radialSegs, heightSegs, false);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, p.mantleLength * 0.5);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const u = THREE.MathUtils.clamp(z / p.mantleLength, 0, 1);
      const theta = Math.atan2(y, x);

      let r = Math.sin(Math.pow(1 - u, 0.70) * Math.PI * 0.88) * p.mantleRadius;
      if (u < 0.08) r *= 1.06;
      const ridge = 1.0 + Math.cos(theta * 8) * 0.045 * Math.sin(u * Math.PI);
      const finalR = Math.max(0.01, r * ridge);

      pos.setX(i, Math.cos(theta) * finalR);
      pos.setY(i, Math.sin(theta) * finalR);
    }
    geo.computeVertexNormals();

    this.parts.mantleMesh = new THREE.Mesh(geo, this.skinMaterial);
    this.parts.mantleGroup.add(this.parts.mantleMesh);

    for (const side of [-1, 1]) {
      for (let k = 0; k < 14; k++) {
        const u = 0.12 + (k / 13) * 0.72;
        const z = u * p.mantleLength;
        const r = Math.sin(Math.pow(1 - u, 0.70) * Math.PI * 0.88) * p.mantleRadius * 1.02;
        this.parts.photophoreBindings.push({
          joint: this.parts.mantleMesh,
          offset: new THREE.Vector3(side * r * 0.96, r * 0.22, z),
          scale: p.mantleRadius * 0.045,
          phase: u
        });
      }
    }

    const finLen = p.mantleLength * 0.36 * p.finScale;
    const finWid = p.mantleRadius * 1.50 * p.finScale;
    const createFin = (side) => {
      const finGeo = new THREE.PlaneGeometry(finWid, finLen, 12, 20);
      const fPos = finGeo.attributes.position;
      for (let i = 0; i < fPos.count; i++) {
        const x = fPos.getX(i);
        const y = fPos.getY(i);
        // Clamp: float rounding can give v = -1e-17, and Math.pow(negative, 0.45) is NaN.
        const u = THREE.MathUtils.clamp((x + finWid / 2) / finWid, 0, 1);
        const v = THREE.MathUtils.clamp((y + finLen / 2) / finLen, 0, 1);
        const edgeShape = Math.sin(v * Math.PI) * (0.35 + 0.65 * Math.pow(v, 0.45));
        fPos.setXYZ(i, side * u * finWid * edgeShape, 0, (v - 0.5) * finLen);
      }
      finGeo.computeVertexNormals();
      finGeo.userData.basePositions = new Float32Array(fPos.array);
      const mesh = new THREE.Mesh(finGeo, this.skinMaterial);
      mesh.position.set(side * p.mantleRadius * 0.24, 0, p.mantleLength * 0.79);
      return mesh;
    };

    this.parts.leftFin = createFin(-1);
    this.parts.rightFin = createFin(1);
    this.parts.mantleGroup.add(this.parts.leftFin, this.parts.rightFin);

    const funnelGeo = new THREE.CylinderGeometry(
      p.mantleRadius * 0.20,
      p.mantleRadius * 0.34,
      p.mantleRadius * 1.0,
      16,
      1,
      true
    );
    funnelGeo.rotateX(Math.PI / 2);
    this.parts.funnel = new THREE.Mesh(funnelGeo, this.skinMaterial);
    this.parts.funnel.position.set(0, -p.mantleRadius * 0.72, -p.mantleRadius * 0.12);
    this.parts.mantleGroup.add(this.parts.funnel);

    this.root.add(this.parts.mantleGroup);
  }

  _buildHeadEyesAndBeak() {
    const p = this.profile;
    const headLen = p.mantleRadius * 1.18;
    const headGeo = new THREE.SphereGeometry(p.mantleRadius * 0.76, 24, 18);
    headGeo.scale(1.05, 0.88, 1.25);
    this.parts.headGroup.add(new THREE.Mesh(headGeo, this.skinMaterial));
    this.parts.headGroup.position.set(0, 0, -headLen * 0.65);

    const buildEye = (side) => {
      const eyeGroup = new THREE.Group();
      const irisMat = new THREE.MeshStandardMaterial({
        color: 0xb0c8d8,
        metalness: 0.85,
        roughness: 0.15,
        emissive: 0x102838,
        emissiveIntensity: 0.35
      });
      const pupilMat = new THREE.MeshBasicMaterial({ color: 0x010103 });
      // No transmission: it adds an extra render pass per view on phones.
      const corneaMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.04,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        clearcoat: 1.0
      });

      const eyeball = new THREE.Mesh(new THREE.SphereGeometry(p.eyeRadius, 22, 16), irisMat);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(p.eyeRadius * 0.58, 16, 12), pupilMat);
      pupil.position.set(side * p.eyeRadius * 0.50, 0, 0);
      const cornea = new THREE.Mesh(new THREE.SphereGeometry(p.eyeRadius * 1.07, 22, 16), corneaMat);

      eyeGroup.add(eyeball, pupil, cornea);
      eyeGroup.position.set(side * p.mantleRadius * 0.65, p.mantleRadius * 0.06, -headLen * 0.05);
      return eyeGroup;
    };

    this.parts.leftEye = buildEye(-1);
    this.parts.rightEye = buildEye(1);
    this.parts.headGroup.add(this.parts.leftEye, this.parts.rightEye);

    const beakSize = p.mantleRadius * 0.28;
    const upperGeo = new THREE.ConeGeometry(beakSize * 0.7, beakSize * 1.5, 10);
    upperGeo.rotateX(-Math.PI * 0.58);
    upperGeo.translate(0, 0, -beakSize * 0.5);
    this.parts.beakUpper = new THREE.Mesh(upperGeo, this.beakMaterial);
    this.parts.beakUpper.position.set(0, beakSize * 0.18, -headLen * 0.90);

    const lowerGeo = new THREE.ConeGeometry(beakSize * 0.6, beakSize * 1.25, 10);
    lowerGeo.rotateX(-Math.PI * 0.42);
    lowerGeo.translate(0, 0, -beakSize * 0.45);
    this.parts.beakLower = new THREE.Mesh(lowerGeo, this.beakMaterial);
    this.parts.beakLower.position.set(0, -beakSize * 0.18, -headLen * 0.90);

    this.parts.headGroup.add(this.parts.beakUpper, this.parts.beakLower);

    this.parts.mouthMarker.position.set(0, 0, -headLen * 1.05);
    this.parts.headGroup.add(this.parts.mouthMarker);

    this.root.add(this.parts.headGroup);
  }

  _buildArmsAndTentacles() {
    const p = this.profile;
    const baseZ = -p.mantleRadius * 0.98;

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const baseRadius = p.mantleRadius * 0.48;
      const segLen = p.armLength / p.armSegments;
      const baseThick = p.mantleRadius * 0.22;

      const chain = [];
      let parent = this.parts.headGroup;

      for (let s = 0; s < p.armSegments; s++) {
        const u = s / p.armSegments;
        const r0 = baseThick * Math.pow(1 - u, 0.82);
        const r1 = baseThick * Math.pow(1 - (s + 1) / p.armSegments, 0.82);

        const joint = new THREE.Group();
        if (s === 0) {
          joint.position.set(Math.cos(angle) * baseRadius, Math.sin(angle) * baseRadius, baseZ);
          joint.userData.radialAngle = angle;
        } else {
          joint.position.set(0, 0, -segLen);
        }

        const geo = new THREE.CylinderGeometry(Math.max(0.015, r1), Math.max(0.02, r0), segLen * 1.08, 10);
        geo.rotateX(Math.PI / 2);
        geo.translate(0, 0, -segLen * 0.5);
        joint.add(new THREE.Mesh(geo, this.skinMaterial));

        if (s < p.armSegments - 1) {
          const suckerScale = Math.max(0.02, r0 * 0.46);
          const inX = -Math.cos(angle);
          const inY = -Math.sin(angle);
          const sideX = -inY;
          const sideY = inX;
          for (const side of [-1, 1]) {
            this.parts.suckerBindings.push({
              joint,
              offset: new THREE.Vector3(
                inX * r0 * 0.85 + sideX * side * r0 * 0.36,
                inY * r0 * 0.85 + sideY * side * r0 * 0.36,
                -segLen * (0.32 + (side > 0 ? 0.34 : 0))
              ),
              scale: suckerScale
            });
          }
          if (s % 2 === 1) {
            this.parts.photophoreBindings.push({
              joint,
              offset: new THREE.Vector3(-inX * r0 * 0.96, -inY * r0 * 0.96, -segLen * 0.5),
              scale: Math.max(0.025, r0 * 0.22),
              phase: 1.0 + u
            });
          }
        }

        parent.add(joint);
        chain.push(joint);
        parent = joint;
      }
      this.parts.arms.push(chain);
    }

    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const segLen = p.tentacleLength / p.tentacleSegments;
      const baseThick = p.mantleRadius * 0.125;
      const chain = [];
      let parent = this.parts.headGroup;

      for (let s = 0; s < p.tentacleSegments; s++) {
        const u = s / p.tentacleSegments;
        const isClub = u >= 0.83;
        const r0 = isClub ? baseThick * 1.55 * (1 - (u - 0.83) * 3.8) : baseThick * (1 - u * 0.32);
        const r1 = isClub ? Math.max(0.02, r0 * 0.82) : baseThick * (1 - (u + 0.04) * 0.32);

        const joint = new THREE.Group();
        if (s === 0) {
          joint.position.set(side * p.mantleRadius * 0.25, -p.mantleRadius * 0.28, baseZ);
          joint.userData.side = side;
        } else {
          joint.position.set(0, 0, -segLen);
        }

        const geo = new THREE.CylinderGeometry(Math.max(0.015, r1), Math.max(0.02, r0), segLen * 1.06, 10);
        if (isClub) geo.scale(1.65, 0.62, 1.0);
        geo.rotateX(Math.PI / 2);
        geo.translate(0, 0, -segLen * 0.5);
        joint.add(new THREE.Mesh(geo, this.skinMaterial));

        if (isClub) {
          for (const k of [-1, 0, 1]) {
            this.parts.suckerBindings.push({
              joint,
              offset: new THREE.Vector3(k * r0 * 0.48, r0 * 0.55, -segLen * 0.5),
              scale: Math.max(0.03, r0 * 0.45)
            });
          }
        }

        parent.add(joint);
        chain.push(joint);
        parent = joint;
      }
      this.parts.tentacles.push(chain);
    }
  }

  _buildInstancedDetails() {
    const suckerGeo = new THREE.CylinderGeometry(0.55, 0.95, 0.65, 8);
    suckerGeo.rotateX(Math.PI / 2);
    this.parts.suckerInstanced = new THREE.InstancedMesh(
      suckerGeo,
      this.suckerMaterial,
      this.parts.suckerBindings.length
    );
    this.parts.suckerInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.root.add(this.parts.suckerInstanced);

    const photoGeo = new THREE.SphereGeometry(1.0, 8, 6);
    this.parts.photophoreInstanced = new THREE.InstancedMesh(
      photoGeo,
      this.photophoreMaterial,
      this.parts.photophoreBindings.length
    );
    this.parts.photophoreInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.root.add(this.parts.photophoreInstanced);

    this.syncDynamicDetails(1.0, 0);
  }

  _buildInkParticles() {
    const count = 420;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const life = new Float32Array(count);
    for (let i = 0; i < count; i++) positions[i * 3 + 1] = -9999;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x0c0412,
      size: this.profile.mantleRadius * 0.55,
      transparent: true,
      opacity: 0.72,
      depthWrite: false
    });

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.root.add(points);

    this.parts.inkSystem = { points, positions, velocities, life, count };
  }

  syncDynamicDetails(suckerPulse = 1.0, waveTime = 0, pulseBoost = 0) {
    this.root.updateMatrixWorld(true);
    this._invRoot.copy(this.root.matrixWorld).invert();

    const sBindings = this.parts.suckerBindings;
    const sMesh = this.parts.suckerInstanced;
    for (let i = 0; i < sBindings.length; i++) {
      const b = sBindings[i];
      const s = b.scale * suckerPulse;
      this._localOffset.makeScale(s, s, s);
      this._localOffset.setPosition(b.offset);
      this._tmpMat.multiplyMatrices(b.joint.matrixWorld, this._localOffset);
      this._tmpMat.premultiply(this._invRoot);
      sMesh.setMatrixAt(i, this._tmpMat);
    }
    sMesh.instanceMatrix.needsUpdate = true;

    const pBindings = this.parts.photophoreBindings;
    const pMesh = this.parts.photophoreInstanced;
    for (let i = 0; i < pBindings.length; i++) {
      const b = pBindings[i];
      const wave = 0.5 + 0.5 * Math.sin(waveTime * (2.5 + pulseBoost * 6.0) - b.phase * 5.0);
      const s = b.scale * (0.45 + wave * (0.75 + pulseBoost * 1.1));
      this._localOffset.makeScale(s, s, s);
      this._localOffset.setPosition(b.offset);
      this._tmpMat.multiplyMatrices(b.joint.matrixWorld, this._localOffset);
      this._tmpMat.premultiply(this._invRoot);
      pMesh.setMatrixAt(i, this._tmpMat);
    }
    pMesh.instanceMatrix.needsUpdate = true;
  }

  getObject3D() {
    return this.root;
  }

  getMouthWorldPosition(outVec) {
    return this.parts.mouthMarker.getWorldPosition(outVec);
  }

  // Measure the body vertices in model units so rotated meshes do not inflate the ruler span.
  measureBodyAxisExtent() {
    const savedMatrix = this.root.matrix.clone();
    const savedPos = this.root.position.clone();
    const savedQuat = this.root.quaternion.clone();
    const savedScale = this.root.scale.clone();
    this.root.position.set(0, 0, 0);
    this.root.quaternion.identity();
    this.root.scale.set(1, 1, 1);
    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const vertex = new THREE.Vector3();
    this.root.traverse((obj) => {
      if (!obj.isMesh || obj.isInstancedMesh || !obj.geometry) return;
      const positions = obj.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i).applyMatrix4(obj.matrixWorld);
        box.expandByPoint(vertex);
      }
    });
    this.root.position.copy(savedPos);
    this.root.quaternion.copy(savedQuat);
    this.root.scale.copy(savedScale);
    this.root.matrix.copy(savedMatrix);
    this.root.updateMatrixWorld(true);
    return { minZ: box.min.z, maxZ: box.max.z, length: box.max.z - box.min.z, halfWidth: Math.max(-box.min.x, box.max.x) };
  }

  dispose() {
    const textures = new Set();
    this.root.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
      for (const m of mats) {
        if (m.map) textures.add(m.map);
        m.dispose();
      }
    });
    for (const tex of textures) tex.dispose();
    this.root.removeFromParent();
  }
}

export function createColossalSquidModel(lengthMeters) {
  return new GiantSquidColossalModel(lengthMeters);
}
