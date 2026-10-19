import * as THREE from 'three/webgpu';
import { pass, float, mix } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCastleMaterials } from './pbr-materials.js';
import { buildGothicArchitecture } from './gothic-architecture.js';
import { buildCastleSanctum } from './castle-sanctum.js';

const $ = id => document.getElementById(id);

const WAYPOINTS = {
  nave: {
    pos: [0.0, 2.55, 13.4],
    look: [0.0, 4.2, -14.5],
    orbit: [1.85, 0.38, 4.8],
    sub: 'NAVE OF THE NORTHERN CROWN',
    title: '皇室中殿巡禮',
    desc: '陽光穿過高聳的哥德彩繪玫瑰花窗，在磨損反光的石板地與全身板甲之間灑落金色塵埃。'
  },
  throne: {
    pos: [-1.8, 2.35, -8.2],
    look: [0.0, 4.8, -16.8],
    orbit: [1.4, 0.32, 2.2],
    sub: 'DAIS OF THE SOVEREIGN',
    title: '玫瑰花窗與王座',
    desc: '三層黑玄武岩皇家高台之上，華蓋橡木王座與七枝純銅燭台映照著六米玫瑰花窗的彩光。'
  },
  hearth: {
    pos: [2.4, 2.05, 2.8],
    look: [7.4, 1.85, -0.4],
    orbit: [0.95, 0.24, 1.8],
    sub: 'THE GREAT STONE HEARTH',
    title: '巨石壁爐與板甲',
    desc: '東側拱廊的巨型錐頂石壁爐烈焰翻騰，火光在哥德式全身騎士板甲與長戟上跳躍閃爍。'
  },
  vault: {
    pos: [-2.9, 6.4, 7.5],
    look: [0.4, 11.2, -9.0],
    orbit: [1.6, 0.45, 3.2],
    sub: 'QUADRIPARTITE RIBBED VAULTS',
    title: '哥德肋拱與吊燈',
    desc: '仰望十三米高的尖拱十字肋頂與二樓拱廊迴廊，三座雙層鍛鐵皇冠吊燈懸垂於鍍金拱心石下。'
  },
  aisle: {
    pos: [-6.4, 2.15, 6.2],
    look: [-2.2, 2.4, -8.5],
    orbit: [0.65, 0.22, 3.6],
    sub: 'COLONNADE & ROYAL FEAST',
    title: '側廊柱列與盛宴',
    desc: '穿梭於十四根八角簇柱與尖拱長廊之間，長桌擺滿純銀酒爵、錫盤與搖曳的蜂蠟燭台。'
  }
};

const MOOD_PRESETS = {
  golden: {
    bg: 0x161411,
    fogColor: 0x211d18,
    fogDensity: 0.0145,
    hemiSky: 0xffe6ba,
    hemiGround: 0x4a3522,
    hemiInt: 1.25,
    sunColor: 0xffdf9e,
    sunInt: 3.6,
    roseColor: 0xffcf82,
    roseInt: 2.2,
    rayColor: 0xffe0a3,
    rayOpacity: 0.36,
    glassEmissive: 0xffd896,
    glassInt: 1.65
  },
  moonlight: {
    bg: 0x090d16,
    fogColor: 0x0f1726,
    fogDensity: 0.0155,
    hemiSky: 0x8cb8ff,
    hemiGround: 0x26201c,
    hemiInt: 0.95,
    sunColor: 0x7cb2ff,
    sunInt: 2.6,
    roseColor: 0x7ab0ff,
    roseInt: 1.9,
    rayColor: 0x8cc0ff,
    rayOpacity: 0.32,
    glassEmissive: 0x84b8ff,
    glassInt: 1.45
  },
  hearth: {
    bg: 0x090706,
    fogColor: 0x140e0a,
    fogDensity: 0.017,
    hemiSky: 0x6e5239,
    hemiGround: 0x29180c,
    hemiInt: 0.55,
    sunColor: 0xff9f59,
    sunInt: 0.55,
    roseColor: 0xc97b42,
    roseInt: 0.65,
    rayColor: 0xffad66,
    rayOpacity: 0.14,
    glassEmissive: 0x9e683c,
    glassInt: 0.55
  }
};

