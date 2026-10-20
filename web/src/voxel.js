import * as THREE from "three";

export const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash3(x, y, z, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1440662683) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function jitterColor(base, amount = 0.045, rand = Math.random, satShift = 0.02) {
  const color = base instanceof THREE.Color ? base.clone() : new THREE.Color(base);
  const hsl = {};
  color.getHSL(hsl);
  color.setHSL(
    (hsl.h + (rand() - 0.5) * satShift + 1) % 1,
    THREE.MathUtils.clamp(hsl.s + (rand() - 0.5) * satShift, 0, 1),
    THREE.MathUtils.clamp(hsl.l + (rand() - 0.5) * amount * 2, 0.01, 0.98)
  );
  return color;
}

export function tint(base, target, amount) {
  const c = base instanceof THREE.Color ? base.clone() : new THREE.Color(base);
  return c.lerp(new THREE.Color(target), amount);
}

export function makeVoxelMaterial(options = {}) {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.82,
    metalness: 0.01,
    flatShading: true,
    ...options,
  });
}

export function makeGlowMaterial(options = {}) {
  return new THREE.MeshBasicMaterial({
    color: 0xffffff,
    toneMapped: false,
    ...options,
  });
}

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _v = new THREE.Vector3();

export class VoxelBatch {
  constructor() {
    this.voxels = [];
  }

  get count() {
    return this.voxels.length;
  }

  add(x, y, z, color = 0xffffff, options = {}) {
    this.voxels.push({
      x,
      y,
      z,
      color: color instanceof THREE.Color ? color.clone() : new THREE.Color(color),
      sx: options.sx ?? options.scale ?? 1,
      sy: options.sy ?? options.scale ?? 1,
      sz: options.sz ?? options.scale ?? 1,
      rx: options.rx ?? 0,
      ry: options.ry ?? 0,
      rz: options.rz ?? 0,
    });
    return this;
  }

  addBox(x0, x1, y0, y1, z0, z1, color, options = {}) {
    const {
      step = 1,
      scale = 1,
      jitter = 0.035,
      rand = Math.random,
      filter = null,
      colorFn = null,
      ry = 0,
      rx = 0,
      rz = 0,
    } = options;

    for (let x = x0; x <= x1; x += step) {
      for (let y = y0; y <= y1; y += step) {
        for (let z = z0; z <= z1; z += step) {
          if (filter && !filter(x, y, z)) continue;
          let c;
          if (colorFn) {
            c = colorFn(x, y, z, rand);
            if (c === null || c === undefined) continue;
          } else {
            c = jitter ? jitterColor(color, jitter, rand) : color;
          }
          this.add(x, y, z, c, { scale, ry, rx, rz });
        }
      }
    }
    return this;
  }

  addEllipsoid(cx, cy, cz, rx, ry, rz, color, options = {}) {
    const {
      step = 1,
      shell = true,
      shellThreshold = 0.9,
      jitter = 0.04,
      rand = Math.random,
      colorFn = null,
      scale = 1,
      filter = null,
      transform = null,
    } = options;

    const inside = (x, y, z) => {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const nz = (z - cz) / rz;
      return nx * nx + ny * ny + nz * nz <= 1;
    };

    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    const z0 = Math.floor(cz - rz);
    const z1 = Math.ceil(cz + rz);

    for (let x = x0; x <= x1; x += step) {
      for (let y = y0; y <= y1; y += step) {
        for (let z = z0; z <= z1; z += step) {
          if (!inside(x, y, z)) continue;
          if (filter && !filter(x, y, z)) continue;
          if (shell) {
            const nx = (x + step - cx) / rx;
            const ny = (y - cy) / ry;
            const nz = (z - cz) / rz;
            const exposed = !inside(x + step, y, z) || !inside(x - step, y, z) ||
              !inside(x, y + step, z) || !inside(x, y - step, z) ||
              !inside(x, y, z + step) || !inside(x, y, z - step);
            if (!exposed) continue;
            if (nx * nx + ny * ny + nz * nz < shellThreshold * shellThreshold) continue;
          }
          let c;
          if (colorFn) {
            c = colorFn(x, y, z, rand);
            if (c === null || c === undefined) continue;
          } else {
            c = jitter ? jitterColor(color, jitter, rand) : color;
          }
          let px = x;
          let py = y;
          let pz = z;
          if (transform) {
            _v.set(x - cx, y - cy, z - cz);
            transform(_v);
            px = cx + _v.x;
            py = cy + _v.y;
            pz = cz + _v.z;
          }
          this.add(px, py, pz, c, { scale });
        }
      }
    }
    return this;
  }

