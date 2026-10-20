import * as THREE from "three";
import { VoxelBatch, mulberry32, hash3, jitterColor, UNIT_BOX } from "./voxel.js";
import { DECK_Y, WHEEL_CENTER, TOWER_X } from "./whale.js";

const C = {
  gold: 0xd6ab58,
  goldBright: 0xf2d394,
  goldDark: 0xa77e37,
  teal: 0x2f6c68,
  tealDeep: 0x255351,
  indigo: 0x3b4f78,
  indigoDeep: 0x2a3a5d,
  wood: 0x5b3a2a,
  woodDark: 0x422b21,
  woodRed: 0x99443c,
  woodRedDark: 0x74312e,
  wall: 0xecdfc0,
  wallShade: 0xddceac,
  stone: 0xc5b796,
  stoneDark: 0x8f8674,
  roofTile: 0x2f6462,
  window: 0xffc56d,
  windowCool: 0xffe2a6,
  cyan: 0x7be7d8,
};

function makeStarMapTexture(seed = 1, cool = false, opaque = false) {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const rand = mulberry32(seed);
  const c = size / 2;

  ctx.clearRect(0, 0, size, size);

  if (opaque) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, c * 1.02, 0, Math.PI * 2);
    ctx.clip();
    const disc = ctx.createRadialGradient(c, c * 0.9, c * 0.05, c, c, c);
    disc.addColorStop(0, "rgba(17, 39, 56, 0.96)");
    disc.addColorStop(0.48, "rgba(9, 27, 48, 0.96)");
    disc.addColorStop(0.86, "rgba(6, 16, 34, 0.96)");
    disc.addColorStop(1, "rgba(5, 12, 27, 0.9)");
    ctx.fillStyle = disc;
    ctx.fillRect(0, 0, size, size);

    const nebulae = [
      [0.4, 0.35, 0.4, "114, 77, 160"],
      [0.64, 0.58, 0.34, "54, 136, 145"],
      [0.55, 0.44, 0.25, "177, 131, 82"],
    ];
    ctx.globalCompositeOperation = "screen";
    for (const [nx, ny, nr, hue] of nebulae) {
      const x = nx * size;
      const y = ny * size;
      const rr = nr * size;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, `rgba(${hue}, 0.17)`);
      g.addColorStop(0.55, `rgba(${hue}, 0.06)`);
      g.addColorStop(1, `rgba(${hue}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  } else {
    const base = ctx.createRadialGradient(c, c, 0, c, c, c);
    if (cool) {
      base.addColorStop(0, "rgba(64, 158, 168, 0.12)");
      base.addColorStop(0.55, "rgba(30, 92, 124, 0.07)");
      base.addColorStop(1, "rgba(8, 24, 48, 0)");
    } else {
      base.addColorStop(0, "rgba(122, 104, 172, 0.1)");
      base.addColorStop(0.6, "rgba(40, 104, 124, 0.06)");
      base.addColorStop(1, "rgba(8, 20, 40, 0)");
    }
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 24; i++) {
      const x = c + (rand() - 0.5) * size * 0.8;
      const y = c + (rand() - 0.5) * size * 0.8;
      const r = 34 + rand() * 150;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const hue = cool ? "83, 197, 187" : "210, 177, 118";
      g.addColorStop(0, `rgba(${hue}, 0.04)`);
      g.addColorStop(0.6, `rgba(${hue}, 0.015)`);
      g.addColorStop(1, `rgba(${hue}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.save();
  ctx.translate(c, c);
  ctx.strokeStyle = "rgba(233, 201, 135, 0.55)";
  ctx.lineWidth = 2.2;
  for (const rr of [0.93, 0.74, 0.47, 0.24]) {
    ctx.beginPath();
    ctx.arc(0, 0, c * rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([5, 14]);
  ctx.strokeStyle = "rgba(160, 230, 216, 0.48)";
  for (const rr of [0.84, 0.61, 0.33]) {
    ctx.beginPath();
    ctx.arc(0, 0, c * rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const r0 = c * (i % 4 === 0 ? 0.79 : 0.86);
    const r1 = c * (i % 4 === 0 ? 0.93 : 0.9);
    ctx.strokeStyle = i % 4 === 0 ? "rgba(246, 215, 153, 0.65)" : "rgba(144, 210, 205, 0.3)";
    ctx.lineWidth = i % 4 === 0 ? 2.2 : 1.2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.stroke();
  }
  ctx.restore();

  // Constellations / zodiac sign-like clusters.
  const glyphs = [];
  for (let g = 0; g < 12; g++) {
    const a = (g / 12) * Math.PI * 2 - Math.PI / 2;
    const rr = size * 0.375;
    const cx = c + Math.cos(a) * rr;
    const cy = c + Math.sin(a) * rr;
    const pts = [];
    const count = 3 + Math.floor(rand() * 4);
    for (let p = 0; p < count; p++) {
      const px = cx + (rand() - 0.5) * 58;
      const py = cy + (rand() - 0.5) * 58;
      pts.push([px, py]);
    }
    glyphs.push(pts);
    ctx.strokeStyle = "rgba(205, 227, 218, 0.56)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let p = 1; p < pts.length; p++) ctx.lineTo(pts[p][0], pts[p][1]);
    ctx.stroke();
    for (const [px, py] of pts) {
      const gr = ctx.createRadialGradient(px, py, 0, px, py, 18);
      gr.addColorStop(0, "rgba(255, 246, 214, 1)");
      gr.addColorStop(0.3, "rgba(255, 224, 154, 0.66)");
      gr.addColorStop(1, "rgba(255, 214, 138, 0)");
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(px, py, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,248,224,0.95)";
      ctx.fillRect(px - 2.5, py - 2.5, 5, 5);
    }
  }

  // Bolder navigational stars.
  for (let i = 0; i < 30; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * c * 0.9;
    const x = c + Math.cos(a) * r;
    const y = c + Math.sin(a) * r;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, 8 + rand() * 8);
    gr.addColorStop(0, "rgba(255, 250, 232, 0.95)");
    gr.addColorStop(0.3, "rgba(255, 228, 164, 0.42)");
    gr.addColorStop(1, "rgba(255, 219, 143, 0)");
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 520; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * c * 0.92;
    const x = c + Math.cos(a) * r;
    const y = c + Math.sin(a) * r;
    const s = rand() > 0.9 ? 2.5 + rand() * 2.4 : 0.9 + rand() * 1.8;
    const alpha = 0.35 + rand() * 0.65;
    const tint = rand() > 0.75 ? "255, 221, 160" : rand() > 0.4 ? "219, 240, 255" : "141, 222, 213";
    ctx.fillStyle = `rgba(${tint}, ${alpha})`;
    ctx.fillRect(x, y, s, s);
  }

  // Central compass emblem.
  ctx.save();
  ctx.translate(c, c);
  ctx.rotate(Math.PI / 4);
  ctx.strokeStyle = "rgba(239, 205, 140, 0.7)";
  ctx.lineWidth = 2;
  ctx.strokeRect(-36, -36, 72, 72);
  ctx.strokeStyle = "rgba(132, 222, 212, 0.55)";
  ctx.strokeRect(-58, -58, 116, 116);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function buildRing(materials, cfg) {
  const {
    radius,
    radialThickness,
    depth,
    segments,
    colorA,
    colorB,
    sectorCount,
    studs = 24,
    glyphs = 12,
    spokes = 0,
    spokesColor = C.gold,
    seed = 1,
    glyphGlow = C.windowCool,
    centerZ = 0,
  } = cfg;

  const rand = mulberry32(seed);
  const solid = new VoxelBatch();
  const glow = new VoxelBatch();
  const pivot = new THREE.Group();

  const zSlices = depth <= 1 ? [0] : [-depth / 2 + 0.7, depth / 2 - 0.7];
  const rSlices = radialThickness <= 1 ? [0] : [-radialThickness / 2 + 0.55, radialThickness / 2 - 0.55];

  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const sector = Math.floor((i / segments) * sectorCount);
    const base = sector % 2 === 0 ? colorA : colorB;
    for (const dr of rSlices) {
      for (const dz of zSlices) {
        const rr = radius + dr;
        const col = jitterColor(base, 0.045, rand);
        if ((i + Math.floor(dr * 3)) % 17 === 0) col.lerp(new THREE.Color(C.gold), 0.28);
        solid.add(ca * rr, sa * rr, dz + centerZ, col, { scale: 0.97 });
      }
    }
  }

  for (let i = 0; i < studs; i++) {
    const a = (i / studs) * Math.PI * 2 + Math.PI / studs;
    const rr = radius + radialThickness * 0.5 + 0.28;
    glow.add(Math.cos(a) * rr, Math.sin(a) * rr, centerZ + depth * 0.5 + 0.28, i % 4 === 0 ? C.goldBright : glyphGlow, {
      scale: 0.38,
    });
    glow.add(Math.cos(a) * rr, Math.sin(a) * rr, centerZ - depth * 0.5 - 0.28, i % 4 === 0 ? C.goldBright : glyphGlow, {
      scale: 0.3,
    });
  }

  const patterns = [
    [[-0.6, 0.4], [0, -0.6], [0.6, 0.4], [0, 0.1]],
    [[0, -0.7], [0, 0.7], [-0.6, 0], [0.6, 0]],
    [[-0.6, -0.6], [0.6, 0.6], [0.2, 0.1]],
    [[-0.55, 0.6], [0, -0.2], [0.55, 0.6], [0, 0.75]],
  ];
  for (let g = 0; g < glyphs; g++) {
    const a = (g / glyphs) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const pattern = patterns[g % patterns.length];
    const rr = radius + 0.15;
    const frontZ = centerZ + depth * 0.5 + 0.42;
    // Small bronze plaque anchors each zodiac mark to the band.
    solid.add(ca * rr, sa * rr, frontZ + 0.12, C.goldDark, { scale: 0.92 });
    const placed = [];
    for (let p = 0; p < pattern.length; p++) {
      const [u, v] = pattern[p];
      const x = ca * (rr + v * 0.72) - sa * u * 0.72;
      const y = sa * (rr + v * 0.72) + ca * u * 0.72;
      placed.push([x, y]);
      solid.add(x, y, frontZ + 0.24, C.gold, { scale: 0.34 });
      glow.add(x, y, frontZ + 0.52, glyphGlow, { scale: 0.5 });
    }
    for (let p = 1; p < placed.length; p++) {
      const [x0, y0] = placed[p - 1];
      const [x1, y1] = placed[p];
      for (let s = 1; s < 3; s++) {
        const t = s / 3;
        glow.add(
          THREE.MathUtils.lerp(x0, x1, t),
          THREE.MathUtils.lerp(y0, y1, t),
          frontZ + 0.5,
          0xb9c9b4,
          { scale: 0.2 }
        );
      }
    }
  }

  if (spokes > 0) {
    for (let s = 0; s < spokes; s++) {
      const a = (s / spokes) * Math.PI * 2 + Math.PI / spokes;
      for (let r = 2.4; r < radius - radialThickness * 0.5; r += 1.35) {
        const fade = 1 - (r / radius) * 0.35;
        solid.add(Math.cos(a) * r, Math.sin(a) * r, centerZ, jitterColor(spokesColor, 0.04, rand), {
          scale: 0.34 * fade + 0.12,
        });
      }
    }
  }

  const solidMesh = solid.build(materials.solid, {
    castShadow: true,
    receiveShadow: true,
    parent: pivot,
    name: "wheel-ring",
  });
  const glowMesh = glow.build(materials.coolGlow, {
    castShadow: false,
    receiveShadow: false,
    parent: pivot,
    name: "wheel-glow",
  });

  return { pivot, solidMesh, glowMesh, radius, depth };
}

function buildGear(radius, teeth, color) {
  const batch = new VoxelBatch();
  const rand = mulberry32(Math.round(radius * 83 + teeth));
  const segs = Math.round(radius * 18);
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    for (const dr of [-0.55, 0.55]) {
      batch.add(Math.cos(a) * (radius + dr), Math.sin(a) * (radius + dr), 0, jitterColor(color, 0.03, rand), { scale: 0.82 });
    }
  }
  for (let t = 0; t < teeth; t++) {
    const a = (t / teeth) * Math.PI * 2;
    for (let d = 0; d < 2; d++) {
      const rr = radius + 1 + d * 0.9;
      batch.add(Math.cos(a) * rr, Math.sin(a) * rr, 0, jitterColor(C.goldDark, 0.03, rand), { scale: 0.72 });
    }
  }
  for (let s = 0; s < 5; s++) {
    const a = (s / 5) * Math.PI * 2;
    for (let r = 1.2; r < radius; r += 1.1) {
      batch.add(Math.cos(a) * r, Math.sin(a) * r, 0, jitterColor(color, 0.04, rand), { scale: 0.45 });
    }
  }
  return batch;
}

function buildSupport(materials) {
  const solid = new VoxelBatch();
  const warm = new VoxelBatch();
  const cool = new VoxelBatch();
  const rand = mulberry32(5117);
  const top = WHEEL_CENTER.y;
  const yBase = DECK_Y - top;
  const yRing = -13.4;

  // Stone plinth resting on the deck.
  for (let tier = 0; tier < 3; tier++) {
    const w = 7.2 - tier * 1.1;
    const y = yBase + tier * 0.8;
    solid.addBox(-w, w, y, y, -4.4 + tier * 0.5, 4.4 - tier * 0.5, tier === 1 ? C.stoneDark : C.stone, {
      scale: 0.95,
      jitter: 0.035,
      rand,
      filter: (x, yy, z) => Math.abs(x) > w - 1.3 || Math.abs(z) > 3.9 - tier * 0.5,
    });
  }

  // Central cradle column.
  for (let y = yBase + 2.2; y < yRing + 0.9; y += 0.9) {
    const t = (y - yBase) / (yRing - yBase);
    const hw = 2.6 - t * 1.45;
    solid.addBox(-hw, hw, y, y, -1.8 + t * 0.7, 1.8 - t * 0.7, y % 2 < 1 ? C.wood : C.woodRed, {
      scale: 0.92,
      jitter: 0.03,
      rand,
      filter: (x, yy, z) => Math.abs(x) > hw - 0.8 || Math.abs(z) > 1.7 - t * 0.7,
    });
    if (Math.abs(y % 3) < 0.8) {
      solid.addBox(-hw - 0.4, hw + 0.4, y + 0.4, y + 0.4, -2.1 + t * 0.7, 2.1 - t * 0.7, C.gold, {
        scale: 0.62,
        jitter: 0.02,
        rand,
      });
    }
  }

  // Four angled golden supports.
  const braces = [
    [new THREE.Vector3(-6.4, yBase + 1.2, 2.7), new THREE.Vector3(-1.7, yRing + 0.4, 0.9)],
    [new THREE.Vector3(6.4, yBase + 1.2, 2.7), new THREE.Vector3(1.7, yRing + 0.4, 0.9)],
    [new THREE.Vector3(-6.4, yBase + 1.2, -2.7), new THREE.Vector3(-1.7, yRing + 0.4, -0.9)],
    [new THREE.Vector3(6.4, yBase + 1.2, -2.7), new THREE.Vector3(1.7, yRing + 0.4, -0.9)],
  ];
  for (const [a, b] of braces) {
    const steps = 13;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p = a.clone().lerp(b, t);
      p.y += Math.sin(t * Math.PI) * 0.4;
      solid.add(p.x, p.y, p.z, jitterColor(C.gold, 0.03, rand), { scale: 0.48 });
      if (i % 4 === 0) {
        solid.add(p.x, p.y, p.z + 0.7, C.goldDark, { scale: 0.35 });
      }
    }
  }

  // Glowing spine up the cradle.
  for (let y = yBase + 2.8; y < yRing; y += 1.5) {
    cool.add(0, y, 2.2, y % 3 < 1.5 ? C.cyan : C.goldBright, { scale: 0.46 });
    cool.add(0, y, -2.2, y % 3 < 1.5 ? C.cyan : C.goldBright, { scale: 0.34 });
  }

  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      warm.add(side * 3.4, yBase + 0.9, -3 + i * 1.5, C.window, { scale: 0.35 });
    }
  }

  const supportGroup = new THREE.Group();
  solid.build(materials.solid, { castShadow: true, receiveShadow: true, parent: supportGroup, name: "wheel-cradle" });
  warm.build(materials.warmGlow, { castShadow: false, receiveShadow: false, parent: supportGroup });
  cool.build(materials.coolGlow, { castShadow: false, receiveShadow: false, parent: supportGroup });

  const gears = [];
  for (const side of [-1, 1]) {
    const gearPivot = new THREE.Group();
    const batch = buildGear(2.5, 12, side > 0 ? C.teal : C.woodRed);
    batch.build(materials.solid, { castShadow: true, receiveShadow: true, parent: gearPivot, name: "astrolabe-gear" });
    const hub = new THREE.InstancedMesh(UNIT_BOX, materials.warmGlow, 1);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(0, 0, 0.4),
      new THREE.Quaternion(),
      new THREE.Vector3(0.6, 0.6, 0.6)
    );
    hub.setMatrixAt(0, m);
    hub.setColorAt(0, new THREE.Color(C.window));
    hub.instanceMatrix.needsUpdate = true;
    hub.instanceColor.needsUpdate = true;
    gearPivot.add(hub);
    gearPivot.position.set(side * 5.5, yBase + 2.6, 3.45);
    gearPivot.rotation.z = side * 0.4;
    supportGroup.add(gearPivot);
    gears.push({ pivot: gearPivot, direction: side });
  }

  supportGroup.position.y = 0;
  return { group: supportGroup, gears };
}

