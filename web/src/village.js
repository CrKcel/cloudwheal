import * as THREE from "three";
import { VoxelBatch, mulberry32, hash3, jitterColor } from "./voxel.js";
import { DECK_Y } from "./whale.js";

const C = {
  wood: 0x5a3a29,
  woodDark: 0x3f2a20,
  woodLight: 0x805636,
  woodRed: 0x97413a,
  goldDark: 0xa87f3a,
  stone: 0xc5b493,
  stoneDark: 0x938975,
  stoneLight: 0xd8c9aa,
  gold: 0xd3a956,
  goldLight: 0xf0d392,
  cream: 0xecdfc0,
  creamWarm: 0xf1e6cc,
  plasterRose: 0xe8d2bd,
  plasterMint: 0xd7ded0,
  roofRust: 0xa25240,
  roofRustDark: 0x824033,
  roofTeal: 0x2f6763,
  roofTealDark: 0x24504f,
  roofIndigo: 0x405a80,
  roofIndigoDark: 0x304567,
  window: 0xffc66e,
  windowBright: 0xffe0a1,
  cyan: 0x86eadb,
  leafDeep: 0x3c6a58,
  leaf: 0x5d8b67,
  leafLight: 0x85a977,
  leafGold: 0xc6a45e,
  sakura: 0xe4a6b4,
  sakuraLight: 0xf1c4ce,
  water: 0x4f9f9b,
  flowerA: 0xef9a9a,
  flowerB: 0xf4d486,
  flowerC: 0x97d4c6,
};

function buildRoof(solid, rand, hw, hd, topY, overhang, roofColor, roofDark, ridgeGold = true) {
  const roofH = 4;
  for (let i = 0; i < roofH; i++) {
    const xh = hw + overhang - i * 0.55;
    const zh = hd + overhang - i * 0.95;
    const y = topY + i * 0.62;
    for (let x = -Math.floor(xh); x <= Math.floor(xh); x++) {
      for (let z = -Math.floor(zh); z <= Math.floor(zh); z++) {
        const edge = Math.abs(z) >= Math.floor(zh) || Math.abs(x) >= Math.floor(xh);
        let col = jitterColor(hash3(x, i, z, 55) > 0.65 ? roofDark : roofColor, 0.04, rand);
        if (i === 0 && edge) col = jitterColor(C.gold, 0.04, rand);
        solid.add(x, y, z, col, { scale: 0.96 });
      }
    }
  }
  if (ridgeGold) {
    const y = topY + roofH * 0.62 + 0.2;
    const len = Math.floor(hw + overhang - (roofH - 1) * 0.55);
    for (let x = -len; x <= len; x++) {
      solid.add(x, y, 0, C.gold, { scale: 0.55 });
    }
    solid.add(-len - 0.5, y + 0.35, 0, C.goldLight, { scale: 0.42 });
    solid.add(len + 0.5, y + 0.35, 0, C.goldLight, { scale: 0.42 });
  }
}

