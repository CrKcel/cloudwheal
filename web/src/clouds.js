import * as THREE from "three";
import { VoxelBatch, mulberry32, makeVoxelMaterial, hash3, jitterColor } from "./voxel.js";

const cloudVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const cloudFragment = /* glsl */ `
  uniform float uTime;
  uniform float uNight;
  uniform vec3 uFogColor;
  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amp = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 5; i++) {
      value += amp * noise(p);
      p = rot * p * 2.03 + 11.7;
      amp *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * 7.0;
    float drift = uTime * 0.022;

    vec2 warp = vec2(fbm(p * 0.8 + drift), fbm(p * 0.8 - drift + 4.7));
    float n1 = fbm(p * 1.25 + warp * 1.18 + vec2(drift * 1.4, -drift));
    float n2 = fbm(p * 2.7 - warp * 0.6 + vec2(-drift * 2.0, drift * 0.5));
    float n = n1 * 0.68 + n2 * 0.32;
    float cover = smoothstep(0.28, 0.72, n);
    float crest = smoothstep(0.58, 0.85, n1 * 0.6 + n2 * 0.4);

    vec3 dayShadow = vec3(0.17, 0.26, 0.45);
    vec3 dayLight = vec3(0.84, 0.82, 0.76);
    vec3 nightShadow = vec3(0.028, 0.042, 0.088);
    vec3 nightLight = vec3(0.24, 0.29, 0.46);
    vec3 shadow = mix(dayShadow, nightShadow, uNight);
    vec3 light = mix(dayLight, nightLight, uNight);

    vec3 col = mix(shadow, light, cover);
    col += mix(vec3(0.95, 0.85, 0.68), vec3(0.34, 0.43, 0.72), uNight) * crest * 0.1;
    col -= mix(vec3(0.11, 0.17, 0.29), vec3(0.015, 0.022, 0.06), uNight) * (1.0 - cover) * 0.5;

    float radial = length(uv - 0.5) * 2.0;
    col = mix(col, uFogColor, smoothstep(0.62, 1.0, radial) * 0.94);

    gl_FragColor = vec4(col, 1.0);
  }
`;

function makeCloudSpriteTexture(seed) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const rand = mulberry32(seed);
  ctx.clearRect(0, 0, 512, 256);
  for (let i = 0; i < 34; i++) {
    const x = 70 + rand() * 372;
    const y = 100 + rand() * 80;
    const rx = 38 + rand() * 88;
    const ry = 26 + rand() * 48;
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    g.addColorStop(0, "rgba(255,251,244,0.34)");
    g.addColorStop(0.55, "rgba(255,250,242,0.14)");
    g.addColorStop(1, "rgba(255,248,238,0)");
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.translate(-x, -y);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildCloud(batch, rand, radius, thickness, step, palette, seed) {
  const blobs = [];
  const count = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < count; i++) {
    blobs.push({
      x: (rand() - 0.5) * radius * 1.25,
      y: (rand() - 0.5) * thickness * 0.75,
      z: (rand() - 0.5) * radius * 0.7,
      rx: radius * (0.35 + rand() * 0.34),
      ry: thickness * (0.42 + rand() * 0.3),
      rz: radius * (0.27 + rand() * 0.25),
    });
  }
  const inside = (x, y, z) => {
    for (const b of blobs) {
      const nx = (x - b.x) / b.rx;
      const ny = (y - b.y) / b.ry;
      const nz = (z - b.z) / b.rz;
      if (nx * nx + ny * ny + nz * nz <= 1) return true;
    }
    return false;
  };
  const R = Math.ceil(radius * 1.4);
  for (let x = -R; x <= R; x += step) {
    for (let y = -Math.ceil(thickness) - 2; y <= Math.ceil(thickness) + 2; y += step) {
      for (let z = -R; z <= R; z += step) {
        if (!inside(x, y, z)) continue;
        const exposed = !inside(x + step, y, z) || !inside(x - step, y, z) ||
          !inside(x, y + step, z) || !inside(x, y - step, z) ||
          !inside(x, y, z + step) || !inside(x, y, z - step);
        if (!exposed) continue;
        const top = y > thickness * 0.5;
        const n = hash3(x, y, z, seed);
        const base = top ? palette.top : palette.side;
        const c = jitterColor(base, 0.05, rand);
        if (n > 0.86) c.lerp(new THREE.Color(palette.shadow), 0.3);
        batch.add(x, y, z, c, { scale: step * 0.94 });
      }
    }
  }
}