export function buildStarWheel(materials) {
  const wheelGroup = new THREE.Group();
  wheelGroup.name = "star-wheel";
  wheelGroup.position.copy(WHEEL_CENTER);

  const support = buildSupport(materials);
  wheelGroup.add(support.group);

  const outer = buildRing(materials, {
    radius: 13.4,
    radialThickness: 2.1,
    depth: 2.6,
    segments: 292,
    colorA: C.tealDeep,
    colorB: C.goldDark,
    sectorCount: 24,
    studs: 36,
    glyphs: 12,
    spokes: 6,
    spokesColor: C.goldDark,
    seed: 71,
    glyphGlow: 0xffe3a4,
  });
  wheelGroup.add(outer.pivot);

  const mid = buildRing(materials, {
    radius: 10.15,
    radialThickness: 1.1,
    depth: 1.5,
    segments: 208,
    colorA: C.gold,
    colorB: C.goldDark,
    sectorCount: 12,
    studs: 24,
    glyphs: 8,
    seed: 73,
    glyphGlow: C.cyan,
  });
  mid.pivot.rotation.set(0.18, 0.92, 0.1);
  wheelGroup.add(mid.pivot);

  const inner = buildRing(materials, {
    radius: 6.7,
    radialThickness: 0.95,
    depth: 1.15,
    segments: 142,
    colorA: C.goldBright,
    colorB: C.teal,
    sectorCount: 8,
    studs: 16,
    glyphs: 4,
    seed: 77,
    glyphGlow: 0xffedbd,
  });
  inner.pivot.rotation.set(1.22, 0.14, 0.35);
  wheelGroup.add(inner.pivot);

  // The star map discs.
  const mapTexture = makeStarMapTexture(403, false, true);
  const mapTextureB = makeStarMapTexture(907, true, false);
  const discMaterial = new THREE.MeshBasicMaterial({
    map: mapTexture,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const discMaterialB = new THREE.MeshBasicMaterial({
    map: mapTextureB,
    transparent: true,
    opacity: 0.46,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    color: 0x89d8d4,
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(12.05, 96), discMaterial);
  disc.position.z = -0.1;
  disc.renderOrder = 3;
  const discB = new THREE.Mesh(new THREE.CircleGeometry(8.2, 80), discMaterialB);
  discB.position.z = 0.35;
  discB.renderOrder = 4;
  const discPivot = new THREE.Group();
  discPivot.add(disc, discB);
  wheelGroup.add(discPivot);

  const starSprite = (() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.16, "rgba(255,250,230,0.98)");
    g.addColorStop(0.38, "rgba(255,230,170,0.3)");
    g.addColorStop(1, "rgba(255,220,150,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();

  const wheelStarMats = [];
  function addWheelStars(count, size, seed, z, spread = 11.5) {
    const rnd = mulberry32(seed);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [0xffe9b8, 0xbfefff, 0x9fe3d0, 0xd5c5ff, 0xfff5dc];
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * spread;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = Math.sin(a) * r;
      positions[i * 3 + 2] = z + (rnd() - 0.5) * 0.4;
      col.set(palette[Math.floor(rnd() * palette.length)]);
      const brightness = 0.75 + rnd() * 0.4;
      colors[i * 3] = col.r * brightness;
      colors[i * 3 + 1] = col.g * brightness;
      colors[i * 3 + 2] = col.b * brightness;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size,
      map: starSprite,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      toneMapped: false,
    });
    const points = new THREE.Points(geo, mat);
    points.renderOrder = 6;
    points.frustumCulled = false;
    discPivot.add(points);
    wheelStarMats.push(mat);
    return points;
  }

  addWheelStars(120, 0.24, 611, 0.42);
  addWheelStars(26, 0.44, 612, 0.56);
  addWheelStars(7, 0.76, 613, 0.7, 10.8);

  // Rotating hub and axle.
  const hubPivot = new THREE.Group();
  const hubBatch = new VoxelBatch();
  const hubGlow = new VoxelBatch();
  for (let x = -2; x <= 2; x++) {
    for (let y = -2; y <= 2; y++) {
      for (let z = -2; z <= 2; z++) {
        if (Math.abs(x) + Math.abs(y) + Math.abs(z) > 3) continue;
        hubBatch.add(x, y, z, jitterColor(C.gold, 0.06, mulberry32(x * 9 + y * 5 + z + 1)), { scale: 0.92 });
      }
    }
  }
  for (let z = -5.5; z <= 5.5; z += 1.1) {
    hubBatch.add(0, 0, z, C.goldDark, { scale: 0.55 });
  }
  hubGlow.add(0, 0, 0, 0xffe9b0, { scale: 1.45 });
  hubGlow.add(0, 0, 5.9, C.cyan, { scale: 0.55 });
  hubGlow.add(0, 0, -5.9, C.cyan, { scale: 0.55 });
  hubBatch.build(materials.solid, { castShadow: true, receiveShadow: true, parent: hubPivot, name: "wheel-hub" });
  hubGlow.build(materials.coolGlow, { castShadow: false, receiveShadow: false, parent: hubPivot });
  wheelGroup.add(hubPivot);

  // Soft satellite sparks orbiting the wheel.
  const orbitGroup = new THREE.Group();
  const orbitPositions = [];
  const orbitColors = [];
  const orbitPalette = [new THREE.Color(0xffd98f), new THREE.Color(0x8ae4d4), new THREE.Color(0xd9c1ff)];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = 15.2;
    orbitPositions.push(Math.cos(a) * r, Math.sin(a) * r, 0);
    const c = orbitPalette[i % 3];
    orbitColors.push(c.r, c.g, c.b);
  }
  const orbitGeo = new THREE.BufferGeometry();
  orbitGeo.setAttribute("position", new THREE.Float32BufferAttribute(orbitPositions, 3));
  orbitGeo.setAttribute("color", new THREE.Float32BufferAttribute(orbitColors, 3));
  const orbitPoints = new THREE.Points(
    orbitGeo,
    new THREE.PointsMaterial({
      size: 0.9,
      map: starSprite,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      toneMapped: false,
    })
  );
  orbitGroup.add(orbitPoints);
  wheelGroup.add(orbitGroup);

  const starLight = new THREE.PointLight(0xffd9a0, 0.8, 58, 1.7);
  starLight.position.set(0, 1, 7);
  wheelGroup.add(starLight);

  let orbitAngle = 0;
  return {
    group: wheelGroup,
    support,
    outer,
    mid,
    inner,
    discPivot,
    disc,
    discB,
    discMaterial,
    discMaterialB,
    wheelStarMats,
    hubPivot,
    orbitGroup,
    starLight,
    update(dt, time, nightMix) {
      outer.pivot.rotation.z += dt * 0.045;
      mid.pivot.rotation.y += dt * 0.085;
      mid.pivot.rotation.z += dt * 0.022;
      inner.pivot.rotation.z -= dt * 0.16;
      inner.pivot.rotation.x += dt * 0.028;
      hubPivot.rotation.z += dt * 0.1;
      discPivot.rotation.z += dt * 0.016;
      discB.rotation.z -= dt * 0.028;
      orbitAngle += dt * 0.12;
      orbitGroup.rotation.z = orbitAngle;
      orbitGroup.rotation.y = Math.sin(time * 0.18) * 0.22;
      for (const gear of support.gears) gear.pivot.rotation.z += dt * 0.34 * gear.direction;
      this.discMaterial.opacity = 1;
      this.discMaterialB.opacity = 0.3 + nightMix * 0.34;
      for (const mat of this.wheelStarMats) mat.opacity = 0.72 + nightMix * 0.26;
      this.starLight.intensity = 0.5 + nightMix * 2.4;
    },
  };
}

function addWindow(solid, glow, x0, y0, z0, face, w, rand) {
  const glowCubes = [];
  if (face === "front" || face === "back") {
    const zOff = face === "front" ? 0.56 : -0.56;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = 0; dy <= 1; dy++) {
        glowCubes.push([x0 + dx, y0 + dy, z0 + zOff]);
      }
    }
    for (let dx = -1; dx <= 1; dx++) {
      glow.add(x0 + dx, y0 + 1, z0 + zOff * 1.06, C.window, { scale: 0.52 });
    }
    solid.add(x0, y0 + 1, z0 + zOff * 1.15, C.woodDark, { scale: 0.36 });
    solid.add(x0 + 1.2, y0, z0 + zOff * 1.15, C.woodDark, { scale: 0.28 });
    solid.add(x0 - 1.2, y0, z0 + zOff * 1.15, C.woodDark, { scale: 0.28 });
  } else {
    const xOff = face === "right" ? 0.56 : -0.56;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dy = 0; dy <= 1; dy++) {
        glow.add(x0 + xOff, y0 + dy, z0 + dz, C.window, { scale: 0.52 });
      }
    }
    solid.add(x0 + xOff * 1.15, y0 + 1, z0, C.woodDark, { scale: 0.36 });
  }
}

