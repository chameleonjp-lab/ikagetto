import * as THREE from 'three';

// v2.1 High-Detail Procedural Models for 10-Step Giant Squid Ajillo Cooking
// Features sculpted LatheGeometry ingredients (mushrooms with gills, garlic cloves, ribbed cherry tomatoes,
// sucker-lined giant squid medallions), golden shimmering olive oil, physical stirring/tumbling,
// live doneness color transitions, and raining salt & black pepper particles.
export class CookingStageModels {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);

    this.time = 0;
    this.flameLevel = 0.0;
    this.oilLevel = 0.0;
    this.isPouring = false;
    this.isBurnt = false;
    this.isSimmering = false;
    this.knifeChop = 0;
    this.knifeTargetX = 0.2;
    this.knifeTargetZ = 0.2;
    this.stirPhase = 0;
    this.cookProgress = 0; // 0..1.35 live doneness during Step 8
    this.garlicHeat = 0;   // 0..1.2 live garlic browning during Step 6
    this.millGrinding = 0; // >0 spawns falling salt & pepper rain

    this._createTextures();
    this._createMaterials();
    this._buildKitchenAndTools();
    this._buildFlameShader();
    this._buildSkilletIngredients();
    this._buildBubblesAndSmoke();
    this._buildSeasoningRain();
  }

  _createTextures() {
    // 1. Hinoki Wood Cutting Board Grain
    const wc = document.createElement('canvas');
    wc.width = 512; wc.height = 256;
    const wctx = wc.getContext('2d');
    const wg = wctx.createLinearGradient(0, 0, 512, 0);
    wg.addColorStop(0, '#ddb680');
    wg.addColorStop(0.5, '#e7c491');
    wg.addColorStop(1, '#d6ac74');
    wctx.fillStyle = wg;
    wctx.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 65; i++) {
      wctx.strokeStyle = `rgba(145, 95, 45, ${0.06 + (i % 4) * 0.025})`;
      wctx.lineWidth = 1 + (i % 3);
      const y = (i / 65) * 256;
      wctx.beginPath();
      wctx.moveTo(0, y);
      wctx.bezierCurveTo(170, y + Math.sin(i) * 6, 340, y - Math.cos(i) * 6, 512, y);
      wctx.stroke();
    }
    this.woodTex = new THREE.CanvasTexture(wc);
    this.woodTex.colorSpace = THREE.SRGBColorSpace;

    // 2. Crimson Speckled Giant Squid Skin
    const sc = document.createElement('canvas');
    sc.width = 256; sc.height = 256;
    const sctx = sc.getContext('2d');
    sctx.fillStyle = '#bd474c';
    sctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 240; i++) {
      const x = (i * 53) % 256;
      const y = (i * 97) % 256;
      const r = 2 + (i % 5);
      sctx.fillStyle = i % 3 === 0 ? 'rgba(255, 224, 218, 0.32)' : 'rgba(115, 20, 28, 0.45)';
      sctx.beginPath();
      sctx.arc(x, y, r, 0, Math.PI * 2);
      sctx.fill();
    }
    this.skinTex = new THREE.CanvasTexture(sc);
    this.skinTex.colorSpace = THREE.SRGBColorSpace;

    // 3. Pearlescent Cross-Hatched Squid Flesh
    const fc = document.createElement('canvas');
    fc.width = 256; fc.height = 256;
    const fctx = fc.getContext('2d');
    fctx.fillStyle = '#fff3ed';
    fctx.fillRect(0, 0, 256, 256);
    fctx.strokeStyle = 'rgba(218, 178, 170, 0.45)';
    fctx.lineWidth = 3;
    for (let i = -256; i < 512; i += 28) {
      fctx.beginPath(); fctx.moveTo(i, 0); fctx.lineTo(i + 256, 256); fctx.stroke();
      fctx.beginPath(); fctx.moveTo(i + 256, 0); fctx.lineTo(i, 256); fctx.stroke();
    }
    this.fleshTex = new THREE.CanvasTexture(fc);
    this.fleshTex.colorSpace = THREE.SRGBColorSpace;
  }

  _createMaterials() {
    this.castIronMat = new THREE.MeshStandardMaterial({ color: 0x2c323b, roughness: 0.56, metalness: 0.45 });
    this.steelMat = new THREE.MeshStandardMaterial({ color: 0xe6eff8, roughness: 0.14, metalness: 0.90 });
    this.boardMat = new THREE.MeshStandardMaterial({ map: this.woodTex, roughness: 0.62 });
    this.oilMat = new THREE.MeshPhysicalMaterial({
      color: 0xf4c430,
      emissive: 0x3b2600,
      emissiveIntensity: 0.25,
      roughness: 0.06,
      metalness: 0.05,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.88
    });
    this.burntOilMat = new THREE.MeshPhysicalMaterial({ color: 0x2c1b0c, roughness: 0.22, clearcoat: 0.85, transparent: true, opacity: 0.94 });
    this.glassMat = new THREE.MeshPhysicalMaterial({ color: 0x9ce2a4, roughness: 0.06, transparent: true, opacity: 0.52, clearcoat: 1.0 });

    this.squidSkinMat = new THREE.MeshPhysicalMaterial({ map: this.skinTex, roughness: 0.22, clearcoat: 0.95 });
    this.squidRawMat = new THREE.MeshPhysicalMaterial({ color: 0xf5d6d2, roughness: 0.18, clearcoat: 0.95, transparent: true, opacity: 0.92 });
    this.squidLiveMat = new THREE.MeshPhysicalMaterial({ map: this.fleshTex, color: 0xf8dcd8, roughness: 0.18, clearcoat: 0.98 });
    this.squidCookedMat = new THREE.MeshPhysicalMaterial({ map: this.fleshTex, color: 0xfff8f2, roughness: 0.14, clearcoat: 1.0, sheen: 0.5, sheenColor: new THREE.Color(0xff9a82) });
    this.squidBurntMat = new THREE.MeshStandardMaterial({ color: 0x221713, roughness: 0.88 });

    this.garlicRawMat = new THREE.MeshStandardMaterial({ color: 0xfaf2d8, roughness: 0.40 });
    this.garlicLiveMat = new THREE.MeshStandardMaterial({ color: 0xfaf2d8, roughness: 0.36 });
    this.garlicGoldenMat = new THREE.MeshStandardMaterial({ color: 0xe39b2d, roughness: 0.30 });
    this.garlicBurntMat = new THREE.MeshStandardMaterial({ color: 0x1c140e, roughness: 0.90 });

    this.chiliMat = new THREE.MeshPhysicalMaterial({ color: 0xe22626, roughness: 0.22, clearcoat: 0.7 });
    this.mushroomCapMat = new THREE.MeshStandardMaterial({ color: 0xe5d5c0, roughness: 0.55 });
    this.mushroomGillMat = new THREE.MeshStandardMaterial({ color: 0x6b5344, roughness: 0.85 });
    this.tomatoMat = new THREE.MeshPhysicalMaterial({ color: 0xed2b3a, roughness: 0.10, clearcoat: 1.0 });
    this.calyxMat = new THREE.MeshStandardMaterial({ color: 0x2e8c3e, roughness: 0.55 });
    this.parsleyMat = new THREE.MeshStandardMaterial({ color: 0x2bb84a, roughness: 0.48 });
    this.saltMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
    this.pepperMat = new THREE.MeshStandardMaterial({ color: 0x1e1a18, roughness: 0.72 });
    this.baguetteCrustMat = new THREE.MeshStandardMaterial({ color: 0xc98234, roughness: 0.68 });
    this.baguetteCrumbMat = new THREE.MeshStandardMaterial({ color: 0xf6e3b8, roughness: 0.82 });
  }

  _buildMushroomMesh(scale = 1.0) {
    const g = new THREE.Group();
    // Sculpted mushroom cap via LatheGeometry
    const capPts = [
      new THREE.Vector2(0.001, 0.16),
      new THREE.Vector2(0.11, 0.15),
      new THREE.Vector2(0.19, 0.08),
      new THREE.Vector2(0.20, 0.0),
      new THREE.Vector2(0.14, -0.02)
    ];
    const cap = new THREE.Mesh(new THREE.LatheGeometry(capPts, 18), this.mushroomCapMat);
    const gills = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.08, 0.04, 16), this.mushroomGillMat);
    gills.position.y = -0.02;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.085, 0.16, 12), this.mushroomCapMat);
    stem.position.y = -0.10;
    g.add(cap, gills, stem);
    g.scale.setScalar(scale);
    return g;
  }

  _buildTomatoMesh(scale = 1.0) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), this.tomatoMat);
    body.scale.set(1.06, 0.92, 1.06);
    g.add(body);
    // Green 5-leaf star calyx on top
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.08, 5), this.calyxMat);
      leaf.position.set(Math.cos(a) * 0.035, 0.135, Math.sin(a) * 0.035);
      leaf.rotation.set(0.95, a, 0);
      g.add(leaf);
    }
    g.scale.setScalar(scale);
    return g;
  }

  _buildGarlicCloveMesh(scale = 1.0) {
    const pts = [
      new THREE.Vector2(0.001, -0.10),
      new THREE.Vector2(0.12, -0.08),
      new THREE.Vector2(0.15, 0.0),
      new THREE.Vector2(0.10, 0.12),
      new THREE.Vector2(0.02, 0.22),
      new THREE.Vector2(0.001, 0.24)
    ];
    const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), this.garlicRawMat);
    m.scale.set(1.0, 1.0, 0.72);
    m.scale.multiplyScalar(scale);
    return m;
  }

  _buildSquidMedallion() {
    const p = new THREE.Group();
    // Thick giant squid arm cross-section with pearlescent scored top + crimson speckled outer skin
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.32, 0.20, 20), this.squidLiveMat);
    const skin = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.335, 0.19, 20, 1, true), this.squidSkinMat);
    p.add(core, skin);
    // 3 stalked 3D cup suckers protruding around the rim
    for (let s = 0; s < 3; s++) {
      const a = s * 1.15 - 0.8;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.062, 0.085, 12), this.squidLiveMat);
      stalk.position.set(Math.cos(a) * 0.32, 0.03, Math.sin(a) * 0.32);
      stalk.rotation.z = -Math.cos(a) * 1.2;
      stalk.rotation.x = Math.sin(a) * 1.2;
      const cup = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.020, 8, 14), this.squidLiveMat);
      cup.position.set(Math.cos(a) * 0.375, 0.04, Math.sin(a) * 0.375);
      cup.lookAt(Math.cos(a) * 0.5, 0.06, Math.sin(a) * 0.5);
      p.add(stalk, cup);
    }
    return p;
  }

  _buildKitchenAndTools() {
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x262d38, roughness: 0.48, metalness: 0.15 })
    );
    counter.position.set(0, -0.35, 0);
    this.root.add(counter);

    // Gas Stove Burner
    this.stoveGroup = new THREE.Group();
    const burnerBase = new THREE.Mesh(new THREE.CylinderGeometry(1.48, 1.60, 0.14, 28), this.castIronMat);
    burnerBase.position.y = -0.06;
    this.stoveGroup.add(burnerBase);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const grate = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 1.38), this.castIronMat);
      grate.position.set(Math.sin(a) * 0.92, 0.04, Math.cos(a) * 0.92);
      grate.rotation.y = a;
      this.stoveGroup.add(grate);
    }
    this.root.add(this.stoveGroup);

    // Sculpted Cast-Iron Skillet
    this.skilletGroup = new THREE.Group();
    this.skilletGroup.position.set(0, 0.24, 0);
    const panPts = [
      new THREE.Vector2(0.001, -0.22),
      new THREE.Vector2(1.62, -0.22),
      new THREE.Vector2(1.78, -0.14),
      new THREE.Vector2(1.92, 0.24),
      new THREE.Vector2(2.00, 0.26),
      new THREE.Vector2(1.86, 0.26),
      new THREE.Vector2(1.72, -0.12),
      new THREE.Vector2(1.58, -0.18),
      new THREE.Vector2(0.001, -0.18)
    ];
    const panBody = new THREE.Mesh(new THREE.LatheGeometry(panPts, 40), this.castIronMat);
    const panHandle = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.09, 0.26), this.castIronMat);
    panHandle.position.set(2.35, 0.18, 0); panHandle.rotation.z = 0.12;
    const handleHole = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 8, 16), this.castIronMat);
    handleHole.rotation.x = Math.PI * 0.5;
    handleHole.position.set(3.05, 0.27, 0);
    this.skilletGroup.add(panBody, panHandle, handleHole);

    // Golden Olive Oil Surface
    this.oilMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.78, 1.66, 0.07, 36), this.oilMat);
    this.oilMesh.position.y = -0.16;
    this.oilMesh.visible = false;
    this.skilletGroup.add(this.oilMesh);
    this.root.add(this.skilletGroup);

    // Cutting Board Prep Stage (Steps 1–4)
    this.prepGroup = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.18, 2.7), this.boardMat);
    board.position.set(0, 0.06, 0.2);
    this.prepGroup.add(board);

    // 6-segment tapered giant squid arm with speckled skin, pearlescent flesh, and 3D cup suckers
    this.armSliceBlocks = [];
    for (let i = 0; i < 6; i++) {
      const seg = new THREE.Group();
      const rL = 0.56 - i * 0.035;
      const rR = 0.56 - (i + 1) * 0.035;
      const core = new THREE.Mesh(new THREE.CylinderGeometry(rR * 0.90, rL * 0.90, 0.46, 22), this.squidRawMat);
      core.rotation.z = Math.PI * 0.5;
      const outer = new THREE.Mesh(new THREE.CylinderGeometry(rR, rL, 0.44, 22, 1, true), this.squidSkinMat);
      outer.rotation.z = Math.PI * 0.5;
      seg.add(core, outer);
      // Giant golf-ball-sized 3D cup suckers along the massive giant squid arm!
      for (let s = 0; s < 2; s++) {
        const cup = new THREE.Mesh(new THREE.TorusGeometry(0.088 - i * 0.006, 0.028, 10, 16), this.squidRawMat);
        cup.position.set((s - 0.5) * 0.21, rL * 0.94, 0.16);
        cup.rotation.x = Math.PI * 0.45;
        seg.add(cup);
      }
      seg.position.set(-1.12 + i * 0.45, 0.52, 0.18);
      this.prepGroup.add(seg);
      this.armSliceBlocks.push(seg);
    }

    // Crisp cross-hatch score grooves (Step 1: appear progressively!)
    this.scoreSlash1 = new THREE.Group();
    this.scoreSlash2 = new THREE.Group();
    const grooveMat = new THREE.MeshStandardMaterial({ color: 0xfff8f4, emissive: 0xffe4d8, emissiveIntensity: 0.25 });
    for (let i = 0; i < 6; i++) {
      const x = -1.10 + i * 0.44;
      const m1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.032), grooveMat);
      m1.position.set(x, 1.04 - i * 0.032, 0.18);
      m1.rotation.y = 0.68;
      this.scoreSlash1.add(m1);

      const m2 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.032), grooveMat);
      m2.position.set(x, 1.04 - i * 0.032, 0.18);
      m2.rotation.y = -0.68;
      this.scoreSlash2.add(m2);
    }
    this.scoreSlash1.visible = false;
    this.scoreSlash2.visible = false;
    this.prepGroup.add(this.scoreSlash1, this.scoreSlash2);

    // Scale reference: normal cherry tomatoes & garlic clove beside the colossal giant squid arm!
    this.scaleRefGroup = new THREE.Group();
    const refTom1 = this._buildTomatoMesh(0.72);
    refTom1.position.set(-1.95, 0.25, 1.05);
    const refTom2 = this._buildTomatoMesh(0.68);
    refTom2.position.set(-1.62, 0.24, 1.12);
    const refGar = this._buildGarlicCloveMesh(0.75);
    refGar.position.set(1.85, 0.24, 1.05);
    this.scaleRefGroup.add(refTom1, refTom2, refGar);
    this.prepGroup.add(this.scaleRefGroup);

    // Gleaming Chef Knife (Santoku / Gyuto)
    this.chefKnife = new THREE.Group();
    const kh = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.13, 0.11), new THREE.MeshStandardMaterial({ color: 0x2a1f1a, roughness: 0.42 }));
    kh.position.x = 0.34;
    const bolster = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.115), this.steelMat);
    bolster.position.x = -0.02;
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, 0.11);
    bladeShape.lineTo(-1.15, 0.09);
    bladeShape.quadraticCurveTo(-1.38, 0.04, -1.42, -0.14);
    bladeShape.lineTo(0, -0.15);
    bladeShape.closePath();
    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.024, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 2 });
    bladeGeo.translate(0, 0, -0.012);
    const kb = new THREE.Mesh(bladeGeo, this.steelMat);
    this.chefKnife.add(kh, bolster, kb);
    this.chefKnife.position.set(1.2, 0.92, 0.45);
    this.chefKnife.rotation.set(0.20, -0.25, -0.12);
    this.prepGroup.add(this.chefKnife);

    // Step 3: Garlic Cloves + Minced Garlic Pile
    this.prepGarlicGroup = new THREE.Group();
    this.prepGarlicCloves = [];
    for (let i = 0; i < 3; i++) {
      const clove = this._buildGarlicCloveMesh(1.45);
      clove.position.set((i - 1) * 0.45, 0.26, 0.2 + (i % 2) * 0.14);
      clove.rotation.z = (i - 1) * 0.4;
      this.prepGarlicGroup.add(clove);
      this.prepGarlicCloves.push(clove);
    }
    this.mincedGarlicBits = [];
    for (let i = 0; i < 24; i++) {
      const bit = new THREE.Mesh(new THREE.DodecahedronGeometry(0.055), this.garlicRawMat);
      const a = (i / 24) * Math.PI * 2;
      const r = 0.12 + (i % 4) * 0.16;
      bit.position.set(Math.cos(a) * r, 0.20, 0.2 + Math.sin(a) * r * 0.75);
      bit.visible = false;
      this.prepGarlicGroup.add(bit);
      this.mincedGarlicBits.push(bit);
    }
    this.prepGarlicGroup.visible = false;
    this.prepGroup.add(this.prepGarlicGroup);

    // Step 4: Veggies on Board (Chili, Mushroom, Cherry Tomato)
    this.prepVeggiesGroup = new THREE.Group();
    // Chili on left
    const chiliCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.35, 0.26, 0.22),
      new THREE.Vector3(-1.05, 0.30, 0.12),
      new THREE.Vector3(-0.75, 0.25, 0.28)
    ]);
    this.prepChili = new THREE.Mesh(new THREE.TubeGeometry(chiliCurve, 14, 0.075, 10, false), this.chiliMat);
    // Mushroom in center
    this.prepMushroom = this._buildMushroomMesh(1.7);
    this.prepMushroom.position.set(0.0, 0.40, 0.22);
    // Tomato on right
    this.prepTomato = this._buildTomatoMesh(1.65);
    this.prepTomato.position.set(1.05, 0.38, 0.22);
    this.prepVeggiesGroup.add(this.prepChili, this.prepMushroom, this.prepTomato);
    this.prepVeggiesGroup.visible = false;
    this.prepGroup.add(this.prepVeggiesGroup);

    this.root.add(this.prepGroup);

    // Step 5: Glass Olive Oil Bottle + Glossy Pouring Stream
    this.oilBottle = new THREE.Group();
    const bBody = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 1.02, 20), this.glassMat);
    const bLiq = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.24, 0.76, 18), this.oilMat);
    bLiq.position.y = -0.10;
    const bNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.14, 0.42, 16), this.glassMat);
    bNeck.position.y = 0.70;
    const bSpout = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.065, 0.18, 12), this.steelMat);
    bSpout.position.y = 0.96;
    this.oilBottle.add(bBody, bLiq, bNeck, bSpout);
    this.oilBottle.position.set(1.65, 1.48, -0.12);
    this.oilBottle.visible = false;
    this.root.add(this.oilBottle);

    this.oilStream = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.048, 1.55, 12), this.oilMat);
    this.oilStream.position.set(0.58, 0.85, -0.10);
    this.oilStream.rotation.z = 0.24;
    this.oilStream.visible = false;
    this.root.add(this.oilStream);

    // Step 8: Sculpted Stainless Steel Tongs
    this.tongs = new THREE.Group();
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.045, 0.09), this.steelMat); t1.position.y = 0.07; t1.rotation.z = -0.06;
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.045, 0.09), this.steelMat); t2.position.y = -0.07; t2.rotation.z = 0.06;
    const tip1 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), this.steelMat); tip1.scale.set(1.3, 0.35, 1.0); tip1.position.set(-0.74, 0.03, 0);
    const tip2 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), this.steelMat); tip2.scale.set(1.3, 0.35, 1.0); tip2.position.set(-0.74, -0.03, 0);
    this.tongs.add(t1, t2, tip1, tip2);
    this.tongs.position.set(1.25, 0.95, 0.45);
    this.tongs.rotation.set(0.32, -0.45, -0.42);
    this.tongs.visible = false;
    this.root.add(this.tongs);

    // Step 9: Lathe-Turned Salt & Black Pepper Mills
    const millPts = [
      new THREE.Vector2(0.001, -0.42),
      new THREE.Vector2(0.20, -0.42),
      new THREE.Vector2(0.18, -0.25),
      new THREE.Vector2(0.13, 0.0),
      new THREE.Vector2(0.17, 0.26),
      new THREE.Vector2(0.15, 0.38),
      new THREE.Vector2(0.001, 0.40)
    ];
    const millGeo = new THREE.LatheGeometry(millPts, 20);
    this.saltMill = new THREE.Group();
    const smBody = new THREE.Mesh(millGeo, this.boardMat);
    const smKnob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), this.steelMat); smKnob.position.y = 0.48;
    this.saltMill.add(smBody, smKnob);
    this.saltMill.position.set(-0.42, 1.52, 0);
    this.saltMill.visible = false;
    this.root.add(this.saltMill);

    this.pepperMill = new THREE.Group();
    const pmBody = new THREE.Mesh(millGeo, new THREE.MeshStandardMaterial({ color: 0x4a2c1c, roughness: 0.45 }));
    const pmKnob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), this.castIronMat); pmKnob.position.y = 0.48;
    this.pepperMill.add(pmBody, pmKnob);
    this.pepperMill.position.set(0.42, 1.52, 0);
    this.pepperMill.visible = false;
    this.root.add(this.pepperMill);

    // Step 10 & Result: Baguette Plate
    this.baguetteGroup = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 0.88, 0.08, 28), new THREE.MeshStandardMaterial({ color: 0xf4f6f9, roughness: 0.22 }));
    this.baguetteGroup.add(plate);
    for (let i = 0; i < 4; i++) {
      const sl = new THREE.Group();
      const crust = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.085, 18), this.baguetteCrustMat);
      const crumb = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.092, 18), this.baguetteCrumbMat);
      sl.add(crust, crumb);
      sl.scale.set(1.32, 1.0, 0.82);
      sl.position.set(-0.34 + i * 0.23, 0.09 + i * 0.03, (i % 2 - 0.5) * 0.16);
      sl.rotation.z = -0.22;
      this.baguetteGroup.add(sl);
    }
    this.baguetteGroup.position.set(-2.25, -0.06, 0.65);
    this.baguetteGroup.visible = false;
    this.root.add(this.baguetteGroup);
  }

  _buildFlameShader() {
    this.flameUniforms = { uTime: { value: 0 }, uIntensity: { value: 0.0 } };
    const geo = new THREE.CylinderGeometry(1.18, 0.94, 0.48, 28, 4, true);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.flameUniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `
        uniform float uTime; uniform float uIntensity; varying vec2 vUv;
        void main() {
          vUv = uv; vec3 p = position;
          p.y *= (0.4 + 1.25 * uIntensity);
          p.x += sin(uv.x * 36.0 + uTime * 16.0) * 0.08 * uv.y * uIntensity;
          p.z += cos(uv.x * 28.0 - uTime * 14.0) * 0.06 * uv.y * uIntensity;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uIntensity; varying vec2 vUv;
        void main() {
          if (uIntensity < 0.03) discard;
          vec3 col = mix(vec3(0.18, 0.68, 1.0), vec3(1.0, 0.44, 0.08), clamp((uIntensity - 0.54) * 1.45, 0.0, 1.0));
          float alpha = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.15, vUv.y) * min(1.0, uIntensity * 1.25);
          gl_FragColor = vec4(col, alpha * 0.88);
        }
      `
    });
    this.flameMesh = new THREE.Mesh(geo, mat);
    this.flameMesh.position.set(0, 0.14, 0);
    this.root.add(this.flameMesh);
  }

  _buildSkilletIngredients() {
    this.ingredientsGroup = new THREE.Group();
    this.skilletGroup.add(this.ingredientsGroup);

    this.squidPieces = [];
    this.garlicSlices = [];
    this.mushrooms = [];
    this.tomatoes = [];
    this.chilis = [];
    this.parsleyBits = [];
    this.pepperGrains = [];
    this.saltPile = [];
    this._swirlItems = []; // { obj, baseAngle, radius, baseY, phase }

    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.2;
      const r = (i === 0 ? 0.0 : 0.78 + (i % 2) * 0.34);
      const p = this._buildSquidMedallion();
      p.position.set(Math.cos(a) * r, -0.06, Math.sin(a) * r);
      p.rotation.set(0.18 * (i % 3), a, 0.12);
      p.visible = false;
      this.ingredientsGroup.add(p);
      this.squidPieces.push(p);
      this._swirlItems.push({ obj: p, baseAngle: a, radius: r, baseY: -0.06, phase: i * 0.7 });
    }

    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = 0.26 + (i % 4) * 0.28;
      const g = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.022, 12), this.garlicLiveMat);
      g.scale.set(1.2, 1.0, 0.85);
      g.position.set(Math.cos(a) * r, -0.10, Math.sin(a) * r);
      g.visible = false;
      this.ingredientsGroup.add(g);
      this.garlicSlices.push(g);
      this._swirlItems.push({ obj: g, baseAngle: a, radius: r, baseY: -0.10, phase: i * 0.5 });
    }

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.52;
      const m = this._buildMushroomMesh(0.78);
      m.position.set(Math.cos(a) * 0.86, -0.03, Math.sin(a) * 0.86);
      m.rotation.set(0.35, a, 0.2);
      m.visible = false;
      this.ingredientsGroup.add(m);
      this.mushrooms.push(m);
      this._swirlItems.push({ obj: m, baseAngle: a, radius: 0.86, baseY: -0.03, phase: i * 1.1 });
    }

    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.15;
      const t = this._buildTomatoMesh(0.74);
      t.position.set(Math.cos(a) * 0.65, -0.02, Math.sin(a) * 0.65);
      t.visible = false;
      this.ingredientsGroup.add(t);
      this.tomatoes.push(t);
      this._swirlItems.push({ obj: t, baseAngle: a, radius: 0.65, baseY: -0.02, phase: i * 1.3 });
    }

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = 0.36 + (i % 3) * 0.30;
      const ch = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.024, 8, 14), this.chiliMat);
      ch.rotation.x = Math.PI * 0.5;
      ch.position.set(Math.cos(a) * r, -0.06, Math.sin(a) * r);
      ch.visible = false;
      this.ingredientsGroup.add(ch);
      this.chilis.push(ch);
      this._swirlItems.push({ obj: ch, baseAngle: a, radius: r, baseY: -0.06, phase: i * 0.9 });
    }

    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 + (i % 3) * 0.4;
      const r = 0.15 + ((i * 37) % 100) * 0.010;
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.016, 0.055), this.parsleyMat);
      p.position.set(Math.cos(a) * r, 0.08, Math.sin(a) * r);
      p.rotation.y = a;
      p.visible = false;
      this.ingredientsGroup.add(p);
      this.parsleyBits.push(p);
    }

    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = 0.18 + ((i * 43) % 100) * 0.009;
      const pg = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 6), this.pepperMat);
      pg.position.set(Math.cos(a) * r, 0.07, Math.sin(a) * r);
      pg.visible = false;
      this.ingredientsGroup.add(pg);
      this.pepperGrains.push(pg);
    }

    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const r = 0.16 + ((i * 29) % 100) * 0.009;
      const sl = new THREE.Mesh(new THREE.DodecahedronGeometry(0.048), this.saltMat);
      sl.position.set(Math.cos(a) * r, 0.08, Math.sin(a) * r);
      sl.visible = false;
      this.ingredientsGroup.add(sl);
      this.saltPile.push(sl);
    }
  }

  _buildBubblesAndSmoke() {
    this.FX_COUNT = 96;
    this.fxPos = new Float32Array(this.FX_COUNT * 3);
    this.fxVel = new Float32Array(this.FX_COUNT * 3);
    for (let i = 0; i < this.FX_COUNT; i++) {
      this.fxPos[i * 3] = (Math.random() - 0.5) * 2.2;
      this.fxPos[i * 3 + 1] = -99;
      this.fxPos[i * 3 + 2] = (Math.random() - 0.5) * 2.2;
      this.fxVel[i * 3 + 1] = 0.65 + Math.random() * 0.95;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.fxPos, 3));
    this.fxMat = new THREE.PointsMaterial({ color: 0xfff3d4, size: 0.22, transparent: true, opacity: 0.58, depthWrite: false });
    this.fxPoints = new THREE.Points(geo, this.fxMat);
    this.skilletGroup.add(this.fxPoints);
  }

  _buildSeasoningRain() {
    this.RAIN_COUNT = 50;
    this.rainPos = new Float32Array(this.RAIN_COUNT * 3);
    this.rainCol = new Float32Array(this.RAIN_COUNT * 3);
    this.rainVel = new Float32Array(this.RAIN_COUNT);
    for (let i = 0; i < this.RAIN_COUNT; i++) {
      this.rainPos[i * 3 + 1] = -99;
      this.rainVel[i] = 1.6 + Math.random() * 1.1;
      const isSalt = i % 2 === 0;
      this.rainCol[i * 3] = isSalt ? 1.0 : 0.12;
      this.rainCol[i * 3 + 1] = isSalt ? 1.0 : 0.10;
      this.rainCol[i * 3 + 2] = isSalt ? 1.0 : 0.08;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.rainCol, 3));
    const mat = new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, opacity: 0.95 });
    this.rainPoints = new THREE.Points(geo, mat);
    this.root.add(this.rainPoints);
  }

  resetForCooking() {
    this.flameLevel = 0;
    this.oilLevel = 0;
    this.isPouring = false;
    this.isBurnt = false;
    this.isSimmering = false;
    this.stirPhase = 0;
    this.cookProgress = 0;
    this.garlicHeat = 0;
    this.millGrinding = 0;

    this.squidLiveMat.color.setHex(0xf8dcd8);
    this.garlicLiveMat.color.setHex(0xfaf2d8);
    this.oilMesh.material = this.oilMat;

    this.prepGroup.visible = true;
    this.skilletGroup.visible = false;
    this.stoveGroup.visible = false;
    this.oilMesh.visible = false;
    this.oilBottle.visible = false;
    this.oilStream.visible = false;
    this.tongs.visible = false;
    this.saltMill.visible = false;
    this.pepperMill.visible = false;
    this.baguetteGroup.visible = false;
    this.scoreSlash1.visible = false;
    this.scoreSlash2.visible = false;
    this.prepGarlicGroup.visible = false;
    this.prepVeggiesGroup.visible = false;

    this.armSliceBlocks.forEach((b, i) => {
      b.visible = true;
      b.position.set(-1.12 + i * 0.45, 0.52, 0.18);
      b.rotation.set(0, 0, 0);
    });
    this.prepGarlicCloves.forEach((c, i) => {
      c.visible = true;
      c.scale.set(1.45, 1.45, 1.45 * 0.72);
      c.position.set((i - 1) * 0.45, 0.26, 0.2 + (i % 2) * 0.14);
    });
    this.mincedGarlicBits.forEach((b) => { b.visible = false; });
    this._unsplit(this.prepChili);
    this._unsplit(this.prepMushroom);
    this._unsplit(this.prepTomato);
    this.prepChili.scale.set(1, 1, 1);
    this.prepMushroom.scale.setScalar(1.7);
    this.prepTomato.scale.setScalar(1.65);

    this.squidPieces.forEach((p) => { p.visible = false; p.scale.set(1, 1, 1); });
    this.garlicSlices.forEach((g) => { g.visible = false; g.material = this.garlicLiveMat; });
    this.mushrooms.forEach((m) => { m.visible = false; });
    this.tomatoes.forEach((t) => { t.visible = false; });
    this.chilis.forEach((c) => { c.visible = false; });
    this.parsleyBits.forEach((p) => { p.visible = false; });
    this.pepperGrains.forEach((p) => { p.visible = false; });
    this.saltPile.forEach((s) => { s.visible = false; });
  }

  triggerScoreSlash(count) {
    this.knifeChop = 1.0;
    if (count >= 1) this.scoreSlash1.visible = true;
    if (count >= 2) this.scoreSlash2.visible = true;
  }

  triggerSliceCut(cutIndex) {
    this.knifeChop = 1.0;
    if (cutIndex >= 0 && cutIndex < this.armSliceBlocks.length) {
      const b = this.armSliceBlocks[cutIndex];
      this.knifeTargetX = b.position.x + 0.22;
      b.position.x -= 0.18;
      b.position.z += (cutIndex % 2 === 0 ? 0.24 : -0.18);
      b.rotation.z = 0.52;
    }
  }

  triggerGarlicTap(count) {
    this.knifeChop = 1.0;
    this.knifeTargetX = (count - 2) * 0.35;
    if (count === 1) {
      this.prepGarlicCloves.forEach((c) => { c.scale.y = 0.45; });
    } else if (count === 2) {
      this.prepGarlicCloves.forEach((c) => { c.visible = false; });
      this.mincedGarlicBits.forEach((b, i) => { b.visible = i < 12; });
    } else {
      this.prepGarlicCloves.forEach((c) => { c.visible = false; });
      this.mincedGarlicBits.forEach((b) => { b.visible = true; });
    }
  }

  triggerVeggieCut(count) {
    this.knifeChop = 1.0;
    if (count === 1) {
      this.knifeTargetX = -1.05;
      this._splitInHalf(this.prepChili, 0.09);
    } else if (count === 2) {
      this.knifeTargetX = 0.0;
      this._splitInHalf(this.prepMushroom, 0.16);
    } else {
      this.knifeTargetX = 1.05;
      this._splitInHalf(this.prepTomato, 0.16);
    }
  }

  // Show a cut: the piece becomes two halves (left / right) with a gap between them,
  // each tilted slightly outward, instead of just changing size.
  _splitInHalf(mesh, gap) {
    const parent = mesh.parent;
    if (!parent) return;
    if (!mesh.userData.cutBase) {
      mesh.userData.cutBase = { pos: mesh.position.clone(), scale: mesh.scale.clone(), rot: mesh.rotation.clone() };
      const twin = mesh.clone();
      parent.add(twin);
      mesh.userData.cutTwin = twin;
    }
    const base = mesh.userData.cutBase;
    const twin = mesh.userData.cutTwin;
    // Centre of the piece in the parent's space (the chili's geometry is not centred on its origin).
    mesh.position.copy(base.pos); mesh.scale.copy(base.scale); mesh.rotation.copy(base.rot);
    mesh.updateMatrixWorld(true);
    const c = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
    parent.worldToLocal(c);
    // Halving scale.x about the object's origin moves its centre; place each half so its
    // centre sits gap/2 left or right of the original centre.
    const half = (side) => c.x + side * gap * 0.5 - 0.5 * (c.x - base.pos.x);
    for (const [obj, side] of [[mesh, -1], [twin, 1]]) {
      obj.visible = true;
      obj.scale.set(base.scale.x * 0.5, base.scale.y, base.scale.z);
      obj.position.set(half(side), base.pos.y, base.pos.z);
      // Tilt only pieces built around their own origin; tilting the chili (whose geometry
      // sits far from its origin) would swing it away from the board.
      const tilt = Math.abs(c.x - base.pos.x) < 0.05 ? 0.18 : 0;
      obj.rotation.set(base.rot.x, base.rot.y, base.rot.z - side * tilt);
    }
  }

  _unsplit(mesh) {
    const base = mesh.userData.cutBase;
    if (!base) return;
    mesh.position.copy(base.pos); mesh.scale.copy(base.scale); mesh.rotation.copy(base.rot);
    if (mesh.userData.cutTwin) mesh.userData.cutTwin.visible = false;
  }

  triggerParsleyTap(count) {
    const showN = Math.min(this.parsleyBits.length, Math.ceil((count / 3) * this.parsleyBits.length));
    for (let i = 0; i < showN; i++) this.parsleyBits[i].visible = true;
  }

  setStepScene(stepIdx) {
    if (stepIdx <= 3) {
      this.prepGroup.visible = true;
      this.skilletGroup.visible = false;
      this.stoveGroup.visible = false;
      const showArm = stepIdx <= 1;
      this.armSliceBlocks.forEach((b) => { b.visible = showArm; });
      this.scoreSlash1.visible = (stepIdx === 1);
      this.scoreSlash2.visible = (stepIdx === 1);
      this.prepGarlicGroup.visible = (stepIdx === 2);
      this.prepVeggiesGroup.visible = (stepIdx === 3);
    } else {
      this.prepGroup.visible = false;
      this.skilletGroup.visible = true;
      this.stoveGroup.visible = true;
    }
    this.oilBottle.visible = (stepIdx === 4);
    this.oilStream.visible = false;
    this.tongs.visible = (stepIdx === 7);
    this.saltMill.visible = (stepIdx === 8);
    this.pepperMill.visible = (stepIdx === 8);
    this.baguetteGroup.visible = (stepIdx === 9);

    if (stepIdx >= 5) {
      this.garlicSlices.forEach((g) => { g.visible = true; });
      this.chilis.forEach((c) => { c.visible = true; });
    }
    if (stepIdx >= 6) {
      this.squidPieces.forEach((p) => { p.visible = true; });
      this.mushrooms.forEach((m) => { m.visible = true; });
      this.tomatoes.forEach((t) => { t.visible = true; });
    }
    if (stepIdx >= 8) {
      this.pepperGrains.forEach((p) => { p.visible = true; });
    }
  }

  setLiveDoneness(progress) {
    this.cookProgress = progress;
    if (progress <= 0.72) {
      const t = progress / 0.72;
      this.squidLiveMat.color.lerpColors(new THREE.Color(0xf5d0cc), new THREE.Color(0xfff6f0), t);
    } else if (progress <= 1.08) {
      this.squidLiveMat.color.setHex(0xfffaf4);
    } else {
      const t = Math.min(1, (progress - 1.08) / 0.25);
      this.squidLiveMat.color.lerpColors(new THREE.Color(0xfffaf4), new THREE.Color(0x281a14), t);
    }
  }

  setLiveGarlicHeat(heat) {
    this.garlicHeat = heat;
    if (heat <= 0.75) {
      this.garlicLiveMat.color.lerpColors(new THREE.Color(0xfaf2d8), new THREE.Color(0xe39b2d), heat / 0.75);
    } else {
      this.garlicLiveMat.color.lerpColors(new THREE.Color(0xe39b2d), new THREE.Color(0x22160f), Math.min(1, (heat - 0.75) / 0.45));
    }
  }

  buildFinalAjillo(cookResults) {
    this.prepGroup.visible = false;
    this.oilBottle.visible = false;
    this.oilStream.visible = false;
    this.tongs.visible = false;
    this.saltMill.visible = false;
    this.pepperMill.visible = false;
    this.skilletGroup.visible = true;
    this.stoveGroup.visible = true;
    this.baguetteGroup.visible = true;

    const cutGood = cookResults[1] !== false;
    const garlicGood = cookResults[5] !== false;
    const oilStatus = cookResults[4];
    const cookStatus = cookResults[7];
    const saltGood = cookResults[8] !== false;

    this.squidPieces.forEach((p, idx) => {
      p.visible = true;
      p.scale.setScalar(cutGood ? 1.0 : (idx % 2 === 0 ? 1.4 : 0.6));
      const mat = cookStatus === 'burnt' ? this.squidBurntMat : (cookStatus === 'raw' ? this.squidRawMat : this.squidCookedMat);
      p.children.forEach((c, ci) => { if (ci !== 1) c.material = mat; });
      if (cookStatus === 'burnt') p.scale.multiplyScalar(0.76);
    });

    this.garlicSlices.forEach((g) => { g.visible = true; g.material = garlicGood ? this.garlicGoldenMat : this.garlicBurntMat; });
    this.mushrooms.forEach((m) => { m.visible = true; });
    this.tomatoes.forEach((t) => { t.visible = true; });
    this.chilis.forEach((c) => { c.visible = true; });
    this.parsleyBits.forEach((p) => { p.visible = true; });
    this.pepperGrains.forEach((p) => { p.visible = true; });
    this.saltPile.forEach((s) => { s.visible = !saltGood; });

    this.oilMesh.visible = oilStatus !== 'dry';
    this.oilMesh.material = (garlicGood && cookStatus !== 'burnt') ? this.oilMat : this.burntOilMat;

    this.isBurnt = (!garlicGood || cookStatus === 'burnt');
    this.isSimmering = true;
    this.flameLevel = 0.32;
    this.fxMat.color.setHex(this.isBurnt ? 0x222226 : 0xfff2d6);
    this.fxMat.opacity = this.isBurnt ? 0.78 : 0.54;
  }

  update(dt, panShakeX = 0, millAngle = 0) {
    const safeDt = Math.min(0.05, dt);
    this.time += safeDt;
    this.flameUniforms.uTime.value = this.time;
    this.flameUniforms.uIntensity.value = this.flameLevel;

    // Knife chopping animation synced to target X
    this.knifeChop = Math.max(0, this.knifeChop - safeDt * 5.8);
    this.chefKnife.position.x = THREE.MathUtils.lerp(this.chefKnife.position.x, this.knifeTargetX + 0.55, Math.min(1, safeDt * 14));
    this.chefKnife.position.y = 0.92 - Math.sin(this.knifeChop * Math.PI) * 0.56;

    // Skillet shake & tongs stirring synced 1:1 to player horizontal swipe
    this.skilletGroup.position.x = THREE.MathUtils.lerp(this.skilletGroup.position.x, panShakeX * 0.35, Math.min(1, safeDt * 14));
    if (this.tongs.visible) {
      this.tongs.position.x = THREE.MathUtils.lerp(this.tongs.position.x, 0.75 + panShakeX * 0.75, Math.min(1, safeDt * 16));
      this.tongs.position.z = 0.35 + Math.sin(this.stirPhase * 2.0) * 0.35;
      this.tongs.rotation.y = -0.45 + panShakeX * 0.35;
    }

    // Physical swirling & bobbing of every ingredient in the skillet!
    if (this.skilletGroup.visible) {
      for (let i = 0; i < this._swirlItems.length; i++) {
        const it = this._swirlItems[i];
        if (!it.obj.visible) continue;
        const a = it.baseAngle + this.stirPhase;
        const bob = (this.isSimmering ? Math.sin(this.time * 5.2 + it.phase) * 0.018 : 0) + Math.abs(panShakeX) * Math.abs(Math.sin(this.stirPhase * 3 + it.phase)) * 0.09;
        it.obj.position.set(Math.cos(a) * it.radius, it.baseY + bob, Math.sin(a) * it.radius);
      }
    }

    this.oilStream.visible = this.isPouring;
    if (this.isPouring) {
      this.oilStream.scale.set(1 + Math.sin(this.time * 24) * 0.12, 1, 1 + Math.cos(this.time * 24) * 0.12);
    }

    this.saltMill.rotation.y = millAngle;
    this.pepperMill.rotation.y = -millAngle;

    if (this.oilLevel > 0.05) {
      this.oilMesh.visible = true;
      this.oilMesh.position.y = -0.17 + Math.min(0.24, this.oilLevel * 0.21);
    }

    // Steam / simmer bubbles
    if (this.isSimmering || this.flameLevel > 0.25) {
      for (let i = 0; i < this.FX_COUNT; i++) {
        const i3 = i * 3;
        this.fxPos[i3 + 1] += this.fxVel[i3 + 1] * safeDt * (this.isBurnt ? 1.6 : 1.0);
        if (this.fxPos[i3 + 1] > 2.2 || this.fxPos[i3 + 1] < -5) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * 1.18;
          this.fxPos[i3] = Math.cos(a) * r;
          this.fxPos[i3 + 1] = 0.05;
          this.fxPos[i3 + 2] = Math.sin(a) * r;
        }
      }
      this.fxPoints.geometry.attributes.position.needsUpdate = true;
    }

    // Raining salt & pepper crystals when mills spin in Step 9!
    this.millGrinding = Math.max(0, this.millGrinding - safeDt * 3.0);
    let rainDirty = false;
    for (let i = 0; i < this.RAIN_COUNT; i++) {
      const i3 = i * 3;
      if (this.rainPos[i3 + 1] > 0.15) {
        this.rainPos[i3 + 1] -= this.rainVel[i] * safeDt;
        rainDirty = true;
      } else if (this.millGrinding > 0.1 && Math.random() < 0.35) {
        const isSalt = i % 2 === 0;
        this.rainPos[i3] = (isSalt ? -0.42 : 0.42) + (Math.random() - 0.5) * 0.28;
        this.rainPos[i3 + 1] = 1.12;
        this.rainPos[i3 + 2] = (Math.random() - 0.5) * 0.28;
        rainDirty = true;
      } else if (this.rainPos[i3 + 1] > -50) {
        this.rainPos[i3 + 1] = -99;
        rainDirty = true;
      }
    }
    if (rainDirty) this.rainPoints.geometry.attributes.position.needsUpdate = true;
  }
}
