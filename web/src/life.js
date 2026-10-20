import * as THREE from "three";
import { VoxelBatch, mulberry32, hash3, jitterColor, UNIT_BOX } from "./voxel.js";
import { DECK_Y } from "./whale.js";

const C = {
  gold: 0xd5ab59,
  goldDark: 0xa87f3a,
  goldLight: 0xf2d697,
  amber: 0xe3a25b,
  cream: 0xf2e4c5,
  teal: 0x356b66,
  tealLight: 0x69a89c,
  wood: 0x5b3b2a,
  rock: 0x73716a,
  rockLight: 0x928d82,
  rockDark: 0x504f4b,
  moss: 0x62815a,
  mossLight: 0x8aa471,
  crystal: 0x8af1e2,
  petalPink: 0xf0aeb9,
  petalGold: 0xf3d28f,
};

function makeSoftGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,236,190,0.9)");
  g.addColorStop(0.22, "rgba(255,206,124,0.45)");
  g.addColorStop(0.6, "rgba(255,184,95,0.11)");
  g.addColorStop(1, "rgba(255,176,80,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBalloon(materials) {
  const group = new THREE.Group();
  group.position.set(-36, 69, -16);
  group.scale.setScalar(1.05);
  group.name = "sky-balloon";

  const solid = new VoxelBatch();
  const warm = new VoxelBatch();
  const rand = mulberry32(1091);

  const rx = 6.6;
  const ry = 7.8;
  const rz = 6.6;
  const colors = [0xe0a057, 0xf3e5c6, 0x356b66];
  const inside = (x, y, z) => {
    const nx = x / rx;
    const ny = (y + 1) / ry;
    const nz = z / rz;
    const base = nx * nx + ny * ny + nz * nz;
    const skirt = y < -1.5 ? Math.pow((-y - 1.5) / 6, 1.4) * 0.9 : 0;
    return base + skirt <= 1 && y > -6.3;
  };

  for (let x = -8; x <= 8; x++) {
    for (let y = -7; y <= 9; y++) {
      for (let z = -8; z <= 8; z++) {
        if (!inside(x, y, z)) continue;
        const exposed = !inside(x + 1, y, z) || !inside(x - 1, y, z) ||
          !inside(x, y + 1, z) || !inside(x, y - 1, z) ||
          !inside(x, y, z + 1) || !inside(x, y, z - 1);
        if (!exposed) continue;
        const angle = Math.atan2(z, x);
        const stripe = Math.floor(((angle + Math.PI) / (Math.PI * 2)) * 12) % colors.length;
        let col = colors[stripe];
        if (Math.abs(y + 1) < 0.8) col = C.gold;
        if (y > 6.2) col = C.gold;
        solid.add(x, y, z, jitterColor(col, 0.035, rand), { scale: 0.94 });
      }
    }
  }

  // Envelope skirt and burner.
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    solid.add(Math.cos(a) * 3.1, -6.2, Math.sin(a) * 3.1, C.teal, { scale: 0.62 });
    solid.add(Math.cos(a) * 2.2, -8.2, Math.sin(a) * 2.2, C.wood, { scale: 0.28 });
  }
  warm.add(0, -8.8, 0, 0xffc26c, { scale: 0.65 });

  // Basket.
  for (let x = -2; x <= 2; x++) {
    for (let z = -2; z <= 2; z++) {
      if (Math.abs(x) < 2 && Math.abs(z) < 2) continue;
      for (let y = -12.6; y <= -10.8; y += 0.8) {
        solid.add(x, y, z, jitterColor(C.wood, 0.05, rand), { scale: 0.75 });
      }
    }
  }
  solid.addBox(-2.2, 2.2, -10.7, -10.7, -2.2, 2.2, C.gold, { scale: 0.6, jitter: 0.02, rand });
  solid.addBox(-2, 2, -13.2, -13.2, -2, 2, C.wood, { scale: 0.65, jitter: 0.04, rand });
  // Ropes.
  for (const sx of [-1.8, 1.8]) {
    for (const sz of [-1.8, 1.8]) {
      const steps = 11;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = sx * (1 - t) + Math.cos(Math.atan2(sz, sx)) * 4 * t;
        const z = sz * (1 - t) + Math.sin(Math.atan2(sz, sx)) * 4 * t;
        const y = THREE.MathUtils.lerp(-10.7, -5.6, t);
        solid.add(x, y, z, C.goldLight, { scale: 0.13 });
      }
    }
  }

  solid.build(materials.solid, { castShadow: true, receiveShadow: true, parent: group, name: "balloon-envelope" });
  warm.build(materials.warmGlow, { castShadow: false, receiveShadow: false, parent: group, name: "balloon-burner" });

  const glowTex = makeSoftGlowTexture();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex,
    color: 0xffc97a,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }));
  halo.scale.set(16, 16, 1);
  halo.position.y = -8.8;
  group.add(halo);

  return {
    group,
    update(time) {
      group.position.y = 69 + Math.sin(time * 0.24) * 1.4;
      group.position.x = -36 + Math.sin(time * 0.11) * 3.2;
      group.position.z = -16 + Math.cos(time * 0.09) * 2.2;
      group.rotation.y = Math.sin(time * 0.08) * 0.16;
      group.rotation.z = Math.sin(time * 0.2) * 0.018;
      halo.material.opacity = 0.3 + Math.sin(time * 4.2) * 0.06;
    },
  };
}

