import * as THREE from 'three';

// v2.1 Sculpted Anatomical Giant Squid Butchering Models
// Curved organic torpedo mantle, layered white flesh, gleaming steel Japanese Deba knife,
// sculpted giant eyes, curved sucker-lined 8 arms + 2 club tentacles, and ice-bed platter
export class ButcherStageModels {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);

    this.time = 0;
    this.knifeSwing = 0;
    this.openAmount = 0;
    this.targetOpenAmount = 0;
    this.penPullProgress = 0;

    this._createTexturesAndMaterials();
    this._buildWorkbenchAndTools();
    this._buildAnatomicalGiantSquid();
    this._buildParticles();
  }

  _createTexturesAndMaterials() {
    // Rich Hinoki wood cutting board texture
    const wCan = document.createElement('canvas');
    wCan.width = 256; wCan.height = 256;
    const wCtx = wCan.getContext('2d');
    wCtx.fillStyle = '#d9b584';
    wCtx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 2) {
      const a = 0.05 + 0.07 * Math.sin(y * 0.11 + Math.sin(y * 0.03) * 2.0);
      wCtx.fillStyle = `rgba(140, 88, 38, ${a.toFixed(2)})`;
      wCtx.fillRect(0, y, 256, 2);
    }
    const woodTex = new THREE.CanvasTexture(wCan);
    woodTex.colorSpace = THREE.SRGBColorSpace;

    // Giant Squid wet chromatophore skin texture + bump
    const sCan = document.createElement('canvas');
    sCan.width = 256; sCan.height = 256;
    const sCtx = sCan.getContext('2d');
    const g = sCtx.createLinearGradient(0, 0, 256, 256);
    g.addColorStop(0, '#9e2c32');
    g.addColorStop(0.45, '#d46460');
    g.addColorStop(1, '#ecc0ba');
    sCtx.fillStyle = g;
    sCtx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1200; i++) {
      sCtx.fillStyle = i % 3 === 0 ? 'rgba(84,12,18,0.42)' : 'rgba(250,224,226,0.28)';
      sCtx.beginPath();
      sCtx.arc(Math.random() * 256, Math.random() * 256, 0.7 + Math.random() * 2.1, 0, Math.PI * 2);
      sCtx.fill();
    }
    const skinTex = new THREE.CanvasTexture(sCan);
    skinTex.colorSpace = THREE.SRGBColorSpace;

    // Pearlescent striated squid fillet flesh texture
    const fCan = document.createElement('canvas');
    fCan.width = 256; fCan.height = 256;
    const fCtx = fCan.getContext('2d');
    fCtx.fillStyle = '#faf5f0';
    fCtx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 4) {
      fCtx.fillStyle = 'rgba(225, 206, 198, 0.25)';
      fCtx.fillRect(0, y, 256, 1);
    }
    const fleshTex = new THREE.CanvasTexture(fCan);
    fleshTex.colorSpace = THREE.SRGBColorSpace;

    this.steelMat = new THREE.MeshStandardMaterial({ color: 0xc8d4e0, metalness: 0.72, roughness: 0.28 });
    this.boardMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.58, metalness: 0.04 });
    // Gleaming Japanese stainless blade (balanced metalness + envMap -> bright silver, never black!)
    this.bladeMat = new THREE.MeshPhysicalMaterial({ color: 0xf4f8fc, metalness: 0.78, roughness: 0.16, clearcoat: 0.9 });
    this.handleMat = new THREE.MeshStandardMaterial({ color: 0x7c4f2b, roughness: 0.62 });
    this.ferruleMat = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.3, metalness: 0.2 });

    this.skinMat = new THREE.MeshPhysicalMaterial({
      map: skinTex, roughness: 0.18, clearcoat: 1.0, clearcoatRoughness: 0.08, iridescence: 0.48
    });
    this.whiteFleshMat = new THREE.MeshPhysicalMaterial({
      map: fleshTex, color: 0xfffaf6, roughness: 0.18, clearcoat: 0.95, sheen: 0.45, sheenColor: new THREE.Color(0xffe0da)
    });
    this.thinFilmMat = new THREE.MeshPhysicalMaterial({
      color: 0xf2e4ea, transparent: true, opacity: 0.55, roughness: 0.12, clearcoat: 1.0
    });
    this.inkedFleshMat = new THREE.MeshPhysicalMaterial({ color: 0x1e1d24, roughness: 0.28, clearcoat: 0.85 });
    this.stainedFleshMat = new THREE.MeshPhysicalMaterial({ color: 0xdabca2, roughness: 0.26, clearcoat: 0.75 });
    this.penMat = new THREE.MeshPhysicalMaterial({ color: 0xe6f8ff, transparent: true, opacity: 0.68, roughness: 0.06, clearcoat: 1.0 });
    this.liverMat = new THREE.MeshPhysicalMaterial({ color: 0xa45e36, roughness: 0.24, clearcoat: 0.85 });
    this.gillsMat = new THREE.MeshStandardMaterial({ color: 0xd47d78, roughness: 0.38 });
    this.inkSacMat = new THREE.MeshPhysicalMaterial({ color: 0x0e1018, metalness: 0.35, roughness: 0.12, clearcoat: 1.0 });
    this.beakMat = new THREE.MeshStandardMaterial({ color: 0x1a0e0a, roughness: 0.18, metalness: 0.25 });
    this.suckerMat = new THREE.MeshPhysicalMaterial({ color: 0xf8e8e0, roughness: 0.2, clearcoat: 0.85 });
    this.iceMat = new THREE.MeshPhysicalMaterial({ color: 0xdcf4ff, transparent: true, opacity: 0.68, roughness: 0.08, clearcoat: 1.0 });
  }

  _buildWorkbenchAndTools() {
    const counter = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 8), this.steelMat);
    counter.position.set(0, -0.35, 0);
    this.root.add(counter);

    // Industrial Harbor Stainless-Steel Giant Squid Disassembly Deck with Meter Ruler & Hazard Stripes!
    const deckCan = document.createElement('canvas');
    deckCan.width = 1024; deckCan.height = 512;
    const dCtx = deckCan.getContext('2d');
    const dg = dCtx.createLinearGradient(0, 0, 0, 512);
    dg.addColorStop(0, '#9fb0c2');
    dg.addColorStop(0.5, '#b8c8d8');
    dg.addColorStop(1, '#8ea1b4');
    dCtx.fillStyle = dg;
    dCtx.fillRect(0, 0, 1024, 512);
    // Subtle stainless drainage grid
    dCtx.strokeStyle = 'rgba(40, 60, 80, 0.18)';
    dCtx.lineWidth = 2;
    for (let x = 0; x <= 1024; x += 64) { dCtx.beginPath(); dCtx.moveTo(x, 0); dCtx.lineTo(x, 430); dCtx.stroke(); }
    for (let y = 0; y <= 430; y += 64) { dCtx.beginPath(); dCtx.moveTo(0, y); dCtx.lineTo(1024, y); dCtx.stroke(); }
    // Bold Meter Scale Strip along the front edge (0m - 6m Giant Squid Reference!)
    dCtx.fillStyle = '#0d1b2a';
    dCtx.fillRect(0, 424, 1024, 54);
    dCtx.fillStyle = '#ffd454';
    dCtx.font = 'bold 28px sans-serif';
    dCtx.textAlign = 'center';
    for (let m = 0; m <= 6; m++) {
      const mx = 64 + (m / 6) * 896;
      dCtx.fillRect(mx - 2, 424, 4, 22);
      dCtx.fillText(`${m}m`, mx, 470);
    }
    // Harbor yellow-black hazard stripe at very front lip
    for (let sx = -32; sx < 1056; sx += 44) {
      dCtx.fillStyle = ((sx / 44) & 1) === 0 ? '#f4c430' : '#181c22';
      dCtx.fillRect(sx, 478, 44, 34);
    }
    const deckTex = new THREE.CanvasTexture(deckCan);
    deckTex.colorSpace = THREE.SRGBColorSpace;
    const deckMat = new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.34, metalness: 0.52 });

    this.board = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.28, 4.8), deckMat);
    this.board.position.set(0, -0.06, 0.1);
    this.root.add(this.board);

    // Human-Scale Reference (170cm Harbor Butcher Worker + Marine Cooler Box) behind the deck
    // so the player IMMEDIATELY feels this is a multi-meter Giant Squid, NOT a supermarket squid!
    this.scaleCrewGroup = new THREE.Group();
    const worker = new THREE.Group();
    const suitMat = new THREE.MeshStandardMaterial({ color: 0xe6a825, roughness: 0.55 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x1e2836, roughness: 0.6 });
    const skinW = new THREE.MeshStandardMaterial({ color: 0xefc39c, roughness: 0.65 });
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.58, 10), bootMat); legL.position.set(-0.11, 0.29, 0);
    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.58, 10), bootMat); legR.position.set(0.11, 0.29, 0);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.22, 0.68, 12), suitMat); torso.position.y = 0.88;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), skinW); head.position.y = 1.38;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.10, 12), bootMat); cap.position.y = 1.49;
    worker.add(legL, legR, torso, head, cap);
    // 1.7m tall human scaled to deck coordinates (deck is ~6m wide = 9.6 units -> 1m = 1.6 units -> 1.7m ≈ 1.45 units standing behind table)
    worker.scale.setScalar(0.85);
    worker.position.set(-2.9, -0.35, -2.55);
    this.scaleCrewGroup.add(worker);

    // Standard Harbor Cooler Box & Yellow Bucket for extra scale contrast
    const cooler = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.45, 0.48), new THREE.MeshStandardMaterial({ color: 0x1c64b0, roughness: 0.4 }));
    cooler.position.set(3.2, -0.10, -2.45);
    const coolerLid = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.08, 0.51), new THREE.MeshStandardMaterial({ color: 0xf4f8fc, roughness: 0.3 }));
    coolerLid.position.set(3.2, 0.15, -2.45);
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.36, 14), suitMat);
    bucket.position.set(2.35, -0.14, -2.35);
    this.scaleCrewGroup.add(cooler, coolerLid, bucket);
    this.root.add(this.scaleCrewGroup);

    this.bowl = new THREE.Group();
    const bw = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.6, 0.5, 24, 1, true), this.steelMat.clone());
    bw.material.side = THREE.DoubleSide;
    const bb = new THREE.Mesh(new THREE.CircleGeometry(0.6, 22), this.steelMat);
    bb.rotation.x = -Math.PI * 0.5; bb.position.y = -0.24;
    this.bowl.add(bw, bb);
    this.bowl.position.set(-3.8, 0.1, -1.7);
    this.root.add(this.bowl);

    // Luxury Ice-Bed Presentation Platter (for Dedicated Butcher Result Screen)
    this.platter = new THREE.Group();
    const woodBase = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.22, 4.2), this.boardMat);
    const iceBed = new THREE.Mesh(new THREE.BoxGeometry(6.7, 0.14, 3.7), this.iceMat);
    iceBed.position.y = 0.14;
    this.platter.add(woodBase, iceBed);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const cube = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14), this.iceMat);
      cube.position.set(Math.cos(a) * 3.05, 0.22, Math.sin(a) * 1.62);
      this.platter.add(cube);
    }
    this.platter.position.set(0, 0.04, 0.1);
    this.platter.visible = false;
    this.root.add(this.platter);

    // Gleaming Japanese Deba Knife
    this.knife = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.85, 12), this.handleMat);
    handle.rotation.z = Math.PI * 0.5; handle.position.x = 0.42;
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.15, 12), this.ferruleMat);
    ferrule.rotation.z = Math.PI * 0.5; ferrule.position.x = -0.04;
    const sh = new THREE.Shape();
    sh.moveTo(0, -0.13); sh.lineTo(-1.88, -0.08); sh.quadraticCurveTo(-2.35, 0.0, -2.45, 0.20); sh.lineTo(0, 0.20); sh.closePath();
    const bGeo = new THREE.ExtrudeGeometry(sh, { depth: 0.026, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 2 });
    bGeo.translate(0, 0, -0.013);
    const blade = new THREE.Mesh(bGeo, this.bladeMat);
    blade.position.x = -0.10;
    this.knife.add(handle, ferrule, blade);
    this.knife.position.set(2.4, 0.65, 1.3);
    this.knife.rotation.set(0.35, -0.35, -0.2);
    this.root.add(this.knife);
  }

  _buildAnatomicalGiantSquid() {
    this.squidGroup = new THREE.Group();
    this.squidGroup.position.set(0, 0.40, 0.1);
    this.squidGroup.scale.setScalar(1.22);
    this.root.add(this.squidGroup);

    // 1. Sculpted Organic Torpedo Mantle (Split into Left & Right Lathe halves!)
    this.mantlePivot = new THREE.Group();
    this.mantlePivot.position.set(-1.1, 0.08, 0);
    this.squidGroup.add(this.mantlePivot);

    const profilePts = [
      new THREE.Vector2(0.02, -1.48), // pointed apex
      new THREE.Vector2(0.24, -1.10),
      new THREE.Vector2(0.46, -0.45),
      new THREE.Vector2(0.56,  0.30), // widest muscular belly
      new THREE.Vector2(0.52,  1.05),
      new THREE.Vector2(0.47,  1.42), // collar rim
      new THREE.Vector2(0.40,  1.45)  // rolled muscular lip
    ];

    const makeSculptedHalf = (sideSign) => {
      const grp = new THREE.Group();
      const startPhi = sideSign > 0 ? 0 : Math.PI;
      const geo = new THREE.LatheGeometry(profilePts, 18, startPhi, Math.PI);
      geo.rotateZ(-Math.PI * 0.5);
      geo.scale(1.0, 0.62, 1.0);
      const flesh = new THREE.Mesh(geo, this.whiteFleshMat.clone());
      flesh.material.side = THREE.DoubleSide;
      grp.add(flesh);

      const skinGeo = geo.clone();
      skinGeo.scale(1.01, 1.04, 1.03);
      const skin = new THREE.Mesh(skinGeo, this.skinMat.clone());
      grp.add(skin);

      const filmGeo = new THREE.PlaneGeometry(2.55, 0.68);
      filmGeo.rotateX(-Math.PI * 0.5);
      const film = new THREE.Mesh(filmGeo, this.thinFilmMat);
      film.position.set(0, 0.06, sideSign * 0.32);
      film.visible = false;
      grp.add(film);

      grp.userData = { flesh, skin, film };
      return grp;
    };

    this.mantleHalfL = makeSculptedHalf(-1);
    this.mantleHalfR = makeSculptedHalf(1);
    this.mantlePivot.add(this.mantleHalfL, this.mantleHalfR);

    this.incisionLine = new THREE.Mesh(
      new THREE.BoxGeometry(2.45, 0.04, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x9e1820, roughness: 0.25 })
    );
    this.incisionLine.position.set(0, 0.35, 0);
    this.incisionLine.visible = false;
    this.mantlePivot.add(this.incisionLine);

    // 2. Heart-Shaped Muscular Fins
    this.finsGroup = new THREE.Group();
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.quadraticCurveTo(-0.42, 0.58, -0.95, 0.28);
    finShape.quadraticCurveTo(-1.18, 0.06, -1.02, 0);
    finShape.closePath();
    const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 2 });
    finGeo.rotateX(Math.PI * 0.5);
    const finL = new THREE.Mesh(finGeo, this.skinMat.clone()); finL.position.set(-1.75, 0.08, -0.06);
    const finR = new THREE.Mesh(finGeo, this.skinMat.clone()); finR.scale.z = -1; finR.position.set(-1.75, 0.08, 0.06);
    this.finsGroup.add(finL, finR);
    this.squidGroup.add(this.finsGroup);

    // 3. Translucent Gladius / Pen
    this.penMesh = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.025, 0.16), this.penMat);
    this.penMesh.position.set(-1.1, 0.15, 0);
    this.penMesh.visible = false;
    this.squidGroup.add(this.penMesh);

    this.brokenPen = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.03, 0.16), this.penMat);
    this.brokenPen.position.set(-1.4, 0.14, 0.1);
    this.brokenPen.rotation.y = 0.25;
    this.brokenPen.visible = false;
    this.squidGroup.add(this.brokenPen);

    // 4. Internal Organs (Gills, Liver/Goro, Glossy Black Ink Sac)
    this.gillsGroup = new THREE.Group();
    const gillGeo = new THREE.CylinderGeometry(0.08, 0.11, 0.65, 10);
    gillGeo.rotateZ(Math.PI * 0.5);
    const gL = new THREE.Mesh(gillGeo, this.gillsMat); gL.position.set(-0.75, 0.18, -0.26);
    const gR = new THREE.Mesh(gillGeo, this.gillsMat); gR.position.set(-0.75, 0.18, 0.26);
    this.gillsGroup.add(gL, gR);
    this.gillsGroup.visible = false;
    this.squidGroup.add(this.gillsGroup);

    this.liverMesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), this.liverMat);
    this.liverMesh.scale.set(1.85, 0.55, 0.82);
    this.liverMesh.position.set(-1.18, 0.20, 0);
    this.liverMesh.visible = false;
    this.squidGroup.add(this.liverMesh);

    this.inkSacMesh = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), this.inkSacMat);
    this.inkSacMesh.scale.set(1.55, 0.68, 0.85);
    this.inkSacMesh.position.set(-0.48, 0.24, 0.08);
    this.inkSacMesh.visible = false;
    this.squidGroup.add(this.inkSacMesh);

    // 5. Sculpted Head, Giant 30cm Multi-Layered Eyes & Beak
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0.68, 0.04, 0);
    const hPts = [
      new THREE.Vector2(0.28, -0.36),
      new THREE.Vector2(0.46, -0.10),
      new THREE.Vector2(0.48,  0.14),
      new THREE.Vector2(0.34,  0.42)
    ];
    const hGeo = new THREE.LatheGeometry(hPts, 20);
    hGeo.rotateZ(-Math.PI * 0.5);
    hGeo.scale(1.0, 0.72, 1.05);
    this.headGroup.add(new THREE.Mesh(hGeo, this.skinMat.clone()));

    const makeGiantEye = (zSide) => {
      const eg = new THREE.Group();
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.048, 12, 24), this.skinMat);
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshPhysicalMaterial({ color: 0x9ec8e6, metalness: 0.72, roughness: 0.16, clearcoat: 1.0 }));
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.10, 14, 12), new THREE.MeshStandardMaterial({ color: 0x020308, roughness: 0.08 }));
      pupil.position.z = zSide * 0.09;
      eg.add(rim, iris, pupil);
      eg.position.set(0.05, 0.10, zSide * 0.40);
      return eg;
    };
    this.eyeL = makeGiantEye(-1);
    this.eyeR = makeGiantEye(1);
    this.beak = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 12), this.beakMat);
    this.beak.rotation.z = -Math.PI * 0.5;
    this.beak.position.set(0.42, 0.04, 0);
    this.headGroup.add(this.eyeL, this.eyeR, this.beak);
    this.squidGroup.add(this.headGroup);

    // 6. 8 Curved Tapered Arms with 2 Rows of 3D Cup Suckers + 2 Long Club Tentacles
    this.armsGroup = new THREE.Group();
    this.armsGroup.position.set(1.08, -0.02, 0);
    this.squidGroup.add(this.armsGroup);

    for (let i = 0; i < 8; i++) {
      const armGrp = new THREE.Group();
      const spread = (i - 3.5) * 0.22;
      const len = 1.95 + (i % 2) * 0.22;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.02, 0),
        new THREE.Vector3(len * 0.35, 0.04, spread * 0.25),
        new THREE.Vector3(len * 0.72, 0.01, spread * 0.45),
        new THREE.Vector3(len, -0.02, spread * 0.2)
      ]);
      const tubeGeo = new THREE.TubeGeometry(curve, 16, 0.085, 8, false);
      // Taper vertices along length
      const pos = tubeGeo.attributes.position;
      for (let vi = 0; vi < pos.count; vi++) {
        const vx = pos.getX(vi);
        const t = Math.max(0, Math.min(1, vx / len));
        const cp = curve.getPoint(t);
        const scaleR = 1.0 - t * 0.85;
        pos.setY(vi, cp.y + (pos.getY(vi) - cp.y) * scaleR);
        pos.setZ(vi, cp.z + (pos.getZ(vi) - cp.z) * scaleR);
      }
      tubeGeo.computeVertexNormals();
      armGrp.add(new THREE.Mesh(tubeGeo, this.skinMat.clone()));

      for (let k = 0; k < 8; k++) {
        const t = 0.12 + (k / 8) * 0.76;
        const cp = curve.getPoint(t);
        const sr = (1.0 - t * 0.7) * 0.042;
        const s1 = new THREE.Mesh(new THREE.CylinderGeometry(sr, sr * 0.7, sr * 0.9, 8), this.suckerMat);
        s1.position.set(cp.x, cp.y + 0.06 * (1 - t * 0.6), cp.z - sr * 0.9);
        const s2 = new THREE.Mesh(new THREE.CylinderGeometry(sr, sr * 0.7, sr * 0.9, 8), this.suckerMat);
        s2.position.set(cp.x + 0.05, cp.y + 0.06 * (1 - t * 0.6), cp.z + sr * 0.9);
        armGrp.add(s1, s2);
      }
      armGrp.position.set(0, 0, spread);
      this.armsGroup.add(armGrp);
    }

    this.tentaclesGroup = new THREE.Group();
    this.tentaclesGroup.position.set(1.08, -0.02, 0);
    for (let t = 0; t < 2; t++) {
      const zSide = t === 0 ? -1 : 1;
      const tGrp = new THREE.Group();
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.9, 0.02, zSide * 0.12),
        new THREE.Vector3(1.8, 0, zSide * 0.05),
        new THREE.Vector3(2.5, 0, zSide * 0.18)
      ]);
      const stalk = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.042, 8, false), this.skinMat.clone());
      const club = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), this.skinMat.clone());
      club.scale.set(2.4, 0.35, 1.15);
      club.position.set(2.6, 0, zSide * 0.18);
      tGrp.add(stalk, club);
      for (let c = 0; c < 6; c++) {
        const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.03, 8), this.suckerMat);
        sk.position.set(2.38 + c * 0.09, 0.05, zSide * 0.18 + (c % 2 === 0 ? -0.05 : 0.05));
        tGrp.add(sk);
      }
      tGrp.position.set(0, 0, zSide * 0.85);
      this.tentaclesGroup.add(tGrp);
    }
    this.squidGroup.add(this.tentaclesGroup);
  }

  _buildParticles() {
    this.FX_COUNT = 110;
    this.fxPos = new Float32Array(this.FX_COUNT * 3);
    this.fxVel = new Float32Array(this.FX_COUNT * 3);
    this.fxActive = false;
    for (let i = 0; i < this.FX_COUNT; i++) this.fxPos[i * 3 + 1] = -99;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.fxPos, 3));
    this.fxMat = new THREE.PointsMaterial({ color: 0xe8f6ff, size: 0.18, transparent: true, opacity: 0.9 });
    this.fxPoints = new THREE.Points(geo, this.fxMat);
    this.root.add(this.fxPoints);
  }

  burstParticles(x, z, colorHex = 0xe8f6ff, count = 45) {
    this.fxActive = true;
    this.fxMat.color.setHex(colorHex);
    for (let i = 0; i < Math.min(count, this.FX_COUNT); i++) {
      this.fxPos[i * 3] = x + (Math.random() - 0.5) * 0.3;
      this.fxPos[i * 3 + 1] = 0.62;
      this.fxPos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.3;
      this.fxVel[i * 3] = (Math.random() - 0.5) * 3.8;
      this.fxVel[i * 3 + 1] = 1.6 + Math.random() * 2.4;
      this.fxVel[i * 3 + 2] = (Math.random() - 0.5) * 3.8;
    }
    this.fxPoints.geometry.attributes.position.needsUpdate = true;
  }

  resetForNewButcher() {
    this.platter.visible = false;
    this.board.visible = true;
    this.knife.visible = true;
    this.bowl.visible = true;
    this.openAmount = 0;
    this.targetOpenAmount = 0;
    this.incisionLine.visible = false;

    [this.mantleHalfL, this.mantleHalfR].forEach((h) => {
      h.position.set(0, 0, 0);
      h.rotation.set(0, 0, 0);
      h.userData.flesh.material = this.whiteFleshMat.clone();
      h.userData.flesh.material.side = THREE.DoubleSide;
      h.userData.skin.visible = true;
      h.userData.skin.scale.set(1, 1, 1);
      h.userData.film.visible = false;
    });

    this.mantlePivot.position.set(-1.1, 0.08, 0);
    this.finsGroup.visible = true;
    this.finsGroup.position.set(0, 0, 0);
    this.finsGroup.scale.set(1, 1, 1);

    this.penMesh.visible = false;
    this.brokenPen.visible = false;
    this.gillsGroup.visible = false;
    this.liverMesh.visible = false;
    this.inkSacMesh.visible = false;

    this.headGroup.visible = true;
    this.headGroup.position.set(0.68, 0.04, 0);
    this.eyeL.visible = true;
    this.eyeR.visible = true;
    this.beak.visible = true;
    this.beak.position.set(0.42, 0.04, 0);
    this.beak.scale.set(1, 1, 1);

    this.armsGroup.visible = true;
    this.armsGroup.position.set(1.08, -0.02, 0);
    this.tentaclesGroup.visible = true;
    this.tentaclesGroup.position.set(1.08, -0.02, 0);
  }

  applyStepVisual(stepIdx, ok) {
    this.knifeSwing = 1.0;
    if (stepIdx === 0) this.burstParticles(-1.0, 0.1, 0xa8e6ff, 50);
    else if (stepIdx === 1) {
      this.finsGroup.position.set(-0.45, 0, -1.05);
      if (!ok) this.finsGroup.scale.set(0.78, 1, 0.72);
      this.burstParticles(-2.0, 0.1, 0xfff0ee, 35);
    } else if (stepIdx === 2) {
      this.incisionLine.visible = true;
      this.burstParticles(-1.0, 0.1, 0xffd0cc, 30);
    } else if (stepIdx === 3) {
      this.targetOpenAmount = 1.0;
      this.incisionLine.visible = false;
      this.burstParticles(-1.1, 0.1, 0xffd8d2, 40);
      this.penMesh.visible = true;
      this.gillsGroup.visible = true;
      this.liverMesh.visible = true;
      this.inkSacMesh.visible = true;
      this.mantleHalfL.userData.film.visible = true;
      this.mantleHalfR.userData.film.visible = true;
    } else if (stepIdx === 4) {
      this.penMesh.visible = false;
      if (!ok) this.brokenPen.visible = true;
    } else if (stepIdx === 5) {
      this.gillsGroup.visible = false;
      if (ok) this.burstParticles(-0.8, 0.1, 0xffb4b4, 30);
      if (!ok) this.mantleHalfL.userData.flesh.material = this.stainedFleshMat;
    } else if (stepIdx === 6) {
      this.liverMesh.visible = false;
      if (ok) this.burstParticles(-1.0, 0.1, 0xc98a5a, 30);
      if (!ok) this.mantleHalfR.userData.flesh.material = this.stainedFleshMat;
    } else if (stepIdx === 7) {
      this.inkSacMesh.visible = false;
      if (!ok) {
        this.burstParticles(-0.5, 0.1, 0x09090d, 100);
        this.mantleHalfL.userData.flesh.material = this.inkedFleshMat;
        this.mantleHalfR.userData.flesh.material = this.inkedFleshMat;
      }
    } else if (stepIdx === 8) {
      this.headGroup.position.x = 1.15;
      this.armsGroup.position.x = 1.55;
      this.tentaclesGroup.position.x = 1.55;
      this.burstParticles(0.55, 0.1, 0xffe8e4, 40);
    } else if (stepIdx === 9) {
      this.eyeL.visible = false;
      this.eyeR.visible = false;
      this.burstParticles(1.15, 0.1, 0xeef4ff, 35);
    } else if (stepIdx === 10) {
      if (ok) this.beak.visible = false;
      else this.beak.scale.set(0.5, 0.5, 0.5);
      this.burstParticles(1.4, 0.1, 0xffe8e4, 25);
    } else if (stepIdx === 11) {
      if (ok) {
        this.mantleHalfL.userData.skin.visible = false;
        this.mantleHalfR.userData.skin.visible = false;
      } else {
        this.mantleHalfL.userData.skin.scale.set(0.55, 1, 0.5);
        this.mantleHalfR.userData.skin.scale.set(0.62, 1, 0.5);
      }
    } else if (stepIdx === 12) {
      if (ok) {
        this.mantleHalfL.userData.film.visible = false;
        this.mantleHalfR.userData.film.visible = false;
      }
    } else if (stepIdx === 13) {
      this.armsGroup.position.set(1.45, 0, 0.45);
      this.burstParticles(1.35, 0.2, 0xffe8e4, 35);
    } else if (stepIdx === 14) {
      this.tentaclesGroup.position.set(1.45, 0, -0.55);
      this.burstParticles(2.2, 0.1, 0xffe8e4, 40);
    }
  }

  arrangeForResult(stepResults) {
    this.board.visible = false;
    this.knife.visible = false;
    this.bowl.visible = false;
    this.headGroup.visible = false;
    this.platter.visible = true;

    this.targetOpenAmount = 1.0;
    this.openAmount = 1.0;
    this.mantlePivot.position.set(-1.35, 0.18, 0.15);
    this.finsGroup.visible = true;
    this.finsGroup.position.set(2.35, 0.14, -1.05);
    this.armsGroup.visible = true;
    this.armsGroup.position.set(0.35, 0.16, 0.45);
    this.tentaclesGroup.visible = true;
    this.tentaclesGroup.position.set(0.25, 0.16, -0.45);
    this.brokenPen.visible = !stepResults[4];
  }

  update(dt, toolX = 0, toolZ = 0) {
    const safeDt = Math.min(0.05, dt);
    this.time += safeDt;

    this.openAmount = THREE.MathUtils.lerp(this.openAmount, this.targetOpenAmount, Math.min(1, safeDt * 5.0));
    this.mantleHalfL.position.z = -this.openAmount * 0.46;
    this.mantleHalfL.rotation.x = -this.openAmount * 1.15;
    this.mantleHalfR.position.z = this.openAmount * 0.46;
    this.mantleHalfR.rotation.x = this.openAmount * 1.15;

    this.knifeSwing = Math.max(0, this.knifeSwing - safeDt * 4.5);
    this.knife.position.x = THREE.MathUtils.lerp(this.knife.position.x, toolX + 0.9, Math.min(1, safeDt * 16));
    this.knife.position.z = THREE.MathUtils.lerp(this.knife.position.z, toolZ + 0.25, Math.min(1, safeDt * 16));
    this.knife.position.y = 0.62 - Math.sin(this.knifeSwing * Math.PI) * 0.36;

    if (this.fxActive) {
      for (let i = 0; i < this.FX_COUNT; i++) {
        const i3 = i * 3;
        if (this.fxPos[i3 + 1] > 0.1) {
          this.fxVel[i3 + 1] -= 9.8 * safeDt;
          this.fxPos[i3] += this.fxVel[i3] * safeDt;
          this.fxPos[i3 + 1] = Math.max(0.1, this.fxPos[i3 + 1] + this.fxVel[i3 + 1] * safeDt);
          this.fxPos[i3 + 2] += this.fxVel[i3 + 2] * safeDt;
        }
      }
      this.fxPoints.geometry.attributes.position.needsUpdate = true;
    }
  }
}