const state = {
  ready: false,
  backend: 'INITIALIZING',
  floating: true,
  freeFly: false,
  dragging: false,
  uiClean: false,
  waypoint: 'nave',
  mood: 'golden',
  driftSpeed: 1.0,
  rayScale: 1.0,
  exposure: 1.05,
  time: 0,
  fps: 60
};

const keys = new Set();
const scene = new THREE.Scene();
scene.background = new THREE.Color(MOOD_PRESETS.golden.bg);
scene.fog = new THREE.FogExp2(MOOD_PRESETS.golden.fogColor, MOOD_PRESETS.golden.fogDensity);

const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.12, 95);
camera.rotation.order = 'YXZ';
camera.position.set(...WAYPOINTS.nave.pos);
camera.lookAt(...WAYPOINTS.nave.look);

let renderer, postProcessor, materials, sanctum;
let hemiLight, sunLight, roseLight;
const rayMeshes = [];
let rayMaterial;
let dustSystem, sparkSystem;
let audioCtx, toastTimeout;

// Floating camera state
let floatPhase = 0;
let transition = null;
const dummyCam = new THREE.PerspectiveCamera();
const targetPos = new THREE.Vector3();
const targetQuat = new THREE.Quaternion();
const flyVel = new THREE.Vector3();
const flyDir = new THREE.Vector3();
const flyRight = new THREE.Vector3();
const moveVec = new THREE.Vector3();

function showToast(msg) {
  const el = $('toast-banner');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove('show'), 3200);
}

function setupLighting() {
  hemiLight = new THREE.HemisphereLight(0xffe6ba, 0x4a3522, 1.25);
  scene.add(hemiLight);

  sunLight = new THREE.DirectionalLight(0xffdf9e, 3.6);
  sunLight.position.set(-14, 15, -10);
  sunLight.target.position.set(2, 0, 2);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunLight.shadow.camera, {
    left: -20,
    right: 20,
    top: 18,
    bottom: -18,
    near: 0.5,
    far: 55
  });
  sunLight.shadow.bias = -0.00015;
  sunLight.shadow.normalBias = 0.035;
  scene.add(sunLight, sunLight.target);

  // North Rose Window directional fill
  roseLight = new THREE.SpotLight(0xffcf82, 160, 34, 0.72, 0.65, 1.4);
  roseLight.position.set(0, 9.4, -17.4);
  roseLight.target.position.set(0, 1.2, -2.0);
  scene.add(roseLight, roseLight.target);

  // Side lancet window spotlights
  for (const z of [-12, 0, 12]) {
    const spot = new THREE.SpotLight(0xffe0ad, 95, 24, 0.78, 0.65, 1.5);
    spot.position.set(-7.5, 5.2, z);
    spot.target.position.set(2.5, 0, z + 3.2);
    scene.add(spot, spot.target);
  }
}