function createHouse(materials, options) {
  const {
    x, z, baseY, rot = 0, hw = 3, hd = 2, floors = 2, roofColor = C.roofRust,
    roofDark = C.roofRustDark, wallColor = C.cream, seed = 1, chimney = true,
  } = options;
  const group = new THREE.Group();
  group.position.set(x, baseY, z);
  group.rotation.y = rot;
  group.name = "whale-village-house";

  const solid = new VoxelBatch();
  const warm = new VoxelBatch();
  const cool = new VoxelBatch();
  const rand = mulberry32(seed);

  // Stone plinth and supporting piers reaching toward the whale's back.
  solid.addBox(-hw - 0.7, hw + 0.7, -0.7, 0, -hd - 0.7, hd + 0.7, C.stone, {
    scale: 0.94, jitter: 0.04, rand,
  });
  for (let x2 = -hw; x2 <= hw; x2 += 2) {
    for (let z2 = -hd; z2 <= hd; z2 += 2) {
      if ((x2 + z2) % 2 !== 0) continue;
      for (let y = -0.9; y > -3.2; y -= 0.7) {
        solid.add(x2, y, z2, C.stoneDark, { scale: 0.5 });
      }
    }
  }

  const wallTop = floors * 2.35;
  for (let y = 0.4; y <= wallTop; y += 1) {
    for (let x2 = -hw; x2 <= hw; x2++) {
      for (let z2 = -hd; z2 <= hd; z2++) {
        const edge = Math.abs(x2) === hw || Math.abs(z2) === hd;
        if (!edge) continue;
        const corner = Math.abs(x2) === hw && Math.abs(z2) === hd;
        let col = jitterColor(wallColor, 0.025, rand);
        if (corner) col = C.woodDark;
        if (Math.abs(y - 2.35) < 0.2) col = C.wood;
        if (y > wallTop - 0.2) col = C.woodDark;
        solid.add(x2, y, z2, col, { scale: 0.95 });
      }
    }
  }
  // Corner and intermediate framing.
  for (const sx of [-hw, hw]) {
    for (const sz of [-hd, hd]) {
      for (let y = 0.6; y <= wallTop - 0.2; y += 1) {
        solid.add(sx, y, sz, C.wood, { scale: 0.72 });
      }
    }
  }
  for (const sx of [-hw, hw]) {
    for (const sz of [-hd, hd]) {
      solid.add(sx + (sx > 0 ? 0.35 : -0.35), wallTop + 0.35, sz, C.gold, { scale: 0.34 });
    }
  }

  // Windows: warm mullioned panels.
  const windowRows = floors;
  for (let f = 0; f < windowRows; f++) {
    const wy = 1.25 + f * 2.35;
    for (const side of [-1, 1]) {
      const zFace = side * hd;
      for (const wx of [-1.5, 1.5]) {
        if (wx > hw - 0.8) continue;
        warm.add(wx, wy, zFace + side * 0.56, C.window, { scale: 0.48 });
        warm.add(wx, wy + 0.7, zFace + side * 0.56, C.windowBright, { scale: 0.44 });
        solid.add(wx, wy + 0.35, zFace + side * 0.63, C.woodDark, { scale: 0.24 });
      }
    }
    for (const side of [-1, 1]) {
      if (f === 0) continue;
      const xFace = side * hw;
      warm.add(xFace + side * 0.56, wy, 0, C.window, { scale: 0.46 });
      solid.add(xFace + side * 0.63, wy + 0.3, 0, C.woodDark, { scale: 0.22 });
    }
  }

  // Door.
  solid.add(0, 1.15, hd + 0.56, C.woodDark, { scale: 0.8 });
  solid.addBox(-0.7, 0.7, 0.4, 2.0, hd + 0.62, hd + 0.62, C.wood, { scale: 0.74, jitter: 0.02, rand });
  solid.add(0, 2.25, hd + 0.8, C.gold, { scale: 0.5 });
  warm.add(0, 2.5, hd + 0.7, C.window, { scale: 0.28 });

  // Striped awning above the entrance.
  for (let ax = -2; ax <= 2; ax++) {
    const c = (ax + 2) % 2 === 0 ? C.roofTeal : C.cream;
    solid.add(ax, 2.75, hd + 1.2, c, { scale: 0.62 });
    solid.add(ax, 3.2, hd + 1.7, c, { scale: 0.55 });
  }
  solid.add(-2.3, 2.8, hd + 1.2, C.wood, { scale: 0.45 });
  solid.add(2.3, 2.8, hd + 1.2, C.wood, { scale: 0.45 });

  buildRoof(solid, rand, hw, hd, wallTop + 0.6, 1.35, roofColor, roofDark);

  if (chimney) {
    const cx = hw - 0.6;
    const cz = -hd + 0.6;
    for (let y = wallTop + 1; y < wallTop + 4.6; y += 0.8) {
      solid.add(cx, y, cz, C.stoneDark, { scale: 0.7 });
    }
    solid.add(cx, wallTop + 4.8, cz, C.stone, { scale: 0.9 });
    cool.add(cx, wallTop + 5.4, cz, 0x645c6a, { scale: 0.05 });
  }

  // Flower boxes.
  for (const wx of [-2, 2]) {
    if (wx > hw - 0.4) continue;
    solid.add(wx, 0.85, hd + 0.85, C.wood, { scale: 0.3 });
    warm.add(wx - 0.4, 1.15, hd + 0.85, C.flowerA, { scale: 0.22 });
    warm.add(wx + 0.4, 1.25, hd + 0.85, C.window, { scale: 0.2 });
    cool.add(wx, 1.3, hd + 0.85, C.flowerC, { scale: 0.2 });
  }

  solid.build(materials.solid, { castShadow: true, receiveShadow: true, parent: group, name: "house" });
  warm.build(materials.warmGlow, { castShadow: false, receiveShadow: false, parent: group });
  cool.build(materials.coolGlow, { castShadow: false, receiveShadow: false, parent: group });
  return group;
}

