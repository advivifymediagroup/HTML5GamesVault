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

  // lighten/darken a hex colour by a signed amount, matching the shading
  // helper used elsewhere in the codebase's Canvas2D games
  function shadeHex(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const cl = v => Math.max(0, Math.min(255, v));
    return '#' + ((cl(((n >> 16) & 255) + amt) << 16) | (cl(((n >> 8) & 255) + amt) << 8) | cl((n & 255) + amt))
      .toString(16).padStart(6, '0');
  }

  // higher tiers glow brighter — tiles 128+ get a soft emissive bloom
  function tierGlow(value) {
    if (value < 128) return 0;
    return Math.min(1, 0.18 + Math.log2(value / 64) * 0.14);
  }

  function tileTexture(value) {
    if (texCache[value]) return texCache[value];
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const ctx = cv.getContext('2d');
    const base = TILE_COLORS[value] || '#8b5cf6';

    // glassy material: 3-stop diagonal gradient (dark corner -> base -> light corner)
    const grad = ctx.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, shadeHex(base, -28));
    grad.addColorStop(0.5, base);
    grad.addColorStop(1, shadeHex(base, 34));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    // beveled rim
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 250, 250);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 3;
    ctx.strokeRect(9, 9, 238, 238);

    // specular highlight oval in the upper-left
    const spec = ctx.createRadialGradient(80, 68, 4, 80, 68, 92);
    spec.addColorStop(0, 'rgba(255,255,255,0.55)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spec;
    ctx.beginPath(); ctx.ellipse(80, 68, 92, 60, -0.4, 0, Math.PI * 2); ctx.fill();

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
    const baseColor = tileColorHex(value);
    const sideColor = baseColor.clone().multiplyScalar(0.75);
    const glow = tierGlow(value);
    const sideMat = new THREE.MeshStandardMaterial({
      color: sideColor, roughness: 0.4, metalness: 0.2, emissive: baseColor.clone(), emissiveIntensity: glow
    });
    const topMat = new THREE.MeshStandardMaterial({
      map: topTex, roughness: 0.3, metalness: 0.12, emissive: baseColor.clone(), emissiveIntensity: glow
    });
    // BoxGeometry material order: +x,-x,+y,-y,+z,-z  → top is +y (index 2)
    const mats = [sideMat, sideMat, topMat, sideMat.clone(), sideMat, sideMat];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 1.8), mats);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.value = value;
    return mesh;
  }

  // ---- Game state ----
  let grid, score, best, moves, idc, won;
  const tileMeshes = new Map();   // id -> animated tile entry (see syncMeshes)
  const ghostMeshes = [];         // consumed tiles still sliding/fading into the survivor
  best = +localStorage.getItem('2048-3d-best') || 0;
  bestEl.textContent = best;

  // ---- milestone feedback: particle bursts + camera shake ----
  const particleTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  })();
  const particles = [];
  let shakeMag = 0;
  const camHome = camera.position.clone();

  function burst(x, z, colorHex, count) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({map: particleTex, color: colorHex, transparent: true, depthWrite: false});
      const spr = new THREE.Sprite(mat);
      spr.scale.setScalar(0.3 + Math.random() * 0.3);
      spr.position.set(x, 0.65, z);
      scene.add(spr);
      const ang = Math.random() * Math.PI * 2, spd = 0.03 + Math.random() * 0.07;
      particles.push({
        spr, vx: Math.cos(ang) * spd, vz: Math.sin(ang) * spd, vy: 0.05 + Math.random() * 0.06,
        life: 1, decay: 0.018 + Math.random() * 0.012
      });
    }
  }

  function milestoneFeedback(x, z, value) {
    const tier = Math.max(0, Math.log2(value / 4)); // 4->0, 8->1, ... 2048->9
    const count = Math.round(8 + tier * 3.2);
    shakeMag = Math.max(shakeMag, 0.06 + tier * 0.045);
    burst(x, z, TILE_COLORS[value] || '#8b5cf6', Math.min(48, count));
  }

  function newGame() {
    grid = Array.from({length: SIZE}, () => Array(SIZE).fill(null));
    score = 0; moves = 0; idc = 0; won = false;
    scoreEl.textContent = 0; movesEl.textContent = 0;
    tileMeshes.forEach(o => scene.remove(o.mesh));
    tileMeshes.clear();
    ghostMeshes.forEach(g => scene.remove(g.mesh));
    ghostMeshes.length = 0;
    particles.forEach(p => scene.remove(p.spr));
    particles.length = 0;
    shakeMag = 0; camera.position.copy(camHome); camera.lookAt(0, 0, 0);
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

  function syncMeshes(prevGrid, merges) {
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
        mesh.scale.setScalar(cell.isNew ? 0.01 : 1);
        scene.add(mesh);
        entry = {
          mesh, from: targetPos.clone(), to: targetPos.clone(), t: 1, moveDur: 8,
          phase: cell.isNew ? 'new' : 'idle', popT: 0, popDur: 9, newT: 0, newDur: 11, willPop: false
        };
        tileMeshes.set(cell.id, entry);
      } else {
        const moved = !entry.to.equals(targetPos);
        if (moved) {
          // phase one: slide from the old cell to the new one, eased out
          entry.from.copy(entry.mesh.position);
          entry.to.copy(targetPos);
          entry.t = 0;
          entry.phase = 'move';
        }
        if (entry.mesh.userData.value !== cell.value) {
          // value changed (merge survivor) → swap texture, pop plays once the slide lands
          swapTileValue(entry.mesh, cell.value);
          entry.willPop = true;
        }
        if (cell.merged && !moved) { entry.phase = 'pop'; entry.popT = 0; entry.willPop = false; }
      }
      cell.isNew = false; cell.merged = false;
    }
    // remove meshes no longer present (their value survives on the merge partner)
    for (const [id, entry] of tileMeshes) {
      if (!present.has(id)) { scene.remove(entry.mesh); tileMeshes.delete(id); }
    }
    // ghost tiles: the consumed half of each merge slides underneath the
    // surviving tile and fades out, so the merge reads as absorption
    if (merges) {
      for (const m of merges) {
        if (!m.fromPos || !m.toPos) continue;
        const gmesh = makeTileMesh(m.value / 2);
        gmesh.position.copy(m.fromPos);
        gmesh.material.forEach(mat => { mat.transparent = true; mat.opacity = 0.85; });
        scene.add(gmesh);
        ghostMeshes.push({mesh: gmesh, from: m.fromPos.clone(), to: m.toPos.clone(), t: 0, dur: 8});
      }
    }
  }

  function swapTileValue(mesh, value) {
    mesh.userData.value = value;
    const topTex = tileTexture(value);
    const baseColor = tileColorHex(value);
    const sideColor = baseColor.clone().multiplyScalar(0.75);
    const glow = tierGlow(value);
    mesh.material[2].map = topTex; mesh.material[2].needsUpdate = true;
    mesh.material[2].emissive.copy(baseColor); mesh.material[2].emissiveIntensity = glow;
    [0,1,3,4,5].forEach(i => {
      mesh.material[i].color.copy(sideColor);
      mesh.material[i].emissive.copy(baseColor);
      mesh.material[i].emissiveIntensity = glow;
      mesh.material[i].needsUpdate = true;
    });
  }

  // ---- move logic (same as 2D) ----
  function slideLeft(row) {
    const f = row.filter(c => c); const res = []; let gained = 0; let i = 0; const merges = [];
    while (i < f.length) {
      if (i + 1 < f.length && f[i].value === f[i + 1].value) {
        const nv = f[i].value * 2;
        res.push({value: nv, id: f[i].id, merged: true});
        merges.push({survivorId: f[i].id, loserId: f[i + 1].id, value: nv});
        gained += nv; i += 2;
      } else { res.push(f[i]); i++; }
    }
    while (res.length < SIZE) res.push(null);
    return {row: res, gained, merges};
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
    const prevGrid = grid;
    let g = grid.map(r => r.slice());
    const k = {left:0, down:1, right:2, up:3}[dir];
    for (let i = 0; i < k; i++) g = rotateCW(g);
    let gained = 0, changed = false;
    const ng = []; const merges = [];
    for (let r = 0; r < SIZE; r++) {
      const {row, gained: gg, merges: mg} = slideLeft(g[r]);
      ng.push(row); gained += gg; merges.push(...mg);
      if (!sameRow(g[r], row)) changed = true;
    }
    let final = ng;
    for (let i = 0; i < (4 - k) % 4; i++) final = rotateCW(final);
    if (!changed) return;

    grid = final;
    score += gained; moves++;
    scoreEl.textContent = score; movesEl.textContent = moves;
    if (score > best) { best = score; localStorage.setItem('2048-3d-best', best); bestEl.textContent = best; }

    // locate each merge's start (consumed tile, previous grid) and end
    // (survivor's new cell) position, and scale feedback with the merge value
    for (const m of merges) {
      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        if (prevGrid[r][c] && prevGrid[r][c].id === m.loserId) m.fromPos = new THREE.Vector3(cellX(c), 0.55, cellZ(r));
      }
      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] && grid[r][c].id === m.survivorId) {
          m.toPos = new THREE.Vector3(cellX(c), 0.55, cellZ(r));
          milestoneFeedback(m.toPos.x, m.toPos.z, m.value);
        }
      }
    }

    addRandom();
    syncMeshes(prevGrid, merges);

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

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeOutBack(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function animate() {
    // two-phase move: slide to the target cell, THEN merged tiles squash-pop
    // and freshly spawned tiles scale in with an ease-out-back overshoot
    tileMeshes.forEach(entry => {
      if (entry.phase === 'new') {
        entry.newT = Math.min(1, entry.newT + 1 / entry.newDur);
        entry.mesh.scale.setScalar(Math.max(0.01, easeOutBack(entry.newT)));
        entry.mesh.position.copy(entry.to);
        if (entry.newT >= 1) entry.phase = 'idle';
      } else if (entry.phase === 'move') {
        entry.t = Math.min(1, entry.t + 1 / entry.moveDur);
        entry.mesh.position.lerpVectors(entry.from, entry.to, easeOutCubic(entry.t));
        if (entry.t >= 1) {
          entry.mesh.position.copy(entry.to);
          if (entry.willPop) { entry.phase = 'pop'; entry.popT = 0; entry.willPop = false; }
          else entry.phase = 'idle';
        }
      } else if (entry.phase === 'pop') {
        entry.popT = Math.min(1, entry.popT + 1 / entry.popDur);
        entry.mesh.scale.setScalar(1 + Math.sin(entry.popT * Math.PI) * 0.22);
        if (entry.popT >= 1) { entry.mesh.scale.setScalar(1); entry.phase = 'idle'; }
      }
    });

    // ghost tiles: slide into the survivor's cell, dip slightly, and fade
    for (let i = ghostMeshes.length - 1; i >= 0; i--) {
      const gh = ghostMeshes[i];
      gh.t = Math.min(1, gh.t + 1 / gh.dur);
      gh.mesh.position.lerpVectors(gh.from, gh.to, easeOutCubic(gh.t));
      gh.mesh.position.y = 0.55 - gh.t * 0.1;
      const op = 0.85 * (1 - gh.t);
      gh.mesh.material.forEach(m => { m.opacity = op; });
      if (gh.t >= 1) { scene.remove(gh.mesh); ghostMeshes.splice(i, 1); }
    }

    // milestone particle bursts
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.spr.position.x += p.vx; p.spr.position.z += p.vz;
      p.spr.position.y += p.vy; p.vy -= 0.004;
      p.life -= p.decay;
      if (p.life <= 0) { scene.remove(p.spr); particles.splice(i, 1); continue; }
      p.spr.material.opacity = p.life;
    }

    // camera shake, magnitude set by milestoneFeedback and decaying each frame
    if (shakeMag > 0.001) {
      const ox = (Math.random() - 0.5) * shakeMag, oz = (Math.random() - 0.5) * shakeMag;
      camera.position.set(camHome.x + ox, camHome.y, camHome.z + oz);
      camera.lookAt(ox * 0.4, 0, oz * 0.4);
      shakeMag *= 0.82;
      if (shakeMag < 0.008) { shakeMag = 0; camera.position.copy(camHome); camera.lookAt(0, 0, 0); }
    }

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
    if (Math.abs(dx) < 26 && Math.abs(dy) < 26) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left'); else move(dy > 0 ? 'down' : 'up');
    ts = null;
  });

  document.getElementById('newBtn').addEventListener('click', newGame);
  document.getElementById('restartOverlay').addEventListener('click', newGame);

  newGame();
  animate();
})();