function buildPagoda(materials, options) {
  const {
    x,
    z = 0,
    roofColor,
    roofColorDark,
    woodColor,
    accent,
    levels = 5,
    seed = 1,
    bannerColor = 0x963d37,
  } = options;
  const group = new THREE.Group();
  group.position.set(x, DECK_Y, z);
  group.name = "cloud-pagoda";

  const solid = new VoxelBatch();
  const warm = new VoxelBatch();
  const cool = new VoxelBatch();
  const rand = mulberry32(seed);

  // Stone foundation plunging into the whale's back.
  for (let tier = 0; tier < 4; tier++) {
    const w = 6.6 - tier * 0.7;
    const y = -tier * 0.9;
    solid.addBox(-w, w, y - 0.9, y, -w, w, tier % 2 === 0 ? C.stone : C.stoneDark, {
      scale: 0.95,
      jitter: 0.04,
      rand,
      filter: (xx, yy, zz) => Math.max(Math.abs(xx), Math.abs(zz)) > w - 1.3,
    });
  }
  solid.addBox(-5.4, 5.4, -0.15, -0.15, -5.4, 5.4, C.stoneDark, { scale: 0.96, jitter: 0.025, rand });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    warm.add(Math.cos(a) * 5.2, 0.28, Math.sin(a) * 5.2, C.window, { scale: 0.3 });
  }

  // Entry walkway and torii.
  solid.addBox(-2.8, 2.8, -0.2, 0.05, 5, 8.6, C.stone, { scale: 0.94, jitter: 0.03, rand });
  for (const sx of [-2.4, 2.4]) {
    for (let y = 0.2; y <= 3.4; y += 0.9) {
      solid.add(sx, y, 7.4, jitterColor(C.woodRed, 0.03, rand), { scale: 0.66 });
    }
    solid.add(sx, 3.65, 7.4, C.gold, { scale: 0.8 });
  }
  solid.addBox(-3.4, 3.4, 3.5, 3.5, 7.4, 7.4, C.woodRedDark, { scale: 0.9, jitter: 0.02, rand });
  solid.addBox(-4.2, 4.2, 3.95, 3.95, 7.4, 7.4, C.woodRed, { scale: 0.82, jitter: 0.02, rand });
  for (const sx of [-4.2, 4.2]) {
    solid.add(sx, 4.45, 7.4, C.gold, { scale: 0.55 });
  }
  warm.add(0, 3.9, 7.4, C.window, { scale: 0.32 });

  let y = 0.55;
  let width = 7.6;
  const bodyHeight = 3.1;
  const levelRise = 5.72;

  for (let level = 0; level < levels; level++) {
    const half = Math.max(1, Math.round(width / 2));
    const wallH = bodyHeight;

    // Balcony deck.
    solid.addBox(-half - 1, half + 1, y, y + 0.28, -half - 1, half + 1, C.wood, {
      scale: 0.94,
      jitter: 0.03,
      rand,
    });
    for (const sx of [-half - 1, half + 1]) {
      for (const sz of [-half - 1, half + 1]) {
        solid.add(sx, y + 0.4, sz, C.gold, { scale: 0.5 });
      }
    }

    // Railing around the balcony.
    for (let t = -half - 1; t <= half + 1; t += 1.2) {
      for (const sz of [-half - 1, half + 1]) {
        solid.add(t, y + 0.9, sz, C.woodRedDark, { scale: 0.26 });
        if (Math.abs(t % 2.4) < 0.5) solid.add(t, y + 1.25, sz, C.gold, { scale: 0.24 });
      }
      for (const sx of [-half - 1, half + 1]) {
        solid.add(sx, y + 0.9, t, C.woodRedDark, { scale: 0.26 });
      }
    }

    // Wall shell.
    for (let px = -half; px <= half; px++) {
      for (let pz = -half; pz <= half; pz++) {
        const edge = Math.max(Math.abs(px), Math.abs(pz)) === half;
        if (!edge) continue;
        const corner = Math.abs(px) === half && Math.abs(pz) === half;
        for (let py = 1; py <= wallH; py++) {
          let col = jitterColor(level % 2 === 0 ? C.wall : C.wallShade, 0.025, rand);
          if (corner || py === 1 || py === wallH) col = jitterColor(C.woodRedDark, 0.025, rand);
          else if (Math.abs(px) === half && Math.abs(pz) % Math.floor(half / 2 + 1) === 0) col = jitterColor(C.woodDark ?? C.woodRedDark, 0.03, rand);
          solid.add(px, y + py, pz, col, { scale: 0.95 });
        }
      }
    }

    // Windows on all four faces.
    const winY = y + 1.45;
    addWindow(solid, warm, 0, winY, half, "front", width, rand);
    addWindow(solid, warm, 0, winY, -half, "back", width, rand);
    addWindow(solid, warm, half, winY, 0, "right", width, rand);
    addWindow(solid, warm, -half, winY, 0, "left", width, rand);

    // Gold name plaque on the front of the first tier.
    if (level === 0) {
      for (let py = 0; py < 3; py++) {
        solid.add(0, y + 2.15 + py * 0.6, half + 0.72, C.goldDark, { scale: 0.34 });
      }
      solid.add(0, y + 2.5, half + 0.94, C.goldBright, { scale: 0.26 });
    }

    // Tiered roof.
    const roofBaseY = y + wallH + 0.25;
    const roofW = width + 3.7;
    const tiers = 4;
    for (let t = 0; t < tiers; t++) {
      const rw = roofW - t * 1.15;
      const ry = roofBaseY + t * 0.68;
      const rHalf = Math.floor(rw / 2);
      for (let rx = -rHalf; rx <= rHalf; rx++) {
        for (let rz = -rHalf; rz <= rHalf; rz++) {
          const border = Math.abs(rx) === rHalf || Math.abs(rz) === rHalf;
          const corner = Math.abs(rx) === rHalf && Math.abs(rz) === rHalf;
          let col;
          if (t === 0 && border) col = jitterColor(C.goldDark, 0.04, rand);
          else if (corner) col = jitterColor(C.gold, 0.04, rand);
          else if (hash3(rx, t, rz, seed + level) > 0.73) col = jitterColor(roofColorDark, 0.045, rand);
          else col = jitterColor(roofColor, 0.045, rand);
          solid.add(rx, ry, rz, col, { scale: 0.97 });
        }
      }
      if (t === 0) {
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            // Sweeping upturned eave tips.
            const cx = sx * (rHalf + 0.4);
            const cz = sz * (rHalf + 0.4);
            solid.add(cx, ry + 0.15, cz, C.goldDark, { scale: 0.72 });
            solid.add(cx + sx * 0.9, ry + 0.55, cz + sz * 0.15, C.gold, { scale: 0.6 });
            solid.add(cx + sx * 1.6, ry + 1.0, cz + sz * 0.4, C.goldBright, { scale: 0.44 });
            // Eave bell.
            solid.add(cx + sx * 1.6, ry + 0.1, cz + sz * 0.4, C.woodRedDark, { scale: 0.22 });
            solid.add(cx + sx * 1.6, ry - 0.35, cz + sz * 0.4, C.goldBright, { scale: 0.36 });
          }
        }
      }
    }

    // Corner lanterns under each eave.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const lx = sx * (half + 1.2);
        const lz = sz * (half + 1.2);
        solid.add(lx, roofBaseY - 0.4, lz, C.woodRedDark, { scale: 0.25 });
        warm.add(lx, roofBaseY - 1.0, lz, C.window, { scale: 0.46 });
      }
    }

    // Cloth banners on the higher tiers.
    if (level === levels - 2) {
      for (const side of [-1, 1]) {
        const bx = side * (half + 0.9);
        for (let i = 0; i < 7; i++) {
          const wave = Math.sin(i * 0.7) * 0.28;
          solid.add(bx + wave, y - 0.1 - i * 0.7, half + 1.15, jitterColor(bannerColor, 0.03, rand), { scale: 0.36 });
        }
      }
    }

    y += levelRise;
    width = Math.max(3.3, width - 1.02);
  }

  // Crown and finial.
  const crownHalf = 2;
  for (const sx of [-crownHalf, crownHalf]) {
    for (const sz of [-crownHalf, crownHalf]) {
      for (let yy = -0.6; yy < 1.4; yy += 0.7) {
        solid.add(sx, y + yy, sz, C.goldDark, { scale: 0.42 });
      }
    }
  }
  solid.addBox(-1.4, 1.4, y - 0.2, y - 0.2, -1.4, 1.4, C.gold, { jitter: 0.03, rand, scale: 0.9 });
  for (let i = 0; i < 4; i++) {
    solid.add(0, y + 0.7 + i * 1.05, 0, i % 2 === 0 ? C.gold : C.goldDark, { scale: 0.7 - i * 0.07 });
  }
  for (let i = 0; i < 3; i++) {
    const rr = 1.3 - i * 0.38;
    const yy = y + 1.0 + i * 0.85;
    for (const sx of [-rr, rr]) {
      solid.add(sx, yy, 0, C.goldBright, { scale: 0.36 });
      solid.add(0, yy, sx, C.goldBright, { scale: 0.36 });
    }
  }
  warm.add(0, y + 4.8, 0, 0xffe0a0, { scale: 1.0 });
  cool.add(0, y + 5.5, 0, C.cyan, { scale: 0.5 });

  // Small floating lanterns orbiting the spire.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    warm.add(Math.cos(a) * 2.2, y + 2.6 + Math.sin(a * 2) * 0.5, Math.sin(a) * 2.2, C.window, { scale: 0.28 });
  }

  solid.build(materials.solid, { castShadow: true, receiveShadow: true, parent: group, name: "pagoda-frame" });
  warm.build(materials.warmGlow, { castShadow: false, receiveShadow: false, parent: group, name: "pagoda-windows" });
  cool.build(materials.coolGlow, { castShadow: false, receiveShadow: false, parent: group, name: "pagoda-stars" });

  return { group, height: y + 5.8 };
}