function addTree(solid, warm, cool, x, y, z, style, scale = 1, seed = 1) {
  const rand = mulberry32(seed);
  const height = Math.round((4 + rand() * 3) * scale);
  for (let i = 0; i < height; i++) {
    solid.add(x, y + i * 0.85, z, jitterColor(i < height - 2 ? C.wood : C.woodLight, 0.04, rand), {
      scale: 0.42 + (1 - i / height) * 0.2,
    });
    if (i === Math.floor(height * 0.55)) {
      solid.add(x + 0.7, y + i * 0.85 + 0.5, z + 0.3, C.wood, { scale: 0.26 });
    }
  }
  const top = y + height * 0.85;
  if (style === "sakura") {
    for (let i = 0; i < 4; i++) {
      const bx = x + (rand() - 0.5) * 3.4 * scale;
      const bz = z + (rand() - 0.5) * 3.4 * scale;
      const by = top + (rand() - 0.2) * 1.6 * scale;
      for (let px = -1.5; px <= 1.5; px += 0.75) {
        for (let pz = -1.5; pz <= 1.5; pz += 0.75) {
          for (let py = -0.7; py <= 0.7; py += 0.7) {
            if (px * px + py * py + pz * pz > 2.1) continue;
            solid.add(bx + px * scale, by + py * scale, bz + pz * scale, jitterColor(rand() > 0.5 ? C.sakura : C.sakuraLight, 0.05, rand), {
              scale: 0.5 * scale,
            });
          }
        }
      }
    }
    for (let i = 0; i < 6; i++) {
      cool.add(x + (rand() - 0.5) * 4, top + rand() * 2, z + (rand() - 0.5) * 4, C.sakuraLight, { scale: 0.22 });
    }
  } else if (style === "pine") {
    for (let layer = 0; layer < 3; layer++) {
      const radius = (2.4 - layer * 0.55) * scale;
      const ly = top - layer * 1.05 * scale;
      for (let px = -2; px <= 2; px++) {
        for (let pz = -2; pz <= 2; pz++) {
          if (px * px + pz * pz > radius * radius + 0.5) continue;
          solid.add(x + px * scale, ly, z + pz * scale, jitterColor(layer % 2 ? C.leaf : C.leafDeep, 0.04, rand), {
            scale: 0.5 * scale,
          });
        }
      }
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const r = (1.6 + rand() * 1.3) * scale;
      const ox = (rand() - 0.5) * 2.2 * scale;
      const oz = (rand() - 0.5) * 2.2 * scale;
      const oy = top + (rand() - 0.3) * 1.7 * scale;
      for (let px = -2; px <= 2; px += 0.8) {
        for (let pz = -2; pz <= 2; pz += 0.8) {
          for (let py = -1; py <= 1; py += 0.8) {
            if (px * px + py * py + pz * pz > 4.4) continue;
            const col = style === "gold" ? (rand() > 0.45 ? C.leafGold : C.gold) : (rand() > 0.6 ? C.leafLight : C.leaf);
            solid.add(x + ox + px * scale, oy + py * scale, z + oz + pz * scale, jitterColor(col, 0.05, rand), {
              scale: 0.55 * scale,
            });
          }
        }
      }
      if (style === "gold" && i === 0) {
        warm.add(x + ox, oy + 1.2 * scale, z + oz, C.windowBright, { scale: 0.3 });
      }
    }
  }
}

