import * as THREE from 'three';
import { GiantSquid } from './GiantSquid.js';
import { getTierForLength } from '../data/SquidTiersAndComments.js';

// Extends GiantSquid to configure all 6 size tiers (Tier 2 = baseline current model)
export function applySquidTierVisuals(squid, specimen) {
  const tierDef = specimen.tierDef || getTierForLength(specimen.lengthMeters || 8);
  const root = squid.getObject3D();

  // Apply anatomical scale & proportion tweaks per Tier
  const t = tierDef.tier;
  if (t === 1) {
    // Tier 1 (1-4m): Slim, translucent juvenile with slightly larger fin ratio
    root.scale.set(0.56, 0.56, 0.62);
    squid.fins.scale.set(1.22, 1.0, 1.18);
  } else if (t === 2) {
    // Tier 2 (5-10m): Baseline current model (2nd from bottom)
    root.scale.set(1.0, 1.0, 1.0);
    squid.fins.scale.set(1.0, 1.0, 1.0);
  } else if (t === 3) {
    // Tier 3 (11-15m): Thick muscular mantle, deeper crimson
    root.scale.set(1.26, 1.24, 1.22);
    squid.fins.scale.set(1.05, 1.05, 1.05);
  } else if (t === 4) {
    // Tier 4 (16-20m): Huge deep-sea lord, broader optic head & scarred hide
    root.scale.set(1.48, 1.44, 1.44);
    squid.fins.scale.set(1.1, 1.1, 1.1);
  } else if (t === 5) {
    // Tier 5 (21-25m): Kraken-class muscular girth & dramatic iridescence
    root.scale.set(1.72, 1.66, 1.68);
    squid.fins.scale.set(1.15, 1.15, 1.15);
  } else {
    // Tier 6 (26-30m): Legendary Abyss Emperor with bioluminescent accent & colossal girth
    root.scale.set(1.96, 1.90, 1.92);
    squid.fins.scale.set(1.24, 1.2, 1.22);
  }

  // Update skin material tint & iridescence per tier
  const tintCol = new THREE.Color(tierDef.tint);
  [squid.mantleMat, squid.finMat, squid.headMat, squid.armMat, squid.tentacleMat].forEach((m) => {
    if (!m) return;
    m.color.copy(tintCol);
    m.iridescence = tierDef.iridescence;
    if (tierDef.biolumRim > 0) {
      m.emissive = new THREE.Color(0x14385c);
      m.emissiveIntensity = tierDef.biolumRim * 0.45;
    } else {
      m.emissive = new THREE.Color(0x000000);
      m.emissiveIntensity = 0;
    }
  });

  // Add battle scars (sperm whale sucker marks) for Tier 3-6
  const oldScars = squid.mantle.getObjectByName('tierBattleScars');
  if (oldScars) squid.mantle.remove(oldScars);
  if (tierDef.hasScars) {
    const scarGroup = new THREE.Group();
    scarGroup.name = 'tierBattleScars';
    const scarMat = new THREE.MeshStandardMaterial({
      color: 0xf4dedc,
      roughness: 0.45,
      emissive: tierDef.biolumRim > 0.2 ? new THREE.Color(0x2d7ab8) : new THREE.Color(0x000000),
      emissiveIntensity: tierDef.biolumRim * 0.6
    });
    const scarCount = t === 3 ? 3 : t === 4 ? 6 : t === 5 ? 9 : 13;
    for (let i = 0; i < scarCount; i++) {
      const ang = (i * 2.1) % (Math.PI * 2);
      const zPos = 0.45 + ((i * 0.37) % 1.85);
      const r = 0.33 * (1.0 - (zPos / 2.85) * 0.45);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055 + (i % 3) * 0.015, 0.008, 6, 14), scarMat);
      ring.position.set(Math.cos(ang) * r, Math.sin(ang) * r, zPos);
      ring.lookAt(0, 0, zPos);
      scarGroup.add(ring);
    }
    squid.mantle.add(scarGroup);
  }

  return tierDef;
}

export function createTieredGiantSquid(specimen) {
  const squid = new GiantSquid();
  applySquidTierVisuals(squid, specimen);
  return squid;
}
