(() => {
  if (window.__hasWebGL === false) return;
  const container = document.getElementById('game3d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const timeEl = document.getElementById('time');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');
  const diffSel = document.getElementById('difficulty');

  const SETTINGS = {
    easy:   {spawn: 1300, life: 1500, bomb: 0.03},
    medium: {spawn: 950,  life: 1100, bomb: 0.08},
    hard:   {spawn: 650,  life: 800,  bomb: 0.15}
  };

  // ---- Three.js ----
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a1a2a);
  scene.fog = new THREE.Fog(0x0a1a2a, 22, 44);

  const camera = new THREE.PerspectiveCamera(48, container.clientWidth / container.clientHeight, 0.1, 100);
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

  scene.add(new THREE.AmbientLight(0xaabbdd, 0.7));
  const sun = new THREE.DirectionalLight(0xffffff, 0.95);
  sun.position.set(-6, 16, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -10; sun.shadow.camera.right = 10;
  sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10;
  scene.add(sun);

  // lawn
  const lawn = new THREE.Mesh(new THREE.BoxGeometry(14, 1, 14), new THREE.MeshStandardMaterial({color: 0x15803d, roughness: 0.95}));
  lawn.position.y = -1; lawn.receiveShadow = true; scene.add(lawn);
  const lawnTop = new THREE.Mesh(new THREE.CircleGeometry(6.6, 40), new THREE.MeshStandardMaterial({color: 0x16a34a, roughness: 1}));
  lawnTop.rotation.x = -Math.PI / 2; lawnTop.position.y = -0.49; lawnTop.receiveShadow = true; scene.add(lawnTop);

  const GRID = 3, SPACING = 3.4;
  const holes = [];   // {group, mole, moleGroup, base, up, type, mesh:{body,...}, hideAt}

  // mole factory
  function makeMole() {
    const g = new THREE.Group();
    const furMat = new THREE.MeshStandardMaterial({color: 0x8b5a2b, roughness: 0.7});
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 20, 16), furMat);
    body.scale.set(1, 1.15, 1); body.castShadow = true; g.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), new THREE.MeshStandardMaterial({color: 0xd9b38c, roughness: 0.8}));
    belly.position.set(0, -0.1, 0.55); belly.scale.set(0.9, 1, 0.5); g.add(belly);
    // snout
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), new THREE.MeshStandardMaterial({color: 0xf3c9a0, roughness: 0.7}));
    snout.position.set(0, 0.05, 0.82); snout.scale.set(1, 0.8, 0.8); g.add(snout);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({color: 0xec4899, roughness: 0.4}));
    nose.position.set(0, 0.05, 1.1); g.add(nose);
    // eyes
    function eye(sx) {
      const e = new THREE.Group();
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshStandardMaterial({color: 0xffffff}));
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshStandardMaterial({color: 0x111111}));
      p.position.z = 0.1; e.add(w, p); e.position.set(sx, 0.4, 0.66); return e;
    }
    g.add(eye(-0.28), eye(0.28));
    // ears
    const earMat = new THREE.MeshStandardMaterial({color: 0x6b4423, roughness: 0.7});
    const earL = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), earMat); earL.position.set(-0.55, 0.75, 0); earL.scale.set(1, 1, 0.4);
    const earR = earL.clone(); earR.position.x = 0.55; g.add(earL, earR);
    // paws
    const pawMat = new THREE.MeshStandardMaterial({color: 0xf3c9a0, roughness: 0.7});
    const pawL = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), pawMat); pawL.position.set(-0.5, -0.7, 0.6);
    const pawR = pawL.clone(); pawR.position.x = 0.5; g.add(pawL, pawR);
    return {group: g, kind: 'mole'};
  }
  function tintMoleGold(mole) {
    mole.group.children[0].material.color.setHex(0xfbbf24);
    mole.group.children[0].material.emissive = new THREE.Color(0xf59e0b);
    mole.group.children[0].material.emissiveIntensity = 0.4;
  }
  function makeBomb() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.85, 20, 16), new THREE.MeshStandardMaterial({color: 0x1f2937, roughness: 0.5, metalness: 0.5}));
    body.castShadow = true; g.add(body);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.4, 12), new THREE.MeshStandardMaterial({color: 0x374151}));
    cap.position.y = 0.85; g.add(cap);
    const fuse = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshStandardMaterial({color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 1}));
    fuse.position.y = 1.2; g.add(fuse);
    return {group: g, kind: 'bomb'};
  }

  // build holes
  for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
    const hg = new THREE.Group();
    hg.position.set((c - 1) * SPACING, -0.45, (r - 1) * SPACING);
    // dirt mound / hole ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.35, 12, 24), new THREE.MeshStandardMaterial({color: 0x5c4033, roughness: 1}));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; ring.receiveShadow = true; hg.add(ring);
    const holeDark = new THREE.Mesh(new THREE.CircleGeometry(1.0, 24), new THREE.MeshStandardMaterial({color: 0x1a0f08, roughness: 1}));
    holeDark.rotation.x = -Math.PI / 2; holeDark.position.y = 0.03; hg.add(holeDark);
    // clip container so mole hides below ground
    const moleHolder = new THREE.Group();
    moleHolder.position.y = -1.6;   // hidden
    hg.add(moleHolder);
    scene.add(hg);
    holes.push({group: hg, holder: moleHolder, occupant: null, kind: null, up: false, y: -1.6, targetY: -1.6, hideAt: 0, whack: 0});
  }

  // hammer
  const hammer = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 10), new THREE.MeshStandardMaterial({color: 0x92400e, roughness: 0.7}));
  handle.position.y = 1; hammer.add(handle);
  const headH = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.8), new THREE.MeshStandardMaterial({color: 0x64748b, roughness: 0.4, metalness: 0.6}));
  headH.position.y = 2.1; hammer.add(headH);
  hammer.rotation.z = -0.6; hammer.visible = false;
  hammer.scale.setScalar(0.85);
  scene.add(hammer);
  let hammerAnim = 0, hammerPos = new THREE.Vector3();

  // ---- state ----
  let score, best, timeLeft, running, spawnTimer, countdownId, lastSpawn;
  best = +localStorage.getItem('wm3d-best') || 0;
  bestEl.textContent = best;

  function newGame() {
    score = 0; timeLeft = 30; running = true;
    scoreEl.textContent = 0; timeEl.textContent = 30;
    holes.forEach(h => { clearOccupant(h); });
    overlay.classList.remove('show');
    statusEl.innerHTML = 'Go!';
    lastSpawn = 0;
    clearInterval(countdownId);
    countdownId = setInterval(() => { if (!running) return; timeLeft--; timeEl.textContent = timeLeft; if (timeLeft <= 0) endGame(false); }, 1000);
  }

  function clearOccupant(h) {
    if (h.occupant) h.holder.remove(h.occupant.group);
    h.occupant = null; h.kind = null; h.up = false; h.targetY = -1.6;
  }

  function spawn() {
    const cfg = SETTINGS[diffSel.value];
    const empties = holes.filter(h => !h.occupant);
    if (!empties.length) return;
    const h = empties[Math.floor(Math.random() * empties.length)];
    const rnd = Math.random();
    let occ;
    if (rnd < cfg.bomb) { occ = makeBomb(); h.kind = 'bomb'; }
    else if (rnd < cfg.bomb + 0.08) { occ = makeMole(); tintMoleGold(occ); h.kind = 'gold'; }
    else { occ = makeMole(); h.kind = 'mole'; }
    occ.group.position.y = 0;
    h.holder.add(occ.group);
    h.occupant = occ; h.up = true; h.targetY = 0.35;
    h.hideAt = performance.now() + cfg.life;
  }

  function hitHole(h) {
    if (!running || !h.occupant || !h.up) return;
    if (h.kind === 'bomb') {
      swingHammer(h);
      endGame(true);
      return;
    }
    const pts = h.kind === 'gold' ? 30 : 10;
    score += pts; scoreEl.textContent = score;
    swingHammer(h);
    // squash then hide
    h.up = false; h.targetY = -1.6;
    setTimeout(() => clearOccupant(h), 160);
    statusEl.innerHTML = `+${pts}!`;
  }

  function swingHammer(h) {
    const wp = new THREE.Vector3(); h.group.getWorldPosition(wp);
    hammer.position.set(wp.x + 0.6, wp.y + 0.4, wp.z + 0.4);
    hammer.visible = true; hammerAnim = 1;
  }

  function endGame(bomb) {
    running = false;
    clearInterval(countdownId);
    if (score > best) { best = score; localStorage.setItem('wm3d-best', best); bestEl.textContent = best; overTitle.textContent = 'New Best!'; overMsg.textContent = `${score} points.`; }
    else { overTitle.textContent = bomb ? '💥 Boom!' : 'Time’s Up'; overMsg.textContent = `Final ${score} · Best ${best}.`; }
    overlay.classList.add('show');
    statusEl.innerHTML = bomb ? '💣 You hit a bomb.' : '⌛ Round complete.';
  }

  // ---- interaction ----
  const raycaster = new THREE.Raycaster();
  function pick(cx, cy) {
    if (!running) return;
    const rect = container.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -(((cy - rect.top) / rect.height) * 2 - 1));
    raycaster.setFromCamera(ndc, camera);
    // gather occupant meshes
    for (const h of holes) {
      if (h.occupant && h.up) {
        const hits = raycaster.intersectObject(h.occupant.group, true);
        if (hits.length) { hitHole(h); return; }
      }
    }
  }
  container.addEventListener('mousedown', e => pick(e.clientX, e.clientY));
  container.addEventListener('touchstart', e => { e.preventDefault(); const t = e.touches[0]; pick(t.clientX, t.clientY); }, {passive: false});

  const clock = new THREE.Clock();

  // keep newly-created meshes visually consistent
  let __polishTick = 0;
  function __polish() {
    if (window.SceneKit && (__polishTick++ % 30 === 0)) SceneKit.polishMaterials(scene);
  }

  function animate() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const now = performance.now();

    if (running) {
      const cfg = SETTINGS[diffSel.value];
      if (now - lastSpawn > cfg.spawn) { spawn(); lastSpawn = now; }
      // auto-hide expired
      holes.forEach(h => { if (h.occupant && h.up && now > h.hideAt) { h.up = false; h.targetY = -1.6; setTimeout(() => { if (!h.up) clearOccupant(h); }, 200); } });
    }

    // animate mole rise/fall + idle wiggle
    holes.forEach(h => {
      h.y += (h.targetY - h.y) * 0.2;
      h.holder.position.y = h.y;
      if (h.occupant && h.up) h.occupant.group.rotation.y = Math.sin(now * 0.004 + h.group.position.x) * 0.15;
    });

    // hammer swing
    if (hammerAnim > 0) {
      hammerAnim -= dt * 4;
      const a = 1 - hammerAnim;
      hammer.rotation.z = -0.6 - Math.sin(Math.min(1, a) * Math.PI) * 1.1;
      if (hammerAnim <= 0) hammer.visible = false;
    }

    __polish();

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  document.getElementById('startBtn').addEventListener('click', newGame);
  document.getElementById('restartOverlay').addEventListener('click', newGame);

  running = false;
  animate();
})();
