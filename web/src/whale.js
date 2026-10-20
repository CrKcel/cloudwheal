import * as THREE from "three";
import { VoxelBatch, mulberry32, hash3, jitterColor } from "./voxel.js";

export const DECK_Y = 11.2;
export const WHEEL_CENTER = new THREE.Vector3(0, 33.5, 0);
export const TOWER_X = 24.2;
export const WHALE_GROUP_Y = 5.5;

const C = {
  body: 0x3d5278,
  bodyLight: 0x516991,
  bodyDark: 0x2c3f61,
  top: 0x5b7397,
  belly: 0xbfd1dc,
  bellyShade: 0xa7bdcb,
  bellyStripe: 0xd7e3ea,
  moss: 0x5e7d59,
  mossLight: 0x7d996d,
  mossDark: 0x47654d,
  stone: 0xc5b696,
  stoneLight: 0xd8c9a8,
  stoneDark: 0x988e79,
  wood: 0x5c3b29,
  woodLight: 0x805635,
  gold: 0xd4aa58,
  goldLight: 0xf0d18f,
  teal: 0x2e6965,
  window: 0xffce7a,
  cyan: 0x86f3e1,
};

function insideBody(x, y, z) {
  const nx = (x - 3) / 37;
  const ny = (y - 0.4) / 10.6;
  const nz = z / 12.4;
  if (nx * nx + ny * ny + nz * nz <= 1) return true;

  const headX = (x - 27) / 13;
  const headY = (y + 2.4) / 6.2;
  const headZ = z / 9.2;
  if (headX * headX + headY * headY + headZ * headZ <= 1) return true;

  if (x < -18 && x > -61) {
    const t = THREE.MathUtils.clamp((x + 58) / 39, 0, 1);
    const cy = 0.4 + Math.pow(1 - t, 1.7) * 10.6;
    const ry = 1 + t * 8.8;
    const rz = 1.5 + t * 10.4;
    const ty = (y - cy) / ry;
    const tz = z / rz;
    if (ty * ty + tz * tz <= 1) return true;
  }

  for (const s of [-1, 1]) {
    const fx = (x + 59) / 9;
    const fy = (y - 12.8) / 1.9;
    const fz = (z - s * 7.4) / 8.8;
    if (fx * fx + fy * fy + fz * fz <= 1) return true;
  }

  for (const s of [-1, 1]) {
    const fx = (x - 9) / 12;
    const fy = (y + 5.2) / 2.5;
    const fz = (Math.abs(z) - 17.5) / 9;
    if (fx * fx + fy * fy + fz * fz <= 1) return true;
  }

  return false;
}

export function insideWhale(x, y, z) {
  return insideBody(x, y, z);
}

function surfaceZ(x, y, side) {
  for (let z = 24; z >= 0; z -= 0.5) {
    const zz = z * side;
    if (insideBody(x, y, zz)) return zz;
  }
  return null;
}

function bodyColor(x, y, z, rand, isTop, isBottom) {
  const n = hash3(x, y, z, 31);
  if (isTop) {
    const topRegion = y > 4.2 && x > -37 && x < 31;
    if (topRegion) {
      const mossNoise = Math.sin(x * 0.21 + z * 0.31) + Math.cos(z * 0.19 - x * 0.11) + (n - 0.5) * 1.1;
      if (mossNoise > 0.62) {
        return jitterColor(n > 0.55 ? C.moss : n > 0.25 ? C.mossLight : C.mossDark, 0.06, rand);
      }
      return jitterColor(n > 0.6 ? C.top : C.bodyLight, 0.05, rand);
    }
    return jitterColor(n > 0.58 ? C.bodyLight : C.body, 0.05, rand);
  }

  if (isBottom) {
    if (x > 16 && y < -1 && Math.floor((z + 30) / 2) % 3 === 0) {
      return jitterColor(C.bellyStripe, 0.03, rand);
    }
    return jitterColor(n > 0.5 ? C.belly : C.bellyShade, 0.04, rand);
  }

  if (y < -1 && x > 10) {
    return jitterColor(n > 0.55 ? C.bellyShade : C.bodyLight, 0.04, rand);
  }

  const streak = Math.sin(x * 0.32 + y * 0.6) + Math.cos(z * 0.4);
  if (streak > 1.05 && n > 0.45) return jitterColor(C.bodyLight, 0.04, rand);
  if (streak < -1.2) return jitterColor(C.bodyDark, 0.04, rand);
  return jitterColor(C.body, 0.045, rand);
}