function createBirds(scene) {
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xf6efe1,
    roughness: 0.68,
    metalness: 0.0,
    flatShading: true,
  });
  const wingMaterial = new THREE.MeshStandardMaterial({
    color: 0xded0b6,
    roughness: 0.74,
    metalness: 0.0,
    flatShading: true,
  });
  const beakMaterial = new THREE.MeshStandardMaterial({
    color: 0xe3b55f,
    roughness: 0.6,
    flatShading: true,
  });

  const birds = [];
  const flocks = [
    { cx: 0, cy: 38, cz: 4, rx: 51, rz: 35, speed: 0.11, count: 4, scale: 0.82 },
    { cx: 45, cy: 22, cz: 20, rx: 24, rz: 18, speed: 0.18, count: 3, scale: 0.7 },
    { cx: -24, cy: 52, cz: -16, rx: 32, rz: 23, speed: 0.09, count: 2, scale: 0.94 },
  ];
  let id = 0;
  for (const flock of flocks) {
    for (let i = 0; i < flock.count; i++) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(UNIT_BOX, bodyMaterial);
      body.scale.set(0.55, 0.42, 1.35);
      body.castShadow = true;
      group.add(body);

      const head = new THREE.Mesh(UNIT_BOX, bodyMaterial);
      head.scale.set(0.42, 0.38, 0.48);
      head.position.z = 0.78;
      group.add(head);

      const beak = new THREE.Mesh(UNIT_BOX, beakMaterial);
      beak.scale.set(0.16, 0.14, 0.44);
      beak.position.set(0, -0.03, 1.12);
      group.add(beak);

      const leftPivot = new THREE.Group();
      leftPivot.position.set(-0.26, 0.12, 0.1);
      const leftWing = new THREE.Mesh(UNIT_BOX, wingMaterial);
      leftWing.scale.set(1.65, 0.09, 0.68);
      leftWing.position.x = -0.85;
      leftPivot.add(leftWing);
      group.add(leftPivot);

      const rightPivot = new THREE.Group();
      rightPivot.position.set(0.26, 0.12, 0.1);
      const rightWing = new THREE.Mesh(UNIT_BOX, wingMaterial);
      rightWing.scale.set(1.65, 0.09, 0.68);
      rightWing.position.x = 0.85;
      rightPivot.add(rightWing);
      group.add(rightPivot);

      group.scale.setScalar(flock.scale * (0.8 + Math.random() * 0.35));
      scene.add(group);
      birds.push({
        group,
        leftPivot,
        rightPivot,
        flock,
        phase: (i / flock.count) * Math.PI * 2 + id * 0.55,
        lane: (i - (flock.count - 1) / 2) * 2.2,
        scale: flock.scale,
        flapSpeed: 7.5 + Math.random() * 3.5,
        id,
      });
      id++;
    }
  }

  return {
    birds,
    update(dt, time, nightMix) {
      for (const bird of birds) {
        const f = bird.flock;
        const a = time * f.speed + bird.phase;
        const x = f.cx + Math.cos(a) * (f.rx + bird.lane) + Math.sin(a * 2.1) * 3;
        const z = f.cz + Math.sin(a) * (f.rz + bird.lane) + Math.cos(a * 1.7) * 3;
        const y = f.cy + Math.sin(a * 2.4 + bird.phase) * 3.4 + bird.lane * 0.25;
        const dx = -Math.sin(a) * f.rx + Math.cos(a * 2.1) * 2.1 * 3;
        const dz = Math.cos(a) * f.rz - Math.sin(a * 1.7) * 1.7 * 3;
        bird.group.position.set(x, y, z);
        bird.group.rotation.y = Math.atan2(dx, dz);
        bird.group.rotation.z = -Math.sin(a * 1.3) * 0.12;
        const flap = Math.sin(time * bird.flapSpeed + bird.phase) * 0.55;
        bird.leftPivot.rotation.z = 0.24 + flap;
        bird.rightPivot.rotation.z = -0.24 - flap;
        bodyMaterial.color.setRGB(
          THREE.MathUtils.lerp(0.96, 0.68, nightMix),
          THREE.MathUtils.lerp(0.94, 0.68, nightMix),
          THREE.MathUtils.lerp(0.88, 0.78, nightMix)
        );
        wingMaterial.color.setRGB(
          THREE.MathUtils.lerp(0.87, 0.58, nightMix),
          THREE.MathUtils.lerp(0.82, 0.6, nightMix),
          THREE.MathUtils.lerp(0.71, 0.78, nightMix)
        );
      }
    },
  };
}

