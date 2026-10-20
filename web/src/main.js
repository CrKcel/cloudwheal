import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createWorld } from "./world.js";

const container = document.getElementById("scene");
const loader = document.getElementById("loader");
const loaderBar = document.getElementById("loaderBar");
const loaderStatus = document.getElementById("loaderStatus");
const dayNightButton = document.getElementById("dayNight");
const cycleLabel = document.getElementById("cycleLabel");
const cycleKicker = document.getElementById("cycleKicker");
const cycleNote = document.getElementById("cycleNote");
const readoutMode = document.getElementById("readoutMode");
const readoutAlt = document.querySelector(".readout-alt strong");
const tourButton = document.getElementById("tourBtn");
const toast = document.getElementById("toast");
const viewButtons = [...document.querySelectorAll(".view-btn")];

const isMobile = window.matchMedia("(max-width: 760px)").matches;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let renderer;
let scene;
let camera;
let controls;
let composer;
let bloomPass;
let world;
let clock;
let elapsed = 0;
let nightTarget = 0;
let nightCurrent = 0;
let cameraTween = null;
let tourActive = false;
let dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.35 : 1.65);
let performanceChecked = false;
let perfTimer = 0;
let perfFrames = 0;
let hudTimer = 0;

const VIEWS = {
  overview: {
    position: new THREE.Vector3(72, 48, 96),
    target: new THREE.Vector3(0, 31, 0),
  },
  wheel: {
    position: new THREE.Vector3(27, 43, 65),
    target: new THREE.Vector3(0, 37.5, 0),
  },
  towers: {
    position: new THREE.Vector3(-72, 37, 64),
    target: new THREE.Vector3(-8, 30, 0),
  },
  head: {
    position: new THREE.Vector3(83, 25, 58),
    target: new THREE.Vector3(26, 17, 0),
  },
  clouds: {
    position: new THREE.Vector3(32, 47, 142),
    target: new THREE.Vector3(0, 10, 0),
  },
};

function setLoaderProgress(value, text) {
  loaderBar.style.transform = `scaleX(${value})`;
  if (text) loaderStatus.textContent = text;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function showToast(message, duration = 2600) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), duration);
}

function initRenderer() {
  renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: "high-performance",
    stencil: false,
  });
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute("aria-label", "云鲸星轮体素场景");
  container.appendChild(renderer.domElement);
  renderer.info.autoReset = false;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(43, window.innerWidth / window.innerHeight, 0.5, 900);
  camera.position.set(146, 94, 188);
  camera.lookAt(0, 31, 0);

  const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    type: THREE.HalfFloatType,
    samples: isMobile ? 0 : 4,
  });
  composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(dpr);
  composer.setSize(window.innerWidth, window.innerHeight);

  const renderPass = new RenderPass(scene, camera);
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.42,
    0.62,
    0.8
  );
  const outputPass = new OutputPass();
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(outputPass);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.rotateSpeed = 0.62;
  controls.zoomSpeed = 0.72;
  controls.panSpeed = 0.7;
  controls.minDistance = 14;
  controls.maxDistance = 285;
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = Math.PI * 0.94;
  controls.target.set(0, 30.5, 0);
  controls.autoRotateSpeed = 0.38;
  controls.update();

  renderer.domElement.addEventListener("pointerdown", () => {
    if (cameraTween) {
      cameraTween = null;
      controls.enabled = true;
    }
  });
}

function updateTourUI() {
  tourButton.setAttribute("aria-pressed", String(tourActive));
  tourButton.setAttribute("aria-label", tourActive ? "停止自动巡游" : "开始自动巡游");
}

function stopTour(silent = true) {
  if (!tourActive) return;
  tourActive = false;
  controls.autoRotate = false;
  updateTourUI();
  if (!silent) showToast("已切换为手动视角");
}

function setActiveView(name) {
  for (const button of viewButtons) {
    button.classList.toggle("is-active", button.dataset.view === name);
  }
}

function cancelTween() {
  cameraTween = null;
  controls.enabled = true;
}

function tweenCamera(position, target, duration = 1.9, easing = "out") {
  stopTour();
  controls.enabled = false;
  cameraTween = {
    fromPosition: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPosition: position.clone(),
    toTarget: target.clone(),
    elapsed: 0,
    duration,
    easing,
  };
}