function buildWhaleShell(solid, glowWarm, glowCool) {
  const rand = mulberry32(4177);
  for (let x = -61; x <= 41; x++) {
    for (let y = -13; y <= 14; y++) {
      for (let z = -24; z <= 24; z++) {
        if (!insideBody(x, y, z)) continue;
        const exposed = !insideBody(x + 1, y, z) || !insideBody(x - 1, y, z) ||
          !insideBody(x, y + 1, z) || !insideBody(x, y - 1, z) ||
          !insideBody(x, y, z + 1) || !insideBody(x, y, z - 1);
        if (!exposed) continue;

        const isTop = !insideBody(x, y + 1, z);
        const isBottom = !insideBody(x, y - 1, z);
        const color = bodyColor(x, y, z, rand, isTop, isBottom);
        solid.add(x, y, z, color, { scale: 0.985 });

        if (isTop && y > 6 && rand() > 0.975) {
          glowCool.add(x, y + 0.4, z, rand() > 0.5 ? C.cyan : 0xa8ffe9, { scale: 0.36 });
        }
      }
    }
  }

  const randGlow = mulberry32(6619);
  for (const side of [-1, 1]) {
    // Expressive eye: dark rim, warm sclera, dark pupil and cool glint.
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const ex = 34.6 + dx;
        const ey = 2.2 + dy;
        const sz = surfaceZ(ex, ey, side);
        if (sz === null) continue;
        const rim = Math.abs(dx) === 2 || Math.abs(dy) === 2;
        if (rim) {
          if (Math.abs(dx) === 2 && Math.abs(dy) === 2) continue;
          solid.add(ex, ey, sz + side * 0.62, 0x102039, { scale: 0.98 });
        } else if (dx >= 0 && dy >= 0) {
          solid.add(ex, ey, sz + side * 1.14, 0x091729, { scale: 0.94 });
          if (dx === 1 && dy === 1) {
            glowCool.add(ex + 0.26, ey + 0.26, sz + side * 1.26, 0xeafff9, { scale: 0.16 });
          }
        } else {
          solid.add(ex, ey, sz + side * 1.0, 0xf0dcb4, { scale: 0.94 });
        }
      }
    }
    // Heavy brow ridge.
    for (let dx = -3; dx <= 3; dx++) {
      const ex = 34.6 + dx;
      const ey = 4.8 + Math.abs(dx) * 0.16;
      const sz = surfaceZ(ex, ey, side);
      if (sz !== null) solid.add(ex, ey, sz + side * 0.72, 0x203752, { scale: 0.62 });
    }

    // Mouth crease, curving toward the snout.
    for (let i = 0; i < 20; i++) {
      const mx = 38.6 - i * 1.28;
      const my = -4.0 - Math.sin((i / 19) * Math.PI) * 2.5;
      const sz = surfaceZ(mx, my, side);
      if (sz === null) continue;
      solid.add(mx, my, sz + side * 0.56, 0x102034, { scale: 0.92 });
      if (i > 1) solid.add(mx, my - 1.15, sz + side * 0.42, 0x8da4b2, { scale: 0.5 });
      if (i % 5 === 0) solid.add(mx, my + 0.9, sz + side * 0.5, 0x2d4765, { scale: 0.44 });
    }

    // Broad leather-and-gold harness bands around the whale.
    for (const hx of [-7, 17]) {
      for (let hy = -8; hy <= 9; hy += 1) {
        const sz = surfaceZ(hx, hy, side);
        if (sz === null) continue;
        for (const dx of [-0.45, 0.45]) {
          const isGold = hy % 4 === 0 || hy === 9 || hy === -8;
          solid.add(hx + dx, hy, sz + side * 0.48, isGold ? C.gold : 0x4d3426, {
            scale: isGold ? 0.54 : 0.68,
          });
        }
        if (hy % 3 === 0) {
          solid.add(hx, hy, sz + side * 0.85, C.goldLight, { scale: 0.24 });
        }
      }
    }

    // Bioluminescent constellation along the flank.
    const stars = [
      [-25, 1.2], [-21, 2.4], [-16, 3.1], [-11, 1.8], [-6, 2.7],
      [-1, 3.7], [4, 2.9], [9, 1.6], [14, 2.5], [19, 0.8],
      [-13, -1.8], [-8, -0.9], [-3, 0], [2, -0.4], [7, -1.4], [12, -2.2],
    ];
    stars.forEach(([sx, sy], i) => {
      const sz = surfaceZ(sx, sy + 5, side);
      if (sz === null) return;
      const color = i % 4 === 0 ? C.goldLight : i % 3 === 0 ? 0xb7fff3 : C.cyan;
      glowCool.add(sx, sy + 5, sz + side * 0.75, color, { scale: i % 4 === 0 ? 0.6 : 0.72 });
      if (i > 0 && i % 5 !== 0) {
        const [px, py] = stars[i - 1];
        const pz = surfaceZ(px, py + 5, side);
        if (pz !== null) {
          const steps = 3;
          for (let s = 1; s < steps; s++) {
            const t = s / steps;
            glowCool.add(
              THREE.MathUtils.lerp(px, sx, t),
              THREE.MathUtils.lerp(py, sy, t) + 5,
              THREE.MathUtils.lerp(pz, sz, t) + side * 0.7,
              0x4b9f9a,
              { scale: 0.3 }
            );
          }
        }
      }
    });

    // Barnacle flecks.
    for (let i = 0; i < 38; i++) {
      const x = Math.floor(-40 + randGlow() * 70);
      const y = Math.floor(-6 + randGlow() * 11);
      const sz = surfaceZ(x, y, side);
      if (sz === null) continue;
      solid.add(x, y, sz + side * 0.46, randGlow() > 0.7 ? C.gold : 0xe4e7dd, { scale: 0.32 });
    }
  }

  // Pale edging on the pectoral fins.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 26; i++) {
      const t = i / 25;
      const x = 20 - t * 23;
      const y = -4 - t * 4.8 + Math.sin(t * Math.PI) * 0.5;
      const z = side * (12 + t * 12);
      solid.add(x, y, z, jitterColor(C.bodyLight, 0.08, randGlow), { scale: 0.8 });
    }
  }
}