function createButterflies(whaleGroup) {
  const palette = [0xff9fb0, 0xffd682, 0x89e4d3, 0xc1a7ff, 0xffb47c];
  const butterflies = [];
  const rand = mulberry32(7712);
  const sites = [
    [-12, 14.1, 15.5], [-9, 14.6, 13.8], [8, 13.4, -12.6], [12, 13.9, -11.9],
    [-27.5, 13.3, 6.1], [16, 13.8, 8.4], [23.5, 12.8, -8.1], [-17, 15.2, 6.6],
  ];
  for (let i = 0; i < sites.length; i++) {
    const group = new THREE.Group();
    const color = palette[i % palette.length];
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x32252b, roughness: 0.7, flatShading: true });
    const wingMat = new THREE.MeshBasicMaterial({ color, toneMapped: false, side: THREE.DoubleSide });
    const body = new THREE.Mesh(UNIT_BOX, bodyMat);
    body.scale.set(0.1, 0.1, 0.58);
    group.add(body);
    const wingGeo = new THREE.BoxGeometry(0.82, 0.035, 0.52);
    const left = new THREE.Mesh(wingGeo, wingMat);
    left.position.x = -0.39;
    const right = new THREE.Mesh(wingGeo, wingMat);
    right.position.x = 0.39;
    group.add(left, right);
    group.scale.setScalar(0.7 + rand() * 0.5);
    whaleGroup.add(group);
    const [sx, sy, sz] = sites[i];
    butterflies.push({
      group,
      left,
      right,
      base: new THREE.Vector3(sx, sy, sz),
      radius: 1.1 + rand() * 1.8,
      speed: 0.5 + rand() * 0.55,
      phase: rand() * 6.28,
      height: 0.7 + rand() * 1.2,
      flap: 12 + rand() * 8,
      dir: rand() > 0.5 ? 1 : -1,
    });
  }

  return {
    update(dt, time) {
      for (const b of butterflies) {
        const a = time * b.speed * b.dir + b.phase;
        b.group.position.set(
          b.base.x + Math.cos(a) * b.radius,
          b.base.y + Math.sin(a * 2.3) * b.height * 0.5 + Math.sin(time * 0.8 + b.phase) * 0.2,
          b.base.z + Math.sin(a * 0.9) * b.radius * 0.8
        );
        b.group.rotation.y = -a + Math.PI / 2;
        const flap = Math.sin(time * b.flap + b.phase) * 0.9;
        b.left.rotation.z = 0.45 + flap;
        b.right.rotation.z = -0.45 - flap;
      }
    },
  };
}

