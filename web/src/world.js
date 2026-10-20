import * as THREE from "three";
import { makeVoxelMaterial, makeGlowMaterial } from "./voxel.js";
import { buildWhale, WHALE_GROUP_Y } from "./whale.js";
import { buildArchitecture } from "./architecture.js";
import { buildVillage } from "./village.js";
import { createLife } from "./life.js";
import { SkySystem } from "./sky.js";
import { CloudSystem } from "./clouds.js";

const DAY_FOG = new THREE.Color(0xaecadf);
const NIGHT_FOG = new THREE.Color(0x17213c);
const DAY_SUN = new THREE.Color(0xffe0b1);
const NIGHT_SKY_HEMI = new THREE.Color(0x5d6fa7);
const DAY_SKY_HEMI = new THREE.Color(0xb9d8f7);
const NIGHT_GROUND_HEMI = new THREE.Color(0x191d31);
const DAY_GROUND_HEMI = new THREE.Color(0xf4d8ae);

export function createWorld(scene) {
  const sky = new SkySystem(scene);
  const clouds = new CloudSystem(scene);

  const solid = makeVoxelMaterial({
    roughness: 0.86,
    metalness: 0.025,
    flatShading: true,
  });
  const warmGlow = makeGlowMaterial();
  const coolGlow = makeGlowMaterial();
  const water = new THREE.MeshStandardMaterial({
    color: 0x4c9c99,
    emissive: 0x144b4e,
    emissiveIntensity: 0.9,
    roughness: 0.22,
    metalness: 0.25,
    transparent: true,
    opacity: 0.86,
  });

  warmGlow.color.setRGB(1.24, 1.14, 0.98);
  coolGlow.color.setRGB(1.08, 1.24, 1.32);

  const materials = {
    solid,
    warmGlow,
    coolGlow,
    water,
    dayFog: DAY_FOG,
    nightFog: NIGHT_FOG,
  };

  const whale = buildWhale(materials);
  whale.group.position.y = WHALE_GROUP_Y;
  scene.add(whale.group);

  const architecture = buildArchitecture(materials);
  whale.group.add(architecture.group);

  const village = buildVillage(materials);
  whale.group.add(village.group);

  const life = createLife(scene, whale.group, materials);

  // Lighting.
  const hemi = new THREE.HemisphereLight(DAY_SKY_HEMI, DAY_GROUND_HEMI, 0.82);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(DAY_SUN, 2.15);
  sun.position.copy(sky.sunDir).multiplyScalar(150);
  sun.target.position.set(0, 24, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -112;
  sun.shadow.camera.right = 112;
  sun.shadow.camera.top = 112;
  sun.shadow.camera.bottom = -112;
  sun.shadow.camera.near = 15;
  sun.shadow.camera.far = 380;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.035;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun, sun.target);

  const moon = new THREE.DirectionalLight(0xabc7ff, 0);
  moon.position.copy(sky.moonDir).multiplyScalar(150);
  moon.target.position.set(0, 24, 0);
  scene.add(moon, moon.target);

  const fill = new THREE.DirectionalLight(0x9dbde8, 0.34);
  fill.position.set(85, 46, 92);
  fill.target.position.set(0, 24, 0);
  scene.add(fill, fill.target);

  const rim = new THREE.DirectionalLight(0xffcf9d, 0.26);
  rim.position.set(-90, 60, -80);
  rim.target.position.set(0, 26, 0);
  scene.add(rim, rim.target);

  scene.fog = new THREE.FogExp2(DAY_FOG.clone(), 0.00155);

  const state = {
    nightMix: 0,
  };

  function applyNight(n) {
    state.nightMix = n;
    sky.setNight(n);
    clouds.setNight(n);

    const fog = scene.fog;
    fog.color.copy(DAY_FOG).lerp(NIGHT_FOG, n);
    fog.density = THREE.MathUtils.lerp(0.00155, 0.0024, n);
    clouds.setFogColor(fog.color);

    sun.intensity = THREE.MathUtils.lerp(2.15, 0.0, n);
    sun.color.copy(DAY_SUN);
    moon.intensity = THREE.MathUtils.lerp(0, 1.45, n);
    fill.intensity = THREE.MathUtils.lerp(0.34, 0.2, n);
    fill.color.setRGB(
      THREE.MathUtils.lerp(0.62, 0.42, n),
      THREE.MathUtils.lerp(0.74, 0.52, n),
      THREE.MathUtils.lerp(0.91, 0.85, n)
    );
    rim.intensity = THREE.MathUtils.lerp(0.26, 0.15, n);
    hemi.color.copy(DAY_SKY_HEMI).lerp(NIGHT_SKY_HEMI, n);
    hemi.groundColor.copy(DAY_GROUND_HEMI).lerp(NIGHT_GROUND_HEMI, n);
    hemi.intensity = THREE.MathUtils.lerp(0.82, 0.52, n);

    warmGlow.color.setRGB(
      THREE.MathUtils.lerp(1.24, 1.7, n),
      THREE.MathUtils.lerp(1.14, 1.46, n),
      THREE.MathUtils.lerp(0.98, 1.1, n)
    );
    coolGlow.color.setRGB(
      THREE.MathUtils.lerp(1.08, 1.4, n),
      THREE.MathUtils.lerp(1.24, 1.6, n),
      THREE.MathUtils.lerp(1.32, 1.72, n)
    );

    water.color.setRGB(
      THREE.MathUtils.lerp(0.07, 0.03, n),
      THREE.MathUtils.lerp(0.32, 0.15, n),
      THREE.MathUtils.lerp(0.31, 0.22, n)
    );
    water.emissive.setRGB(
      THREE.MathUtils.lerp(0.015, 0.05, n),
      THREE.MathUtils.lerp(0.09, 0.16, n),
      THREE.MathUtils.lerp(0.10, 0.22, n)
    );

    solid.roughness = THREE.MathUtils.lerp(0.86, 0.92, n);
  }

  applyNight(0);

  const clockTime = { value: 0 };
  let startTime = null;

  return {
    scene,
    sky,
    clouds,
    whale,
    architecture,
    village,
    life,
    lights: { sun, moon, hemi, fill, rim },
    materials,
    state,
    applyNight,
    update(dt, time, nightMix) {
      applyNight(nightMix);
      whale.group.position.y = WHALE_GROUP_Y + Math.sin(time * 0.22) * 0.26;
      whale.group.rotation.z = Math.sin(time * 0.17) * 0.0045;
      whale.group.rotation.x = Math.sin(time * 0.13 + 1.2) * 0.002;
      architecture.update(dt, time, nightMix);
      village.update(dt, time);
      life.update(dt, time, nightMix);
      sky.update(dt, time, nightMix);
      clouds.update(dt, time, nightMix);
      clockTime.value = time;
    },
  };
}