  addRing(cx, cy, cz, radius, color, options = {}) {
    const {
      radialThickness = 1.2,
      depth = 2,
      segments = Math.max(64, Math.round(radius * 14)),
      colorFn = null,
      jitter = 0.05,
      rand = Math.random,
      scale = 1,
      phase = 0,
      zSlices = null,
    } = options;

    const zList = zSlices ?? (depth <= 1 ? [0] : [-depth / 2 + 0.5, depth / 2 - 0.5]);
    const radialList = radialThickness <= 1 ? [0] : [-radialThickness / 2 + 0.5, radialThickness / 2 - 0.5];

    for (let i = 0; i < segments; i++) {
      const a = phase + (i / segments) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      for (const dr of radialList) {
        for (const dz of zList) {
          const r = radius + dr;
          const x = cx + ca * r;
          const y = cy + sa * r;
          const z = cz + dz;
          let c;
          if (colorFn) c = colorFn(i, a, r, dz);
          else c = jitter ? jitterColor(color, jitter, rand) : color;
          this.add(x, y, z, c, { scale });
        }
      }
    }
    return this;
  }

  addCylinder(cx, cy, cz, radiusTop, radiusBottom, height, color, options = {}) {
    const { step = 1, colorFn = null, jitter = 0.04, rand = Math.random, scale = 1 } = options;
    for (let y = 0; y < height; y += step) {
      const t = height <= 1 ? 0 : y / (height - 1);
      const r = THREE.MathUtils.lerp(radiusBottom, radiusTop, t);
      const rFloor = Math.floor(r);
      for (let x = -rFloor; x <= rFloor; x++) {
        for (let z = -rFloor; z <= rFloor; z++) {
          if (x * x + z * z > r * r) continue;
          const px = cx + x;
          const py = cy + y;
          const pz = cz + z;
          let c = colorFn ? colorFn(px, py, pz, t) : jitterColor(color, jitter, rand);
          if (c !== null) this.add(px, py, pz, c, { scale });
        }
      }
    }
    return this;
  }

  addCatenary(p0, p1, sag, color, options = {}) {
    const { steps = 24, scale = 0.72, jitter = 0.06, rand = Math.random, onlyEvery = 1 } = options;
    for (let i = 0; i <= steps; i++) {
      if (i % onlyEvery !== 0 && i !== steps) continue;
      const t = i / steps;
      const x = THREE.MathUtils.lerp(p0.x, p1.x, t);
      const y = THREE.MathUtils.lerp(p0.y, p1.y, t) - Math.sin(t * Math.PI) * sag;
      const z = THREE.MathUtils.lerp(p0.z, p1.z, t);
      this.add(x, y, z, jitterColor(color, jitter, rand), { scale });
    }
    return this;
  }

  merge(other) {
    this.voxels.push(...other.voxels);
    return this;
  }

  build(material, options = {}) {
    const {
      castShadow = true,
      receiveShadow = true,
      parent = null,
      name = "",
      frustumCulled = true,
    } = options;

    if (this.voxels.length === 0) return null;

    const mesh = new THREE.InstancedMesh(UNIT_BOX, material, this.voxels.length);
    mesh.name = name;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.frustumCulled = frustumCulled;

    for (let i = 0; i < this.voxels.length; i++) {
      const v = this.voxels[i];
      _dummy.position.set(v.x, v.y, v.z);
      _dummy.rotation.set(v.rx, v.ry, v.rz);
      _dummy.scale.set(v.sx, v.sy, v.sz);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
      mesh.setColorAt(i, v.color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (frustumCulled) mesh.computeBoundingSphere();

    if (parent) parent.add(mesh);
    return mesh;
  }
}

export function voxelGroup(parent, batches, material, options = {}) {
  const group = new THREE.Group();
  for (const [batch, extra] of batches) {
    batch.build(material, { ...options, ...extra, parent: group });
  }
  if (parent) parent.add(group);
  return group;
}

export function circlePoints(cx, cy, cz, radius, count, phase = 0) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2;
    points.push(new THREE.Vector3(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, cz));
  }
  return points;
}
