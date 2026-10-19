/**
 * Builds the multi-level Gothic architecture of Valenkeep Sanctum:
 * - Central Nave + Walkable Side Aisles separated by 14 Clustered Compound Piers
 * - Pointed Nave Arcade + Second-Story Triforium Gallery + Pointed Ribbed Groin Vault
 * - North Three-Tiered Royal Dais & 6.4m Cathedral Rose Window with Bar Tracery
 * - Deeply Splayed Lancet Stained-Glass Windows & South Portcullis Gate
 */

export function buildGothicArchitecture(THREE, mats) {
  const root = new THREE.Group();
  root.name = 'ValenkeepArchitecture';

  const batches = new Map();
  const mat4 = new THREE.Matrix4();
  const posVec = new THREE.Vector3();
  const euler = new THREE.Euler();
  const quat = new THREE.Quaternion();
  const scaleVec = new THREE.Vector3();
  const PI = Math.PI;

  function pushGeo(geo, matKey, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
    posVec.set(pos[0], pos[1], pos[2]);
    euler.set(rot[0], rot[1], rot[2]);
    quat.setFromEuler(euler);
    scaleVec.set(scale[0], scale[1], scale[2]);
    mat4.compose(posVec, quat, scaleVec);

    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (geo.index) geo.dispose();
    g.applyMatrix4(mat4);
    if (!g.attributes.normal) g.computeVertexNormals();

    if (!batches.has(matKey)) batches.set(matKey, []);
    batches.get(matKey).push(g);
  }

  function addBox(w, h, d, pos, matKey = 'ashlar', rot = [0, 0, 0]) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    const scales = [
      [d, h], [d, h],
      [w, d], [w, d],
      [w, h], [w, h]
    ];
    for (let i = 0; i < uv.count; i++) {
      const s = scales[Math.floor(i / 4)];
      uv.setXY(i, uv.getX(i) * s[0], uv.getY(i) * s[1]);
    }
    pushGeo(g, matKey, pos, rot);
  }

  function addCyl(rTop, rBot, h, pos, matKey = 'freestone', segs = 14, rot = [0, 0, 0]) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, segs);
    const uv = g.attributes.uv;
    const circum = Math.max(rTop, rBot) * 2 * PI;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * circum, uv.getY(i) * h);
    }
    pushGeo(g, matKey, pos, rot);
  }

  function addTube(pts, radius, matKey = 'freestone', tubularSegs = 36, radialSegs = 8) {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])));
    const g = new THREE.TubeGeometry(curve, tubularSegs, radius, radialSegs, false);
    pushGeo(g, matKey);
  }

  function pointedArchCurve(halfSpan, springY, apexY, steps = 20) {
    const pts = [];
    const h = apexY - springY;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * PI;
      const x = -Math.cos(angle) * halfSpan;
      // Gothic pointed profile
      const pinch = 1 - Math.pow(Math.abs(Math.cos(angle)), 1.35);
      const y = springY + Math.sin(angle) * h * 0.82 + pinch * h * 0.18;
      pts.push([x, y]);
    }
    return pts;
  }

  // 1. COURSED FLAGSTONE FLOOR WITH STAGGERED SLABS & AISLE BORDERS
  addBox(17.6, 0.3, 38.4, [0, -0.22, 0], 'darkBasalt');
  let seed = 919;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let row = 0; row < 26; row++) {
    const z = -17.8 + row * 1.42;
    const rowShift = (row % 2) * 0.45;
    for (let col = -5; col <= 5; col++) {
      const x = col * 1.48 + rowShift * (col % 2 === 0 ? 1 : -0.5);
      if (Math.abs(x) > 8.1) continue;
      const relief = (rand() - 0.5) * 0.012;
      addBox(1.44, 0.14 + relief, 1.39, [x, -0.06 + relief * 0.5, z], 'flagstone');
    }
  }

  // Nave colonnade stone floor runners
  for (const side of [-1, 1]) {
    addBox(0.92, 0.06, 36.8, [side * 5.1, 0.02, 0], 'darkBasalt');
    addBox(0.45, 0.24, 36.8, [side * 8.18, 0.12, 0], 'darkBasalt');
    addBox(0.32, 0.14, 36.8, [side * 8.05, 0.28, 0], 'freestone');
  }

  // 2. THREE-TIERED NORTH ROYAL DAIS & BALUSTRADE STEPS
  addBox(10.2, 0.24, 5.8, [0, 0.12, -15.3], 'darkBasalt');
  addBox(9.6, 0.24, 5.1, [0, 0.36, -15.65], 'freestone');
  addBox(9.0, 0.24, 4.4, [0, 0.60, -16.0], 'flagstone');
  // Molded dais nosing & side cheek walls
  for (const side of [-1, 1]) {
    addBox(0.48, 1.18, 2.2, [side * 2.6, 0.59, -13.1], 'freestone');
    addBox(0.58, 0.16, 2.36, [side * 2.6, 1.22, -13.1], 'darkBasalt');
    addCyl(0.24, 0.28, 0.55, [side * 2.6, 1.55, -12.2], 'freestone', 8);
  }

  // 3. FOURTEEN CLUSTERED GOTHIC COMPOUND PIERS & NAVE ARCADE
  const pierZ = [-15, -9, -3, 3, 9, 15];
  const bayCenters = [-12, -6, 0, 6, 12];

  for (const side of [-1, 1]) {
    const px = side * 5.1;

    for (const z of pierZ) {
      // Octagonal stepped plinth
      addCyl(0.74, 0.82, 0.28, [px, 0.14, z], 'darkBasalt', 8);
      addCyl(0.64, 0.72, 0.32, [px, 0.44, z], 'freestone', 8);

      // Central core column (rises to arcade capital at y = 5.2m)
      addCyl(0.44, 0.46, 4.6, [px, 2.9, z], 'ashlar', 16);

      // 4 attached cardinal shafts around each compound pier
      for (const [dx, dz] of [[0.42, 0], [-0.42, 0], [0, 0.42], [0, -0.42]]) {
        const isNaveShaft = Math.sign(dx) === -side;
        const shaftH = isNaveShaft ? 8.15 : 4.65;
        const shaftY = isNaveShaft ? 0.6 + shaftH / 2 : 2.92;
        addCyl(0.14, 0.15, shaftH, [px + dx, shaftY, z + dz], 'freestone', 12);
        // Shaft annulet rings
        addCyl(0.18, 0.18, 0.09, [px + dx, 2.8, z + dz], 'darkBasalt', 12);
        addCyl(0.18, 0.18, 0.09, [px + dx, 5.15, z + dz], 'darkBasalt', 12);
      }

      // 4 diagonal colonnettes
      for (const sx of [-0.3, 0.3]) {
        for (const sz of [-0.3, 0.3]) {
          addCyl(0.095, 0.1, 4.6, [px + sx, 2.9, z + sz], 'freestone', 10);
        }
      }

      // Molded foliate bell capital & abacus at arcade level
      addCyl(0.68, 0.48, 0.38, [px, 5.35, z], 'freestone', 12);
      addBox(1.38, 0.22, 1.38, [px, 5.64, z], 'darkBasalt');

      // High vaulting capital at y = 8.75m (facing the nave)
      addCyl(0.38, 0.22, 0.34, [px - side * 0.36, 8.75, z], 'freestone', 10);
      addBox(0.84, 0.18, 0.84, [px - side * 0.36, 8.98, z], 'darkBasalt');
    }

    // Pointed Nave Arcade Arches between piers + Triforium Gallery above
    for (const bz of bayCenters) {
      const arch2D = pointedArchCurve(2.55, 5.65, 7.38, 22);
      const innerArch = arch2D.map(([az, ay]) => [px, ay, bz + az]);
      const outerArch = pointedArchCurve(2.74, 5.65, 7.56, 22).map(([az, ay]) => [px - side * 0.18, ay, bz + az]);
      addTube(innerArch, 0.22, 'freestone', 36, 8);
      addTube(outerArch, 0.11, 'darkBasalt', 36, 8);

      // Spandrel wall above arcade up to Triforium sill
      addBox(0.52, 0.95, 5.4, [px, 7.45, bz], 'ashlar');

      // Second-Story Triforium Gallery (twin pointed openings + colonnette + balustrade)
      for (const subZ of [-1.25, 1.25]) {
        addCyl(0.11, 0.12, 1.35, [px - side * 0.1, 8.65, bz + subZ], 'freestone', 10);
        const triArch = pointedArchCurve(1.05, 9.15, 9.85, 14).map(([az, ay]) => [px - side * 0.1, ay, bz + subZ + az]);
        addTube(triArch, 0.095, 'freestone', 20, 7);
      }
      addCyl(0.12, 0.13, 1.35, [px - side * 0.1, 8.65, bz], 'darkBasalt', 10);
      // Triforium pierced stone balustrade
      addBox(0.36, 0.42, 5.2, [px - side * 0.12, 8.12, bz], 'freestone');

      // Side Aisle Transverse Arch connecting compound pier to outer wall
      const aisleArch = pointedArchCurve(1.45, 5.4, 6.85, 16).map(([ax, ay]) => [side * (6.65 + ax), ay, bz - 3]);
      addTube(aisleArch, 0.16, 'freestone', 24, 8);
    }

    // Continuous horizontal stringcourses tying the nave elevation together
    addBox(0.68, 0.18, 36.4, [px - side * 0.08, 7.86, 0], 'darkBasalt');
    addBox(0.64, 0.18, 36.4, [px - side * 0.08, 9.95, 0], 'freestone');
  }

  // 4. OUTER SIDE AISLE WALLS, BUTTRESSES & LANCET STAINED-GLASS WINDOWS
  const windowLightAnchors = [];

  for (const side of [-1, 1]) {
    const wallX = side * 8.28;

    // Outer wall piers corresponding to compound piers
    for (const z of pierZ) {
      addBox(0.75, 9.8, 1.15, [side * 7.95, 4.9, z], 'ashlar');
      addCyl(0.22, 0.24, 5.4, [side * 7.55, 2.8, z], 'freestone', 10);
      addCyl(0.32, 0.24, 0.28, [side * 7.55, 5.58, z], 'darkBasalt', 10);
    }

    // Side aisle ceiling vault slab
    addBox(3.2, 0.45, 36.8, [side * 6.7, 7.15, 0], 'ashlar');
    // Upper Triforium back wall
    addBox(0.6, 3.2, 36.8, [side * 6.55, 8.6, 0], 'darkBasalt');

    for (const bz of bayCenters) {
      const isHearthBay = side === 1 && bz === 0;

      if (isHearthBay) {
        // Solid stone wall behind the grand fireplace bay
        addBox(0.85, 7.2, 6.0, [wallX, 3.6, bz], 'ashlar');
        continue;
      }

      // Lower dado wall & stone bench
      addBox(0.85, 2.15, 6.0, [wallX, 1.075, bz], 'ashlar');
      addBox(0.95, 0.2, 5.2, [side * 7.9, 2.18, bz], 'freestone');
      // Flanking wall jambs around lancet window
      addBox(0.85, 5.1, 1.45, [wallX, 4.65, bz - 2.28], 'ashlar');
      addBox(0.85, 5.1, 1.45, [wallX, 4.65, bz + 2.28], 'ashlar');
      addBox(0.85, 1.1, 3.2, [wallX, 6.75, bz], 'ashlar');

      // Deeply splayed Gothic Lancet Window Frame
      const winArch = pointedArchCurve(1.42, 5.15, 6.45, 18).map(([az, ay]) => [side * 7.88, ay, bz + az]);
      addTube(winArch, 0.18, 'freestone', 28, 8);

      // Stained Glass Pane & Stone Mullions
      const glassGeo = new THREE.PlaneGeometry(2.75, 4.25);
      pushGeo(glassGeo, 'stainedLancet', [side * 8.18, 4.3, bz], [0, -side * PI * 0.5, 0]);

      // Central stone mullion & sub-arches
      addBox(0.16, 4.1, 0.14, [side * 8.06, 4.25, bz], 'freestone');
      for (const sub of [-0.68, 0.68]) {
        const subArch = pointedArchCurve(0.66, 4.95, 5.68, 12).map(([az, ay]) => [side * 8.06, ay, bz + sub + az]);
        addTube(subArch, 0.065, 'freestone', 18, 6);
      }
      // Quatrefoil oculus ring in window head
      pushGeo(new THREE.TorusGeometry(0.36, 0.06, 8, 24), 'freestone', [side * 8.06, 5.88, bz], [0, PI * 0.5, 0]);

      windowLightAnchors.push({
        from: [side * 7.6, 5.1, bz],
        to: [-side * 2.2, 0.05, bz + 2.6],
        side
      });
    }
  }

  // 5. POINTED GOTHIC RIBBED VAULT, TRANSVERSE ARCHES, DIAGONAL RIBS & GILDED BOSSES
  const vaultSteps = 44;
  const vaultVerts = [];
  const vaultNorms = [];
  const vaultUVs = [];

  function vaultProfilePoint(t) {
    // t in [0, 1] across nave x = -5.25 .. +5.25, y = 9.0 .. 13.55
    const angle = t * PI;
    const x = -Math.cos(angle) * 5.28;
    const pinch = 1 - Math.pow(Math.abs(Math.cos(angle)), 1.3);
    const y = 9.02 + Math.sin(angle) * 3.75 + pinch * 0.82;
    return [x, y];
  }

  for (let i = 0; i < vaultSteps; i++) {
    const t0 = i / vaultSteps;
    const t1 = (i + 1) / vaultSteps;
    const [x0, y0] = vaultProfilePoint(t0);
    const [x1, y1] = vaultProfilePoint(t1);
    const zStart = -18.2;
    const zEnd = 18.2;

    const quad = [
      [x0, y0, zStart, t0 * 14, 0],
      [x1, y1, zStart, t1 * 14, 0],
      [x1, y1, zEnd, t1 * 14, 24],
      [x0, y0, zEnd, t0 * 14, 24]
    ];

    const dx = x1 - x0;
    const dy = y1 - y0;
    const nx = dy;
    const ny = -dx;
    const inv = 1 / Math.hypot(nx, ny);

    for (const idx of [0, 2, 1, 0, 3, 2]) {
      const v = quad[idx];
      vaultVerts.push(v[0], v[1], v[2]);
      vaultNorms.push(nx * inv, ny * inv, 0);
      vaultUVs.push(v[3], v[4]);
    }
  }

  const vaultGeo = new THREE.BufferGeometry();
  vaultGeo.setAttribute('position', new THREE.Float32BufferAttribute(vaultVerts, 3));
  vaultGeo.setAttribute('normal', new THREE.Float32BufferAttribute(vaultNorms, 3));
  vaultGeo.setAttribute('uv', new THREE.Float32BufferAttribute(vaultUVs, 2));
  pushGeo(vaultGeo, 'ashlar');

  // Transverse Pointed Vault Arches at every pier line
  for (const z of [-18, ...pierZ, 18]) {
    const pts = [];
    for (let i = 0; i <= 36; i++) {
      const [vx, vy] = vaultProfilePoint(i / 36);
      pts.push([vx * 0.985, vy - 0.08, z]);
    }
    addTube(pts, 0.17, 'freestone', 44, 8);
    addTube(pts.map(([x, y, pz]) => [x * 0.968, y - 0.18, pz]), 0.075, 'darkBasalt', 44, 6);
  }

  // Diagonal Quadripartite Groin Ribs + Tierceron Ribs + Gilded Bosses
  for (const bz of [-15, ...bayCenters, 15]) {
    const halfBay = 3.0;
    for (const diag of [-1, 1]) {
      const ribPts = [];
      for (let i = 0; i <= 32; i++) {
        const u = i / 32;
        const [vx, vy] = vaultProfilePoint(u);
        const rz = bz + diag * (u * 2 - 1) * halfBay;
        ribPts.push([vx * 0.98, vy - 0.1, rz]);
      }
      addTube(ribPts, 0.11, 'freestone', 36, 7);
    }

    // Carved stone ring & gilded boss at vault crown intersection
    addCyl(0.32, 0.26, 0.14, [0, 13.42, bz], 'darkBasalt', 12);
    pushGeo(new THREE.OctahedronGeometry(0.24, 1), 'gildedBrass', [0, 13.32, bz]);
  }

  // Longitudinal central ridge rib
  addTube([[0, 13.48, -18.2], [0, 13.48, 18.2]], 0.095, 'freestone', 24, 8);

  // 6. NORTH SANCTUARY GABLE WALL, REREDOS ARCADE & 6.4M ROSE WINDOW
  addBox(17.2, 14.0, 0.9, [0, 7.0, -18.55], 'ashlar');

  // Triple Gothic Blind Arcade Reredos behind the Throne Dais
  for (const rx of [-2.8, 0, 2.8]) {
    const isCenter = rx === 0;
    const span = isCenter ? 1.35 : 1.05;
    const topY = isCenter ? 5.65 : 5.1;
    for (const sx of [-span, span]) {
      addCyl(0.14, 0.15, 3.6, [rx + sx, 2.5, -17.98], 'freestone', 12);
    }
    const rArch = pointedArchCurve(span, 4.3, topY, 18).map(([ax, ay]) => [rx + ax, ay, -17.98]);
    addTube(rArch, 0.14, 'freestone', 26, 8);
  }
  addBox(9.4, 0.22, 0.55, [0, 5.95, -17.95], 'darkBasalt');

  // Monumental 6.4m Cathedral Rose Window (centered at y = 9.45m, z = -18.02m)
  const roseY = 9.45;
  const roseZ = -18.02;
  const roseRadius = 2.95;

  pushGeo(new THREE.CircleGeometry(roseRadius, 48), 'roseWindow', [0, roseY, roseZ - 0.05]);
  // Deep molded stone surround rings
  pushGeo(new THREE.TorusGeometry(roseRadius + 0.12, 0.24, 12, 56), 'freestone', [0, roseY, roseZ]);
  pushGeo(new THREE.TorusGeometry(roseRadius - 0.18, 0.1, 10, 48), 'darkBasalt', [0, roseY, roseZ + 0.06]);
  pushGeo(new THREE.TorusGeometry(1.15, 0.09, 10, 36), 'freestone', [0, roseY, roseZ + 0.05]);
  pushGeo(new THREE.TorusGeometry(0.45, 0.08, 8, 24), 'freestone', [0, roseY, roseZ + 0.06]);

  // 12 Radiating Gothic Tracery Spokes & Outer Trefoil Rings
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * PI * 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    addTube(
      [
        [cos * 0.45, roseY + sin * 0.45, roseZ + 0.05],
        [cos * (roseRadius - 0.15), roseY + sin * (roseRadius - 0.15), roseZ + 0.05]
      ],
      0.048,
      'freestone',
      6,
      6
    );
    pushGeo(
      new THREE.TorusGeometry(0.38, 0.045, 8, 20),
      'freestone',
      [cos * 2.18, roseY + sin * 2.18, roseZ + 0.05]
    );
  }

  // 7. SOUTH ENTRANCE WALL, GREAT TIMBER DOORS & IRON PORTCULLIS
  addBox(6.2, 14.0, 0.9, [-5.5, 7.0, 18.45], 'ashlar');
  addBox(6.2, 14.0, 0.9, [5.5, 7.0, 18.45], 'ashlar');
  addBox(5.2, 7.6, 0.9, [0, 10.2, 18.45], 'ashlar');

  // Pointed portal arch surround
  const portalArch = pointedArchCurve(2.35, 4.6, 6.55, 22).map(([ax, ay]) => [ax, ay, 17.95]);
  addTube(portalArch, 0.28, 'freestone', 32, 10);
  // Heavy Oak Double Doors
  addBox(4.6, 6.4, 0.24, [0, 3.2, 18.32], 'oak');
  // Wrought-iron portcullis grid
  for (let x = -1.95; x <= 1.95; x += 0.65) {
    addCyl(0.032, 0.032, 6.1, [x, 3.2, 18.12], 'wroughtIron', 8);
  }
  for (let y = 0.9; y <= 5.4; y += 0.9) {
    addBox(4.4, 0.07, 0.07, [0, y, 18.12], 'wroughtIron');
  }

  // Merge all geometry batches into single draw-call meshes per material
  for (const [matKey, geos] of batches.entries()) {
    let totalVerts = 0;
    for (const g of geos) totalVerts += g.attributes.position.count;

    const posArr = new Float32Array(totalVerts * 3);
    const normArr = new Float32Array(totalVerts * 3);
    const uvArr = new Float32Array(totalVerts * 2);

    let offset = 0;
    for (const g of geos) {
      const p = g.attributes.position;
      const n = g.attributes.normal;
      const u = g.attributes.uv;
      posArr.set(p.array, offset * 3);
      normArr.set(n.array, offset * 3);
      if (u) uvArr.set(u.array, offset * 2);
      offset += p.count;
      g.dispose();
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
    merged.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
    merged.computeBoundingSphere();

    const isGlass = matKey === 'stainedLancet' || matKey === 'roseWindow';
    const mesh = new THREE.Mesh(merged, mats[matKey] || mats.ashlar);
    mesh.name = `Arch_${matKey}`;
    mesh.castShadow = !isGlass;
    mesh.receiveShadow = !isGlass;
    root.add(mesh);
  }

  return { group: root, windowLightAnchors };
}
