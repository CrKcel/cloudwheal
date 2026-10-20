import * as THREE from "three";
import { mulberry32 } from "./voxel.js";

function canvasTexture(size, draw, { nearest = false } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
  texture.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
  texture.generateMipmaps = !nearest;
  return texture;
}

function makeStarTexture() {
  return canvasTexture(64, (ctx, size) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.22, "rgba(255,255,255,0.95)");
    g.addColorStop(0.5, "rgba(255,255,255,0.26)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
}

function makeSunTexture() {
  return canvasTexture(512, (ctx, size) => {
    const c = size / 2;
    const halo = ctx.createRadialGradient(c, c, 0, c, c, c);
    halo.addColorStop(0, "rgba(255,246,219,1)");
    halo.addColorStop(0.08, "rgba(255,233,180,0.98)");
    halo.addColorStop(0.2, "rgba(255,203,136,0.4)");
    halo.addColorStop(0.52, "rgba(255,179,118,0.12)");
    halo.addColorStop(1, "rgba(255,170,110,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(c, c);
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 16; i++) {
      ctx.rotate((Math.PI * 2) / 16);
      const ray = ctx.createLinearGradient(0, 0, c * 0.82, 0);
      ray.addColorStop(0, "rgba(255,236,190,0.22)");
      ray.addColorStop(0.6, "rgba(255,215,153,0.055)");
      ray.addColorStop(1, "rgba(255,210,150,0)");
      ctx.fillStyle = ray;
      ctx.beginPath();
      ctx.moveTo(c * 0.1, -c * 0.012);
      ctx.lineTo(c * 0.85, -c * 0.045);
      ctx.lineTo(c * 0.85, c * 0.045);
      ctx.lineTo(c * 0.1, c * 0.012);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    const core = ctx.createRadialGradient(c, c, 0, c, c, size * 0.055);
    core.addColorStop(0, "rgba(255,255,248,1)");
    core.addColorStop(0.6, "rgba(255,246,215,0.95)");
    core.addColorStop(1, "rgba(255,236,189,0)");
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, size, size);
  });
}

function makeMoonTexture() {
  return canvasTexture(288, (ctx, size) => {
    ctx.clearRect(0, 0, size, size);
    const pixels = 24;
    const p = size / pixels;
    const rand = mulberry32(3317);
    const craters = [
      [8, 6, 1.4], [15, 8, 2.1], [10, 14, 1.1], [18, 16, 1.5], [6, 17, 0.9], [13, 20, 0.7],
    ];
    for (let y = 0; y < pixels; y++) {
      for (let x = 0; x < pixels; x++) {
        const nx = (x + 0.5) / pixels * 2 - 1;
        const ny = (y + 0.5) / pixels * 2 - 1;
        if (nx * nx + ny * ny > 0.91) continue;
        const edge = Math.sqrt(nx * nx + ny * ny);
        let shade = 0.88 + rand() * 0.1;
        for (const [cx, cy, cr] of craters) {
          const d = Math.hypot((x - cx) / 1.4, y - cy);
          if (d < cr) shade -= 0.17;
          else if (d < cr + 0.7) shade += 0.05;
        }
        shade -= edge * 0.13;
        const v = Math.max(0.52, Math.min(1, shade));
        const r = Math.round(222 * v);
        const g = Math.round(232 * v);
        const b = Math.round(250 * v);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x * p, y * p, p + 0.5, p + 0.5);
      }
    }
  }, { nearest: true });
}