function createWindmill(materials, options) {
  const { x, z, baseY, rot = 0, scale = 1, seed = 1 } = options;
  const group = new THREE.Group();
  group.position.set(x, baseY, z);
  group.rotation.y = rot;
  group.name = "whale-windmill";

  const solid = new VoxelBatch();
  const warm = new VoxelBatch();
  const rand = mulberry32(seed);

  solid.addBox(-3, 3, -1.4, 0, -3, 3, C.stone, { scale: 0.94, jitter: 0.03, rand });
  for (let x2 = -2; x2 <= 2; x2++) {
    for (let z2 = -2; z2 <= 2; z2++) {
      if (x2 * x2 + z2 * z2 > 5) continue;
      for (let y = 0.4; y < 7; y += 0.85) {
        const t = y / 7;
        const half = 2.2 - t * 0.9;
        if (Math.abs(x2) > half || Math.abs(z2) > half) continue;
        solid.add(x2, y, z2, jitterColor(Math.abs(x2) > half - 1 && Math.abs(z2) > half - 1 ? C.wood : C.cream, 0.035, rand), {
          scale: 0.7,
        });
      }
    }
  }
  for (let i = 0; i < 4; i++) {
    const y = 1.5 + i * 1.35;
    solid.addBox(-2.4 + i * 0.2, 2.4 - i * 0.2, y, y, 2.1 - i * 0.2, 2.1 - i * 0.2, C.woodDark, { scale: 0.5, jitter: 0.02, rand });
  }
  warm.add(0, 4.1, 2.55, C.window, { scale: 0.5 });
  warm.add(0, 5.4, 2.35, C.windowBright, { scale: 0.36 });
  // Domed cap.
  for (let y = 7; y < 8.6; y += 0.7) {
    const r = Math.max(0, 2.2 - (y - 7) * 0.9);
    for (let px = -2; px <= 2; px++) {
      for (let pz = -2; pz <= 2; pz++) {
        if (px * px + pz * pz > r * r + 0.4) continue;
        solid.add(px, y, pz, jitterColor(C.roofTeal, 0.04, rand), { scale: 0.6 });
      }
    }
  }
  solid.add(0, 8.7, 0, C.gold, { scale: 0.45 });

  const blades = new THREE.Group();
  blades.position.set(0, 7.4, 2.8);
  const bladeBatch = new VoxelBatch();
  for (let arm = 0; arm < 4; arm++) {
    const a = (arm / 4) * Math.PI * 2;
    for (let r = 1; r <= 5; r += 0.8) {
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      bladeBatch.add(px, py, 0, C.woodDark, { scale: 0.28 });
      if (r > 1.6) {
        const nx = Math.cos(a + Math.PI / 2) * 0.38;
        const ny = Math.sin(a + Math.PI / 2) * 0.38;
        bladeBatch.add(px + nx, py + ny, 0.3, C.creamWarm, { scale: 0.5 });
      }
    }
  }
  bladeBatch.add(0, 0, 0.6, C.gold, { scale: 0.55 });
  bladeBatch.build(materials.solid, { castShadow: true, receiveShadow: true, parent: blades, name: "windmill-blades" });
  group.add(blades);

  solid.build(materials.solid, { castShadow: true, receiveShadow: true, parent: group, name: "windmill" });
  warm.build(materials.warmGlow, { castShadow: false, receiveShadow: false, parent: group });
  group.scale.setScalar(scale);
  return { group, blades, speed: 0.5 + rand() * 0.35 };
}