function buildFloatingRock(materials, options) {
  const { x, y, z, size, seed, style = "pine", warmTint = false } = options;
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = seed * 0.7;
  group.name = "floating-rock";

  const solid = new VoxelBatch();
  const warm = new VoxelBatch();
  const cool = new VoxelBatch();
  const rand = mulberry32(seed);

  const R = size;
  const depth = R * 1.25;
  const inside = (px, py, pz) => {
    const wobble = (hash3(px, py, pz, seed) - 0.5) * 0.22;
    if (py > 0.6) {
      const d = (px * px) / (R * R) + (pz * pz) / (R * R * 0.82);
      return d <= 1 + wobble * 0.25;
    }
    const t = Math.min(1, -py / depth);
    const rr = R * (1 - Math.pow(t, 0.8) * 0.82);
    const d = (px * px) / (rr * rr) + (pz * pz) / (rr * rr * 0.82);
    return d <= 1 + wobble && py > -depth;
  };

  const bound = Math.ceil(R * 1.3);
  for (let px = -bound; px <= bound; px++) {
    for (let py = -Math.ceil(depth); py <= 2; py++) {
      for (let pz = -bound; pz <= bound; pz++) {
        if (!inside(px, py, pz)) continue;
        const exposed = !inside(px + 1, py, pz) || !inside(px - 1, py, pz) ||
          !inside(px, py + 1, pz) || !inside(px, py - 1, pz) ||
          !inside(px, py, pz + 1) || !inside(px, py, pz - 1);
        if (!exposed) continue;
        let color;
        if (py >= 0) {
          color = jitterColor(rand() > 0.4 ? C.moss : C.mossLight, 0.05, rand);
        } else {
          const band = Math.floor((-py + 1) / 2.6) % 2;
          color = jitterColor(band ? C.rock : C.rockDark, 0.05, rand);
          if (hash3(px, py, pz, seed + 9) > 0.94) color = jitterColor(C.rockLight, 0.04, rand);
        }
        solid.add(px, py, pz, color, { scale: 0.94 });
      }
    }
  }

  // Hanging roots and vines.
  for (let i = 0; i < 10; i++) {
    const a = rand() * Math.PI * 2;
    const rr = R * (0.55 + rand() * 0.4);
    const vx = Math.cos(a) * rr;
    const vz = Math.sin(a) * rr * 0.8;
    const len = 2 + rand() * R * 0.7;
    for (let j = 0; j < len; j += 0.8) {
      solid.add(vx + Math.sin(j * 0.6) * 0.25, -1 - j, vz + Math.cos(j * 0.5) * 0.2, jitterColor(C.moss, 0.06, rand), {
        scale: 0.22,
      });
    }
  }

  // Miniature tree.
  if (style) {
    const tx = (rand() - 0.5) * R * 0.25;
    const tz = (rand() - 0.5) * R * 0.25;
    const trunkH = Math.round(2.2 + R * 0.3);
    for (let i = 0; i < trunkH; i++) {
      solid.add(tx, 1.4 + i * 0.8, tz, jitterColor(C.wood, 0.05, rand), { scale: 0.4 });
    }
    const canopyY = 1.4 + trunkH * 0.8;
    if (style === "sakura") {
      for (let i = 0; i < 50; i++) {
        const ox = (rand() - 0.5) * R * 0.85;
        const oz = (rand() - 0.5) * R * 0.75;
        const oy = (rand() - 0.5) * R * 0.35;
        if (ox * ox + oz * oz > R * R * 0.3) continue;
        solid.add(tx + ox, canopyY + oy, tz + oz, jitterColor(rand() > 0.4 ? C.petalPink : 0xf6ccd3, 0.05, rand), {
          scale: 0.48,
        });
      }
    } else {
      for (let layer = 0; layer < 3; layer++) {
        const rr = (R * 0.36 - layer * R * 0.08);
        for (let i = 0; i < 40; i++) {
          const ox = (rand() - 0.5) * rr * 2;
          const oz = (rand() - 0.5) * rr * 2;
          if (ox * ox + oz * oz > rr * rr) continue;
          solid.add(tx + ox, canopyY + layer * 1.0, tz + oz, jitterColor(layer % 2 ? C.moss : 0x4d7059, 0.05, rand), {
            scale: 0.44,
          });
        }
      }
    }
  }

  // Crystals and tiny ruins.
  const crystalCount = 3 + Math.floor(rand() * 4);
  for (let i = 0; i < crystalCount; i++) {
    const a = rand() * Math.PI * 2;
    const rr = R * (0.25 + rand() * 0.55);
    const cx = Math.cos(a) * rr;
    const cz = Math.sin(a) * rr * 0.8;
    const h = 1 + rand() * R * 0.32;
    for (let j = 0; j < h; j += 0.65) {
      cool.add(cx + j * 0.16, 1.4 + j, cz, j % 2 < 1 ? C.crystal : (warmTint ? C.goldLight : 0xb8fff5), {
        scale: 0.3 - j * 0.01,
      });
    }
  }
  if (size > 5.5) {
    const ax = -R * 0.45;
    const az = R * 0.38;
    for (let i = 0; i < 4; i++) {
      for (const sx of [-0.9, 0.9]) {
        solid.add(ax + sx, 1.6 + i * 0.7, az, i % 2 ? C.rockLight : C.gold, { scale: 0.3 });
      }
    }
    for (let i = -1; i <= 1; i++) {
      solid.add(ax + i * 0.9, 4.2, az, C.goldDark ?? C.gold, { scale: 0.32 });
    }
  }

  solid.build(materials.solid, { castShadow: false, receiveShadow: true, parent: group, name: "rock" });
  warm.build(materials.warmGlow, { castShadow: false, receiveShadow: false, parent: group });
  cool.build(materials.coolGlow, { castShadow: false, receiveShadow: false, parent: group });

  return {
    group,
    baseY: y,
    phase: rand() * Math.PI * 2,
    speed: 0.12 + rand() * 0.12,
    bob: 0.7 + rand() * 1.4,
    spin: (rand() - 0.5) * 0.04,
  };
}