function setupVolumetricAtmosphere(windowAnchors) {
  // Soft radial gradient texture for volumetric god rays
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 512;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(128, 512);
  for (let y = 0; y < 512; y++) {
    const vFade = Math.pow(Math.sin((y / 511) * Math.PI), 0.75);
    for (let x = 0; x < 128; x++) {
      const rFade = Math.pow(Math.max(0, 1 - Math.abs(x - 63.5) / 63.5), 2.1);
      const idx = (y * 128 + x) * 4;
      img.data[idx] = 255;
      img.data[idx + 1] = 238;
      img.data[idx + 2] = 202;
      img.data[idx + 3] = Math.round(rFade * vFade * 36);
    }
  }
  ctx.putImageData(img, 0, 0);
  const rayTex = new THREE.CanvasTexture(c);

  rayMaterial = new THREE.MeshBasicMaterial({
    map: rayTex,
    color: 0xffe0a3,
    transparent: true,
    opacity: 0.36,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  // Beams from West lancet windows & the Great North Rose Window
  const allBeams = [
    ...windowAnchors.filter(w => w.side === -1),
    { from: [0, 9.3, -17.5], to: [0, 0.7, -4.5], widthScale: 2.35 }
  ];

  const upVec = new THREE.Vector3(0, 1, 0);
  for (const beam of allBeams) {
    const vFrom = new THREE.Vector3(...beam.from);
    const vTo = new THREE.Vector3(...beam.to);
    const len = vFrom.distanceTo(vTo);
    const mid = vFrom.clone().add(vTo).multiplyScalar(0.5);
    const dir = vFrom.clone().sub(vTo).normalize();
    const wScale = beam.widthScale || 1.0;

    for (let s = 0; s < 3; s++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry((1.25 + s * 0.45) * wScale, len),
        rayMaterial
      );
      m.position.copy(mid);
      m.quaternion.setFromUnitVectors(upVec, dir);
      m.rotateY((s * Math.PI) / 3);
      m.renderOrder = 3;
      scene.add(m);
      rayMeshes.push(m);
    }
  }

  // Suspended golden dust motes
  const dustCount = 650;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 14.5;
    dustPos[i * 3 + 1] = 0.5 + Math.random() * 11.5;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 33.0;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustSystem = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      color: 0xf2d59b,
      size: 0.028,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  scene.add(dustSystem);

  // Rising glowing hearth ember sparks
  const sparkCount = 48;
  const sparkPos = new Float32Array(sparkCount * 3);
  for (let i = 0; i < sparkCount; i++) {
    sparkPos[i * 3] = 7.25 + (Math.random() - 0.5) * 0.65;
    sparkPos[i * 3 + 1] = 0.4 + Math.random() * 2.3;
    sparkPos[i * 3 + 2] = (Math.random() - 0.5) * 1.4;
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  sparkSystem = new THREE.Points(
    sparkGeo,
    new THREE.PointsMaterial({
      color: 0xff8c2b,
      size: 0.042,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  scene.add(sparkSystem);
}

function applyMood(moodKey) {
  const m = MOOD_PRESETS[moodKey];
  if (!m) return;
  state.mood = moodKey;

  scene.background.setHex(m.bg);
  scene.fog.color.setHex(m.fogColor);
  scene.fog.density = m.fogDensity;

  if (hemiLight) {
    hemiLight.color.setHex(m.hemiSky);
    hemiLight.groundColor.setHex(m.hemiGround);
    hemiLight.intensity = m.hemiInt;
  }
  if (sunLight) {
    sunLight.color.setHex(m.sunColor);
    sunLight.intensity = m.sunInt;
  }
  if (roseLight) {
    roseLight.color.setHex(m.roseColor);
    roseLight.intensity = m.roseInt * 70;
  }
  if (rayMaterial) {
    rayMaterial.color.setHex(m.rayColor);
    rayMaterial.opacity = m.rayOpacity * state.rayScale;
  }
  if (materials) {
    materials.stainedLancet.emissive.setHex(m.glassEmissive);
    materials.stainedLancet.emissiveIntensity = m.glassInt;
    materials.roseWindow.emissive.setHex(m.glassEmissive);
    materials.roseWindow.emissiveIntensity = m.glassInt * 1.15;
  }

  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mood === moodKey);
  });
}

function beginCameraTransition(wpKey) {
  const wp = WAYPOINTS[wpKey];
  if (!wp) return;
  state.waypoint = wpKey;

  dummyCam.position.set(...wp.pos);
  dummyCam.lookAt(...wp.look);

  transition = {
    fromPos: camera.position.clone(),
    fromQuat: camera.quaternion.clone(),
    toPos: dummyCam.position.clone(),
    toQuat: dummyCam.quaternion.clone(),
    progress: 0
  };
  floatPhase = 0;

  $('caption-sub').textContent = wp.sub;
  $('caption-title').textContent = wp.title;
  $('caption-desc').textContent = wp.desc;

  document.querySelectorAll('.waypoint-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cam === wpKey);
  });
}

function setFloatingMode(enabled) {
  state.floating = enabled;
  if (enabled) {
    state.freeFly = false;
    document.body.classList.remove('free-flight');
    $('btn-free-mode').classList.remove('active');
    $('btn-free-mode').setAttribute('aria-pressed', 'false');
    if (!transition) beginCameraTransition(state.waypoint);
  } else {
    transition = null;
  }
  $('btn-float-mode').classList.toggle('active', enabled);
  $('btn-float-mode').setAttribute('aria-pressed', String(enabled));
  $('float-label').textContent = enabled ? '漂浮運鏡中 · Floating' : '漂浮已暫停 · Paused';
}

function setFreeFlyMode(enabled) {
  state.freeFly = enabled;
  document.body.classList.toggle('free-flight', enabled);
  $('btn-free-mode').classList.toggle('active', enabled);
  $('btn-free-mode').setAttribute('aria-pressed', String(enabled));
  if (enabled) {
    setFloatingMode(false);
    transition = null;
  }
}

function clampCameraBounds() {
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -7.2, 7.1);
  camera.position.y = THREE.MathUtils.clamp(camera.position.y, 0.85, 11.8);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -16.8, 16.9);
}