function createGarden(materials, parent, solid, warm, cool) {
  const rand = mulberry32(4901);
  const x0 = -12;
  const z0 = 14.9;
  const halfX = 6.5;
  const halfZ = 3.8;
  const y = 9.8;

  // Wooden terrace.
  for (let x = -halfX; x <= halfX; x += 1) {
    for (let z = -halfZ; z <= halfZ; z += 1) {
      const inPond = x > -4.5 && x < 2.5 && z > -2.2 && z < 2;
      if (inPond) continue;
      const border = Math.abs(x) > halfX - 1 || Math.abs(z) > halfZ - 1;
      solid.add(x0 + x, y, z0 + z, jitterColor(border ? C.wood : C.stoneLight, 0.04, rand), {
        scale: 0.94,
      });
    }
  }
  for (let x = -halfX; x <= halfX; x += 3) {
    for (let z = -halfZ; z <= halfZ; z += 3) {
      for (let yy = y - 0.6; yy > y - 4.2; yy -= 0.8) {
        solid.add(x0 + x, yy, z0 + z, C.wood, { scale: 0.45 });
      }
    }
  }
  // Railing around the outer edge.
  for (let x = -halfX; x <= halfX; x += 1.5) {
    for (const z of [-halfZ, halfZ]) {
      solid.add(x0 + x, y + 0.9, z0 + z, C.woodDark, { scale: 0.26 });
      solid.add(x0 + x, y + 1.5, z0 + z, C.woodLight, { scale: 0.18 });
    }
  }

  // Pond surface and stepping stones.
  const pondGeo = new THREE.BoxGeometry(7.2, 0.22, 4.3);
  const pond = new THREE.Mesh(pondGeo, materials.water);
  pond.position.set(x0 - 1, y + 0.36, z0);
  pond.receiveShadow = true;
  parent.add(pond);

  for (let i = 0; i < 9; i++) {
    const px = x0 - 4.2 + rand() * 6.4;
    const pz = z0 - 1.7 + rand() * 3.4;
    solid.add(px, y + 0.55, pz, jitterColor(C.stoneDark, 0.05, rand), { scale: 0.36 });
    if (rand() > 0.7) warm.add(px, y + 0.66, pz, rand() > 0.5 ? C.flowerA : C.flowerB, { scale: 0.16 });
  }
  // Koi.
  for (let i = 0; i < 4; i++) {
    const px = x0 - 3.6 + rand() * 5.2;
    const pz = z0 - 1.4 + rand() * 2.8;
    warm.add(px, y + 0.52, pz, i % 2 ? 0xffb06d : 0xfff0d2, { scale: 0.23 });
  }

  // Arched bridge across the pond.
  const bridgeX = x0 - 1;
  for (let z = -4; z <= 4; z++) {
    const t = (z + 4) / 8;
    const arch = Math.sin(t * Math.PI) * 1.35;
    const yy = y + 0.4 + arch;
    solid.addBox(bridgeX - 1.7, bridgeX + 1.7, yy, yy, z0 + z, z0 + z, C.wood, {
      scale: 0.9,
      jitter: 0.03,
      rand,
    });
    for (const sx of [-1.8, 1.8]) {
      solid.add(bridgeX + sx, yy + 0.7, z0 + z, C.woodDark, { scale: 0.22 });
      if (Math.abs(z) % 2 === 0) {
        solid.add(bridgeX + sx, yy + 1.25, z0 + z, C.gold, { scale: 0.24 });
      }
    }
    if (Math.abs(z) === 4) {
      solid.add(bridgeX - 1.8, yy + 1.7, z0 + z, C.goldLight, { scale: 0.32 });
      solid.add(bridgeX + 1.8, yy + 1.7, z0 + z, C.goldLight, { scale: 0.32 });
    }
  }

  // Stone lanterns, bonsai and flowers.
  for (const [lx, lz] of [[x0 + 4.8, z0 - 2.5], [x0 - 5, z0 + 2.6], [x0 + 3.5, z0 + 2.7]]) {
    for (let yy = y + 0.5; yy <= y + 1.7; yy += 0.6) {
      solid.add(lx, yy, lz, C.stoneDark, { scale: 0.36 });
    }
    warm.add(lx, y + 2.05, lz, C.window, { scale: 0.38 });
    solid.add(lx, y + 2.45, lz, C.stone, { scale: 0.7 });
  }
  addTree(solid, warm, cool, x0 - 4.6, y + 0.65, z0 + 2.7, "sakura", 0.9, 811);
  addTree(solid, warm, cool, x0 + 4.8, y + 0.65, z0 + 2.6, "gold", 0.72, 822);
  addTree(solid, warm, cool, x0 + 5.2, y + 0.65, z0 - 2.7, "pine", 0.7, 833);

  for (let i = 0; i < 36; i++) {
    const fx = x0 + (rand() - 0.5) * 11;
    const fz = z0 + (rand() - 0.5) * 6;
    const inPond = fx > x0 - 4.5 && fx < x0 + 2.5 && Math.abs(fz - z0) < 2;
    if (inPond) continue;
    const targets = [warm, cool, warm];
    const colors = [C.flowerA, C.flowerB, C.flowerC, C.windowBright];
    targets[Math.floor(rand() * targets.length)].add(fx, y + 0.62, fz, colors[Math.floor(rand() * colors.length)], {
      scale: 0.16 + rand() * 0.12,
    });
  }

  // Small pavilion edge.
  for (const sx of [-halfX + 1, halfX - 1]) {
    for (let yy = y + 0.4; yy < y + 3.3; yy += 0.85) {
      solid.add(x0 + sx, yy, z0 - halfZ + 1, C.woodRed ?? C.wood, { scale: 0.38 });
    }
  }
}