export class CloudSystem {
  constructor(scene) {
    this.scene = scene;
    this.groups = [];
    this.nightMix = 0;

    this.uniforms = {
      uTime: { value: 0 },
      uNight: { value: 0 },
      uFogColor: { value: new THREE.Color(0xcfe2f2) },
    };

    const geometry = new THREE.CircleGeometry(540, 96);
    geometry.rotateX(-Math.PI / 2);
    this.sea = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: cloudVertex,
        fragmentShader: cloudFragment,
        depthWrite: true,
      })
    );
    this.sea.position.y = -17;
    this.sea.renderOrder = -5;
    scene.add(this.sea);

    this.cloudMaterial = makeVoxelMaterial({
      roughness: 0.94,
      metalness: 0,
      emissive: 0x2a3f55,
      emissiveIntensity: 0.34,
    });
    this.highMaterial = makeVoxelMaterial({ roughness: 0.95, metalness: 0, transparent: true, opacity: 0.92 });
    this.buildVoxelClouds();

    this.mistSprites = [];
    this.buildMist();
  }

  buildVoxelClouds() {
    const rand = mulberry32(90817);
    const palette = {
      top: 0xfffaf0,
      side: 0xe7edf3,
      shadow: 0xbbbdcf,
    };
    const defs = [
      { x: -105, y: -8, z: 25, r: 25, t: 7, seed: 4 },
      { x: 72, y: -9, z: -38, r: 30, t: 8, seed: 8 },
      { x: -28, y: -10, z: 82, r: 34, t: 9, seed: 13 },
      { x: 152, y: -8, z: 20, r: 27, t: 7, seed: 21 },
      { x: -165, y: -9, z: -35, r: 38, t: 10, seed: 33 },
      { x: 22, y: -12, z: -105, r: 40, t: 10, seed: 41 },
      { x: 122, y: 6, z: 92, r: 17, t: 5, seed: 55 },
      { x: -72, y: 17, z: -95, r: 18, t: 5, seed: 61 },
      { x: 6, y: 27, z: -155, r: 13, t: 4, seed: 72 },
      { x: -135, y: 14, z: 105, r: 15, t: 4, seed: 81 },
      { x: -66, y: 0, z: 42, r: 21, t: 7, seed: 101 },
      { x: 76, y: -3, z: 37, r: 24, t: 8, seed: 102 },
      { x: -18, y: -7, z: -54, r: 27, t: 9, seed: 103 },
      { x: 96, y: 5, z: 6, r: 15, t: 5, seed: 104 },
      { x: -105, y: 7, z: 10, r: 17, t: 5, seed: 105 },
      { x: 42, y: -6, z: 58, r: 18, t: 6, seed: 106 },
    ];

    for (const d of defs) {
      const group = new THREE.Group();
      const batch = new VoxelBatch();
      buildCloud(batch, rand, d.r, d.t, d.r > 20 ? 2 : 1.4, palette, d.seed);
      const mesh = batch.build(this.cloudMaterial, {
        castShadow: false,
        receiveShadow: false,
        parent: group,
        name: "cloud-bank",
        frustumCulled: true,
      });
      if (mesh) {
        group.position.set(d.x, d.y, d.z);
        group.rotation.y = rand() * Math.PI * 2;
        this.scene.add(group);
        this.groups.push({
          group,
          baseX: d.x,
          baseY: d.y,
          phase: rand() * Math.PI * 2,
          speed: 0.1 + rand() * 0.1,
          amp: 3 + rand() * 5,
          spin: (rand() - 0.5) * 0.008,
        });
      }
    }
  }

  buildMist() {
    const tex = makeCloudSpriteTexture(671);
    const defs = [
      [-150, 18, -190, 300, 92, 0.24],
      [170, 8, -160, 330, 96, 0.2],
      [-230, 5, 40, 270, 80, 0.18],
      [240, 26, 60, 300, 90, 0.16],
      [20, -2, 180, 340, 90, 0.16],
    ];
    for (const [x, y, z, sx, sy, op] of defs) {
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: op * 0.72,
        depthWrite: false,
        color: 0xdfeaf3,
        toneMapped: true,
        fog: true,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(sx, sy, 1);
      sprite.position.set(x, y, z);
      sprite.renderOrder = 3;
      this.scene.add(sprite);
      this.mistSprites.push({ sprite, baseOpacity: op * 0.72, baseX: x, baseY: y, phase: Math.random() * 6 });
    }
  }

  setNight(nightMix) {
    this.nightMix = nightMix;
    this.uniforms.uNight.value = nightMix;
    this.cloudMaterial.color.setRGB(
      THREE.MathUtils.lerp(1, 0.68, nightMix),
      THREE.MathUtils.lerp(1, 0.71, nightMix),
      THREE.MathUtils.lerp(1, 0.86, nightMix)
    );
    this.cloudMaterial.emissive.setRGB(
      THREE.MathUtils.lerp(0.115, 0.018, nightMix),
      THREE.MathUtils.lerp(0.17, 0.026, nightMix),
      THREE.MathUtils.lerp(0.24, 0.055, nightMix)
    );
    for (const m of this.mistSprites) {
      m.sprite.material.opacity = m.baseOpacity * THREE.MathUtils.lerp(1, 0.42, nightMix);
    }
  }

  setFogColor(color) {
    this.uniforms.uFogColor.value.copy(color);
  }

  update(dt, time, nightMix) {
    this.uniforms.uTime.value = time;
    for (const c of this.groups) {
      c.group.position.x = c.baseX + Math.sin(time * c.speed + c.phase) * c.amp;
      c.group.position.y = c.baseY + Math.sin(time * c.speed * 0.7 + c.phase) * 0.6;
      c.group.position.z += Math.sin(time * 0.02 + c.phase) * dt * 0.04;
      c.group.rotation.y += c.spin * dt;
    }
    for (let i = 0; i < this.mistSprites.length; i++) {
      const m = this.mistSprites[i];
      m.sprite.position.x = m.baseX + Math.sin(time * 0.012 + m.phase) * 10;
      m.sprite.position.y = m.baseY + Math.sin(time * 0.02 + m.phase) * 1.2;
    }
  }
}
