import * as THREE from 'three';

export class FishingRig {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'FishingRigRoot';
    this.scene.add(this.root);

    this.time = 0;
    this._buildRigAssembly();
    this._buildDynamicWire();

    // Scratch vectors
    this._mid = new THREE.Vector3();
    this._p = new THREE.Vector3();
  }

  getObject3D() {
    return this.root;
  }

  _buildRigAssembly() {
    const steelMat = new THREE.MeshStandardMaterial({ color: 0xc8d4df, metalness: 0.9, roughness: 0.22 });
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x1b2836, metalness: 0.65, roughness: 0.35 });

    // 1. Underwater ROV Camera & Floodlight Unit (top of rig)
    this.rovUnit = new THREE.Group();
    this.rovUnit.position.set(0, 1.55, 0);
    this.root.add(this.rovUnit);

    const camBody = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.42, 14), housingMat);
    camBody.rotation.x = Math.PI * 0.5;
    this.rovUnit.add(camBody);

    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 14, 12),
      new THREE.MeshPhysicalMaterial({ color: 0x88ccff, roughness: 0.05, metalness: 0.1, clearcoat: 1.0 })
    );
    lens.position.z = 0.2;
    this.rovUnit.add(lens);

    this.rovCamAnchor = new THREE.Object3D();
    this.rovCamAnchor.position.set(0, 0.15, 0.35);
    this.rovUnit.add(this.rovCamAnchor);

    // 2. Deep-sea LED Attractant Lamp (mid-rig)
    this.ledMat = new THREE.MeshStandardMaterial({
      color: 0xd0f4ff,
      emissive: new THREE.Color(0x45d8ff),
      emissiveIntensity: 1.2,
      roughness: 0.18
    });
    const ledLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.38, 14), this.ledMat);
    ledLamp.position.set(0, 0.82, 0);
    this.root.add(ledLamp);

    this.ledLight = new THREE.PointLight(0x5ae0ff, 12, 22, 1.4);
    this.ledLight.position.set(0, 0.82, 0);
    this.root.add(this.ledLight);

    // Central steel leader rod connecting ROV -> Lamp -> Kanna
    const leader = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.2, 8), steelMat);
    leader.position.set(0, 0.52, 0);
    this.root.add(leader);

    // 3. Giant Multi-Prong Kanna (Squid Jig)
    this.kannaGroup = new THREE.Group();
    this.kannaGroup.position.set(0, -0.42, 0);
    this.root.add(this.kannaGroup);

    const sinker = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.32, 12), steelMat);
    sinker.rotation.x = Math.PI;
    sinker.position.y = -0.18;
    this.kannaGroup.add(sinker);

    // Two radial tiers of curved stainless prongs
    for (let tier = 0; tier < 2; tier++) {
      const yOff = tier === 0 ? -0.05 : 0.16;
      const prongs = 10;
      for (let i = 0; i < prongs; i++) {
        const a = (i / prongs) * Math.PI * 2 + tier * 0.3;
        const prong = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.24, 6), steelMat);
        prong.position.set(Math.cos(a) * 0.14, yOff + 0.05, Math.sin(a) * 0.14);
        prong.rotation.z = -Math.cos(a) * 0.72;
        prong.rotation.x = Math.sin(a) * 0.72;
        this.kannaGroup.add(prong);
      }
    }

    // 4. Translucent Live Bait (Sode-ika / Diamondback Squid)
    this.baitGroup = new THREE.Group();
    this.baitGroup.position.set(0, 0.05, 0);
    this.root.add(this.baitGroup);

    const baitMat = new THREE.MeshPhysicalMaterial({
      color: 0xffd2cc,
      emissive: new THREE.Color(0x3a1216),
      emissiveIntensity: 0.25,
      roughness: 0.18,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.86
    });
    const baitBody = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.65, 14), baitMat);
    baitBody.position.y = 0.08;
    this.baitGroup.add(baitBody);

    const baitFin = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.025), baitMat);
    baitFin.rotation.z = Math.PI * 0.25;
    baitFin.position.y = 0.22;
    this.baitGroup.add(baitFin);

    this.baitAnchor = new THREE.Object3D();
    this.baitAnchor.position.set(0, -0.1, 0);
    this.baitGroup.add(this.baitAnchor);
  }

  _buildDynamicWire() {
    this.WIRE_SEGS = 28;
    this.wirePositions = new Float32Array((this.WIRE_SEGS + 1) * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.wirePositions, 3));

    this.wireMat = new THREE.LineBasicMaterial({ color: 0xaad4f5 });
    this.wireLine = new THREE.Line(geo, this.wireMat);
    this.wireLine.frustumCulled = false;
    this.scene.add(this.wireLine);
  }

  getROVCameraPosition(outVec) {
    this.rovCamAnchor.getWorldPosition(outVec);
    return outVec;
  }

  getBaitWorldPosition(outVec) {
    this.baitAnchor.getWorldPosition(outVec);
    return outVec;
  }

  update(dt, startPos, endPos, tension = 0, lightPower = 0.45) {
    const safeDt = Math.min(0.05, Math.max(0.001, dt));
    this.time += safeDt;

    this.root.position.copy(endPos);

    // Gentle live bait sway in current
    this.baitGroup.rotation.z = Math.sin(this.time * 2.4) * 0.16;
    this.baitGroup.rotation.x = Math.cos(this.time * 1.9) * 0.12;

    // LED attractant lamp intensity
    const lp = THREE.MathUtils.clamp(lightPower, 0, 1);
    this.ledMat.emissiveIntensity = 0.15 + lp * 4.2;
    this.ledLight.intensity = lp * 32.0;

    // Dynamic catenary / Bezier wire between ship sheave (startPos) and rig (endPos)
    const tClamped = THREE.MathUtils.clamp(tension, 0, 1);
    const dist = startPos.distanceTo(endPos);
    const sag = Math.min(5.5, dist * 0.16) * Math.pow(1.0 - tClamped, 1.8);

    this._mid.lerpVectors(startPos, endPos, 0.5);
    this._mid.y -= sag;

    // High-frequency metallic vibration when tension >= 0.8
    const vibAmp = tClamped > 0.78 ? (tClamped - 0.78) * 0.24 : 0.0;

    // Shift wire color from steel cyan to danger red under extreme load
    if (tClamped > 0.8) {
      this.wireMat.color.setRGB(1.0, 0.32, 0.28);
    } else if (tClamped > 0.6) {
      this.wireMat.color.setRGB(0.95, 0.76, 0.35);
    } else {
      this.wireMat.color.setRGB(0.66, 0.83, 0.96);
    }

    const arr = this.wirePositions;
    for (let i = 0; i <= this.WIRE_SEGS; i++) {
      const u = i / this.WIRE_SEGS;
      const inv = 1 - u;
      // Quadratic Bezier interpolation
      let x = inv * inv * startPos.x + 2 * inv * u * this._mid.x + u * u * endPos.x;
      let y = inv * inv * startPos.y + 2 * inv * u * this._mid.y + u * u * endPos.y;
      let z = inv * inv * startPos.z + 2 * inv * u * this._mid.z + u * u * endPos.z;

      if (vibAmp > 0 && i > 0 && i < this.WIRE_SEGS) {
        const vWave = Math.sin(this.time * 75.0 + i * 2.1) * vibAmp * Math.sin(u * Math.PI);
        x += vWave;
        z += vWave * 0.7;
      }

      arr[i * 3]     = x;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = z;
    }
    this.wireLine.geometry.attributes.position.needsUpdate = true;
  }
}