function createMarket(solid, warm, x, y, z, accent, seed) {
  const rand = mulberry32(seed);
  for (const sx of [-1.8, 1.8]) {
    for (const sz of [-1.4, 1.4]) {
      for (let yy = y + 0.4; yy <= y + 2.6; yy += 0.7) {
        solid.add(x + sx, yy, z + sz, C.wood, { scale: 0.3 });
      }
    }
  }
  for (let px = -2; px <= 2; px++) {
    for (let pz = -1.6; pz <= 1.6; pz++) {
      if (Math.abs(pz) < 1 && rand() < 0.7) continue;
      solid.add(x + px, y + 2.9, z + pz, (px + 2) % 2 === 0 ? accent : C.cream, { scale: 0.62 });
      if (Math.abs(pz) === 1.6) solid.add(x + px, y + 3.25, z + pz, accent, { scale: 0.5 });
    }
  }
  solid.addBox(x - 1.8, x + 1.8, y + 1.4, y + 1.5, z - 0.6, z + 0.6, C.woodLight, { scale: 0.8, jitter: 0.02, rand });
  for (let i = 0; i < 5; i++) {
    warm.add(x - 1.4 + rand() * 2.8, y + 1.7, z - 0.4 + rand() * 0.8, [C.flowerA, C.flowerB, C.flowerC][i % 3], { scale: 0.2 });
  }
  warm.add(x, y + 2.3, z + 1.1, C.window, { scale: 0.35 });
  for (let i = 0; i < 3; i++) {
    solid.add(x + 2.2, y + 0.5 + i * 0.5, z - 1.4, C.woodLight, { scale: 0.42 });
  }
}

function buildTorii(solid, warm, x, y, z, scale = 1) {
  const half = 2.7 * scale;
  for (const sx of [-half, half]) {
    for (let yy = 0.3; yy < 4.3 * scale; yy += 0.8) {
      solid.add(x + sx, y + yy, z, jitterColor(C.roofRustDark, 0.03, mulberry32(Math.round(sx * 10))), {
        scale: 0.62,
      });
    }
    solid.add(x + sx, y + 0.35, z, C.stoneDark, { scale: 0.8 });
    warm.add(x + sx, y + 1.8 * scale, z + 0.55, C.window, { scale: 0.28 });
  }
  const topY = y + 4.4 * scale;
  for (let dx = -Math.ceil(half) - 1; dx <= Math.ceil(half) + 1; dx++) {
    const tip = Math.abs(dx) > Math.ceil(half);
    solid.add(x + dx, topY + (tip ? 0.55 : 0), z, tip ? C.gold : C.roofRustDark, { scale: 0.55 });
    if (!tip) solid.add(x + dx, topY - 0.55, z, C.roofRust, { scale: 0.45 });
  }
  solid.add(x, topY + 1.05, z, C.goldLight, { scale: 0.42 });
  solid.add(x, topY - 1.2, z, C.woodDark, { scale: 0.5 });
}