function buildPlaza(solid, glowWarm, glowCool) {
  const rand = mulberry32(7823);
  const platformTop = DECK_Y;
  const HALF_X = 20;
  const HALF_Z = 9;

  for (let x = -HALF_X; x <= HALF_X; x++) {
    for (let z = -HALF_Z; z <= HALF_Z; z++) {
      const edgeX = Math.abs(x) / HALF_X;
      const edgeZ = Math.abs(z) / HALF_Z;
      if (edgeX > 0.9 && edgeZ > 0.82) continue;
      const border = Math.abs(x) >= HALF_X - 1 || Math.abs(z) >= HALF_Z - 1;
      const n = hash3(x, 3, z, 57);
      let color;
      if (border) color = jitterColor(n > 0.5 ? C.stoneDark : C.wood, 0.045, rand);
      else if (n > 0.82) color = jitterColor(C.mossLight, 0.05, rand);
      else color = jitterColor(n > 0.45 ? C.stone : C.stoneLight, 0.035, rand);
      solid.add(x, platformTop, z, color, { scale: 0.96 });

      if (edgeX < 0.95 && edgeZ < 0.95) {
        const underDepth = 2.4 + Math.max(0, (1 - edgeX * edgeX) * 1.2);
        if ((Math.abs(x) % 7 === 0) || (Math.abs(z) === HALF_Z - 2 && Math.abs(x) % 3 === 0)) {
          for (let y = platformTop - 0.8; y > platformTop - underDepth; y -= 0.8) {
            solid.add(x, y, z, jitterColor(C.stoneDark, 0.08, rand), { scale: 0.9 });
          }
        }
      }
    }
  }

  // Mosaic rings and compass spokes.
  const drawRing = (radius, color, glow) => {
    const segments = Math.round(radius * 26);
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const x = Math.cos(a) * radius;
      const z = Math.sin(a) * radius;
      if (Math.abs(x) > HALF_X - 1 || Math.abs(z) > HALF_Z - 1) continue;
      const target = glow ? glowCool : solid;
      target.add(x, platformTop + 0.52, z, color, { scale: 0.34 });
    }
  };
  drawRing(9.4, C.gold, false);
  drawRing(10.1, 0x84d8c8, true);
  drawRing(12.6, C.stoneDark, false);
  drawRing(13.1, C.gold, false);

  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    for (let r = 8; r < 13; r += 1.15) {
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.abs(x) > HALF_X - 1 || Math.abs(z) > HALF_Z - 1.5) continue;
      solid.add(x, platformTop + 0.52, z, k % 3 === 0 ? C.gold : 0xc0b190, { scale: 0.33 });
    }
    const gx = Math.cos(a) * 12.1;
    const gz = Math.sin(a) * 12.1;
    if (Math.abs(gx) < HALF_X - 1 && Math.abs(gz) < HALF_Z - 1) {
      glowWarm.add(gx, platformTop + 0.66, gz, C.window, { scale: 0.4 });
    }
  }

  // Perimeter lantern posts.
  const posts = [
    [-17, -8], [-9, -8], [9, -8], [17, -8],
    [-17, 8], [-9, 8], [9, 8], [17, 8],
    [-19, -3], [-19, 3], [19, -3], [19, 3],
  ];
  for (const [x, z] of posts) {
    for (let y = 0.6; y <= 2.8; y += 0.7) {
      solid.add(x, platformTop + y, z, jitterColor(C.wood, 0.03, rand), { scale: 0.46 });
    }
    solid.add(x, platformTop + 3.25, z, C.gold, { scale: 0.72 });
    glowWarm.add(x, platformTop + 3.85, z, C.window, { scale: 0.72 });
    solid.add(x, platformTop + 4.4, z, C.wood, { scale: 0.9 });
  }

  // Foundations and support brackets around the plateau edge.
  for (let x = -HALF_X + 1; x <= HALF_X - 1; x += 2) {
    for (const z of [-HALF_Z + 1, HALF_Z - 1]) {
      for (let y = platformTop - 1; y >= platformTop - 2.8; y -= 0.8) {
        solid.add(x, y, z, jitterColor(C.stoneDark, 0.06, rand), { scale: 0.84 });
      }
      if (Math.abs(x) % 4 === 0) {
        solid.add(x, platformTop - 2.8, z + Math.sign(z) * 0.6, C.gold, { scale: 0.42 });
      }
    }
  }

  // Steps down to the promenades.
  for (const side of [-1, 1]) {
    const stairs = [
      [0, 10.8, 9.6], [0, 10.4, 10.3], [0, 10.0, 11.0], [0, 9.6, 11.7],
    ];
    for (const [x, y, z] of stairs) {
      solid.addBox(x - 2, x + 2, y, y, z, z + 0.6, C.stone, { scale: 0.94, jitter: 0.025, rand });
      for (const sx of [-2.4, 2.4]) {
        solid.add(x + sx, y + 0.5, z + 0.3, C.gold, { scale: 0.5 });
      }
    }
    // Wide side steps.
    for (const x of [-14.5, 14.5]) {
      for (let i = 0; i < 3; i++) {
        solid.addBox(x - 2, x + 2, platformTop - i - 0.8, platformTop - i - 0.8, side * (9.6 + i * 0.7), side * (10.2 + i * 0.7), C.stoneDark, { scale: 0.93, jitter: 0.02, rand });
      }
    }
  }
}

