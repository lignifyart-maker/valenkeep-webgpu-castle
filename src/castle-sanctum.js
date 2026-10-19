/**
 * Populates Valenkeep Sanctum with:
 * - Canopied Gothic Royal Throne & Standing 7-Branch Candelabra on the North Dais
 * - 8 Suits of Fluted Gothic Plate Armor with Halberds guarding the Nave Colonnade
 * - Twin Refectory Banquet Tables flanking the Central Processional Carpet
 * - 3 Massive Two-Tiered Corona Lucis Wheel Chandeliers
 * - Monumental Hooded Stone Hearth with Turbulent Fire & Rising Ember Sparks
 */

export function buildCastleSanctum(THREE, mats) {
  const root = new THREE.Group();
  root.name = 'ValenkeepSanctumProps';

  const flames = [];
  const dynamicLights = [];
  const instancedPools = new Map();
  const dummy = new THREE.Object3D();
  const PI = Math.PI;

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
  const sphereGeo = new THREE.SphereGeometry(0.5, 14, 10);
  const coneGeo = new THREE.ConeGeometry(0.5, 1, 12);
  const torusGeo = new THREE.TorusGeometry(0.5, 0.08, 8, 24);

  const platePoints = [
    [0, 0], [0.13, 0], [0.18, 0.012], [0.24, 0.036], [0.25, 0.044], [0.17, 0.02], [0, 0.016]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const plateGeo = new THREE.LatheGeometry(platePoints, 20);

  const chalicePoints = [
    [0.005, 0], [0.06, 0.01], [0.018, 0.035], [0.016, 0.11], [0.068, 0.14],
    [0.078, 0.22], [0.07, 0.22], [0.056, 0.145], [0.005, 0.135]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const chaliceGeo = new THREE.LatheGeometry(chalicePoints, 18);

  function registerPool(key, geometry, material) {
    instancedPools.set(key, { geometry, material, matrices: [] });
  }

  registerPool('oakBox', boxGeo, mats.oak);
  registerPool('oakCyl', cylGeo, mats.oak);
  registerPool('stoneBox', boxGeo, mats.freestone);
  registerPool('basaltBox', boxGeo, mats.darkBasalt);
  registerPool('ironBox', boxGeo, mats.wroughtIron);
  registerPool('ironCyl', cylGeo, mats.wroughtIron);
  registerPool('ironTorus', torusGeo, mats.wroughtIron);
  registerPool('brassBox', boxGeo, mats.gildedBrass);
  registerPool('brassCyl', cylGeo, mats.gildedBrass);
  registerPool('brassSphere', sphereGeo, mats.gildedBrass);
  registerPool('brassCone', coneGeo, mats.gildedBrass);
  registerPool('steelCyl', cylGeo, mats.flutedSteel);
  registerPool('steelSphere', sphereGeo, mats.flutedSteel);
  registerPool('steelCone', coneGeo, mats.flutedSteel);
  registerPool('steelBox', boxGeo, mats.flutedSteel);
  registerPool('velvetBox', boxGeo, mats.velvet);
  registerPool('waxCyl', cylGeo, mats.beeswax);
  registerPool('pewterPlate', plateGeo, mats.pewter);
  registerPool('brassChalice', chaliceGeo, mats.gildedBrass);

  function makeMatrix(pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
    dummy.position.set(pos[0], pos[1], pos[2]);
    dummy.rotation.set(rot[0], rot[1], rot[2]);
    dummy.scale.set(scale[0], scale[1], scale[2]);
    dummy.updateMatrix();
    return dummy.matrix.clone();
  }

  function addInstance(poolKey, pos, scale = [1, 1, 1], rot = [0, 0, 0], parentMatrix = null) {
    const m = makeMatrix(pos, rot, scale);
    if (parentMatrix) m.premultiply(parentMatrix);
    instancedPools.get(poolKey).matrices.push(m);
  }

  function addSpanCyl(poolKey, p1, p2, radius, parentMatrix = null) {
    const v1 = new THREE.Vector3(...p1);
    const v2 = new THREE.Vector3(...p2);
    const diff = v2.clone().sub(v1);
    const len = diff.length();
    dummy.position.copy(v1.add(v2).multiplyScalar(0.5));
    dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), diff.normalize());
    dummy.scale.set(radius * 2, len, radius * 2);
    dummy.updateMatrix();
    const m = dummy.matrix.clone();
    if (parentMatrix) m.premultiply(parentMatrix);
    instancedPools.get(poolKey).matrices.push(m);
  }

  // Shared Candle Flame Geometry & Helper
  const flameGeo = new THREE.SphereGeometry(1, 10, 8);
  const fPos = flameGeo.attributes.position;
  for (let i = 0; i < fPos.count; i++) {
    const y = fPos.getY(i);
    const taper = y > 0 ? Math.max(0.08, 1 - y * 0.72) : 1;
    fPos.setX(i, fPos.getX(i) * taper);
    fPos.setZ(i, fPos.getZ(i) * taper);
  }
  flameGeo.computeVertexNormals();

  const outerFlameMat = new THREE.MeshBasicMaterial({
    color: 0xffaa3b,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    toneMapped: false
  });
  const innerFlameMat = new THREE.MeshBasicMaterial({
    color: 0xfff5cc,
    toneMapped: false
  });

  function spawnCandle(worldPos, height = 0.26, radius = 0.032, flameScale = 1.0) {
    const [x, y, z] = worldPos;
    addInstance('waxCyl', [x, y + height * 0.5, z], [radius * 2, height, radius * 2]);
    addInstance('ironCyl', [x, y + height + 0.012, z], [0.005, 0.024, 0.005]);

    const flameMesh = new THREE.Mesh(flameGeo, outerFlameMat);
    flameMesh.position.set(x, y + height + 0.068 * flameScale, z);
    flameMesh.scale.set(0.032 * flameScale, 0.086 * flameScale, 0.032 * flameScale);
    flameMesh.userData.baseScale = flameMesh.scale.clone();
    flameMesh.userData.phase = x * 2.9 + z * 1.7 + y;

    const core = new THREE.Mesh(flameGeo, innerFlameMat);
    core.scale.set(0.45, 0.65, 0.45);
    core.position.y = -0.14;
    flameMesh.add(core);

    root.add(flameMesh);
    flames.push(flameMesh);
  }

  // 1. CENTRAL PROCESSIONAL CARPET RUNNER & DAIS CARPET
  const naveCarpet = new THREE.Mesh(new THREE.PlaneGeometry(2.55, 27.5), mats.carpet);
  naveCarpet.rotation.x = -PI / 2;
  naveCarpet.position.set(0, 0.022, 1.2);
  naveCarpet.receiveShadow = true;
  root.add(naveCarpet);

  const daisCarpet = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.1), mats.carpet);
  daisCarpet.rotation.x = -PI / 2;
  daisCarpet.position.set(0, 0.732, -16.0);
  daisCarpet.receiveShadow = true;
  root.add(daisCarpet);

  // 2. CANOPIED GOTHIC ROYAL THRONE ON THE NORTH DAIS (y = 0.72, z = -16.3)
  const throneBase = makeMatrix([0, 0.72, -16.35], [0, 0, 0]);
  // Stepped oak throne podium
  addInstance('oakBox', [0, 0.09, 0], [1.85, 0.18, 1.45], [0, 0, 0], throneBase);
  addInstance('brassBox', [0, 0.19, 0], [1.68, 0.04, 1.28], [0, 0, 0], throneBase);
  // Seat & velvet cushion
  addInstance('oakBox', [0, 0.64, 0.06], [1.26, 0.14, 0.96], [0, 0, 0], throneBase);
  addInstance('velvetBox', [0, 0.75, 0.06], [1.12, 0.11, 0.84], [0, 0, 0], throneBase);
  // High Gothic backrest & velvet panel
  addInstance('oakBox', [0, 1.95, -0.38], [1.32, 2.75, 0.14], [0, 0, 0], throneBase);
  addInstance('velvetBox', [0, 1.75, -0.30], [1.02, 1.95, 0.05], [0, 0, 0], throneBase);
  // Armrests & vertical piers with gilded finials
  for (const side of [-1, 1]) {
    addInstance('oakBox', [side * 0.62, 0.96, 0.08], [0.16, 0.12, 0.98], [0, 0, 0], throneBase);
    addInstance('oakCyl', [side * 0.62, 0.56, 0.48], [0.16, 0.76, 0.16], [0, 0, 0], throneBase);
    addInstance('oakCyl', [side * 0.66, 1.95, -0.36], [0.18, 3.6, 0.18], [0, 0, 0], throneBase);
    addInstance('brassCone', [side * 0.66, 3.98, -0.36], [0.24, 0.52, 0.24], [0, 0, 0], throneBase);
  }
  // Projecting Gothic Baldachin Canopy & Spire Finials
  addInstance('oakBox', [0, 3.48, -0.06], [1.56, 0.24, 1.12], [0, 0, 0], throneBase);
  addInstance('brassBox', [0, 3.62, -0.06], [1.64, 0.06, 1.2], [0, 0, 0], throneBase);
  addInstance('brassCone', [0, 4.25, -0.22], [0.38, 1.15, 0.38], [0, 0, 0], throneBase);

  // Standing 7-Branch Gilded Candelabra flanking the Throne
  for (const side of [-1, 1]) {
    const cx = side * 2.35;
    const cz = -15.8;
    const baseY = 0.72;
    addInstance('brassCyl', [cx, baseY + 0.08, cz], [0.58, 0.16, 0.58]);
    addInstance('brassCyl', [cx, baseY + 1.15, cz], [0.09, 2.1, 0.09]);
    addInstance('brassSphere', [cx, baseY + 1.1, cz], [0.22, 0.22, 0.22]);
    addInstance('brassBox', [cx, baseY + 2.18, cz], [1.18, 0.06, 0.08]);

    for (let b = -2; b <= 2; b++) {
      const bx = cx + b * 0.22;
      const by = baseY + 2.22 + (2 - Math.abs(b)) * 0.11;
      addInstance('brassCyl', [bx, by - 0.06, cz], [0.06, 0.14, 0.06]);
      addInstance('brassCyl', [bx, by, cz], [0.14, 0.03, 0.14]);
      spawnCandle([bx, by + 0.015, cz], 0.28, 0.032, 1.15);
    }

    const candLight = new THREE.PointLight(0xffb866, 48, 12, 2);
    candLight.position.set(cx, baseY + 2.65, cz);
    root.add(candLight);
    dynamicLights.push(candLight);
  }

  // 3. EIGHT SUITS OF FLUTED GOTHIC PLATE ARMOR GUARDING THE NAVE COLONNADE
  function placeKnightArmor(x, z, facingYaw) {
    const p = makeMatrix([x, 0, z], [0, facingYaw, 0]);
    // Stone pedestal
    addInstance('basaltBox', [0, 0.18, 0], [0.92, 0.36, 0.92], [0, 0, 0], p);
    addInstance('stoneBox', [0, 0.4, 0], [0.8, 0.08, 0.8], [0, 0, 0], p);

    // Legs (greaves & cuisses)
    for (const s of [-1, 1]) {
      addInstance('steelBox', [s * 0.15, 0.48, 0.06], [0.14, 0.09, 0.28], [0, 0, 0], p);
      addInstance('steelCyl', [s * 0.15, 0.78, 0], [0.13, 0.52, 0.14], [0, 0, 0], p);
      addInstance('steelSphere', [s * 0.15, 1.06, 0.03], [0.16, 0.16, 0.18], [0, 0, 0], p);
      addInstance('steelCyl', [s * 0.15, 1.28, 0], [0.16, 0.42, 0.17], [0, 0, 0], p);
    }

    // Fluted cuirass (breastplate) & waist fauld
    addInstance('steelCyl', [0, 1.54, 0], [0.38, 0.24, 0.28], [0, 0, 0], p);
    addInstance('steelSphere', [0, 1.82, 0.02], [0.46, 0.52, 0.36], [0, 0, 0], p);
    addInstance('brassBox', [0, 1.84, 0.19], [0.06, 0.36, 0.04], [0, 0, 0], p);

    // Pauldrons & Arms
    for (const s of [-1, 1]) {
      addInstance('steelSphere', [s * 0.31, 1.98, 0], [0.24, 0.22, 0.26], [0, 0, -s * 0.25], p);
      addInstance('steelCyl', [s * 0.34, 1.7, 0.04], [0.12, 0.46, 0.12], [0.15, 0, 0], p);
    }

    // Sallet / Great Bascinet Helmet & Gilded Plume Finial
    addInstance('steelCyl', [0, 2.18, 0], [0.24, 0.22, 0.26], [0, 0, 0], p);
    addInstance('steelSphere', [0, 2.28, 0.02], [0.27, 0.28, 0.31], [0, 0, 0], p);
    addInstance('steelCone', [0, 2.22, 0.16], [0.22, 0.22, 0.22], [PI * 0.46, 0, 0], p);
    addInstance('brassCone', [0, 2.48, -0.02], [0.1, 0.22, 0.14], [-0.2, 0, 0], p);

    // Tall Steel Halberd in right hand
    addInstance('oakCyl', [0.36, 1.65, 0.14], [0.045, 2.6, 0.045], [0, 0, 0], p);
    addInstance('steelCone', [0.36, 3.08, 0.14], [0.08, 0.38, 0.04], [0, 0, 0], p);
    addInstance('steelBox', [0.36, 2.78, 0.24], [0.02, 0.32, 0.22], [0.15, 0, 0], p);

    // Heater Shield on left arm
    addInstance('steelBox', [-0.36, 1.66, 0.16], [0.04, 0.68, 0.46], [0, 0.35, 0], p);
    addInstance('brassBox', [-0.38, 1.66, 0.16], [0.05, 0.52, 0.06], [0, 0.35, 0], p);
  }

  for (const z of [-9, -3, 3, 9]) {
    placeKnightArmor(-4.1, z, PI * 0.5);
    placeKnightArmor(4.1, z, -PI * 0.5);
  }

  // 4. TWIN LONG OAK BANQUET TABLES & MEDIEVAL FEAST
  for (const side of [-1, 1]) {
    const tx = side * 2.45;
    // Heavy oak tabletop planks (18m long, centered at z = 0)
    for (let p = -1; p <= 1; p++) {
      addInstance('oakBox', [tx + p * 0.36, 0.84, 0], [0.34, 0.09, 17.6]);
    }
    // Trestle legs & stretcher beam
    addInstance('oakBox', [tx, 0.28, 0], [0.14, 0.12, 15.8]);
    for (const tz of [-7.2, -2.4, 2.4, 7.2]) {
      addInstance('oakBox', [tx, 0.42, tz], [0.22, 0.78, 0.22]);
      addInstance('oakBox', [tx, 0.08, tz], [0.98, 0.14, 0.28]);
    }

    // Flanking oak benches
    for (const bSide of [-1, 1]) {
      const bx = tx + bSide * 0.82;
      for (const bz of [-4.4, 4.4]) {
        addInstance('oakBox', [bx, 0.48, bz], [0.36, 0.07, 7.4]);
        for (const lz of [-2.8, 0, 2.8]) {
          addInstance('oakBox', [bx, 0.24, bz + lz], [0.32, 0.44, 0.14]);
        }
      }
    }

    // Place settings along each banquet table
    for (let seat = -7; seat <= 7; seat++) {
      const sz = seat * 1.15;
      for (const sSide of [-1, 1]) {
        const px = tx + sSide * 0.32;
        addInstance('pewterPlate', [px, 0.886, sz], [0.88, 0.88, 0.88]);
        addInstance('brassChalice', [px - sSide * 0.14, 0.886, sz + 0.22], [0.95, 0.95, 0.95]);
      }
    }

    // Table Candelabra & Candles every 3.4m
    for (const cz of [-6.8, -3.4, 0, 3.4, 6.8]) {
      addInstance('brassCyl', [tx, 0.91, cz], [0.18, 0.04, 0.18]);
      addInstance('brassCyl', [tx, 1.08, cz], [0.04, 0.32, 0.04]);
      addInstance('brassSphere', [tx, 1.06, cz], [0.08, 0.08, 0.08]);
      addInstance('brassCyl', [tx, 1.24, cz], [0.12, 0.025, 0.12]);
      spawnCandle([tx, 1.25, cz], 0.24, 0.028, 0.9);
    }
  }

  // 5. THREE TWO-TIERED CORONA LUCIS WHEEL CHANDELIERS (z = -8, 0, +8)
  const outerWheelGeo = new THREE.TorusGeometry(1.58, 0.042, 10, 56);
  const innerWheelGeo = new THREE.TorusGeometry(0.96, 0.032, 8, 44);

  for (const cz of [-8.5, 0, 8.5]) {
    const cy = 6.65;
    const outerWheel = new THREE.Mesh(outerWheelGeo, mats.wroughtIron);
    outerWheel.position.set(0, cy, cz);
    outerWheel.rotation.x = PI / 2;
    outerWheel.castShadow = true;
    root.add(outerWheel);

    const innerWheel = new THREE.Mesh(innerWheelGeo, mats.gildedBrass);
    innerWheel.position.set(0, cy + 0.38, cz);
    innerWheel.rotation.x = PI / 2;
    innerWheel.castShadow = true;
    root.add(innerWheel);

    // Central suspension rod up to vault boss (y = 13.3m)
    addInstance('ironCyl', [0, (cy + 13.3) * 0.5, cz], [0.055, 13.3 - cy, 0.055]);
    addInstance('brassSphere', [0, cy - 0.12, cz], [0.22, 0.28, 0.22]);

    const numCandles = 16;
    for (let i = 0; i < numCandles; i++) {
      const a = (i / numCandles) * PI * 2;
      const wx = Math.cos(a) * 1.58;
      const wz = cz + Math.sin(a) * 1.58;
      addInstance('brassCyl', [wx, cy + 0.05, wz], [0.13, 0.03, 0.13]);
      spawnCandle([wx, cy + 0.065, wz], 0.24 + (i % 3) * 0.04, 0.034, 1.08);

      if (i % 2 === 0) {
        addSpanCyl('ironCyl', [0, cy + 0.38, cz], [wx, cy, wz], 0.014);
      }
      if (i % 4 === 0) {
        addSpanCyl('ironCyl', [wx, cy, wz], [0, cy + 2.2, cz], 0.016);
      }
    }

    const chandLight = new THREE.PointLight(0xffbd6e, 95, 19, 1.9);
    chandLight.position.set(0, cy - 0.25, cz);
    root.add(chandLight);
    dynamicLights.push(chandLight);
  }

  // 6. ROYAL HERALDIC TAPESTRIES ALONG THE NAVE & SANCTUARY
  function hangTapestry(pos, yaw, width = 1.65, height = 3.6) {
    const geo = new THREE.PlaneGeometry(width, height, 14, 22);
    const pAttr = geo.attributes.position;
    for (let i = 0; i < pAttr.count; i++) {
      const x = pAttr.getX(i);
      const y = pAttr.getY(i);
      const fold = Math.cos(x * 13) * 0.045 * (1 - (y + height * 0.5) / height * 0.6);
      pAttr.setZ(i, fold);
      if (y < -height * 0.46) {
        pAttr.setY(i, y + Math.abs(x) * 0.28);
      }
    }
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, mats.banner);
    mesh.position.set(...pos);
    mesh.rotation.y = yaw;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);

    const rodM = makeMatrix(pos, [0, yaw, 0]);
    addInstance('brassCyl', [0, height * 0.5 + 0.04, 0], [0.05, width + 0.28, 0.05], [0, 0, PI / 2], rodM);
  }

  hangTapestry([-3.6, 5.2, -17.75], 0, 1.75, 3.8);
  hangTapestry([3.6, 5.2, -17.75], 0, 1.75, 3.8);
  for (const z of [-9, 3]) {
    hangTapestry([-4.52, 4.3, z], PI * 0.5, 1.35, 3.1);
    hangTapestry([4.52, 4.3, z], -PI * 0.5, 1.35, 3.1);
  }

  // 7. MONUMENTAL HOODED CASTLE HEARTH (East Bay x = +7.55, z = 0)
  const hearthM = makeMatrix([7.65, 0, 0], [0, -PI / 2, 0]);
  // Raised hearthstone & dark firebox back
  addInstance('basaltBox', [0, 0.14, 0.45], [4.2, 0.28, 1.65], [0, 0, 0], hearthM);
  const fireboxBack = new THREE.Mesh(
    new THREE.BoxGeometry(2.85, 2.55, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x0a0908, roughness: 0.98 })
  );
  fireboxBack.position.set(0, 1.45, -0.1);
  fireboxBack.applyMatrix4(hearthM);
  root.add(fireboxBack);

  // Jamb piers & mantel lintel
  for (const s of [-1, 1]) {
    addInstance('stoneBox', [s * 1.66, 1.42, 0.24], [0.62, 2.56, 0.92], [0, 0, 0], hearthM);
    addInstance('basaltBox', [s * 1.66, 2.66, 0.32], [0.76, 0.24, 1.08], [0, 0, 0], hearthM);
  }
  addInstance('stoneBox', [0, 2.95, 0.28], [4.15, 0.46, 1.05], [0, 0, 0], hearthM);
  addInstance('basaltBox', [0, 3.24, 0.36], [4.38, 0.16, 1.18], [0, 0, 0], hearthM);
  // Towering tapered stone chimney hood
  addInstance('stoneBox', [0, 4.45, 0.12], [3.65, 2.25, 0.78], [0, 0, 0], hearthM);
  addInstance('stoneBox', [0, 6.15, 0.02], [2.95, 1.45, 0.58], [0, 0, 0], hearthM);
  addInstance('brassSphere', [0, 4.35, 0.52], [0.58, 0.58, 0.12], [0, 0, 0], hearthM);

  // Glowing ember bed & charred logs
  const emberBed = new THREE.Mesh(
    new THREE.SphereGeometry(1, 18, 10),
    new THREE.MeshStandardMaterial({
      color: 0x260c04,
      emissive: 0xff3b08,
      emissiveIntensity: 2.8,
      roughness: 0.92
    })
  );
  emberBed.position.set(0, 0.32, 0.38);
  emberBed.scale.set(1.08, 0.08, 0.42);
  emberBed.applyMatrix4(hearthM);
  root.add(emberBed);

  for (let i = -3; i <= 3; i++) {
    addSpanCyl('oakCyl', [i * 0.26 - 0.15, 0.38, 0.18], [i * 0.24 + 0.18, 0.48, 0.65], 0.09, hearthM);
  }

  // Animated turbulent procedural fire canvas texture
  const fCanvas = document.createElement('canvas');
  fCanvas.width = 128;
  fCanvas.height = 192;
  const fCtx = fCanvas.getContext('2d');
  const fImg = fCtx.createImageData(128, 192);
  const fTex = new THREE.CanvasTexture(fCanvas);
  fTex.colorSpace = THREE.SRGBColorSpace;

  for (const [zOff, w, h, yaw, op] of [
    [0.22, 2.1, 1.85, -0.1, 0.55],
    [0.42, 1.75, 1.55, 0.12, 0.72],
    [0.58, 1.38, 1.25, -0.05, 0.52]
  ]) {
    const fPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: fTex,
        transparent: true,
        opacity: op,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false
      })
    );
    fPlane.position.set(0, 0.35 + h * 0.5, zOff);
    fPlane.rotation.y = yaw;
    fPlane.applyMatrix4(hearthM);
    root.add(fPlane);
  }

  const hearthLight = new THREE.PointLight(0xff7b29, 175, 18, 1.85);
  hearthLight.position.set(6.4, 1.45, 0);
  hearthLight.castShadow = true;
  hearthLight.shadow.mapSize.set(1024, 1024);
  hearthLight.shadow.normalBias = 0.03;
  hearthLight.userData.isHearth = true;
  root.add(hearthLight);
  dynamicLights.push(hearthLight);

  let lastFireTick = -1;
  function updateSanctum(time) {
    // Animate candle flames
    for (let i = 0; i < flames.length; i++) {
      const f = flames[i];
      const base = f.userData.baseScale;
      const p = f.userData.phase;
      const flicker = 1 + Math.sin(time * 8.4 + p) * 0.13 + Math.cos(time * 14.7 + p * 1.7) * 0.06;
      f.scale.set(base.x * (1 + (1 - flicker) * 0.25), base.y * flicker, base.z * (1 + (1 - flicker) * 0.25));
    }

    // Animate dynamic point lights
    for (let i = 0; i < dynamicLights.length; i++) {
      const l = dynamicLights[i];
      const baseInt = l.userData.baseIntensity ?? l.intensity;
      l.userData.baseIntensity = baseInt;
      const wave = Math.sin(time * 6.2 + i * 1.9) * 0.045 + Math.sin(time * 13.1 + i) * 0.025;
      l.intensity = baseInt * (1 + wave);
    }

    // Update procedural hearth fire at ~24fps
    const tick = Math.floor(time * 24);
    if (tick !== lastFireTick) {
      lastFireTick = tick;
      const t = tick / 24;
      const d = fImg.data;
      for (let y = 0; y < 192; y++) {
        const ny = 1 - y / 191;
        const vFade = Math.min(1, ny / 0.08) * Math.max(0, 1 - Math.max(0, (ny - 0.78) / 0.22));
        for (let x = 0; x < 128; x++) {
          const nx = (x / 127) * 2 - 1;
          const sway = Math.sin(ny * 8 - t * 6.5 + nx * 3) * 0.14 * ny;
          const tongues =
            Math.exp(-Math.pow((nx + sway - 0.45) * 4.2, 2)) +
            Math.exp(-Math.pow((nx - sway) * 3.4, 2)) * 1.2 +
            Math.exp(-Math.pow((nx + sway + 0.45) * 4.2, 2));
          const turb = Math.sin(nx * 14 + t * 4) * Math.cos(ny * 16 - t * 9) * 0.28 + 0.72;
          const val = Math.max(0, tongues * turb * (1 - ny * 0.88)) * vFade;
          const idx = (y * 128 + x) * 4;
          const alpha = Math.min(1, val * 1.45);
          d[idx] = 255;
          d[idx + 1] = Math.min(255, Math.round(52 + val * 195));
          d[idx + 2] = Math.min(255, Math.round(Math.pow(val, 2.4) * 180));
          d[idx + 3] = Math.round(alpha * 235);
        }
      }
      fCtx.putImageData(fImg, 0, 0);
      fTex.needsUpdate = true;
    }
  }

  // Finalize all instanced meshes
  for (const [key, pool] of instancedPools.entries()) {
    if (!pool.matrices.length) continue;
    const imesh = new THREE.InstancedMesh(pool.geometry, pool.material, pool.matrices.length);
    imesh.name = `Prop_${key}`;
    for (let i = 0; i < pool.matrices.length; i++) {
      imesh.setMatrixAt(i, pool.matrices[i]);
    }
    imesh.instanceMatrix.needsUpdate = true;
    imesh.castShadow = true;
    imesh.receiveShadow = true;
    imesh.computeBoundingSphere();
    root.add(imesh);
  }

  return { group: root, dynamicLights, updateSanctum };
}