function createLanternField(scene, materials) {
  const texture = makeSoftGlowTexture();
  const lanternMaterial = new THREE.MeshStandardMaterial({
    color: 0x74421f,
    emissive: 0xff9a42,
    emissiveIntensity: 1.15,
    roughness: 0.72,
    metalness: 0,
    flatShading: true,
  });
  const woodMaterial = new THREE.MeshStandardMaterial({ color: C.wood, roughness: 0.86, flatShading: true });
  const lanterns = [];
  const rand = mulberry32(3319);
  for (let i = 0; i < 9; i++) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(UNIT_BOX, lanternMaterial);
    body.scale.set(0.9, 1.2, 0.9);
    group.add(body);
    const cap = new THREE.Mesh(UNIT_BOX, woodMaterial);
    cap.scale.set(0.98, 0.16, 0.98);
    cap.position.y = -0.72;
    group.add(cap);
    const capTop = new THREE.Mesh(UNIT_BOX, woodMaterial);
    capTop.scale.set(0.74, 0.1, 0.74);
    capTop.position.y = 0.72;
    group.add(capTop);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      color: 0xffb05e,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }));
    halo.scale.set(2.1, 2.1, 1);
    group.add(halo);

    const a = rand() * Math.PI * 2;
    const radius = 42 + rand() * 34;
    const base = new THREE.Vector3(
      Math.cos(a) * radius,
      20 + rand() * 36,
      Math.sin(a) * radius * 0.7
    );
    group.position.copy(base);
    group.scale.setScalar(0.45 + rand() * 0.28);
    scene.add(group);
    lanterns.push({
      group,
      halo,
      base,
      speed: 0.4 + rand() * 0.65,
      sway: 0.6 + rand() * 1.6,
      phase: rand() * Math.PI * 2,
    });
  }

  return {
    update(dt, time, nightMix) {
      lanternMaterial.emissiveIntensity = 0.9 + nightMix * 1.1;
      for (const l of lanterns) {
        let y = l.group.position.y + dt * l.speed;
        if (y > 90) {
          y = 20 + Math.random() * 12;
          const a = Math.random() * Math.PI * 2;
          l.group.position.x = Math.cos(a) * (42 + Math.random() * 34);
          l.group.position.z = Math.sin(a) * (30 + Math.random() * 34);
        }
        l.group.position.y = y;
        l.group.position.x += Math.sin(time * 0.3 + l.phase) * dt * 0.35;
        l.group.position.z += Math.cos(time * 0.24 + l.phase) * dt * 0.25;
        l.group.rotation.y += dt * 0.12;
        l.halo.material.opacity = 0.08 + nightMix * 0.28 + Math.sin(time * 2.2 + l.phase) * 0.025;
      }
    },
  };
}