let prevTime = performance.now();
let fpsAccum = 0;
let fpsFrames = 0;

function animate(now) {
  const dt = Math.min((now - prevTime) / 1000, 0.05);
  prevTime = now;
  state.time += dt;

  fpsAccum += dt;
  fpsFrames++;
  if (fpsAccum >= 0.6) {
    state.fps = Math.round(fpsFrames / fpsAccum);
    $('gpu-text').textContent = `${state.backend} · ${state.fps} FPS`;
    fpsAccum = 0;
    fpsFrames = 0;
  }

  // 1. Update 6-DOF Floating Camera or Transition
  if (transition) {
    transition.progress = Math.min(1, transition.progress + dt * 0.42);
    const s = transition.progress * transition.progress * (3 - 2 * transition.progress);
    camera.position.lerpVectors(transition.fromPos, transition.toPos, s);
    camera.quaternion.slerpQuaternions(transition.fromQuat, transition.toQuat, s);
    if (transition.progress >= 1) transition = null;
  } else if (state.floating && !state.dragging) {
    floatPhase += dt * state.driftSpeed;
    const wp = WAYPOINTS[state.waypoint];
    const [ox, oy, oz] = wp.orbit;
    const t = floatPhase * 0.16;

    // Smooth figure-8 floating suspension path
    targetPos.set(
      wp.pos[0] + Math.sin(t) * ox + Math.cos(t * 2.1) * 0.22,
      wp.pos[1] + Math.sin(t * 1.35) * oy,
      wp.pos[2] - (1 - Math.cos(t * 0.85)) * oz
    );
    camera.position.lerp(targetPos, 1 - Math.exp(-dt * 1.6));

    dummyCam.position.copy(camera.position);
    dummyCam.lookAt(
      wp.look[0] + Math.sin(t * 0.7) * 0.65,
      wp.look[1] + Math.cos(t * 0.9) * 0.35,
      wp.look[2]
    );
    targetQuat.copy(dummyCam.quaternion);
    camera.quaternion.slerp(targetQuat, 1 - Math.exp(-dt * 1.6));
  }

  // 2. Free-Flight Keyboard / Touch Movement
  moveVec.set(0, 0, 0);
  const fwd = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
  const strafe = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  const lift = Number(keys.has('KeyE')) - Number(keys.has('KeyQ'));

  if (fwd || strafe || lift) {
    if (!state.freeFly) setFreeFlyMode(true);
    camera.getWorldDirection(flyDir);
    flyRight.crossVectors(flyDir, camera.up).normalize();
    moveVec.addScaledVector(flyDir, fwd).addScaledVector(flyRight, strafe);
    moveVec.y += lift;
    moveVec.normalize().multiplyScalar(keys.has('ShiftLeft') || keys.has('ShiftRight') ? 6.2 : 2.8);
  }
  flyVel.lerp(moveVec, 1 - Math.exp(-dt * 6.0));
  if (flyVel.lengthSq() > 0.0001) {
    camera.position.addScaledVector(flyVel, dt);
    clampCameraBounds();
  }

  // 3. Animate Candles, Hearth Fire, Dust & Sparks
  sanctum?.updateSanctum(state.time);

  if (dustSystem) {
    dustSystem.rotation.y = Math.sin(state.time * 0.04) * 0.05;
    dustSystem.position.y = Math.sin(state.time * 0.12) * 0.14;
  }
  if (sparkSystem) {
    const sAttr = sparkSystem.geometry.attributes.position;
    for (let i = 0; i < sAttr.count; i++) {
      let y = sAttr.getY(i) + dt * (0.65 + (i % 5) * 0.15);
      let x = sAttr.getX(i) + Math.sin(state.time * 3 + i) * dt * 0.12;
      if (y > 2.75) {
        y = 0.38;
        x = 7.25 + (Math.random() - 0.5) * 0.65;
      }
      sAttr.setXY(i, x, y);
    }
    sAttr.needsUpdate = true;
  }

  // 4. Render Frame
  if (postProcessor) {
    postProcessor.render();
  } else {
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
}

async function init() {
  const bar = $('loader-bar');
  const status = $('loader-status');
  const setProgress = (pct, msg) => {
    if (bar) bar.style.width = `${pct}%`;
    if (status && msg) status.textContent = msg;
  };

  try {
    setProgress(10, '正在啟動 WebGPU 硬體渲染管線…');
    renderer = new THREE.WebGPURenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
    renderer.setSize(innerWidth, innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = state.exposure;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    $('viewport').appendChild(renderer.domElement);
    await renderer.init();

    const isWebGPU = Boolean(renderer.backend?.isWebGPUBackend);
    state.backend = isWebGPU ? 'WEBGPU' : 'WEBGL2';
    $('gpu-text').textContent = `${state.backend} · LIVE`;

    materials = await createCastleMaterials(THREE, renderer, setProgress);

    setProgress(75, '正在建造雙層哥德式尖拱迴廊與十字肋拱頂…');
    await new Promise(r => setTimeout(r, 16));
    const arch = buildGothicArchitecture(THREE, materials);
    scene.add(arch.group);

    setProgress(86, '正在陳設全身騎士板甲、王座、皇冠吊燈與壁爐烈焰…');
    await new Promise(r => setTimeout(r, 16));
    sanctum = buildCastleSanctum(THREE, materials);
    scene.add(sanctum.group);

    setupLighting();
    setupVolumetricAtmosphere(arch.windowLightAnchors);

    setProgress(94, '正在烘焙室內環境反射與 GTAO + 輝光後處理…');
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    scene.environment = (await pmrem.fromSceneAsync(roomEnv, 0.04)).texture;
    scene.environmentIntensity = 0.34;
    roomEnv.dispose();
    pmrem.dispose();

    try {
      postProcessor = new THREE.PostProcessing(renderer);
      const scenePass = pass(scene, camera);
      const colorNode = scenePass.getTextureNode('output');
      const gtao = ao(scenePass.getTextureNode('depth'), null, camera);
      gtao.resolutionScale = 0.5;
      gtao.radius.value = 0.65;
      gtao.thickness.value = 1.4;
      gtao.samples.value = 12;
      const bloomNode = bloom(colorNode, 0.26, 0.45, 0.98);
      postProcessor.outputNode = colorNode
        .mul(mix(float(1), gtao.getTextureNode(), float(0.68)))
        .add(bloomNode);
    } catch (postErr) {
      console.warn('PostProcessing fallback to direct WebGPU render:', postErr);
      postProcessor = null;
    }

    await renderer.compileAsync(scene, camera);
    applyMood('golden');

    setProgress(100, '大殿已開啟');
    state.ready = true;
    $('loader').classList.add('fade-out');
    prevTime = performance.now();
    requestAnimationFrame(animate);
  } catch (err) {
    console.error(err);
    status.textContent = '您的瀏覽器未能啟動 WebGPU/3D 加速，請使用最新版 Chrome 或 Edge 並開啟硬體加速。';
  }
}

// UI Event Listeners
document.querySelectorAll('.waypoint-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setFloatingMode(true);
    beginCameraTransition(btn.dataset.cam);
  });
});