export function buildVillage(materials) {
  const group = new THREE.Group();
  group.name = "whale-village";
  const solid = new VoxelBatch();
  const warm = new VoxelBatch();
  const cool = new VoxelBatch();
  const rand = mulberry32(20271);

  const houses = [
    { x: -30.2, z: -4.6, baseY: 9.15, rot: 0.34, hw: 3, hd: 2, floors: 2, roofColor: C.roofRust, roofDark: C.roofRustDark, wallColor: C.cream, seed: 11 },
    { x: -36.5, z: 3.1, baseY: 9.0, rot: -0.22, hw: 2, hd: 2, floors: 1, roofColor: C.roofTeal, roofDark: C.roofTealDark, wallColor: C.plasterMint, seed: 12 },
    { x: -26.9, z: 5.9, baseY: 9.4, rot: 1.42, hw: 2, hd: 2, floors: 1, roofColor: C.roofIndigo, roofDark: C.roofIndigoDark, wallColor: C.plasterRose, seed: 13 },
    { x: 31.6, z: -5.2, baseY: 7.5, rot: 2.7, hw: 3, hd: 2, floors: 2, roofColor: C.roofTeal, roofDark: C.roofTealDark, wallColor: C.cream, seed: 14 },
    { x: 35.2, z: 3.5, baseY: 7.3, rot: 3.48, hw: 2, hd: 2, floors: 1, roofColor: C.roofRust, roofDark: C.roofRustDark, wallColor: C.plasterRose, seed: 15 },
    { x: -5.5, z: -12.4, baseY: 9.3, rot: 0.08, hw: 3, hd: 2, floors: 1, roofColor: C.roofIndigo, roofDark: C.roofIndigoDark, wallColor: C.plasterMint, seed: 16 },
  ];
  for (const house of houses) {
    group.add(createHouse(materials, house));
  }

  const windmills = [];
  const windA = createWindmill(materials, { x: -35.3, z: -10.1, baseY: 9.0, rot: 0.55, scale: 1.0, seed: 31 });
  const windB = createWindmill(materials, { x: 29.4, z: 10.4, baseY: 7.7, rot: -0.65, scale: 0.78, seed: 32 });
  group.add(windA.group, windB.group);
  windmills.push(windA, windB);

  // Decks, platforms and supports for houses beyond the main plaza.
  for (const [px, py, pz, w, d] of [
    [-30.5, 9.0, -4.6, 5, 4.5], [-36.5, 8.9, 3.2, 4.8, 4.2], [-27, 9.25, 5.8, 4.6, 4],
    [31.6, 7.4, -5.1, 5, 4.3], [35, 7.2, 3.5, 4.5, 4], [-5.5, 9.2, -12.4, 5.5, 4.2],
    [-35.3, 8.9, -10, 5.5, 5.5], [29.4, 7.6, 10.3, 4.8, 4.8],
  ]) {
    solid.addBox(px - w / 2, px + w / 2, py - 0.2, py, pz - d / 2, pz + d / 2, C.wood, {
      scale: 0.9, jitter: 0.04, rand,
    });
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        if (Math.abs(i) + Math.abs(j) < 1) continue;
        for (let yy = py - 0.8; yy > py - 4.2; yy -= 0.8) {
          solid.add(px + i * w * 0.35, yy, pz + j * d * 0.35, C.woodDark, { scale: 0.42 });
        }
      }
    }
  }

  // Central torii over the front stairs.
  buildTorii(solid, warm, 0, DECK_Y, 9.6, 1.0);
  // A second, smaller torii by the left tower.
  buildTorii(solid, warm, -16.7, DECK_Y, -6.5, 0.62);

  // Market stalls.
  createMarket(solid, warm, -14.2, DECK_Y, -6, C.roofRust, 61);
  createMarket(solid, warm, 14.5, DECK_Y, 6.1, C.roofTeal, 62);

  // Side garden and a hanging tea garden.
  createGarden(materials, group, solid, warm, cool);

  // Trees around the plaza and on the tail.
  addTree(solid, warm, cool, -18.6, DECK_Y + 0.5, 5.8, "sakura", 0.88, 701);
  addTree(solid, warm, cool, 18.8, DECK_Y + 0.5, -5.6, "pine", 1.0, 702);
  addTree(solid, warm, cool, -18.5, DECK_Y + 0.5, -6.4, "gold", 0.9, 703);
  addTree(solid, warm, cool, 18.4, DECK_Y + 0.5, 6.2, "sakura", 0.75, 704);
  addTree(solid, warm, cool, -33.8, 9.15, 7.9, "pine", 0.8, 705);
  addTree(solid, warm, cool, -31.4, 9.25, -8.6, "gold", 0.7, 706);
  addTree(solid, warm, cool, 34.2, 7.35, -8.3, "pine", 0.8, 707);
  addTree(solid, warm, cool, 7.5, 9.5, -12.6, "sakura", 0.66, 708);
  addTree(solid, warm, cool, 24.8, 7.95, -2.1, "gold", 0.62, 709);

  // Flower beds and grasses at the plaza perimeter.
  for (let i = 0; i < 160; i++) {
    const a = rand() * Math.PI * 2;
    const r = 14 + rand() * 7;
    const fx = Math.cos(a) * r;
    const fz = Math.sin(a) * r * 0.45;
    if (Math.abs(fx) > 19.5 || Math.abs(fz) > 8.6) continue;
    if (Math.abs(fx) < 7 && Math.abs(fz) < 4) continue;
    const col = [C.leaf, C.leafLight, C.flowerA, C.flowerB, C.flowerC][Math.floor(rand() * 5)];
    const target = rand() > 0.7 ? warm : solid;
    target.add(fx, DECK_Y + 0.66, fz, col, { scale: 0.16 + rand() * 0.16 });
  }

  // Lantern strings across the plaza.
  const stringPositions = [
    [[-15, DECK_Y + 6.2, 7.7], [15, DECK_Y + 6.2, 7.7], 2.2],
    [[-16, DECK_Y + 5.4, -7.3], [16, DECK_Y + 5.4, -7.3], 2.8],
    [[-12, DECK_Y + 8.2, -5.9], [12, DECK_Y + 8.2, -5.9], 1.7],
  ];
  for (const [p0, p1, sag] of stringPositions) {
    const a = new THREE.Vector3(...p0);
    const b = new THREE.Vector3(...p1);
    solid.addCatenary(a, b, sag, C.woodDark, { steps: 32, scale: 0.16, onlyEvery: 1 });
    for (let i = 1; i < 10; i++) {
      const t = i / 10;
      const x = THREE.MathUtils.lerp(a.x, b.x, t);
      const y = THREE.MathUtils.lerp(a.y, b.y, t) - Math.sin(t * Math.PI) * sag;
      const z = THREE.MathUtils.lerp(a.z, b.z, t);
      warm.add(x, y - 0.55, z, i % 4 === 0 ? C.windowBright : C.window, { scale: 0.3 });
      solid.add(x, y - 0.2, z, C.gold, { scale: 0.15 });
    }
  }

  // Dock bollards, crates and a lookout telescope by the head.
  for (let i = 0; i < 8; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = -28 + i * 8;
    solid.add(x, 10.1, side * 13.2, C.woodDark, { scale: 0.4 });
    solid.add(x, 10.6, side * 13.2, C.gold, { scale: 0.24 });
  }
  for (let i = 0; i < 5; i++) {
    solid.add(21 + i * 0.8, 9.95, 7.8 - i * 0.2, C.woodLight, { scale: 0.55 });
  }
  for (let i = 0; i < 4; i++) {
    solid.add(22 + i * 0.7, 8.9 + i * 0.9, 2.2, C.goldDark, { scale: 0.22 });
  }

  solid.build(materials.solid, { castShadow: true, receiveShadow: true, parent: group, name: "village-grounds" });
  warm.build(materials.warmGlow, { castShadow: false, receiveShadow: false, parent: group, name: "village-lights" });
  cool.build(materials.coolGlow, { castShadow: false, receiveShadow: false, parent: group, name: "village-flowers" });

  return {
    group,
    windmills,
    update(dt) {
      for (const windmill of windmills) windmill.blades.rotation.z += dt * windmill.speed;
    },
  };
}
