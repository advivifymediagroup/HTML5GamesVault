(() => {
  if (window.__hasWebGL === false) return;
  const COLS = 10, ROWS = 20;
  const container = document.getElementById('game3d');
  const scoreEl = document.getElementById('score');
  const linesEl = document.getElementById('lines');
  const levelEl = document.getElementById('level');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  const SHAPES = {
    I: {color: 0x06d4f7, cells: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]]},
    O: {color: 0xfde047, cells: [[1,1],[1,1]]},
    T: {color: 0xa855f7, cells: [[0,1,0],[1,1,1],[0,0,0]]},
    S: {color: 0x22c55e, cells: [[0,1,1],[1,1,0],[0,0,0]]},
    Z: {color: 0xef4444, cells: [[1,1,0],[0,1,1],[0,0,0]]},
    J: {color: 0x3b82f6, cells: [[1,0,0],[1,1,1],[0,0,0]]},
    L: {color: 0xf97316, cells: [[0,0,1],[1,1,1],[0,0,0]]}
  };
  const KEYS = Object.keys(SHAPES);

  // ---- Three.js ----
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a25);
  scene.fog = new THREE.Fog(0x0a0a25, 30, 60);

  const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 0, 26);
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

  scene.add(new THREE.AmbientLight(0x9099cc, 0.7));
  const sun = new THREE.DirectionalLight(0xffffff, 0.85);
  sun.position.set(-8, 12, 20); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -14; sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22;
  scene.add(sun);
  scene.add(new THREE.PointLight(0x8b5cf6, 0.4, 60));

  // playfield group centered
  const field = new THREE.Group();
  field.position.set(-(COLS - 1) / 2, (ROWS - 1) / 2, 0);
  scene.add(field);

  // back wall + frame
  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(COLS + 0.4, ROWS + 0.4),
    new THREE.MeshStandardMaterial({color: 0x141234, roughness: 0.95})
  );
  backWall.position.set((COLS - 1) / 2, -(ROWS - 1) / 2, -0.6);
  backWall.receiveShadow = true;
  field.add(backWall);
  const frameMat = new THREE.MeshStandardMaterial({color: 0x8b5cf6, emissive: 0x6d28d9, emissiveIntensity: 0.5, roughness: 0.4});
  const fw = COLS, fh = ROWS;
  [[-0.7, (fh-1)/2*-1 + (fh-1)/2, 0.6, fh + 1.2, 'v'], [fw - 0.3, 0, 0.6, fh + 1.2, 'v']].forEach(() => {});
  function addBar(x, y, w, h) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1), frameMat);
    bar.position.set(x, y, 0); bar.castShadow = true; field.add(bar);
  }
  addBar(-0.7, -(ROWS - 1) / 2, 0.5, ROWS + 1.4);
  addBar(COLS - 0.3, -(ROWS - 1) / 2, 0.5, ROWS + 1.4);
  addBar((COLS - 1) / 2, 0.7, COLS + 1.4, 0.5);
  addBar((COLS - 1) / 2, -ROWS + 0.3, COLS + 1.4, 0.5);

  // cube factory
  const cubeGeo = new THREE.BoxGeometry(0.92, 0.92, 0.92);
  function makeCube(color) {
    const mat = new THREE.MeshStandardMaterial({color, roughness: 0.4, metalness: 0.15, emissive: color, emissiveIntensity: 0.12});
    const m = new THREE.Mesh(cubeGeo, mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function cellPos(col, row) { return {x: col, y: -row}; }

  // ---- Game state ----
  let grid, piece, nextPiece, cubeGrid, pieceCubes, ghostCubes;
  let score, lines, level, gravityMs, dropAcc, lastTime, paused, running;

  function emptyGrid() { return Array.from({length: ROWS}, () => Array(COLS).fill(null)); }
  function randPiece() {
    const k = KEYS[Math.floor(Math.random() * KEYS.length)];
    const s = SHAPES[k];
    return {kind: k, color: s.color, cells: s.cells.map(r => r.slice()), x: Math.floor((COLS - s.cells[0].length) / 2), y: 0};
  }
  function rotate(p) {
    const n = p.cells.length;
    const r = Array.from({length: n}, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) r[j][n - 1 - i] = p.cells[i][j];
    return r;
  }
  function valid(p, ox = 0, oy = 0, cells = p.cells) {
    for (let i = 0; i < cells.length; i++) for (let j = 0; j < cells[i].length; j++) {
      if (!cells[i][j]) continue;
      const x = p.x + j + ox, y = p.y + i + oy;
      if (x < 0 || x >= COLS || y >= ROWS) return false;
      if (y >= 0 && grid[y][x]) return false;
    }
    return true;
  }

  function clearMeshGrid() {
    if (cubeGrid) cubeGrid.forEach(row => row.forEach(m => { if (m) field.remove(m); }));
    cubeGrid = Array.from({length: ROWS}, () => Array(COLS).fill(null));
  }

  function merge() {
    piece.cells.forEach((row, i) => row.forEach((v, j) => {
      if (v) {
        const y = piece.y + i, x = piece.x + j;
        if (y >= 0) {
          grid[y][x] = piece.color;
          const cube = makeCube(piece.color);
          const p = cellPos(x, y); cube.position.set(p.x, p.y, 0);
          field.add(cube); cubeGrid[y][x] = cube;
        }
      }
    }));
  }

  let flashCells = [];
  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r].every(c => c !== null)) {
        // flash then remove
        for (let c = 0; c < COLS; c++) { if (cubeGrid[r][c]) flashCells.push(cubeGrid[r][c]); }
        grid.splice(r, 1); grid.unshift(Array(COLS).fill(null));
        // remove meshes on this row
        for (let c = 0; c < COLS; c++) { if (cubeGrid[r][c]) field.remove(cubeGrid[r][c]); }
        cubeGrid.splice(r, 1); cubeGrid.unshift(Array(COLS).fill(null));
        cleared++; r++;
      }
    }
    if (cleared) {
      score += [0, 100, 300, 500, 800][cleared] * level;
      lines += cleared;
      const nl = Math.floor(lines / 10) + 1;
      if (nl !== level) { level = nl; gravityMs = Math.max(120, 1100 - (level - 1) * 70); }
      scoreEl.textContent = score; linesEl.textContent = lines; levelEl.textContent = level;
      if (cleared === 4) statusEl.innerHTML = 'Tetris!';
      // reposition all cubes to match shifted grid
      repositionCubes();
    }
  }
  function repositionCubes() {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cube = cubeGrid[r][c];
      if (cube) { const p = cellPos(c, r); cube.position.set(p.x, p.y, 0); }
    }
  }

  function spawn() {
    piece = nextPiece; nextPiece = randPiece();
    buildPieceCubes();
    if (!valid(piece)) gameOver();
  }

  function buildPieceCubes() {
    if (pieceCubes) pieceCubes.forEach(m => field.remove(m.cube));
    pieceCubes = [];
    piece.cells.forEach((row, i) => row.forEach((v, j) => {
      if (v) { const cube = makeCube(piece.color); field.add(cube); pieceCubes.push({cube, i, j}); }
    }));
    if (ghostCubes) ghostCubes.forEach(m => field.remove(m.cube));
    ghostCubes = [];
    piece.cells.forEach((row, i) => row.forEach((v, j) => {
      if (v) {
        const gm = new THREE.Mesh(cubeGeo, new THREE.MeshStandardMaterial({color: piece.color, transparent: true, opacity: 0.18, roughness: 0.6}));
        field.add(gm); ghostCubes.push({cube: gm, i, j});
      }
    }));
  }
  function rebuildPieceCubes() { buildPieceCubes(); }

  function updatePieceMeshes() {
    if (!pieceCubes) return;
    // rebuild if count mismatched (after rotation the active cells positions differ but count same for a tetromino)
    let gy = piece.y;
    while (valid(piece, 0, gy - piece.y + 1)) gy++;
    let idx = 0, gidx = 0;
    // We rebuild mapping each frame based on current cells
    const active = [];
    piece.cells.forEach((row, i) => row.forEach((v, j) => { if (v) active.push({i, j}); }));
    // ensure counts match
    if (active.length !== pieceCubes.length) { rebuildPieceCubes(); }
    active.forEach((a, n) => {
      const p = cellPos(piece.x + a.j, piece.y + a.i);
      if (pieceCubes[n]) pieceCubes[n].cube.position.set(p.x, p.y, 0);
      const gp = cellPos(piece.x + a.j, gy + a.i);
      if (ghostCubes[n]) ghostCubes[n].cube.position.set(gp.x, gp.y, 0);
    });
  }

  function hardDrop() { while (valid(piece, 0, 1)) piece.y++; lock(); }
  function lock() { merge(); clearLines(); spawn(); }
  function step(dt) {
    dropAcc += dt;
    if (dropAcc >= gravityMs) { dropAcc = 0; if (valid(piece, 0, 1)) piece.y++; else lock(); }
  }

  function start() {
    grid = emptyGrid(); clearMeshGrid();
    score = 0; lines = 0; level = 1; gravityMs = 1100; dropAcc = 0; lastTime = 0;
    paused = false; running = true;
    scoreEl.textContent = 0; linesEl.textContent = 0; levelEl.textContent = 1;
    nextPiece = randPiece(); spawn();
    overlay.classList.remove('show');
    statusEl.innerHTML = 'Stack the blocks. Clear lines.';
  }
  function gameOver() {
    running = false;
    overTitle.textContent = 'Game Over';
    overMsg.textContent = `Score ${score} · Lines ${lines} · Level ${level}`;
    overlay.classList.add('show');
    statusEl.innerHTML = 'Topped out.';
  }

  let clock = new THREE.Clock();

  // keep newly-created meshes visually consistent
  let __polishTick = 0;
  function __polish() {
    if (window.SceneKit && (__polishTick++ % 30 === 0)) SceneKit.polishMaterials(scene);
  }

  function animate() {
    const dt = Math.min(clock.getDelta(), 0.05) * 1000;
    if (running && !paused) { step(dt); }
    updatePieceMeshes();
    // flash fade
    for (let i = flashCells.length - 1; i >= 0; i--) {
      const m = flashCells[i];
      m.material.emissiveIntensity = 1.2;
    }
    flashCells = [];
    __polish();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  document.addEventListener('keydown', e => {
    if (!running && e.key !== ' ') return;
    const k = e.key.toLowerCase();
    if (['arrowleft','a'].includes(k)) { e.preventDefault(); if (valid(piece, -1, 0)) piece.x--; }
    else if (['arrowright','d'].includes(k)) { e.preventDefault(); if (valid(piece, 1, 0)) piece.x++; }
    else if (['arrowdown','s'].includes(k)) { e.preventDefault(); if (valid(piece, 0, 1)) { piece.y++; score += 1; scoreEl.textContent = score; } }
    else if (['arrowup','x'].includes(k)) {
      e.preventDefault();
      const rot = rotate(piece);
      for (const dx of [0, -1, 1, -2, 2]) { if (valid(piece, dx, 0, rot)) { piece.cells = rot; piece.x += dx; rebuildPieceCubes(); break; } }
    }
    else if (e.key === ' ') { e.preventDefault(); if (!running) start(); else hardDrop(); }
    else if (k === 'p') { e.preventDefault(); paused = !paused; }
  });

  // touch: tap zones — left/right thirds move, top rotates, swipe down hard drop
  let ts = null;
  container.addEventListener('touchstart', e => { ts = {x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now()}; }, {passive: true});
  container.addEventListener('touchend', e => {
    if (!ts || !running) { ts = null; return; }
    const t = e.changedTouches[0]; const dx = t.clientX - ts.x, dy = t.clientY - ts.y;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
      // tap → rotate
      const rot = rotate(piece);
      for (const k of [0, -1, 1, -2, 2]) { if (valid(piece, k, 0, rot)) { piece.cells = rot; piece.x += k; rebuildPieceCubes(); break; } }
    } else if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) { if (valid(piece, 1, 0)) piece.x++; } else { if (valid(piece, -1, 0)) piece.x--; }
    } else if (dy > 40) { hardDrop(); }
    ts = null;
  });

  document.getElementById('startBtn').addEventListener('click', start);
  document.getElementById('pauseBtn').addEventListener('click', () => { if (running) paused = !paused; });
  document.getElementById('restartOverlay').addEventListener('click', start);

  // idle scene
  grid = emptyGrid(); clearMeshGrid();
  nextPiece = randPiece(); piece = randPiece(); buildPieceCubes();
  running = false;
  animate();
})();
