import * as THREE from 'three';

export class ResearchVessel {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'ResearchVesselRoot';

    // Inner motion pivot for pitch/roll/heave on waves
    this.hullGroup = new THREE.Group();
    this.root.add(this.hullGroup);

    this.time = 0;
    this.currentCraneAngle = 0; // 0 = stowed, 1 = deployed 55 deg aft
    this.targetCraneAngle = 0;
    this.winchTempNorm = 0;
    this.winchSpeed = 0;

    this._createMaterials();
    this._buildHull();
    this._buildBridge();
    this._buildAftDeckAndLights();
    this._buildHydraulicWinch();
    this._buildAFrameCrane();
    this._buildPropellerRef();
    this._buildSteamParticles();
  }

  getObject3D() {
    return this.root;
  }

  _createMaterials() {
    this.lowerHullMat = new THREE.MeshStandardMaterial({ color: 0x6e1717, roughness: 0.55, metalness: 0.25 });
    this.upperHullMat = new THREE.MeshStandardMaterial({ color: 0x16263a, roughness: 0.45, metalness: 0.32 });
    this.whitePaintMat = new THREE.MeshStandardMaterial({ color: 0xdce5ee, roughness: 0.42, metalness: 0.15 });
    this.deckMat = new THREE.MeshStandardMaterial({ color: 0x2a333c, roughness: 0.82, metalness: 0.18 });
    this.steelMat = new THREE.MeshStandardMaterial({ color: 0x5c6875, roughness: 0.35, metalness: 0.78 });
    this.yellowSafetyMat = new THREE.MeshStandardMaterial({ color: 0xd99b26, roughness: 0.4, metalness: 0.4 });
    this.wireDrumMat = new THREE.MeshStandardMaterial({ color: 0x76828e, roughness: 0.38, metalness: 0.85 });
    this.windowEmissiveMat = new THREE.MeshStandardMaterial({
      color: 0x2a3542,
      emissive: new THREE.Color(0xffb454),
      emissiveIntensity: 1.35,
      roughness: 0.15,
      metalness: 0.6
    });
    this.beaconMat = new THREE.MeshStandardMaterial({
      color: 0x441010,
      emissive: new THREE.Color(0xff2211),
      emissiveIntensity: 0.0,
      roughness: 0.2
    });
  }

  _buildHull() {
    // Coordinate convention: +Z = Bow (forward), -Z = Stern (aft), Length = 25m (-12.5 to +12.5), Beam = 6m
    // Sculpted extruded hull cross-sections via custom BufferGeometry / composed shapes
    const lowerGeo = new THREE.BoxGeometry(5.8, 2.0, 21.5);
    const lowerMesh = new THREE.Mesh(lowerGeo, this.lowerHullMat);
    lowerMesh.position.set(0, -0.8, -0.8);
    this.hullGroup.add(lowerMesh);

    // Tapered bow section (lower)
    const bowLowerGeo = new THREE.ConeGeometry(3.0, 4.6, 4);
    bowLowerGeo.rotateY(Math.PI * 0.25);
    bowLowerGeo.rotateX(Math.PI * 0.5);
    bowLowerGeo.scale(0.96, 0.48, 1.0);
    const bowLower = new THREE.Mesh(bowLowerGeo, this.lowerHullMat);
    bowLower.position.set(0, -0.8, 11.4);
    this.hullGroup.add(bowLower);

    // Upper navy hull
    const upperGeo = new THREE.BoxGeometry(6.0, 1.6, 22.0);
    const upperMesh = new THREE.Mesh(upperGeo, this.upperHullMat);
    upperMesh.position.set(0, 0.9, -0.7);
    this.hullGroup.add(upperMesh);

    // Tapered upper bow
    const bowUpperGeo = new THREE.ConeGeometry(3.15, 4.8, 4);
    bowUpperGeo.rotateY(Math.PI * 0.25);
    bowUpperGeo.rotateX(Math.PI * 0.5);
    bowUpperGeo.scale(0.96, 0.40, 1.0);
    const bowUpper = new THREE.Mesh(bowUpperGeo, this.upperHullMat);
    bowUpper.position.set(0, 0.9, 11.6);
    this.hullGroup.add(bowUpper);

    // White stripe along gunwale
    const stripeGeo = new THREE.BoxGeometry(6.1, 0.22, 22.1);
    const stripe = new THREE.Mesh(stripeGeo, this.whitePaintMat);
    stripe.position.set(0, 1.55, -0.7);
    this.hullGroup.add(stripe);

    // Main working deck floor
    const deckGeo = new THREE.BoxGeometry(5.6, 0.16, 21.4);
    const deck = new THREE.Mesh(deckGeo, this.deckMat);
    deck.position.set(0, 1.72, -0.8);
    this.hullGroup.add(deck);

    // Bulwarks (side safety walls along aft & mid deck)
    const sideWallGeo = new THREE.BoxGeometry(0.18, 0.95, 20.8);
    const portWall = new THREE.Mesh(sideWallGeo, this.whitePaintMat);
    portWall.position.set(-2.92, 2.18, -0.9);
    const stbdWall = new THREE.Mesh(sideWallGeo, this.whitePaintMat);
    stbdWall.position.set(2.92, 2.18, -0.9);
    this.hullGroup.add(portWall, stbdWall);

    // Low stern transom gate
    const transom = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.55, 0.22), this.whitePaintMat);
    transom.position.set(0, 1.98, -11.6);
    this.hullGroup.add(transom);
  }

  _buildBridge() {
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(0, 1.8, 4.8);
    this.hullGroup.add(bridgeGroup);

    // Lower accommodation cabin
    const lowerCabin = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.4, 7.2), this.whitePaintMat);
    lowerCabin.position.set(0, 1.2, 0);
    bridgeGroup.add(lowerCabin);

    // Upper pilothouse / bridge
    const upperBridge = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.1, 4.8), this.whitePaintMat);
    upperBridge.position.set(0, 3.35, 0.4);
    bridgeGroup.add(upperBridge);

    // Warm emissive bridge windows (front, sides, aft observation)
    const frontWin = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.85, 0.12), this.windowEmissiveMat);
    frontWin.position.set(0, 3.55, 2.82);
    const aftWin = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.8, 0.12), this.windowEmissiveMat);
    aftWin.position.set(0, 3.55, -2.02);
    const sideWinL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 3.2), this.windowEmissiveMat);
    sideWinL.position.set(-2.22, 3.55, 0.4);
    const sideWinR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 3.2), this.windowEmissiveMat);
    sideWinR.position.set(2.22, 3.55, 0.4);
    bridgeGroup.add(frontWin, aftWin, sideWinL, sideWinR);

    // Smokestack / exhaust funnel
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 2.6, 12), this.yellowSafetyMat);
    stack.position.set(-1.3, 3.6, -2.4);
    bridgeGroup.add(stack);

    // Mast, rotating radar, GPS dome & searchlight
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 3.4, 10), this.steelMat);
    mast.position.set(0, 6.0, 0.6);
    bridgeGroup.add(mast);

    this.radarBar = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.12, 0.22), this.whitePaintMat);
    this.radarBar.position.set(0, 7.45, 0.6);
    bridgeGroup.add(this.radarBar);

    const gpsDome = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), this.whitePaintMat);
    gpsDome.position.set(1.1, 4.65, 1.5);
    bridgeGroup.add(gpsDome);

    // Navigation lights (Port Red, Starboard Green, Masthead White)
    const portNav = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    portNav.position.set(-2.35, 4.2, 1.6);
    const stbdNav = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), new THREE.MeshBasicMaterial({ color: 0x22ff55 }));
    stbdNav.position.set(2.35, 4.2, 1.6);
    const mastNav = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfff5dd }));
    mastNav.position.set(0, 7.8, 0.6);
    bridgeGroup.add(portNav, stbdNav, mastNav);
  }

  _buildAftDeckAndLights() {
    // Powerful LED floodlights illuminating the aft working deck & stern water
    const deckLightL = new THREE.PointLight(0xdaf0ff, 26, 22, 1.5);
    deckLightL.position.set(-2.0, 5.2, 1.2);
    this.hullGroup.add(deckLightL);

    const deckLightR = new THREE.PointLight(0xdaf0ff, 26, 22, 1.5);
    deckLightR.position.set(2.0, 5.2, 1.2);
    this.hullGroup.add(deckLightR);

    const sternSpot = new THREE.SpotLight(0xeef6ff, 55, 34, Math.PI / 3.2, 0.65, 1.3);
    sternSpot.position.set(0, 5.8, -1.5);
    sternSpot.target.position.set(0, 0.5, -14.0);
    this.hullGroup.add(sternSpot, sternSpot.target);

    // Visible lamp housings
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xe6f7ff });
    const lampL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.16), lampMat);
    lampL.position.set(-1.9, 5.15, 1.5);
    const lampR = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.16), lampMat);
    lampR.position.set(1.9, 5.15, 1.5);
    this.hullGroup.add(lampL, lampR);
  }

  _buildHydraulicWinch() {
    this.winchGroup = new THREE.Group();
    this.winchGroup.position.set(0, 1.82, -4.4);
    this.hullGroup.add(this.winchGroup);

    // Heavy steel pedestal frame
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.35, 2.2), this.steelMat);
    base.position.y = 0.175;
    this.winchGroup.add(base);

    const cheekL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.55, 1.8), this.yellowSafetyMat);
    cheekL.position.set(-1.15, 0.95, 0);
    const cheekR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.55, 1.8), this.yellowSafetyMat);
    cheekR.position.set(1.15, 0.95, 0);
    this.winchGroup.add(cheekL, cheekR);

    // Hydraulic drive motor block
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.85, 14), this.steelMat);
    motor.rotation.z = Math.PI * 0.5;
    motor.position.set(-1.62, 1.02, 0);
    this.winchGroup.add(motor);

    // Rotating wire drum
    this.winchDrum = new THREE.Group();
    this.winchDrum.position.set(0, 1.02, 0);
    this.winchGroup.add(this.winchDrum);

    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 1.95, 20), this.wireDrumMat);
    core.rotation.z = Math.PI * 0.5;
    this.winchDrum.add(core);

    const flangeGeo = new THREE.CylinderGeometry(0.84, 0.84, 0.08, 22);
    flangeGeo.rotateZ(Math.PI * 0.5);
    const flL = new THREE.Mesh(flangeGeo, this.yellowSafetyMat); flL.position.x = -0.96;
    const flR = new THREE.Mesh(flangeGeo, this.yellowSafetyMat); flR.position.x = 0.96;
    this.winchDrum.add(flL, flR);

    // Rib markers on drum so rotation is clearly visible
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const rib = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 0.06), this.steelMat);
      rib.position.set(0, Math.cos(a) * 0.6, Math.sin(a) * 0.6);
      this.winchDrum.add(rib);
    }

    // Overheat warning beacon on top of hydraulic housing
    this.warningBeacon = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.24, 12), this.beaconMat);
    this.warningBeacon.position.set(-1.15, 1.85, 0.45);
    this.winchGroup.add(this.warningBeacon);

    this.warningLight = new THREE.PointLight(0xff2200, 0, 8, 1.6);
    this.warningLight.position.set(-1.15, 2.1, 0.45);
    this.winchGroup.add(this.warningLight);
  }

  _buildAFrameCrane() {
    // Hinged at stern deck edge (-11.35)
    this.cranePivot = new THREE.Group();
    this.cranePivot.position.set(0, 1.85, -11.35);
    this.hullGroup.add(this.cranePivot);

    const legGeo = new THREE.BoxGeometry(0.32, 5.4, 0.36);
    const legL = new THREE.Mesh(legGeo, this.yellowSafetyMat);
    legL.position.set(-2.35, 2.6, 0);
    legL.rotation.z = -0.14;
    const legR = new THREE.Mesh(legGeo, this.yellowSafetyMat);
    legR.position.set(2.35, 2.6, 0);
    legR.rotation.z = 0.14;

    const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.42, 0.42), this.yellowSafetyMat);
    crossBeam.position.set(0, 5.2, 0);
    this.cranePivot.add(legL, legR, crossBeam);

    // Top sheave block (pulley)
    const sheaveHousing = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.68, 0.55), this.steelMat);
    sheaveHousing.position.set(0, 4.78, 0);
    this.cranePivot.add(sheaveHousing);

    const sheaveWheel = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.06, 8, 16), this.wireDrumMat);
    sheaveWheel.rotation.y = Math.PI * 0.5;
    sheaveWheel.position.set(0, 4.6, 0);
    this.cranePivot.add(sheaveWheel);

    this.sheaveAnchor = new THREE.Object3D();
    this.sheaveAnchor.position.set(0, 4.35, 0);
    this.cranePivot.add(this.sheaveAnchor);

    // Hydraulic cylinders (visual linkage)
    const cylGeo = new THREE.CylinderGeometry(0.11, 0.13, 2.6, 10);
    const cylL = new THREE.Mesh(cylGeo, this.steelMat);
    cylL.position.set(-2.45, 1.2, 0.95);
    cylL.rotation.x = -0.58;
    const cylR = new THREE.Mesh(cylGeo, this.steelMat);
    cylR.position.set(2.45, 1.2, 0.95);
    cylR.rotation.x = -0.58;
    this.cranePivot.add(cylL, cylR);
  }

  _buildPropellerRef() {
    this.propellerAnchor = new THREE.Object3D();
    this.propellerAnchor.position.set(0, -1.65, -10.8);
    this.hullGroup.add(this.propellerAnchor);
  }

  _buildSteamParticles() {
    this.STEAM_COUNT = 60;
    this.steamPos = new Float32Array(this.STEAM_COUNT * 3);
    this.steamVel = new Float32Array(this.STEAM_COUNT * 3);
    this.steamAge = new Float32Array(this.STEAM_COUNT);
    for (let i = 0; i < this.STEAM_COUNT; i++) {
      this.steamAge[i] = 99;
      this.steamPos[i * 3 + 1] = -999;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.steamPos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xd8e8f5, size: 0.42, transparent: true, opacity: 0.45, depthWrite: false
    });
    this.steamPoints = new THREE.Points(geo, mat);
    this.winchGroup.add(this.steamPoints);
    this.steamCursor = 0;
  }

  setWinchState(speed, tempNormalized) {
    this.winchSpeed = speed;
    this.winchTempNorm = THREE.MathUtils.clamp(tempNormalized, 0, 1);
  }

  setCraneAngle(normalizedAngle) {
    this.targetCraneAngle = THREE.MathUtils.clamp(normalizedAngle, 0, 1);
  }

  getSheaveWorldPosition(outVec) {
    this.sheaveAnchor.getWorldPosition(outVec);
    return outVec;
  }

  getPropellerWorldPosition(outVec) {
    this.propellerAnchor.getWorldPosition(outVec);
    return outVec;
  }

  update(dt, waveHeight = 0, wavePitch = 0, waveRoll = 0) {
    const safeDt = Math.min(0.05, Math.max(0.001, dt));
    this.time += safeDt;

    // Radar sweep
    this.radarBar.rotation.y += safeDt * 2.4;

    // Smooth wave heave, pitch, roll
    this.hullGroup.position.y = THREE.MathUtils.lerp(this.hullGroup.position.y, waveHeight, Math.min(1, safeDt * 4.0));
    this.hullGroup.rotation.x = THREE.MathUtils.lerp(this.hullGroup.rotation.x, wavePitch, Math.min(1, safeDt * 3.5));
    this.hullGroup.rotation.z = THREE.MathUtils.lerp(this.hullGroup.rotation.z, waveRoll, Math.min(1, safeDt * 3.5));

    // Winch drum rotation
    this.winchDrum.rotation.x += this.winchSpeed * safeDt * 5.2;

    // Overheat beacon & steam particles (> 0.8 normalized temp)
    if (this.winchTempNorm > 0.78) {
      const blink = Math.sin(this.time * 14.0) * 0.5 + 0.5;
      this.beaconMat.emissiveIntensity = 1.5 + blink * 2.5;
      this.warningLight.intensity = blink * 14.0;

      if (Math.random() < safeDt * 28) {
        const idx = this.steamCursor;
        this.steamCursor = (this.steamCursor + 1) % this.STEAM_COUNT;
        this.steamPos[idx * 3]     = -1.4 + (Math.random() - 0.5) * 0.5;
        this.steamPos[idx * 3 + 1] = 1.3;
        this.steamPos[idx * 3 + 2] = (Math.random() - 0.5) * 0.5;
        this.steamVel[idx * 3]     = (Math.random() - 0.5) * 0.4;
        this.steamVel[idx * 3 + 1] = 1.2 + Math.random() * 0.9;
        this.steamVel[idx * 3 + 2] = (Math.random() - 0.5) * 0.4;
        this.steamAge[idx] = 0;
      }
    } else {
      this.beaconMat.emissiveIntensity = 0;
      this.warningLight.intensity = 0;
    }

    for (let i = 0; i < this.STEAM_COUNT; i++) {
      if (this.steamAge[i] > 1.6) continue;
      this.steamAge[i] += safeDt;
      if (this.steamAge[i] > 1.6) {
        this.steamPos[i * 3 + 1] = -999;
        continue;
      }
      this.steamPos[i * 3] += this.steamVel[i * 3] * safeDt;
      this.steamPos[i * 3 + 1] += this.steamVel[i * 3 + 1] * safeDt;
      this.steamPos[i * 3 + 2] += this.steamVel[i * 3 + 2] * safeDt;
    }
    this.steamPoints.geometry.attributes.position.needsUpdate = true;

    // A-Frame crane smooth tilt: 0 = stowed (slightly forward +0.18 rad), 1 = deployed aft (-55 deg = -0.96 rad)
    this.currentCraneAngle = THREE.MathUtils.lerp(this.currentCraneAngle, this.targetCraneAngle, Math.min(1, safeDt * 2.5));
    this.cranePivot.rotation.x = THREE.MathUtils.lerp(0.15, -0.96, this.currentCraneAngle);
  }
}
