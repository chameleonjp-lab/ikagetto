import * as THREE from 'three';

// 4-directional Gerstner wave parameters shared identically by GPU Shader & CPU JS
const WAVES = [
  { dx: 0.85,  dz: 0.52,  amp: 0.72, len: 28.0, speed: 1.05 },
  { dx: -0.35, dz: 0.93,  amp: 0.42, len: 17.5, speed: 1.25 },
  { dx: 0.52,  dz: -0.85, amp: 0.24, len: 10.5, speed: 1.45 },
  { dx: -0.92, dz: -0.38, amp: 0.14, len: 6.4,  speed: 1.75 }
];

export class OceanEnv {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;

    this.surfaceFogColor = new THREE.Color(0x020814);
    this.abyssFogColor = new THREE.Color(0x000308);
    this.fog = new THREE.FogExp2(0x020814, 0.012);
    scene.fog = this.fog;
    scene.background = this.surfaceFogColor.clone();

    this._buildLightsAndSky();
    this._buildGerstnerOcean();
    this._buildMarineSnow();
    this._buildROVBeam();
  }

  _buildLightsAndSky() {
    // Dark stormy night sky dome
    const skyGeo = new THREE.SphereGeometry(260, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x01040b) },
        uHorizon: { value: new THREE.Color(0x061428) }
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        varying vec3 vPos;
        void main() {
          float h = clamp(normalize(vPos).y, 0.0, 1.0);
          vec3 col = mix(uHorizon, uTop, pow(h, 0.55));
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyDome);

    // Faint moonlight
    this.moonLight = new THREE.DirectionalLight(0x88b2dc, 0.95);
    this.moonLight.position.set(40, 65, -50);
    this.scene.add(this.moonLight);

    // Ambient sea-sky reflection
    this.hemiLight = new THREE.HemisphereLight(0x1f4068, 0x02060f, 0.52);
    this.scene.add(this.hemiLight);
  }

  _buildGerstnerOcean() {
    const geo = new THREE.PlaneGeometry(240, 240, 110, 110);
    geo.rotateX(-Math.PI * 0.5);

    this.oceanUniforms = {
      uTime: { value: 0 },
      uLightDir: { value: new THREE.Vector3(0.45, 0.72, -0.52).normalize() },
      uDeepColor: { value: new THREE.Color(0x020b18) },
      uCrestColor: { value: new THREE.Color(0x0a253d) },
      uFoamColor: { value: new THREE.Color(0x9ec4dc) }
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.oceanUniforms,
      transparent: true,
      side: THREE.DoubleSide,
      vertexShader: `
        uniform float uTime;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying float vCrest;

        vec3 gerstner(vec2 pos, vec2 dir, float amp, float len, float spd, inout vec3 tangent, inout vec3 binormal) {
          float k = 6.2831853 / len;
          float c = sqrt(9.8 / k) * spd;
          vec2 d = normalize(dir);
          float f = k * (dot(d, pos) - c * uTime);
          float a = amp;
          float s = sin(f);
          float co = cos(f);
          float steep = min(0.65, k * a);

          tangent += vec3(-d.x * d.x * steep * s, d.x * steep * co, -d.x * d.y * steep * s);
          binormal += vec3(-d.x * d.y * steep * s, d.y * steep * co, -d.y * d.y * steep * s);
          return vec3(d.x * (a * co), a * s, d.y * (a * co));
        }

        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vec2 xz = wp.xz;
          vec3 tangent = vec3(1.0, 0.0, 0.0);
          vec3 binormal = vec3(0.0, 0.0, 1.0);
          vec3 disp = vec3(0.0);

          disp += gerstner(xz, vec2(0.85, 0.52),  0.72, 28.0, 1.05, tangent, binormal);
          disp += gerstner(xz, vec2(-0.35, 0.93), 0.42, 17.5, 1.25, tangent, binormal);
          disp += gerstner(xz, vec2(0.52, -0.85), 0.24, 10.5, 1.45, tangent, binormal);
          disp += gerstner(xz, vec2(-0.92, -0.38),0.14,  6.4, 1.75, tangent, binormal);

          wp.xyz += disp;
          vWorldPos = wp.xyz;
          vNormal = normalize(cross(binormal, tangent));
          vCrest = disp.y;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uLightDir;
        uniform vec3 uDeepColor;
        uniform vec3 uCrestColor;
        uniform vec3 uFoamColor;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying float vCrest;

        void main() {
          vec3 N = normalize(vNormal);
          vec3 V = normalize(cameraPosition - vWorldPos);
          float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.2);

          vec3 baseCol = mix(uDeepColor, uCrestColor, clamp(vCrest * 0.55 + 0.45, 0.0, 1.0));
          // Moonlight specular
          vec3 H = normalize(uLightDir + V);
          float spec = pow(max(dot(N, H), 0.0), 90.0) * 0.95;

          // Whitecap foam on high crests
          float foam = smoothstep(0.68, 1.25, vCrest) * 0.55;
          vec3 col = mix(baseCol, uFoamColor, foam);
          col += vec3(0.55, 0.78, 0.96) * spec + vec3(0.08, 0.18, 0.30) * fresnel;

          // Distance night fog blend
          float dist = length(cameraPosition - vWorldPos);
          float fogF = 1.0 - exp(-pow(dist * 0.011, 2.0));
          col = mix(col, vec3(0.008, 0.031, 0.078), clamp(fogF, 0.0, 1.0));

          gl_FragColor = vec4(col, 0.96);
        }
      `
    });

    this.oceanMesh = new THREE.Mesh(geo, mat);
    this.scene.add(this.oceanMesh);
  }

  _buildMarineSnow() {
    this.SNOW_COUNT = 2600;
    this.SNOW_BOX = 34.0;
    this.SNOW_HALF = this.SNOW_BOX * 0.5;
    this.snowPos = new Float32Array(this.SNOW_COUNT * 3);
    this.snowSeeds = new Float32Array(this.SNOW_COUNT * 2);

    for (let i = 0; i < this.SNOW_COUNT; i++) {
      this.snowPos[i * 3]     = (Math.random() - 0.5) * this.SNOW_BOX;
      this.snowPos[i * 3 + 1] = -80 + (Math.random() - 0.5) * this.SNOW_BOX;
      this.snowPos[i * 3 + 2] = (Math.random() - 0.5) * this.SNOW_BOX;
      this.snowSeeds[i * 2]     = Math.random() * Math.PI * 2;
      this.snowSeeds[i * 2 + 1] = 0.08 + Math.random() * 0.15;
    }

    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(210,235,250,0.85)');
    g.addColorStop(1, 'rgba(120,180,220,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.snowPos, 3));
    const mat = new THREE.PointsMaterial({
      map: new THREE.CanvasTexture(c),
      color: 0xaad0ee,
      size: 0.085,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.marineSnow = new THREE.Points(geo, mat);
    this.marineSnow.frustumCulled = false;
    this.scene.add(this.marineSnow);
  }

  _buildROVBeam() {
    const geo = new THREE.ConeGeometry(3.2, 13.0, 24, 1, true);
    geo.translate(0, -6.5, 0);
    geo.rotateX(-Math.PI * 0.5);

    this.beamUniforms = {
      uColor: { value: new THREE.Color(0x5aaae0) },
      uIntensity: { value: 0.09 }
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.beamUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec3 vN;
        varying vec3 vV;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = -mv.xyz;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uIntensity;
        varying vec3 vN;
        varying vec3 vV;
        varying vec2 vUv;
        void main() {
          float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.7);
          float axial = smoothstep(0.0, 0.22, vUv.y) * smoothstep(1.0, 0.15, vUv.y);
          gl_FragColor = vec4(uColor, edge * axial * uIntensity);
        }
      `
    });
    this.rovBeam = new THREE.Mesh(geo, mat);
    this.rovBeam.frustumCulled = false;
    this.scene.add(this.rovBeam);
  }

  // Exact CPU mirror of the 4-directional Gerstner wave formula
  getWaveStateAt(x, z, time = this.time) {
    let height = 0;
    let dHdX = 0;
    let dHdZ = 0;
    let primaryPhase = 0;

    for (let i = 0; i < WAVES.length; i++) {
      const w = WAVES[i];
      const lenD = Math.hypot(w.dx, w.dz);
      const dx = w.dx / lenD;
      const dz = w.dz / lenD;
      const k = (Math.PI * 2) / w.len;
      const c = Math.sqrt(9.8 / k) * w.speed;
      const f = k * (dx * x + dz * z - c * time);
      if (i === 0) primaryPhase = ((f % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      height += w.amp * Math.sin(f);
      const slope = w.amp * k * Math.cos(f);
      dHdX += slope * dx;
      dHdZ += slope * dz;
    }

    return {
      height,
      pitch: Math.atan(dHdZ) * 0.65,
      roll: Math.atan(-dHdX) * 0.85,
      phase: primaryPhase // [0, 2*PI]; crest near PI/2
    };
  }

  setFogForView(isDeepSea) {
    if (isDeepSea) {
      this.scene.background.copy(this.abyssFogColor);
      this.fog.color.copy(this.abyssFogColor);
      this.fog.density = 0.042;
      this.oceanMesh.visible = false;
      this.skyDome.visible = false;
      this.marineSnow.visible = true;
      this.rovBeam.visible = true;
    } else {
      this.scene.background.copy(this.surfaceFogColor);
      this.fog.color.copy(this.surfaceFogColor);
      this.fog.density = 0.011;
      this.oceanMesh.visible = true;
      this.skyDome.visible = true;
      this.marineSnow.visible = false;
      this.rovBeam.visible = false;
    }
  }

  update(dt, vesselPos, rovCamPos, rovTargetPos, lightPower = 0.45) {
    const safeDt = Math.min(0.05, Math.max(0.001, dt));
    this.time += safeDt;
    this.oceanUniforms.uTime.value = this.time;

    // Keep ocean mesh & sky centered around vessel XZ so sea feels infinite
    if (vesselPos) {
      this.oceanMesh.position.x = Math.floor(vesselPos.x / 10) * 10;
      this.oceanMesh.position.z = Math.floor(vesselPos.z / 10) * 10;
      this.skyDome.position.set(vesselPos.x, 0, vesselPos.z);
    }

    // Wrap marine snow around ROV camera
    if (rovCamPos) {
      const cx = rovCamPos.x, cy = rovCamPos.y, cz = rovCamPos.z;
      const arr = this.snowPos;
      for (let i = 0; i < this.SNOW_COUNT; i++) {
        const i3 = i * 3;
        const seed = this.snowSeeds[i * 2];
        const sink = this.snowSeeds[i * 2 + 1];
        let x = arr[i3] + Math.sin(this.time * 0.7 + seed) * 0.03 * safeDt;
        let y = arr[i3 + 1] - sink * safeDt;
        let z = arr[i3 + 2] + Math.cos(this.time * 0.6 + seed) * 0.03 * safeDt;

        if (x - cx > this.SNOW_HALF) x -= this.SNOW_BOX;
        else if (x - cx < -this.SNOW_HALF) x += this.SNOW_BOX;
        if (y - cy > this.SNOW_HALF) y -= this.SNOW_BOX;
        else if (y - cy < -this.SNOW_HALF) y += this.SNOW_BOX;
        if (z - cz > this.SNOW_HALF) z -= this.SNOW_BOX;
        else if (z - cz < -this.SNOW_HALF) z += this.SNOW_BOX;

        arr[i3] = x; arr[i3 + 1] = y; arr[i3 + 2] = z;
      }
      this.marineSnow.geometry.attributes.position.needsUpdate = true;

      this.rovBeam.position.copy(rovCamPos);
      if (rovTargetPos) this.rovBeam.lookAt(rovTargetPos);
      this.beamUniforms.uIntensity.value = 0.03 + lightPower * 0.14;
    }
  }
}