document.querySelectorAll('.mood-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    applyMood(btn.dataset.mood);
    showToast(`已切換光影氛圍：${btn.textContent.trim()}`);
  });
});

$('btn-float-mode').addEventListener('click', () => setFloatingMode(!state.floating));
$('btn-free-mode').addEventListener('click', () => {
  setFreeFlyMode(!state.freeFly);
  if (state.freeFly) showToast('自由飛行已開啟：使用 WASD 移動、E/Q 升降、拖曳畫面環視');
});

$('btn-settings').addEventListener('click', () => {
  const drawer = $('settings-drawer');
  drawer.hidden = !drawer.hidden;
  $('btn-settings').setAttribute('aria-expanded', String(!drawer.hidden));
});
$('btn-close-settings').addEventListener('click', () => {
  $('settings-drawer').hidden = true;
  $('btn-settings').setAttribute('aria-expanded', 'false');
});

$('ctrl-exposure').addEventListener('input', e => {
  state.exposure = parseFloat(e.target.value);
  if (renderer) renderer.toneMappingExposure = state.exposure;
  $('out-exposure').textContent = `${Math.round(state.exposure * 100)}%`;
});

$('ctrl-speed').addEventListener('input', e => {
  state.driftSpeed = parseFloat(e.target.value);
  $('out-speed').textContent = `${state.driftSpeed.toFixed(1)}×`;
});