function buildPromenades(solid, glowWarm) {
  const rand = mulberry32(33821);
  for (const side of [-1, 1]) {
    for (let x = -36; x <= 34; x += 2) {
      const z = side * (12.2 + Math.sin(x * 0.145) * 0.9);
      const y = 10.05 + Math.sin(x * 0.08 + side) * 0.25;
      solid.addBox(x - 0.9, x + 0.9, y - 0.35, y, z - 1.1, z + 1.1, C.wood, {
        scale: 0.92,
        jitter: 0.03,
        rand,
        filter: (xx, yy, zz) => Math.abs(zz - z) < 1.2,
      });

      if (Math.abs(x % 6) < 1) {
        for (let yy = y - 0.7; yy > y - 5.5; yy -= 0.8) {
          solid.add(x, yy, z + side * 0.8, jitterColor(C.wood, 0.04, rand), { scale: 0.5 });
        }
        solid.add(x, y - 5.7, z + side * 0.8, C.gold, { scale: 0.36 });
      }

      if (Math.abs(x % 4) === 0) {
        for (let yy = y + 0.4; yy <= y + 1.8; yy += 0.7) {
          solid.add(x, yy, z + side * 1.15, jitterColor(C.wood, 0.03, rand), { scale: 0.34 });
        }
        glowWarm.add(x, y + 1.6, z + side * 1.15, C.window, { scale: 0.5 });
        solid.add(x, y + 2.15, z + side * 1.15, C.gold, { scale: 0.44 });
      }

      if (Math.abs(x % 4) === 2) {
        solid.add(x, y + 1.15, z + side * 1.15, C.woodLight, { scale: 0.26 });
      }
    }

    // Rail line along the outer edge.
    for (let x = -36; x <= 34; x += 1.4) {
      const z = side * (12.2 + Math.sin(x * 0.145) * 0.9) + side * 1.15;
      const y = 10.05 + Math.sin(x * 0.08 + side) * 0.25;
      solid.add(x, y + 1.7, z, C.woodLight, { scale: 0.22 });
    }
  }
}

export function buildWhale(materials) {
  const group = new THREE.Group();
  group.name = "cloud-whale";

  const solidBatch = new VoxelBatch();
  const warmBatch = new VoxelBatch();
  const coolBatch = new VoxelBatch();

  buildWhaleShell(solidBatch, warmBatch, coolBatch);
  buildPlaza(solidBatch, warmBatch, coolBatch);
  buildPromenades(solidBatch, warmBatch);

  const whaleMesh = solidBatch.build(materials.solid, {
    castShadow: true,
    receiveShadow: true,
    parent: group,
    name: "whale-shell",
  });
  const warmMesh = warmBatch.build(materials.warmGlow, {
    castShadow: false,
    receiveShadow: false,
    parent: group,
    name: "plaza-lights",
  });
  const coolMesh = coolBatch.build(materials.coolGlow, {
    castShadow: false,
    receiveShadow: false,
    parent: group,
    name: "whale-starlight",
  });

  return {
    group,
    solidBatch,
    whaleMesh,
    warmMesh,
    coolMesh,
  };
}
