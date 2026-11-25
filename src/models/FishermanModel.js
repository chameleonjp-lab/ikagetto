import * as THREE from 'three';

// Procedural 170cm (1.70 units tall) Japanese Deep-Sea Fisherman 3D Model
// Feet planted cleanly at Y = 0.0 for exact side-by-side scale comparison
export class FishermanModel {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'Fisherman170cm';

    const bootMat = new THREE.MeshStandardMaterial({ color: 0x1a2028, roughness: 0.45, metalness: 0.1 });
    const kappaMat = new THREE.MeshStandardMaterial({ color: 0xe6a11c, roughness: 0.38, metalness: 0.05 }); // Yellow waterproof marine kappa
    const jacketMat = new THREE.MeshStandardMaterial({ color: 0x163252, roughness: 0.55 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xdfb18f, roughness: 0.62 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0x0f243d, roughness: 0.5 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x2268a8, roughness: 0.48 });

    // Rubber boots (Y: 0.00 -> 0.36)
    const bootGeo = new THREE.CylinderGeometry(0.068, 0.075, 0.36, 12);
    const bootL = new THREE.Mesh(bootGeo, bootMat); bootL.position.set(-0.11, 0.18, 0);
    const bootR = new THREE.Mesh(bootGeo, bootMat); bootR.position.set(0.11, 0.18, 0);
    const footGeo = new THREE.BoxGeometry(0.12, 0.08, 0.24);
    const footL = new THREE.Mesh(footGeo, bootMat); footL.position.set(-0.11, 0.04, 0.05);
    const footR = new THREE.Mesh(footGeo, bootMat); footR.position.set(0.11, 0.04, 0.05);
    this.root.add(bootL, bootR, footL, footR);

    // Legs in yellow waterproof bib overalls (Y: 0.34 -> 0.84)
    const legGeo = new THREE.CylinderGeometry(0.088, 0.075, 0.52, 12);
    const legL = new THREE.Mesh(legGeo, kappaMat); legL.position.set(-0.11, 0.60, 0);
    const legR = new THREE.Mesh(legGeo, kappaMat); legR.position.set(0.11, 0.60, 0);
    this.root.add(legL, legR);

    // Torso: Navy sweater + Yellow bib chest (Y: 0.82 -> 1.38)
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.54, 14), jacketMat);
    torso.scale.set(1.12, 1.0, 0.72);
    torso.position.set(0, 1.10, 0);
    this.root.add(torso);

    const bib = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.38, 0.25), kappaMat);
    bib.position.set(0, 1.02, 0.01);
    this.root.add(bib);

    // Straps
    const strapGeo = new THREE.BoxGeometry(0.045, 0.22, 0.26);
    const strapL = new THREE.Mesh(strapGeo, kappaMat); strapL.position.set(-0.11, 1.28, 0.01);
    const strapR = new THREE.Mesh(strapGeo, kappaMat); strapR.position.set(0.11, 1.28, 0.01);
    this.root.add(strapL, strapR);

    // Arms: Left hand on hip, Right arm gesturing proudly toward the giant squid!
    const armGeo = new THREE.CylinderGeometry(0.056, 0.048, 0.46, 10);
    const armL = new THREE.Mesh(armGeo, jacketMat);
    armL.position.set(-0.27, 1.12, 0.02);
    armL.rotation.z = -0.34;
    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), gloveMat);
    handL.position.set(-0.22, 0.90, 0.04);

    const armR = new THREE.Mesh(armGeo, jacketMat);
    armR.position.set(0.30, 1.18, 0.06);
    armR.rotation.z = 0.62;
    const handR = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), gloveMat);
    handR.position.set(0.42, 1.02, 0.08);
    this.root.add(armL, handL, armR, handR);

    // Neck & Head (top of head reaches exact Y = 1.70m!)
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.068, 0.09, 10), skinMat);
    neck.position.set(0, 1.40, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 14), skinMat);
    head.position.set(0, 1.54, 0.01);
    head.rotation.y = 0.28; // Looking slightly right toward the squid
    head.rotation.x = -0.15;

    // Marine cap (top at Y = 1.70)
    const capCrown = new THREE.Mesh(new THREE.SphereGeometry(0.132, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), capMat);
    capCrown.position.set(0, 1.57, 0.01);
    const capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.14), capMat);
    capBrim.position.set(0.03, 1.60, 0.12);
    capBrim.rotation.y = 0.28;

    this.root.add(neck, head, capCrown, capBrim);
  }

  getObject3D() {
    return this.root;
  }
}