$('ctrl-rays').addEventListener('input', e => {
  state.rayScale = parseFloat(e.target.value);
  if (rayMaterial) {
    rayMaterial.opacity = MOOD_PRESETS[state.mood].rayOpacity * state.rayScale;
  }
  $('out-rays').textContent = `${Math.round(state.rayScale * 100)}%`;
});

$('ctrl-quality').addEventListener('change', e => {
  const ultra = e.target.value === 'ultra';
  if (renderer) {
    renderer.setPixelRatio(ultra ? Math.min(devicePixelRatio, 1.65) : 1.0);
    renderer.setSize(innerWidth, innerHeight);
  }
  showToast(ultra ? '已切換至 Ultra 原生高畫質模式' : '已切換至 Balanced 流暢省電模式');
});

$('btn-reset-cam').addEventListener('click', () => {
  setFloatingMode(true);
  beginCameraTransition('nave');
});

$('btn-share').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    showToast('已複製古堡大殿網址，可直接貼給朋友觀賞！');
  } catch {
    showToast(`請複製上方網址列分享：${location.href}`);
  }
});

function toggleCleanUI() {
  state.uiClean = !state.uiClean;
  document.body.classList.toggle('ui-clean', state.uiClean);
  $('btn-restore-ui').hidden = !state.uiClean;
}
$('btn-clean-ui').addEventListener('click', toggleCleanUI);
$('btn-restore-ui').addEventListener('click', toggleCleanUI);

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    showToast('此視窗環境不支援全螢幕切換');
  }
}
$('btn-fullscreen').addEventListener('click', toggleFullscreen);