function makeMoonGlowTexture() {
  return canvasTexture(256, (ctx, size) => {
    const c = size / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, "rgba(213,230,255,0.44)");
    g.addColorStop(0.24, "rgba(181,207,255,0.22)");
    g.addColorStop(0.6, "rgba(143,174,255,0.07)");
    g.addColorStop(1, "rgba(120,150,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
}

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vDir = normalize(world.xyz - cameraPosition);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const skyFragment = /* glsl */ `
  uniform float uNight;
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uMoonDir;
  varying vec3 vDir;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec3 dir = normalize(vDir);
    float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
    float up = clamp(dir.y, 0.0, 1.0);

    vec3 dayHorizon = vec3(0.96, 0.54, 0.28);
    vec3 dayLow = vec3(0.24, 0.53, 0.94);
    vec3 dayMid = vec3(0.06, 0.26, 0.80);
    vec3 dayZenith = vec3(0.005, 0.06, 0.32);

    vec3 nightHorizon = vec3(0.09, 0.08, 0.20);
    vec3 nightLow = vec3(0.020, 0.035, 0.10);
    vec3 nightMid = vec3(0.004, 0.010, 0.040);
    vec3 nightZenith = vec3(0.0004, 0.0012, 0.006);

    float t1 = smoothstep(0.0, 0.10, up);
    float t2 = smoothstep(0.05, 0.52, up);

    vec3 day = mix(dayHorizon, dayLow, smoothstep(0.0, 0.028, up));
    day = mix(day, dayMid, t1);
    day = mix(day, dayZenith, t2);

    vec3 night = mix(nightHorizon, nightLow, smoothstep(0.0, 0.09, up));
    night = mix(night, nightMid, t1);
    night = mix(night, nightZenith, t2);

    vec3 color = mix(day, night, uNight);

    // Warm scatter around the morning sun.
    float sunDot = max(dot(dir, uSunDir), 0.0);
    vec3 sunGlow = vec3(1.0, 0.42, 0.13);
    color += sunGlow * pow(sunDot, 38.0) * 0.18 * (1.0 - uNight);
    color += vec3(1.0, 0.72, 0.38) * pow(sunDot, 130.0) * 0.34 * (1.0 - uNight);
    color += vec3(1.0, 0.66, 0.34) * smoothstep(0.2, 0.0, dir.y) * pow(sunDot, 22.0) * 0.1 * (1.0 - uNight);

    // Cool moonlight wash.
    float moonDot = max(dot(dir, uMoonDir), 0.0);
    color += vec3(0.28, 0.36, 0.68) * pow(moonDot, 14.0) * 0.13 * uNight;
    color += vec3(0.52, 0.63, 0.92) * pow(moonDot, 120.0) * 0.2 * uNight;

    // Horizon haze.
    float haze = exp(-max(dir.y, 0.0) * 20.0);
    vec3 hazeColor = mix(vec3(0.92, 0.62, 0.38), vec3(0.18, 0.19, 0.32), uNight);
    color = mix(color, hazeColor, haze * 0.065);

    // Very faint nebular bands after dark.
    float band = exp(-pow((dir.y - 0.22 - sin(dir.x * 3.1) * 0.035) * 7.5, 2.0));
    color += vec3(0.16, 0.2, 0.34) * band * uNight * 0.18;

    float dither = (hash(gl_FragCoord.xy + uTime * 0.03) - 0.5) * 0.0035;
    color += dither;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function buildStars(count, radius, size, palette, seed, band = 0) {
  const rand = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    let x, y, z;
    if (band) {
      const a = rand() * Math.PI * 2;
      const lat = (rand() + rand() + rand() - 1.5) * 0.16;
      x = Math.cos(a) * Math.cos(lat);
      z = Math.sin(a) * Math.cos(lat);
      y = Math.sin(lat) + 0.18;
      const len = Math.hypot(x, y, z);
      x = (x / len) * radius;
      y = (y / len) * radius;
      z = (z / len) * radius;
    } else {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(rand() * 1.92 - 0.92);
      x = Math.sin(phi) * Math.cos(theta) * radius;
      y = Math.cos(phi) * radius;
      z = Math.sin(phi) * Math.sin(theta) * radius;
    }
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    const p = palette[Math.floor(rand() * palette.length)];
    color.set(p);
    const brightness = band ? 0.65 + rand() * 0.35 : 0.55 + rand() * 0.6;
    colors[i * 3] = color.r * brightness;
    colors[i * 3 + 1] = color.g * brightness;
    colors[i * 3 + 2] = color.b * brightness;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size,
    map: makeStarTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = -8;
  return points;
}

class Meteor {
  constructor(scene, rand, starTexture) {
    this.rand = rand;
    this.count = 26;
    this.positions = new Float32Array(this.count * 3);
    this.colors = new Float32Array(this.count * 3);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    this.material = new THREE.PointsMaterial({
      size: 3.5,
      map: starTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      toneMapped: false,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
    scene.add(this.points);
    this.active = false;
    this.wait = 0.6 + rand() * 3.2;
    this.progress = 0;
    this.duration = 1;
    this.head = new THREE.Vector3();
    this.dir = new THREE.Vector3();
    this.trailLength = 50;
    this.colorHead = new THREE.Color(0xfff1c9);
    this.colorTail = new THREE.Color(0x7fc9ff);
  }

  spawn() {
    const r = this.rand;
    const start = new THREE.Vector3((r() - 0.5) * 380, 135 + r() * 130, -80 + (r() - 0.5) * 250);
    this.dir.set(-0.5 - r() * 0.4, -0.6 - r() * 0.35, -0.1 + (r() - 0.5) * 0.4).normalize();
    this.head.copy(start);
    this.speed = 65 + r() * 75;
    this.duration = 1.9 + r() * 1.3;
    this.progress = 0;
    this.trailLength = 38 + r() * 44;
    this.active = true;
    this.points.visible = true;
    this.material.opacity = 0;
  }

  update(dt, nightMix) {
    if (!this.active) {
      this.wait -= dt;
      if (this.wait <= 0) {
        this.spawn();
        this.wait = 3.5 + this.rand() * 8;
      }
      return;
    }
    this.progress += dt / this.duration;
    if (this.progress >= 1) {
      this.active = false;
      this.points.visible = false;
      return;
    }
    const p = this.progress;
    const fade = Math.sin(Math.min(1, p * 3.2) * Math.PI * 0.5) * (1 - Math.max(0, (p - 0.7) / 0.3));
    this.material.opacity = (0.28 + nightMix * 0.72) * fade;
    const travel = this.speed * p * this.duration;
    this.head.addScaledVector(this.dir, this.speed * dt);
    const base = this.head.clone();
    for (let i = 0; i < this.count; i++) {
      const t = i / (this.count - 1);
      const x = base.x - this.dir.x * this.trailLength * t;
      const y = base.y - this.dir.y * this.trailLength * t + Math.sin(t * Math.PI) * 1.8;
      const z = base.z - this.dir.z * this.trailLength * t;
      this.positions[i * 3] = x;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = z;
      const brightness = Math.pow(1 - t, 2.4) * (0.65 + nightMix * 0.55);
      this.colors[i * 3] = (this.colorHead.r * (1 - t) + this.colorTail.r * t) * brightness;
      this.colors[i * 3 + 1] = (this.colorHead.g * (1 - t) + this.colorTail.g * t) * brightness;
      this.colors[i * 3 + 2] = (this.colorHead.b * (1 - t) + this.colorTail.b * t) * brightness;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }
}

export class SkySystem {
  constructor(scene) {
    this.scene = scene;
    this.nightMix = 0;
    this.sunDir = new THREE.Vector3(-0.58, 0.3, -0.76).normalize();
    this.moonDir = new THREE.Vector3(-0.5, 0.31, -0.81).normalize();

    this.uniforms = {
      uNight: { value: 0 },
      uTime: { value: 0 },
      uSunDir: { value: this.sunDir },
      uMoonDir: { value: this.moonDir },
    };

    const domeGeo = new THREE.SphereGeometry(460, 48, 28);
    this.dome = new THREE.Mesh(
      domeGeo,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      })
    );
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -20;
    scene.add(this.dome);

    const starTex = makeStarTexture();
    this.starFar = buildStars(1500, 420, 1.55, ["#fff7e4", "#d9e6ff", "#ffe3b8", "#c9d8ff"], 7103);
    this.starNear = buildStars(280, 415, 2.9, ["#fff9ec", "#d8e8ff", "#ffddb0"], 9931);
    this.milky = buildStars(900, 425, 1.15, ["#aebde9", "#d4c6ec", "#e8d7c5", "#8ea8df"], 1179, 1);
    scene.add(this.starFar, this.starNear, this.milky);

    const sunTexture = makeSunTexture();
    this.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sunTexture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      opacity: 1,
      fog: false,
    }));
    this.sunSprite.scale.setScalar(58);
    this.sunSprite.position.copy(this.sunDir).multiplyScalar(380);
    this.sunSprite.renderOrder = -9;
    scene.add(this.sunSprite);

    this.moonGroup = new THREE.Group();
    this.moonGroup.position.copy(this.moonDir).multiplyScalar(360);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeMoonGlowTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      opacity: 0,
      fog: false,
    }));
    glow.scale.setScalar(96);
    this.moonGroup.add(glow);
    this.moonGlow = glow;

    this.moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeMoonTexture(),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      opacity: 0,
      fog: false,
    }));
    this.moonSprite.scale.setScalar(40);
    this.moonGroup.add(this.moonSprite);
    this.moonGroup.visible = false;
    scene.add(this.moonGroup);

    this.meteors = [];
    const rand = mulberry32(8821);
    for (let i = 0; i < 8; i++) {
      this.meteors.push(new Meteor(scene, rand, starTex));
    }

    // Long, faint meteor ribbons for a persistent trail across the night sky.
    this.trails = [];
    const trailSpecs = [
      { a: [-80, 120, -220], b: [30, 90, -300], c: [-20, 142, -260], seed: 31 },
      { a: [-10, 150, -260], b: [20, 105, -310], c: [10, 142, -282], seed: 67 },
      { a: [-40, 140, -240], b: [45, 110, -300], c: [8, 156, -270], seed: 83 },
    ];
    for (const spec of trailSpecs) {
      const r = mulberry32(spec.seed);
      const pts = [];
      const cols = [];
      const count = 96;
      const colA = new THREE.Color(0xfff1c9);
      const colB = new THREE.Color(0x77c6ff);
      const color = new THREE.Color();
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const x = (1 - t) * (1 - t) * spec.a[0] + 2 * (1 - t) * t * spec.c[0] + t * t * spec.b[0];
        const y = (1 - t) * (1 - t) * spec.a[1] + 2 * (1 - t) * t * spec.c[1] + t * t * spec.b[1];
        const z = (1 - t) * (1 - t) * spec.a[2] + 2 * (1 - t) * t * spec.c[2] + t * t * spec.b[2];
        pts.push(x, y, z);
        color.lerpColors(colA, colB, t);
        const bright = Math.pow(1 - t, 1.1) * (0.8 + r() * 0.3);
        cols.push(color.r * bright, color.g * bright, color.b * bright);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
      const mat = new THREE.PointsMaterial({
        size: 2.6,
        map: starTex,
        vertexColors: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        toneMapped: false,
        fog: false,
      });
      const points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      points.renderOrder = -7;
      scene.add(points);
      this.trails.push({ points, mat });
    }
  }

  setNight(nightMix) {
    this.nightMix = nightMix;
    this.uniforms.uNight.value = nightMix;
    this.starFar.material.opacity = nightMix * 0.85;
    this.starNear.material.opacity = nightMix * 0.95;
    this.milky.material.opacity = nightMix * 0.46;
    this.sunSprite.material.opacity = Math.max(0, 1 - nightMix * 1.45);
    this.sunSprite.visible = nightMix < 0.72;
    this.moonSprite.material.opacity = THREE.MathUtils.smoothstep(nightMix, 0.18, 0.72);
    this.moonGlow.material.opacity = THREE.MathUtils.smoothstep(nightMix, 0.18, 0.72) * 0.85;
    this.moonGroup.visible = nightMix > 0.16;
    for (const trail of this.trails) {
      trail.mat.opacity = nightMix * 0.9;
    }
  }

  update(dt, time, nightMix) {
    this.uniforms.uTime.value = time;
    this.starFar.rotation.y = time * 0.0035;
    this.starNear.rotation.y = time * 0.005;
    this.milky.rotation.y = time * 0.002;
    for (const meteor of this.meteors) meteor.update(dt, nightMix);
  }
}