function createMotes(scene) {
  const rand = mulberry32(6261);
  const count = 760;
  const positions = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  const speed = new Float32Array(count);
  const size = new Float32Array(count);
  const kind = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let x, y, z;
    if (i < 470) {
      x = (rand() - 0.5) * 150;
      y = 6 + rand() * 64;
      z = (rand() - 0.5) * 110;
    } else if (i < 650) {
      const a = rand() * Math.PI * 2;
      const r = 12 + rand() * 30;
      x = Math.cos(a) * r;
      y = 20 + rand() * 28;
      z = Math.sin(a) * r * 0.65;
    } else {
      x = (rand() - 0.5) * 70;
      y = 13 + rand() * 12;
      z = (rand() - 0.5) * 34;
    }
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    phase[i] = rand() * Math.PI * 2;
    speed[i] = 0.08 + rand() * 0.22;
    size[i] = 0.18 + rand() * (i > 650 ? 0.35 : 0.55);
    kind[i] = rand();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  geometry.setAttribute("aKind", new THREE.BufferAttribute(kind, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uNight: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uNight;
      uniform float uPixelRatio;
      attribute float aPhase;
      attribute float aSpeed;
      attribute float aSize;
      attribute float aKind;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * aSpeed + aPhase) * (2.2 + aKind * 3.0);
        p.y += sin(uTime * aSpeed * 0.63 + aPhase * 1.7) * 2.2;
        p.z += cos(uTime * aSpeed * 0.82 + aPhase * 1.3) * 2.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aSize * uPixelRatio * (340.0 / max(1.0, -mv.z));
        gl_PointSize = clamp(gl_PointSize, 1.0, 26.0);
        vAlpha = 0.35 + 0.65 * aKind;
        vec3 dayColor = mix(vec3(1.0, 0.82, 0.55), vec3(1.0, 0.95, 0.8), aKind);
        vec3 nightColor = mix(vec3(0.52, 1.0, 0.9), vec3(1.0, 0.83, 0.5), aKind);
        vColor = mix(dayColor, nightColor, uNight);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float glow = smoothstep(0.5, 0.0, d);
        glow = pow(glow, 1.8);
        gl_FragColor = vec4(vColor, glow * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  return {
    points,
    material,
    update(time, nightMix) {
      material.uniforms.uTime.value = time;
      material.uniforms.uNight.value = nightMix;
    },
  };
}

export function createLife(scene, whaleGroup, materials) {
  const balloon = makeBalloon(materials);
  scene.add(balloon.group);

  const birds = createBirds(scene);
  const butterflies = createButterflies(whaleGroup);

  const islandDefs = [
    { x: -92, y: 33, z: 18, size: 6.0, seed: 91, style: "pine", warmTint: false },
    { x: 102, y: 44, z: -18, size: 5.0, seed: 92, style: "sakura", warmTint: true },
    { x: -42, y: 56, z: -64, size: 4.2, seed: 93, style: "pine", warmTint: false },
    { x: 95, y: 50, z: 60, size: 3.6, seed: 94, style: "sakura", warmTint: true },
    { x: 12, y: 62, z: -70, size: 3.2, seed: 95, style: "pine", warmTint: false },
    { x: -106, y: 16, z: -42, size: 6.0, seed: 96, style: "sakura", warmTint: false },
  ];
  const rocks = islandDefs.map((def) => buildFloatingRock(materials, def));
  for (const rock of rocks) scene.add(rock.group);

  const skyLanterns = createLanternField(scene, materials);
  const motes = createMotes(scene);

  return {
    balloon,
    birds,
    butterflies,
    rocks,
    skyLanterns,
    motes,
    update(dt, time, nightMix) {
      balloon.update(time);
      birds.update(dt, time, nightMix);
      butterflies.update(dt, time);
      for (const rock of rocks) {
        rock.group.position.y = rock.baseY + Math.sin(time * rock.speed + rock.phase) * rock.bob;
        rock.group.position.x += Math.sin(time * 0.06 + rock.phase) * dt * 0.15;
        rock.group.rotation.y += rock.spin * dt;
      }
      skyLanterns.update(dt, time, nightMix);
      motes.update(time, nightMix);
    },
  };
}