// Synthesized Ambient Medieval Soundscape (Crackling Fire + Cathedral Drone)
$('btn-audio').addEventListener('click', async () => {
  const turningOn = $('btn-audio').getAttribute('aria-pressed') !== 'true';
  try {
    if (!audioCtx) {
      audioCtx = new AudioContext();
      const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 4, audioCtx.sampleRate);
      const ch = buf.getChannelData(0);
      let brown = 0;
      for (let i = 0; i < ch.length; i++) {
        const white = Math.random() * 2 - 1;
        brown = (brown + 0.02 * white) / 1.02;
        const crackle = Math.random() > 0.9988 ? (Math.random() - 0.5) * 0.85 : 0;
        ch[i] = brown * 2.6 + crackle;
      }
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 680;

      const gain = audioCtx.createGain();
      gain.gain.value = 0.16;
      src.connect(filter).connect(gain).connect(audioCtx.destination);
      src.start();

      // Deep resonant hall fifth drone
      for (const [freq, vol] of [[65.4, 0.015], [98.0, 0.009]]) {
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const g = audioCtx.createGain();
        g.gain.value = vol;
        osc.connect(g).connect(audioCtx.destination);
        osc.start();
      }
    }

    if (turningOn) await audioCtx.resume();
    else await audioCtx.suspend();

    $('btn-audio').setAttribute('aria-pressed', String(turningOn));
    showToast(turningOn ? '環境音效已開啟：壁爐柴火與聖堂低鳴' : '環境音效已靜音');
  } catch {
    showToast('瀏覽器音訊無法啟動');
  }
});

// Pointer Look & Wheel Dolly
let lastX = 0, lastY = 0;
const vp = $('viewport');
vp.addEventListener('pointerdown', e => {
  if (!state.ready) return;
  state.dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  vp.setPointerCapture(e.pointerId);
  setFloatingMode(false);
});

vp.addEventListener('pointermove', e => {
  if (!state.dragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  camera.rotation.y -= dx * 0.0024;
  camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x - dy * 0.0024, -1.32, 1.32);
  camera.rotation.z = 0;
});

const stopDrag = () => { state.dragging = false; };
vp.addEventListener('pointerup', stopDrag);
vp.addEventListener('pointercancel', stopDrag);

vp.addEventListener('wheel', e => {
  e.preventDefault();
  if (!state.ready) return;
  setFloatingMode(false);
  camera.getWorldDirection(flyDir);
  camera.position.addScaledVector(flyDir, -Math.sign(e.deltaY) * 0.75);
  clampCameraBounds();
}, { passive: false });

// Keyboard shortcuts
window.addEventListener('keydown', e => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (e.code === 'Space') {
    e.preventDefault();
    setFloatingMode(!state.floating);
    return;
  }
  if (e.code === 'KeyH') {
    toggleCleanUI();
    return;
  }
  if (e.code === 'KeyF') {
    toggleFullscreen();
    return;
  }
  keys.add(e.code);
});

window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => {
  keys.clear();
  state.dragging = false;
});

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer?.setSize(innerWidth, innerHeight);
});

// Touch D-Pad
const dirMap = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', rise: 'KeyE', sink: 'KeyQ' };
document.querySelectorAll('#touch-pad button').forEach(btn => {
  const code = dirMap[btn.dataset.dir];
  btn.addEventListener('pointerdown', e => {
    e.preventDefault();
    btn.setPointerCapture(e.pointerId);
    keys.add(code);
  });
  const clearKey = () => keys.delete(code);
  btn.addEventListener('pointerup', clearKey);
  btn.addEventListener('pointercancel', clearKey);
});

window.valenkeepDiagnostics = () => ({
  ready: state.ready,
  backend: state.backend,
  fps: state.fps,
  mood: state.mood,
  waypoint: state.waypoint,
  floating: state.floating,
  cameraPosition: camera.position.toArray().map(n => +n.toFixed(2))
});

init();
