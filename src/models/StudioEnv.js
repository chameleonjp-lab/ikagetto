import * as THREE from 'three';

// Generates a bright studio-lit procedural Environment Map via PMREMGenerator
// so metallic steel knives, cast-iron skillets, wet squid skin & golden olive oil
// reflect rich highlights instead of rendering pitch-black!
export function applyStudioEnvironment(renderer, scene, warm = false) {
  if (!renderer || !scene) return;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(warm ? 0x2a2018 : 0x1b2838);

  // Soft overhead studio softboxes
  const topLight = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14),
    new THREE.MeshBasicMaterial({ color: warm ? 0xfff3de : 0xf0f8ff, side: THREE.DoubleSide })
  );
  topLight.position.set(0, 8, 0);
  topLight.rotation.x = Math.PI * 0.5;
  envScene.add(topLight);

  const sideL = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 6),
    new THREE.MeshBasicMaterial({ color: warm ? 0xffd2a0 : 0x9ed4ff, side: THREE.DoubleSide })
  );
  sideL.position.set(-8, 3, 2);
  sideL.lookAt(0, 0, 0);
  envScene.add(sideL);

  const sideR = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 6),
    new THREE.MeshBasicMaterial({ color: warm ? 0xffe4c4 : 0xe4f0ff, side: THREE.DoubleSide })
  );
  sideR.position.set(8, 4, -2);
  sideR.lookAt(0, 0, 0);
  envScene.add(sideR);

  const rt = pmrem.fromScene(envScene, 0.04);
  scene.environment = rt.texture;
  pmrem.dispose();
}
