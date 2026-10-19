/**
 * Synthesizes high-resolution procedural PBR texture maps (Albedo, Normal, Roughness)
 * and physically based materials for the Valenkeep Gothic Sanctum.
 */

function createPRNG(seed = 1337) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function createNoise2D(seed = 4096, size = 256) {
  const rand = createPRNG(seed);
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const mask = size - 1;

  function sample(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let xf = x - xi;
    let yf = y - yi;
    xf = xf * xf * (3 - 2 * xf);
    yf = yf * yf * (3 - 2 * yf);
    const x0 = xi & mask;
    const x1 = (xi + 1) & mask;
    const y0 = (yi & mask) * size;
    const y1 = ((yi + 1) & mask) * size;
    const top = grid[y0 + x0] + (grid[y0 + x1] - grid[y0 + x0]) * xf;
    const bot = grid[y1 + x0] + (grid[y1 + x1] - grid[y1 + x0]) * xf;
    return top + (bot - top) * yf;
  }

  function fbm(x, y, octaves = 4) {
    let val = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      val += sample(x * freq, y * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.02;
    }
    return val / norm;
  }

  return { sample, fbm };
}

function heightToNormalCanvas(heightField, width, height, strength = 4.0) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(width, height);
  const data = img.data;
  const wMask = width - 1;
  const hMask = height - 1;

  for (let y = 0; y < height; y++) {
    const ym = ((y - 1) & hMask) * width;
    const y0 = y * width;
    const yp = ((y + 1) & hMask) * width;
    for (let x = 0; x < width; x++) {
      const xm = (x - 1) & wMask;
      const xp = (x + 1) & wMask;

      const tl = heightField[ym + xm];
      const tc = heightField[ym + x];
      const tr = heightField[ym + xp];
      const ml = heightField[y0 + xm];
      const mr = heightField[y0 + xp];
      const bl = heightField[yp + xm];
      const bc = heightField[yp + x];
      const br = heightField[yp + xp];

      const dx = (tr + 2 * mr + br - (tl + 2 * ml + bl)) * strength;
      const dy = (bl + 2 * bc + br - (tl + 2 * tc + tr)) * strength;
      const dz = 1.0;
      const invLen = 1 / Math.hypot(dx, dy, dz);

      const idx = (y0 + x) * 4;
      data[idx] = Math.round((-dx * invLen * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((-dy * invLen * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((dz * invLen * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function buildAshlarStoneMaps(THREE, anisotropy, options = {}) {
  const size = options.size || 512;
  const rows = options.rows || 8;
  const cols = options.cols || 4;
  const baseR = options.baseRGB?.[0] ?? 150;
  const baseG = options.baseRGB?.[1] ?? 140;
  const baseB = options.baseRGB?.[2] ?? 124;
  const mortarWidth = options.mortarWidth ?? 0.032;
  const baseRough = options.baseRough ?? 0.78;
  const roughRange = options.roughRange ?? 0.2;

  const noise = createNoise2D(options.seed || 101, 256);
  const rand = createPRNG((options.seed || 101) + 77);

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d');
  const cImg = cCtx.createImageData(size, size);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d');
  const rImg = rCtx.createImageData(size, size);

  const heightField = new Float32Array(size * size);

  // Pre-generate per-row horizontal offsets and block variations
  const rowOffsets = Array.from({ length: rows }, (_, r) => (r % 2) * 0.5 + (rand() - 0.5) * 0.14);
  const blockTint = new Float32Array(rows * cols * 3);
  for (let i = 0; i < blockTint.length; i += 3) {
    const shift = (rand() - 0.5) * 26;
    const warm = (rand() - 0.5) * 10;
    blockTint[i] = shift + warm;
    blockTint[i + 1] = shift + warm * 0.4;
    blockTint[i + 2] = shift - warm * 0.6;
  }

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const rowFloat = v * rows;
    const rowIdx = Math.floor(rowFloat) % rows;
    const rowFrac = rowFloat - Math.floor(rowFloat);

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const warpX = (noise.fbm(u * 14, v * 14, 3) - 0.5) * 0.018;
      const warpY = (noise.fbm(u * 14 + 7.3, v * 14 + 2.1, 3) - 0.5) * 0.022;

      const uShifted = ((u + rowOffsets[rowIdx] + warpX) % 1 + 1) % 1;
      const colFloat = uShifted * cols;
      const colIdx = Math.floor(colFloat) % cols;
      const colFrac = colFloat - Math.floor(colFloat);

      const distY = Math.min(rowFrac, 1 - rowFrac + warpY * 0.5);
      const distX = Math.min(colFrac, 1 - colFrac);
      const edgeDist = Math.min(distX * (rows / cols), distY);

      const mortarFactor = Math.min(1, Math.max(0, (edgeDist - mortarWidth * 0.45) / (mortarWidth * 1.35)));
      const bevel = mortarFactor * mortarFactor * (3 - 2 * mortarFactor);

      const macro = noise.fbm(u * 9, v * 9, 4);
      const micro = noise.fbm(u * 42, v * 42, 3);
      const pores = Math.max(0, noise.sample(u * 96, v * 96) - 0.72) * 1.8;

      const hVal = bevel * (0.65 + macro * 0.25 + micro * 0.14 - pores * 0.22) + (1 - bevel) * (0.12 + micro * 0.08);
      const pIdx = y * size + x;
      heightField[pIdx] = hVal;

      const bIdx = (rowIdx * cols + colIdx) * 3;
      const shade = (macro - 0.5) * 38 + (micro - 0.5) * 24 - pores * 28;
      const ao = 0.52 + 0.48 * bevel;

      const r = Math.min(255, Math.max(12, (baseR + blockTint[bIdx] + shade) * ao));
      const g = Math.min(255, Math.max(12, (baseG + blockTint[bIdx + 1] + shade) * ao));
      const b = Math.min(255, Math.max(12, (baseB + blockTint[bIdx + 2] + shade) * ao));

      const idx4 = pIdx * 4;
      cImg.data[idx4] = r;
      cImg.data[idx4 + 1] = g;
      cImg.data[idx4 + 2] = b;
      cImg.data[idx4 + 3] = 255;

      const rough = Math.min(
        1,
        Math.max(0.18, baseRough + (1 - bevel) * 0.22 + (0.5 - macro) * roughRange + pores * 0.25)
      );
      const rByte = Math.round(rough * 255);
      rImg.data[idx4] = rByte;
      rImg.data[idx4 + 1] = rByte;
      rImg.data[idx4 + 2] = rByte;
      rImg.data[idx4 + 3] = 255;
    }
  }

  cCtx.putImageData(cImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const normalCanvas = heightToNormalCanvas(heightField, size, size, options.normalStrength ?? 5.2);

  const makeTex = (canvas, isSRGB = false) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = anisotropy;
    if (isSRGB) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  return {
    map: makeTex(colorCanvas, true),
    normalMap: makeTex(normalCanvas, false),
    roughnessMap: makeTex(roughCanvas, false)
  };
}

function buildOakWoodMaps(THREE, anisotropy) {
  const size = 512;
  const noise = createNoise2D(808, 256);
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d');
  const cImg = cCtx.createImageData(size, size);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d');
  const rImg = rCtx.createImageData(size, size);

  const heightField = new Float32Array(size * size);
  const planks = 6;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const plankIdx = Math.floor(u * planks);
      const plankFrac = u * planks - plankIdx;
      const seam = Math.min(plankFrac, 1 - plankFrac);
      const seamMask = Math.min(1, seam / 0.03);

      const grainDistort = noise.fbm(u * 6 + plankIdx * 1.7, v * 2.5, 3) * 3.5;
      const rings = Math.sin((u * 38 + grainDistort) * Math.PI * 2) * 0.5 + 0.5;
      const fineFiber = noise.fbm(u * 95, v * 16, 3);
      const hVal = seamMask * (0.45 + rings * 0.25 + fineFiber * 0.3);

      const pIdx = y * size + x;
      heightField[pIdx] = hVal;

      const plankTone = ((plankIdx * 37) % 5 - 2) * 5;
      const tone = rings * 22 + (fineFiber - 0.5) * 18 + plankTone;
      const r = Math.min(255, Math.max(10, (82 + tone) * (0.4 + 0.6 * seamMask)));
      const g = Math.min(255, Math.max(8, (53 + tone * 0.72) * (0.4 + 0.6 * seamMask)));
      const b = Math.min(255, Math.max(6, (34 + tone * 0.48) * (0.4 + 0.6 * seamMask)));

      const idx4 = pIdx * 4;
      cImg.data[idx4] = r;
      cImg.data[idx4 + 1] = g;
      cImg.data[idx4 + 2] = b;
      cImg.data[idx4 + 3] = 255;

      const rough = Math.min(0.92, Math.max(0.32, 0.46 + (1 - rings) * 0.18 + (1 - seamMask) * 0.3));
      const rb = Math.round(rough * 255);
      rImg.data[idx4] = rb;
      rImg.data[idx4 + 1] = rb;
      rImg.data[idx4 + 2] = rb;
      rImg.data[idx4 + 3] = 255;
    }
  }

  cCtx.putImageData(cImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  const normalCanvas = heightToNormalCanvas(heightField, size, size, 3.6);

  const makeTex = (canvas, isSRGB = false) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = anisotropy;
    if (isSRGB) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  return {
    map: makeTex(colorCanvas, true),
    normalMap: makeTex(normalCanvas, false),
    roughnessMap: makeTex(roughCanvas, false)
  };
}

function buildStainedGlassLancetTexture(THREE, anisotropy) {
  const w = 512, h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Warm radiant Gothic grisaille background with golden-sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#ffe8b8');
  grad.addColorStop(0.45, '#e8d5ae');
  grad.addColorStop(1, '#c8b693');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Stained glass colored border panels (ruby & sapphire)
  ctx.lineWidth = 26;
  ctx.strokeStyle = '#9e2424';
  ctx.strokeRect(24, 24, w - 48, h - 48);
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#244d8a';
  ctx.strokeRect(44, 44, w - 88, h - 88);

  // Diamond quarrel lead cames across the field
  ctx.strokeStyle = 'rgba(28, 25, 22, 0.72)';
  ctx.lineWidth = 3;
  const step = 48;
  for (let y = -w; y < h + w; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y + w);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(w, y);
    ctx.lineTo(0, y + w);
    ctx.stroke();
  }

  // Three vertical heraldic stained-glass medallions
  const medallionColors = [
    ['#b8292f', '#f4c05a', '#1f4f91'],
    ['#1f4f91', '#f4c05a', '#25734c'],
    ['#b8292f', '#f4c05a', '#7c2e7a']
  ];
  [240, 520, 800].forEach((cy, idx) => {
    const [outer, gold, inner] = medallionColors[idx];
    ctx.save();
    ctx.translate(w / 2, cy);

    // Outer quatrefoil/circle
    ctx.fillStyle = outer;
    ctx.strokeStyle = '#181512';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 92, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 8-pointed golden star
    ctx.fillStyle = gold;
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 4);
      ctx.fillRect(-38, -38, 76, 76);
      ctx. strokeRect(-38, -38, 76, 76);
      ctx.restore();
    }

    // Inner jewel core
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });

  // Iron saddle bars
  ctx.fillStyle = '#161412';
  for (let y = 110; y < h; y += 128) {
    ctx.fillRect(0, y, w, 7);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

function buildRoseWindowTexture(THREE, anisotropy) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;

  ctx.fillStyle = '#12100e';
  ctx.fillRect(0, 0, size, size);

  const bgGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, 480);
  bgGrad.addColorStop(0, '#fff2c6');
  bgGrad.addColorStop(0.35, '#f5b352');
  bgGrad.addColorStop(0.68, '#b82d38');
  bgGrad.addColorStop(0.92, '#204582');
  bgGrad.addColorStop(1, '#12100e');
  ctx.fillStyle = bgGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 485, 0, Math.PI * 2);
  ctx.fill();

  const petals = 12;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);

    // Outer lancet petal
    ctx.fillStyle = i % 2 === 0 ? '#c92e39' : '#2658a6';
    ctx.strokeStyle = '#141210';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, 110);
    ctx.quadraticCurveTo(68, 260, 0, 445);
    ctx.quadraticCurveTo(-68, 260, 0, 110);
    ctx.fill();
    ctx.stroke();

    // Golden trefoil medallion inside petal
    ctx.fillStyle = '#f8c963';
    ctx.beginPath();
    ctx.arc(0, 325, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Emerald inner jewel
    ctx.fillStyle = '#2d8a5e';
    ctx.beginPath();
    ctx.arc(0, 210, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  // Central sun-rose core
  ctx.fillStyle = '#ffdf88';
  ctx.strokeStyle = '#141210';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, 98, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

function buildRoyalTextileTexture(THREE, anisotropy, isBanner = false) {
  const w = 512;
  const h = isBanner ? 1024 : 1536;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Deep royal crimson & burgundy weave
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#4f151b');
  grad.addColorStop(0.5, '#631b22');
  grad.addColorStop(1, '#3b1015');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Double ornate gold border
  ctx.strokeStyle = '#c8a258';
  ctx.lineWidth = 16;
  ctx.strokeRect(24, 24, w - 48, h - 48);
  ctx.lineWidth = 4;
  ctx.strokeRect(46, 46, w - 92, h - 92);

  // Geometric damask diamond lattice
  ctx.strokeStyle = 'rgba(212, 174, 98, 0.28)';
  ctx.lineWidth = 3;
  const step = 96;
  for (let y = 96; y < h - 96; y += step) {
    for (let x = 96; x < w - 96; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, y - 38);
      ctx.lineTo(x + 38, y);
      ctx.lineTo(x, y + 38);
      ctx.lineTo(x - 38, y);
      ctx.closePath();
      ctx.stroke();
    }
  }

  // Central heraldic sun-crest on banners or repeating medallions on runner
  const centers = isBanner ? [h * 0.42] : [h * 0.2, h * 0.5, h * 0.8];
  centers.forEach(cy => {
    ctx.save();
    ctx.translate(w / 2, cy);
    ctx.fillStyle = '#cfa85b';
    ctx.strokeStyle = '#2b0d10';
    ctx.lineWidth = 5;

    ctx.beginPath();
    ctx.arc(0, 0, 96, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#4f151b';
    ctx.beginPath();
    ctx.arc(0, 0, 68, 0, Math.PI * 2);
    ctx.fill();

    // 12-ray royal sunburst
    ctx.fillStyle = '#e5c278';
    for (let i = 0; i < 12; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 6);
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(0, -56);
      ctx.lineTo(10, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  });

  // Woven linen thread micro-striations
  ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
  for (let y = 0; y < h; y += 3) {
    ctx.fillRect(0, y, w, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

export async function createCastleMaterials(THREE, renderer, onProgress) {
  const anisotropy = Math.min(renderer.getMaxAnisotropy?.() || 8, 8);
  const tick = (pct, msg) => onProgress?.(pct, msg);

  tick(18, '正在合成哥德灰岩與鑿石法線貼圖…');
  await new Promise(r => setTimeout(r, 16));
  const wallMaps = buildAshlarStoneMaps(THREE, anisotropy, {
    size: 512,
    rows: 8,
    cols: 4,
    baseRGB: [148, 138, 122],
    mortarWidth: 0.032,
    baseRough: 0.82,
    roughRange: 0.18,
    normalStrength: 5.5,
    seed: 301
  });
  wallMaps.map.repeat.set(0.38, 0.38);
  wallMaps.normalMap.repeat.set(0.38, 0.38);
  wallMaps.roughnessMap.repeat.set(0.38, 0.38);

  tick(34, '正在拋光古堡石板地面與鏡面粗糙度貼圖…');
  await new Promise(r => setTimeout(r, 16));
  const floorMaps = buildAshlarStoneMaps(THREE, anisotropy, {
    size: 512,
    rows: 6,
    cols: 3,
    baseRGB: [112, 108, 100],
    mortarWidth: 0.025,
    baseRough: 0.38,
    roughRange: 0.24,
    normalStrength: 4.4,
    seed: 509
  });
  floorMaps.map.repeat.set(0.28, 0.28);
  floorMaps.normalMap.repeat.set(0.28, 0.28);
  floorMaps.roughnessMap.repeat.set(0.28, 0.28);

  tick(50, '正在精雕拱肋細石與百年黑橡木紋理…');
  await new Promise(r => setTimeout(r, 16));
  const trimMaps = buildAshlarStoneMaps(THREE, anisotropy, {
    size: 512,
    rows: 6,
    cols: 4,
    baseRGB: [176, 165, 146],
    mortarWidth: 0.02,
    baseRough: 0.68,
    roughRange: 0.14,
    normalStrength: 3.6,
    seed: 709
  });
  trimMaps.map.repeat.set(0.45, 0.45);
  trimMaps.normalMap.repeat.set(0.45, 0.45);
  trimMaps.roughnessMap.repeat.set(0.45, 0.45);

  const oakMaps = buildOakWoodMaps(THREE, anisotropy);
  oakMaps.map.repeat.set(0.6, 0.6);
  oakMaps.normalMap.repeat.set(0.6, 0.6);
  oakMaps.roughnessMap.repeat.set(0.6, 0.6);

  tick(66, '正在鑲嵌彩繪玫瑰花窗與皇室織錦掛毯…');
  await new Promise(r => setTimeout(r, 16));
  const lancetTex = buildStainedGlassLancetTexture(THREE, anisotropy);
  const roseTex = buildRoseWindowTexture(THREE, anisotropy);
  const bannerTex = buildRoyalTextileTexture(THREE, anisotropy, true);
  const carpetTex = buildRoyalTextileTexture(THREE, anisotropy, false);

  return {
    ashlar: new THREE.MeshStandardMaterial({
      map: wallMaps.map,
      normalMap: wallMaps.normalMap,
      roughnessMap: wallMaps.roughnessMap,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughness: 0.92,
      metalness: 0.02
    }),
    flagstone: new THREE.MeshStandardMaterial({
      map: floorMaps.map,
      normalMap: floorMaps.normalMap,
      roughnessMap: floorMaps.roughnessMap,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughness: 0.56,
      metalness: 0.06
    }),
    freestone: new THREE.MeshStandardMaterial({
      map: trimMaps.map,
      normalMap: trimMaps.normalMap,
      roughnessMap: trimMaps.roughnessMap,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.74,
      metalness: 0.03
    }),
    darkBasalt: new THREE.MeshStandardMaterial({
      map: wallMaps.map,
      normalMap: wallMaps.normalMap,
      roughnessMap: wallMaps.roughnessMap,
      color: 0x5c5852,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.68,
      metalness: 0.08
    }),
    oak: new THREE.MeshStandardMaterial({
      map: oakMaps.map,
      normalMap: oakMaps.normalMap,
      roughnessMap: oakMaps.roughnessMap,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughness: 0.58,
      metalness: 0.04
    }),
    stainedLancet: new THREE.MeshStandardMaterial({
      map: lancetTex,
      emissiveMap: lancetTex,
      emissive: new THREE.Color(0xffe2ad),
      emissiveIntensity: 1.55,
      roughness: 0.25,
      metalness: 0.1,
      side: THREE.DoubleSide
    }),
    roseWindow: new THREE.MeshStandardMaterial({
      map: roseTex,
      emissiveMap: roseTex,
      emissive: new THREE.Color(0xffd796),
      emissiveIntensity: 1.85,
      roughness: 0.22,
      metalness: 0.1,
      side: THREE.DoubleSide
    }),
    banner: new THREE.MeshStandardMaterial({
      map: bannerTex,
      normalMap: oakMaps.normalMap,
      normalScale: new THREE.Vector2(0.25, 0.25),
      roughness: 0.88,
      metalness: 0.08,
      side: THREE.DoubleSide
    }),
    carpet: new THREE.MeshStandardMaterial({
      map: carpetTex,
      normalMap: oakMaps.normalMap,
      normalScale: new THREE.Vector2(0.3, 0.3),
      roughness: 0.92,
      metalness: 0.05
    }),
    flutedSteel: new THREE.MeshStandardMaterial({
      color: 0xc8cfd6,
      roughness: 0.22,
      metalness: 0.92
    }),
    gildedBrass: new THREE.MeshStandardMaterial({
      color: 0xdcb668,
      roughness: 0.26,
      metalness: 0.88
    }),
    wroughtIron: new THREE.MeshStandardMaterial({
      color: 0x26282a,
      roughness: 0.5,
      metalness: 0.84
    }),
    pewter: new THREE.MeshStandardMaterial({
      color: 0xaeb4bc,
      roughness: 0.3,
      metalness: 0.85
    }),
    beeswax: new THREE.MeshStandardMaterial({
      color: 0xe6cfa1,
      emissive: 0x59320c,
      emissiveIntensity: 0.35,
      roughness: 0.68
    }),
    velvet: new THREE.MeshStandardMaterial({
      color: 0x61131b,
      roughness: 0.86,
      metalness: 0.05
    })
  };
}