export function buildArchitecture(materials) {
  const group = new THREE.Group();
  group.name = "celestial-architecture";

  const wheel = buildStarWheel(materials);
  group.add(wheel.group);

  const leftTower = buildPagoda(materials, {
    x: -TOWER_X,
    roofColor: 0x2f6764,
    roofColorDark: 0x24504f,
    woodColor: C.woodRed,
    accent: C.teal,
    levels: 5,
    seed: 1001,
    bannerColor: 0x9a4038,
  });
  const rightTower = buildPagoda(materials, {
    x: TOWER_X,
    roofColor: 0x415a83,
    roofColorDark: 0x31476d,
    woodColor: 0x62392c,
    accent: C.indigo,
    levels: 5,
    seed: 2007,
    bannerColor: 0x3c6f67,
  });
  group.add(leftTower.group, rightTower.group);

  // Golden rigging between the towers and the wheel.
  const cableSolid = new VoxelBatch();
  const cableGlow = new VoxelBatch();
  const rand = mulberry32(933);
  for (const side of [-1, 1]) {
    for (const zOff of [-1.6, 0, 1.6]) {
      const start = new THREE.Vector3(side * (TOWER_X - 1.8), DECK_Y + 34.5, zOff);
      const end = new THREE.Vector3(side * 6.2, WHEEL_CENTER.y + 12.8, zOff * 0.7);
      for (let i = 0; i <= 22; i++) {
        const t = i / 22;
        const x = THREE.MathUtils.lerp(start.x, end.x, t);
        const y = THREE.MathUtils.lerp(start.y, end.y, t) - Math.sin(t * Math.PI) * (1.9 + Math.abs(zOff) * 0.2);
        const z = THREE.MathUtils.lerp(start.z, end.z, t);
        cableSolid.add(x, y, z, jitterColor(C.gold, 0.04, rand), { scale: 0.24 });
        if (i > 2 && i < 20 && i % 4 === 0) {
          cableGlow.add(x, y - 0.8, z, i % 8 === 0 ? C.window : C.cyan, { scale: 0.3 });
          cableSolid.add(x, y - 0.4, z, C.goldDark, { scale: 0.16 });
        }
      }
    }
    // Lower tension cable with hanging lanterns.
    const start = new THREE.Vector3(side * (TOWER_X - 2.2), DECK_Y + 23, 0.4);
    const end = new THREE.Vector3(side * 13.2, WHEEL_CENTER.y - 1.5, 0.4);
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      const x = THREE.MathUtils.lerp(start.x, end.x, t);
      const y = THREE.MathUtils.lerp(start.y, end.y, t) - Math.sin(t * Math.PI) * 2.6;
      cableSolid.add(x, y, 0.4, C.goldDark, { scale: 0.18 });
      if (i === 8) cableGlow.add(x, y - 1.2, 0.4, C.window, { scale: 0.55 });
    }
  }
  cableSolid.build(materials.solid, { castShadow: false, receiveShadow: false, parent: group, name: "rigging" });
  cableGlow.build(materials.warmGlow, { castShadow: false, receiveShadow: false, parent: group, name: "rigging-lights" });

  return {
    group,
    wheel,
    towers: [leftTower, rightTower],
    update(dt, time, nightMix) {
      wheel.update(dt, time, nightMix);
    },
  };
}
