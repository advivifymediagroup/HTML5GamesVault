(() => {
  if (window.__hasWebGL === false) return;
  const SIZE = 4;
  const container = document.getElementById('game3d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const movesEl = document.getElementById('moves');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  // ---- Three.js scaffold ----
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a25);
  scene.fog = new THREE.Fog(0x0a0a25, 20, 40);

  const camera = new THREE.PerspectiveCamera(46, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 13.0, 0.01);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  if (window.SceneKit) SceneKit.enhance(renderer, scene);

  new ResizeObserver(() => {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }).observe(container);

  scene.add(new THREE.AmbientLight(0x9099cc, 0.65));
  const sun = new THREE.DirectionalLight(0xffffff, 0.95);
  sun.position.set(-6, 16, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -8; sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8;
  scene.add(sun);

  const GAP = 2.1;
  const OFF = (SIZE - 1) / 2 * GAP;
  function cellX(c) { return c * GAP - OFF; }
  function cellZ(r) { return r * GAP - OFF; }

  // board base + wells
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(SIZE * GAP + 1, 0.8, SIZE * GAP + 1),
    new THREE.MeshStandardMaterial({color: 0x1e1b4b, roughness: 0.85})
  );
  base.position.y = -0.5; base.receiveShadow = true; scene.add(base);
  const wellMat = new THREE.MeshStandardMaterial({color: 0x141234, roughness: 0.9});
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.3, 1.85), wellMat);
    w.position.set(cellX(c), -0.02, cellZ(r)); w.receiveShadow = true;
    scene.add(w);
  }

  // ---- number textures ----
  const texCache = {};
  const TILE_COLORS = {
    2:'#ddd6fe',4:'#c4b5fd',8:'#fbbf24',16:'#fb923c',32:'#f87171',64:'#ef4444',
    128:'#fde047',256:'#facc15',512:'#fbbf24',1024:'#34d399',2048:'#06d4f7',4096:'#ec4899'
  };
  const TXT_DARK = new Set([2,4,128,256,512]);
  function tileTexture(value) {
    if (texCache[value]) return texCache[value];
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = TILE_COLORS[value] || '#8b5cf6';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = TXT_DARK.has(value) ? '#4c1d95' : '#ffffff';
    ctx.font = `bold ${value >= 1024 ? 84 : value >= 128 ? 104 : 128}px "Space Grotesk", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(value, 128, 138);
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    texCache[value] = tex;
    return tex;
  }
  function tileColorHex(value) { return new THREE.Color(TILE_COLORS[value] || '#8b5cf6'); }

  function makeTileMesh(value) {
    const topTex = tileTexture(value);
    const sideColor = tileColorHex(value).multiplyScalar(0.75);
    const sideMat = new THREE.MeshStandardMaterial({color: sideColor, roughness: 0.5, metalness: 0.15});
    const topMat = new THREE.MeshStandardMaterial({map: topTex, roughness: 0.45, metalness: 0.1});
    // BoxGeometry material order: +x,-x,+y,-y,+z,-z  → top is +y (index 2)
    const mats = [sideMat, sideMat, topMat, sideMat.clone(), sideMat, sideMat];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 1.8), mats);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.value = value;
    return mesh;
  }

  // ---- Game state ----
  let grid, score, best, moves, idc, won;
  const tileMeshes = new Map();   // id -> {mesh, target, pop}
  best = +localStorage.getItem('2048-3d-best') || 0;
  bestEl.textContent = best;

  function newGame() {
    grid = Array.from({length: SIZE}, () => Array(SIZE).fill(null));
    score = 0; moves = 0; idc = 0; won = false;
    scoreEl.textContent = 0; movesEl.textContent = 0;
    tileMeshes.forEach(o => scene.remove(o.mesh));
    tileMeshes.clear();
    overlay.classList.remove('show');
    addRandom(); addRandom();
    syncMeshes();
    statusEl.innerHTML = 'Merge tiles to reach <strong>2048</strong>.';
  }

  function addRandom() {
    const empty = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!grid[r][c]) empty.push({r, c});
    if (!empty.length) return;
    const {r, c} = empty[Math.floor(Math.random() * empty.length)];
    grid[r][c] = {value: Math.random() < 0.9 ? 2 : 4, id: ++idc, isNew: true};
  }

  function syncMeshes() {
    const present = new Set();
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const cell = grid[r][c];
      if (!cell) continue;
      present.add(cell.id);
      let entry = tileMeshes.get(cell.id);
      const targetPos = new THREE.Vector3(cellX(c), 0.55, cellZ(r));
      if (!entry) {
        const mesh = makeTileMesh(cell.value);
        mesh.position.copy(targetPos);
        if (cell.isNew) mesh.scale.setScalar(0.01);
        scene.add(mesh);
        entry = {mesh, target: targetPos.clone(), pop: cell.merged ? 1 : 0};
        tileMeshes.set(cell.id, entry);
      } else {
        entry.target.copy(targetPos);
        if (entry.mesh.userData.value !== cell.value) {
          // value changed (merge target) → swap texture + pop
          swapTileValue(entry.mesh, cell.value);
          entry.pop = 1;
        }
        if (cell.merged) entry.pop = 1;
      }
      cell.isNew = false; cell.merged = false;
    }
    // remove meshes no longer present
    for (const [id, entry] of tileMeshes) {
      if (!present.has(id)) { scene.remove(entry.mesh); tileMeshes.delete(id); }
    }
  }

  function swapTileValue(mesh, value) {
    mesh.userData.value = value;
    const topTex = tileTexture(value);
    const sideColor = tileColorHex(value).multiplyScalar(0.75);
    mesh.material[2].map = topTex; mesh.material[2].needsUpdate = true;
    [0,1,3,4,5].forEach(i => { mesh.material[i].color.copy(sideColor); mesh.material[i].needsUpdate = true; });
  }

  // ---- move logic (same as 2D) ----
  function slideLeft(row) {
    const f = row.filter(c => c); const res = []; let gained = 0; let i = 0;
    while (i < f.length) {
      if (i + 1 < f.length && f[i].value === f[i + 1].value) {
        const nv = f[i].value * 2;
        res.push({value: nv, id: f[i].id, merged: true});
        gained += nv; i += 2;
      } else { res.push(f[i]); i++; }
    }
    while (res.length < SIZE) res.push(null);
    return {row: res, gained};
  }
  function rotateCW(g) {
    const r = Array.from({length: SIZE}, () => Array(SIZE).fill(null));
    for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE; j++) r[j][SIZE - 1 - i] = g[i][j];
    return r;
  }
  function sameRow(a, b) {
    for (let i = 0; i < a.length; i++) { const av = a[i]?a[i].value:null, bv = b[i]?b[i].value:null; if (av !== bv) return false; }
    return true;
  }

  function move(dir) {
    let g = grid.map(r => r.slice());
    const k = {left:0, down:1, right:2, up:3}[dir];
    for (let i = 0; i < k; i++) g = rotateCW(g);
    let gained = 0, changed = false;
    const ng = [];
    for (let r = 0; r < SIZE; r++) { const {row, gained:gg} = slideLeft(g[r]); ng.push(row); gained += gg; if (!sameRow(g[r], row)) changed = true; }
    let final = ng;
    for (let i = 0; i < (4 - k) % 4; i++) final = rotateCW(final);
    if (!changed) return;

    grid = final;
    score += gained; moves++;
    scoreEl.textContent = score; movesEl.textContent = moves;
    if (score > best) { best = score; localStorage.setItem('2048-3d-best', best); bestEl.textContent = best; }
    addRandom();
    syncMeshes();

    if (!won && grid.some(row => row.some(c => c && c.value >= 2048))) { won = true; statusEl.innerHTML = 'You reached <strong>2048</strong>! Keep going.'; }
    if (isGameOver()) {
      overTitle.textContent = won ? '🏆 Great Run!' : 'Game Over';
      overMsg.textContent = `${score} points in ${moves} moves.`;
      overlay.classList.add('show');
    }
  }

  function isGameOver() {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      if (!grid[r][c]) return false;
      const v = grid[r][c].value;
      if (c + 1 < SIZE && grid[r][c+1] && grid[r][c+1].value === v) return false;
      if (r + 1 < SIZE && grid[r+1][c] && grid[r+1][c].value === v) return false;
    }
    return true;
  }

  // ---- animation ----

  // keep newly-created meshes visually consistent
  let __polishTick = 0;
  function __polish() {
    if (window.SceneKit && (__polishTick++ % 30 === 0)) SceneKit.polishMaterials(scene);
  }

  function animate() {
    tileMeshes.forEach(entry => {
      entry.mesh.position.lerp(entry.target, 0.3);
      const targetScale = 1 + (entry.pop > 0 ? Math.sin(entry.pop * Math.PI) * 0.18 : 0);
      const cur = entry.mesh.scale.x;
      entry.mesh.scale.setScalar(THREE.MathUtils.lerp(cur, targetScale, 0.35));
      if (entry.pop > 0) { entry.pop -= 0.06; if (entry.pop < 0) entry.pop = 0; }
    });
    __polish();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  // ---- input ----
  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (['arrowleft','a'].includes(k)) { e.preventDefault(); move('left'); }
    else if (['arrowright','d'].includes(k)) { e.preventDefault(); move('right'); }
    else if (['arrowup','w'].includes(k)) { e.preventDefault(); move('up'); }
    else if (['arrowdown','s'].includes(k)) { e.preventDefault(); move('down'); }
  });
  document.querySelectorAll('.dpad-btn').forEach(b => b.addEventListener('click', () => move(b.dataset.d)));
  let ts = null;
  container.addEventListener('touchstart', e => { ts = {x: e.touches[0].clientX, y: e.touches[0].clientY}; }, {passive: true});
  container.addEventListener('touchend', e => {
    if (!ts) return;
    const t = e.changedTouches[0]; const dx = t.clientX - ts.x, dy = t.clientY - ts.y;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left'); else move(dy > 0 ? 'down' : 'up');
    ts = null;
  });

  document.getElementById('newBtn').addEventListener('click', newGame);
  document.getElementById('restartOverlay').addEventListener('click', newGame);

  newGame();
  animate();
})();
