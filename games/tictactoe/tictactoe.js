(() => {
  if (window.__hasWebGL === false) return;
  const container = document.getElementById('game3d');
  const winsXEl = document.getElementById('winsX');
  const winsOEl = document.getElementById('winsO');
  const drawsEl = document.getElementById('draws');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');
  const diffSel = document.getElementById('difficulty');

  const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a25);
  scene.fog = new THREE.Fog(0x0a0a25, 20, 44);

  const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 11.6, 0.01);
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

  scene.add(new THREE.AmbientLight(0x8899cc, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 0.95);
  sun.position.set(-6, 16, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -10; sun.shadow.camera.right = 10;
  sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10;
  scene.add(sun);

  // board base
  const base = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.6, 9.5), new THREE.MeshStandardMaterial({color: 0x1e1b4b, roughness: 0.8}));
  base.position.y = -0.35; base.receiveShadow = true; scene.add(base);

  const CELL = 3;
  const cellCenters = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cellCenters.push({x: (c - 1) * CELL, z: (r - 1) * CELL});

  // cell tiles (clickable)
  const tiles = [];
  const tileGeo = new THREE.BoxGeometry(2.7, 0.25, 2.7);
  cellCenters.forEach((cc, i) => {
    const mat = new THREE.MeshStandardMaterial({color: 0x27235c, roughness: 0.6, metalness: 0.1});
    const t = new THREE.Mesh(tileGeo, mat);
    t.position.set(cc.x, 0, cc.z);
    t.receiveShadow = true;
    t.userData.index = i;
    scene.add(t);
    tiles.push(t);
  });

  // grid ridges (neon)
  const ridgeMat = new THREE.MeshStandardMaterial({color: 0x8b5cf6, emissive: 0x8b5cf6, emissiveIntensity: 0.6, roughness: 0.4});
  [-1.5, 1.5].forEach(x => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.35, 9), ridgeMat); m.position.set(x, 0.12, 0); m.castShadow = true; scene.add(m); });
  [-1.5, 1.5].forEach(z => { const m = new THREE.Mesh(new THREE.BoxGeometry(9, 0.35, 0.16), ridgeMat); m.position.set(0, 0.12, z); m.castShadow = true; scene.add(m); });

  // ---- Piece factories ----
  function makeX() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({color: 0x06d4f7, emissive: 0x0369a1, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0.55});
    const bar1 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 0.55), mat);
    const bar2 = bar1.clone();
    bar1.rotation.y = Math.PI / 4; bar2.rotation.y = -Math.PI / 4;
    bar1.castShadow = bar2.castShadow = true;
    g.add(bar1, bar2);
    return g;
  }
  function makeO() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({color: 0xec4899, emissive: 0x9d174d, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0.4});
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.34, 16, 32), mat);
    ring.rotation.x = Math.PI / 2; ring.castShadow = true;
    g.add(ring);
    return g;
  }

  // ---- State ----
  let stateArr, turn, locked, roundOver;
  const pieces = new Array(9).fill(null);
  const wins = {X: 0, O: 0, D: 0};
  const anims = [];   // {mesh, t, fromY, toY, spin}

  function newRound() {
    stateArr = new Array(9).fill(null);
    turn = 'X'; locked = false; roundOver = false;
    pieces.forEach((p, i) => { if (p) scene.remove(p); pieces[i] = null; });
    tiles.forEach(t => t.material.emissive.setHex(0x000000));
    overlay.classList.remove('show');
    statusEl.innerHTML = 'Your move — you play <strong>X</strong>.';
  }

  function placePiece(i, mark) {
    stateArr[i] = mark;
    const cc = cellCenters[i];
    const piece = mark === 'X' ? makeX() : makeO();
    piece.position.set(cc.x, 6, cc.z);
    piece.rotation.y = Math.PI;
    scene.add(piece);
    pieces[i] = piece;
    anims.push({mesh: piece, t: 0, fromY: 6, toY: mark === 'X' ? 0.5 : 0.9, spin: mark === 'X' ? Math.PI * 2 + Math.PI / 4 : Math.PI * 2});
  }

  function humanMove(i) {
    if (locked || roundOver || stateArr[i] || turn !== 'X') return;
    placePiece(i, 'X');
    if (!checkEnd()) {
      turn = 'O'; locked = true;
      statusEl.innerHTML = 'AI thinking...';
      setTimeout(() => {
        const m = pickAI();
        placePiece(m, 'O');
        locked = false;
        if (!checkEnd()) { turn = 'X'; statusEl.innerHTML = 'Your move.'; }
      }, 480);
    }
  }

  function checkEnd() {
    for (const line of LINES) {
      const [a,b,c] = line;
      if (stateArr[a] && stateArr[a] === stateArr[b] && stateArr[a] === stateArr[c]) {
        line.forEach(idx => tiles[idx].material.emissive.setHex(0x22c55e));
        endRound(stateArr[a], line);
        return true;
      }
    }
    if (stateArr.every(v => v)) { endRound('D', null); return true; }
    return false;
  }

  function endRound(result, line) {
    roundOver = true; locked = true;
    if (result === 'X') { wins.X++; winsXEl.textContent = wins.X; overTitle.textContent = 'You Win!'; overMsg.textContent = 'Take that, AI.'; statusEl.innerHTML = 'You won.'; }
    else if (result === 'O') { wins.O++; winsOEl.textContent = wins.O; overTitle.textContent = 'AI Wins'; overMsg.textContent = 'Try a lower difficulty?'; statusEl.innerHTML = 'AI won.'; }
    else { wins.D++; drawsEl.textContent = wins.D; overTitle.textContent = 'Draw'; overMsg.textContent = 'Even match.'; statusEl.innerHTML = 'Draw.'; }
    if (line) line.forEach(idx => { if (pieces[idx]) anims.push({mesh: pieces[idx], t: 0, pulse: true}); });
    setTimeout(() => overlay.classList.add('show'), 650);
  }

  // ---- AI (same brains as 2D) ----
  function pickAI() {
    const diff = diffSel.value;
    const empty = stateArr.map((v,i)=>v?null:i).filter(i=>i!==null);
    if (diff === 'easy') {
      if (Math.random() < 0.5) return empty[Math.floor(Math.random()*empty.length)];
    }
    if (diff === 'easy' || diff === 'medium') {
      for (const i of empty) { const c = stateArr.slice(); c[i]='O'; if (winnerOf(c)==='O') return i; }
      for (const i of empty) { const c = stateArr.slice(); c[i]='X'; if (winnerOf(c)==='X') return i; }
      if (diff === 'medium') {
        if (stateArr[4] === null) return 4;
        const corners = [0,2,6,8].filter(i=>!stateArr[i]);
        if (corners.length) return corners[Math.floor(Math.random()*corners.length)];
      }
      return empty[Math.floor(Math.random()*empty.length)];
    }
    // hard minimax
    let bestScore = -Infinity, bestMove = empty[0];
    for (const i of empty) { const c = stateArr.slice(); c[i]='O'; const s = minimax(c, false); if (s > bestScore) { bestScore = s; bestMove = i; } }
    return bestMove;
  }
  function winnerOf(s) { for (const [a,b,c] of LINES) if (s[a] && s[a]===s[b] && s[a]===s[c]) return s[a]; return s.every(v=>v)?'D':null; }
  function minimax(s, isMax) {
    const w = winnerOf(s);
    if (w === 'O') return 10; if (w === 'X') return -10; if (w === 'D') return 0;
    const empty = s.map((v,i)=>v?null:i).filter(i=>i!==null);
    let best = isMax ? -Infinity : Infinity;
    for (const i of empty) { const c = s.slice(); c[i] = isMax?'O':'X'; const sc = minimax(c, !isMax); best = isMax ? Math.max(best, sc) : Math.min(best, sc); }
    return best;
  }

  // ---- Interaction ----
  const raycaster = new THREE.Raycaster();
  function pick(clientX, clientY) {
    if (locked || roundOver) return;
    const rect = container.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX-rect.left)/rect.width)*2-1, -(((clientY-rect.top)/rect.height)*2-1));
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(tiles);
    if (hits.length) humanMove(hits[0].object.userData.index);
  }
  container.addEventListener('click', e => pick(e.clientX, e.clientY));
  container.addEventListener('touchstart', e => { e.preventDefault(); const t = e.touches[0]; pick(t.clientX, t.clientY); }, {passive: false});

  // hover highlight
  container.addEventListener('mousemove', e => {
    if (locked || roundOver) return;
    const rect = container.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2-1, -(((e.clientY-rect.top)/rect.height)*2-1));
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(tiles);
    tiles.forEach((t, i) => { if (!stateArr || !stateArr[i]) t.material.emissive.setHex(0x000000); });
    if (hits.length) { const i = hits[0].object.userData.index; if (!stateArr[i]) tiles[i].material.emissive.setHex(0x312e81); }
  });

  // keep newly-created meshes visually consistent
  let __polishTick = 0;
  function __polish() {
    if (window.SceneKit && (__polishTick++ % 30 === 0)) SceneKit.polishMaterials(scene);
  }


  function animate() {
    // piece drop / spin / pulse animations
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i];
      a.t += 0.06;
      if (a.pulse) {
        a.mesh.scale.setScalar(1 + Math.sin(a.t * 4) * 0.12);
        if (a.t > 3) { a.mesh.scale.setScalar(1); anims.splice(i, 1); }
      } else {
        const t = Math.min(1, a.t);
        const ease = 1 - Math.pow(1 - t, 3);
        a.mesh.position.y = THREE.MathUtils.lerp(a.fromY, a.toY, ease);
        a.mesh.rotation.y = Math.PI + a.spin * ease;
        if (t >= 1) anims.splice(i, 1);
      }
    }
    // gentle idle spin on O rings not animating
    __polish();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  document.getElementById('newBtn').addEventListener('click', newRound);
  document.getElementById('restartOverlay').addEventListener('click', newRound);
  diffSel.addEventListener('change', newRound);

  newRound();
  animate();
})();