function getFramedView(name) {
  const view = VIEWS[name];
  const aspect = window.innerWidth / window.innerHeight;
  const framing = THREE.MathUtils.clamp(1.06 / aspect, 1, 1.38);
  return {
    position: view.target.clone().add(view.position.clone().sub(view.target).multiplyScalar(framing)),
    target: view.target.clone(),
  };
}

function goToView(name, instant = false) {
  if (!VIEWS[name]) return;
  const view = getFramedView(name);
  setActiveView(name);
  if (instant) {
    cancelTween();
    camera.position.copy(view.position);
    controls.target.copy(view.target);
    controls.update();
    return;
  }
  tweenCamera(view.position, view.target, 1.9, "inout");
}

function toggleNight(force) {
  const next = typeof force === "boolean" ? force : nightTarget < 0.5;
  nightTarget = next ? 1 : 0;
  document.body.classList.toggle("is-night", next);
  dayNightButton.setAttribute("aria-pressed", String(next));
  dayNightButton.setAttribute("aria-label", next ? "切换到晨光" : "切换到星夜");
  cycleKicker.textContent = next ? "星夜 · 23:10" : "晨光 · 06:42";
  cycleLabel.textContent = next ? "破晓" : "入夜";
  cycleNote.textContent = next ? "晨光将至" : "星轮将明";
  readoutMode.textContent = next ? "星夜巡航" : "晨光航行";
}

function toggleTour() {
  if (cameraTween) cancelTween();
  tourActive = !tourActive;
  controls.autoRotate = tourActive;
  controls.enabled = true;
  updateTourUI();
  setActiveView(null);
  if (tourActive) {
    showToast("自动巡游中 · 拖拽画面可随时停下");
  }
}

function updateUI() {
  tourButton.setAttribute("aria-pressed", String(tourActive));
  tourButton.setAttribute("aria-label", tourActive ? "停止自动巡游" : "开始自动巡游");
  cycleNote.textContent = nightTarget > 0.5 ? "晨光将至" : "星轮将明";
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height);
  composer.setPixelRatio(dpr);
  composer.setSize(width, height);
}

function updateCameraTween(dt) {
  if (!cameraTween) return;
  cameraTween.elapsed += dt;
  const t = Math.min(1, cameraTween.elapsed / cameraTween.duration);
  let ease;
  if (cameraTween.easing === "inout") {
    ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  } else {
    ease = 1 - Math.pow(1 - t, 5);
  }
  camera.position.lerpVectors(cameraTween.fromPosition, cameraTween.toPosition, ease);
  controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, ease);
  camera.lookAt(controls.target);
  if (t >= 1) {
    cameraTween = null;
    controls.enabled = true;
    controls.update();
  }
}

const keys = new Set();
const moveVector = new THREE.Vector3();
const forwardVector = new THREE.Vector3();
const rightVector = new THREE.Vector3();
const upVector = new THREE.Vector3(0, 1, 0);

function updateMovement(dt) {
  if (keys.size === 0) return;
  const sprint = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const speed = (sprint ? 42 : 17) * dt;
  forwardVector.set(0, 0, 0);
  camera.getWorldDirection(forwardVector);
  rightVector.crossVectors(forwardVector, upVector).normalize();
  moveVector.set(0, 0, 0);
  if (keys.has("KeyW")) moveVector.add(forwardVector);
  if (keys.has("KeyS")) moveVector.sub(forwardVector);
  if (keys.has("KeyD")) moveVector.add(rightVector);
  if (keys.has("KeyA")) moveVector.sub(rightVector);
  if (keys.has("KeyE")) moveVector.y += 1;
  if (keys.has("KeyQ")) moveVector.y -= 1;
  if (moveVector.lengthSq() === 0) return;
  moveVector.normalize().multiplyScalar(speed);
  camera.position.add(moveVector);
  controls.target.add(moveVector);
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -230, 230);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -230, 230);
  camera.position.y = THREE.MathUtils.clamp(camera.position.y, 1.2, 145);
  controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0, 145);
  setActiveView(null);
  stopTour();
}

function bindUI() {
  dayNightButton.addEventListener("click", () => toggleNight());
  viewButtons.forEach((button) => {
    button.addEventListener("click", () => goToView(button.dataset.view));
  });
  tourButton.addEventListener("click", toggleTour);

  controls.addEventListener("start", () => {
    if (tourActive) {
      stopTour(false);
    }
    if (cameraTween) return;
    setActiveView(null);
  });

  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    const code = event.code;
    if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE"].includes(code)) {
      if (cameraTween) cancelTween();
      keys.add(code);
      event.preventDefault();
    } else if (code === "ShiftLeft" || code === "ShiftRight") {
      keys.add(code);
    } else if (code === "KeyN") {
      toggleNight();
    } else if (code === "KeyT") {
      toggleTour();
    } else if (code === "KeyR") {
      goToView("overview");
      showToast("已回到寰宇视角");
    }
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.code);
  });

  window.addEventListener("blur", () => keys.clear());
  window.addEventListener("resize", onResize);
}

function monitorPerformance(dt) {
  if (performanceChecked) return;
  if (elapsed < 3.5) return;
  perfFrames++;
  perfTimer += dt;
  if (perfTimer < 3) return;
  const fps = perfFrames / perfTimer;
  performanceChecked = true;
  if (fps < 42 && dpr > 1.05) {
    dpr = 1;
    onResize();
    showToast("已降低渲染精度以保持流畅");
  }
}

function updateHud(dt) {
  hudTimer += dt;
  if (hudTimer < 0.4) return;
  hudTimer = 0;
  const altitude = Math.round(860 + Math.max(0, camera.position.y) * 7.3);
  readoutAlt.textContent = altitude.toLocaleString("en-US");
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  const diff = nightTarget - nightCurrent;
  if (Math.abs(diff) > 0.0005) {
    nightCurrent += diff * (1 - Math.exp(-dt * 1.45));
  } else {
    nightCurrent = nightTarget;
  }

  world.update(dt, elapsed, nightCurrent);

  if (cameraTween) {
    updateCameraTween(dt);
  } else {
    updateMovement(dt);
    controls.enabled = true;
    controls.update();
  }

  bloomPass.strength = THREE.MathUtils.lerp(0.22, 0.8, nightCurrent);
  bloomPass.threshold = THREE.MathUtils.lerp(0.87, 0.66, nightCurrent);
  bloomPass.radius = THREE.MathUtils.lerp(0.52, 0.66, nightCurrent);
  renderer.toneMappingExposure = THREE.MathUtils.lerp(1.0, 0.94, nightCurrent);

  updateHud(dt);
  updateUI();
  monitorPerformance(dt);
  renderer.info.reset();
  composer.render();
}

async function boot() {
  try {
    setLoaderProgress(0.24, "正在校准星轨");
    await nextFrame();
    setLoaderProgress(0.48, "正在托起巨鲸");
    initRenderer();
    await nextFrame();

    setLoaderProgress(0.67, "正在搭建云上楼阁");
    world = createWorld(scene);
    bindUI();
    window.__CLOUDWHALE__ = {
      setNight(value) {
        toggleNight(Boolean(value));
        nightCurrent = value;
      },
      goToView(name) {
        goToView(name, true);
      },
      camera: () => ({
        position: camera.position.toArray(),
        target: controls.target.toArray(),
        night: nightCurrent,
      }),
      stats: () => ({
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        dpr,
        size: renderer.getSize(new THREE.Vector2()).toArray(),
      }),
    };
    await nextFrame();

    setLoaderProgress(0.88, "正在点亮星轮");
    clock = new THREE.Clock();
    animate();
    await wait(420);
    setLoaderProgress(1, "云海已就绪");

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await wait(240);
    loader.classList.add("is-hidden");
    document.body.classList.remove("is-loading");
    document.body.classList.add("is-day");
    loader.setAttribute("aria-hidden", "true");

    if (reduceMotion) {
      goToView("overview", true);
    } else {
      const intro = getFramedView("overview");
      tweenCamera(intro.position, intro.target, 3.4, "out");
    }
    setActiveView("overview");
    toggleNight(false);
    window.setTimeout(() => {
      showToast(isMobile ? "单指旋转 · 双指缩放 · 下方切换视角" : "拖拽环视 · 滚轮远近 · W A S D 自由漫游", 3600);
    }, 1300);
  } catch (error) {
    console.error(error);
    loaderStatus.textContent = "云海未能展开，请刷新页面重试";
    loaderBar.style.background = "#b5645b";
  }
}

boot();
