(() => {
  if (window.__hasWebGL === false) return;
  const EMOJIS = ['🎮','🎲','🚀','🌟','🔥','⚡','💎','🎯','🎨','🎪','🌈','🦄'];
  const container = document.getElementById('game3d');
  const movesEl = document.getElementById('moves');
  const pairsEl = document.getElementById('pairs');
  const timeEl = document.getElementById('time');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');
  const diffSel = document.getElementById('difficulty');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a25);
  scene.fog = new THREE.Fog(0x0a0a25, 22, 44);

  const camera = new THREE.PerspectiveCamera(46, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 20.0, 0.01);
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

  scene.add(new THREE.AmbientLight(0x9099cc, 0.7));
  const sun = new THREE.DirectionalLight(0xffffff, 0.95);
  sun.position.set(-6, 16, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -12; sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -12;
  scene.add(sun);

  const table = new THREE.Mesh(new THREE.BoxGeometry(24, 0.6, 18), new THREE.MeshStandardMaterial({color: 0x1e1b4b, roughness: 0.85}));
  table.position.y = -0.4; table.receiveShadow = true; scene.add(table);

  // emoji face texture
  const faceCache = {};
  function faceTexture(emoji) {
    if (faceCache[emoji]) return faceCache[emoji];
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const ctx = cv.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 256, 256);
    g.addColorStop(0, '#34d399'); g.addColorStop(1, '#06d4f7');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    ctx.font = '150px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 128, 140);
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
    faceCache[emoji] = tex; return tex;
  }
  let backTex = null;
  function backTexture() {
    if (backTex) return backTex;
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const ctx = cv.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 256, 256);
    g.addColorStop(0, '#6366f1'); g.addColorStop(1, '#8b5cf6');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 8;
    ctx.strokeRect(24, 24, 208, 208);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 120px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 128, 140);
    backTex = new THREE.CanvasTexture(cv); backTex.anisotropy = 4; return backTex;
  }

  const CARD_W = 2.4, CARD_H = 3.0, CARD_T = 0.28;
  function makeCard(emoji) {
    const faceMat = new THREE.MeshStandardMaterial({map: faceTexture(emoji), roughness: 0.5});
    const backMat = new THREE.MeshStandardMaterial({map: backTexture(), roughness: 0.5});
    const edgeMat = new THREE.MeshStandardMaterial({color: 0x312e81, roughness: 0.6});
    // Card lies flat: width X, thin along Y, depth Z. Box face order +x,-x,+y,-y,+z,-z.
    // Top (+y, index 2) = back ("?"); bottom (-y, index 3) = emoji face.
    // Flip = rotate 180° around X so the bottom face comes up.
    const mats = [edgeMat, edgeMat, backMat, faceMat, edgeMat, edgeMat];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(CARD_W, CARD_T, CARD_H), mats);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData = {emoji};
    return mesh;
  }

  // ---- state ----
  let cards, flipped, moves, matches, pairCount, busy, startTime, timer;

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function newGame() {
    if (cards) cards.forEach(c => scene.remove(c.mesh));
    pairCount = +diffSel.value;
    moves = 0; matches = 0; flipped = []; busy = false;
    movesEl.textContent = 0; pairsEl.textContent = `0/${pairCount}`; timeEl.textContent = '0s';
    overlay.classList.remove('show');
    statusEl.innerHTML = 'Click a card to flip it.';
    clearInterval(timer); startTime = null;

    const chosen = EMOJIS.slice(0, pairCount);
    const deck = shuffle([...chosen, ...chosen]);
    const cols = pairCount <= 6 ? 4 : pairCount === 8 ? 4 : 5;
    const rows = Math.ceil(deck.length / cols);
    const gapX = 3.0, gapZ = 3.7;
    const offX = (cols - 1) / 2 * gapX, offZ = (rows - 1) / 2 * gapZ;

    cards = deck.map((emoji, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const mesh = makeCard(emoji);
      mesh.position.set(col * gapX - offX, 0.15, row * gapZ - offZ);
      scene.add(mesh);
      return {mesh, emoji, state: 'down', flip: 0, targetFlip: 0, matched: false};
    });
  }

  function flipCard(card, toUp) {
    card.targetFlip = toUp ? 1 : 0;
    card.state = toUp ? 'up' : 'down';
  }

  function onPick(card) {
    if (busy || card.state === 'up' || card.matched) return;
    if (!startTime) { startTime = Date.now(); timer = setInterval(() => { timeEl.textContent = Math.floor((Date.now() - startTime) / 1000) + 's'; }, 250); }
    flipCard(card, true);
    flipped.push(card);
    if (flipped.length === 2) {
      moves++; movesEl.textContent = moves;
      const [a, b] = flipped;
      if (a.emoji === b.emoji) {
        a.matched = b.matched = true;
        matches++; pairsEl.textContent = `${matches}/${pairCount}`;
        flipped = [];
        if (matches === pairCount) win();
      } else {
        busy = true;
        setTimeout(() => { flipCard(a, false); flipCard(b, false); flipped = []; busy = false; }, 850);
      }
    }
  }

  function win() {
    clearInterval(timer);
    const s = Math.floor((Date.now() - startTime) / 1000);
    overTitle.textContent = 'You Did It!';
    overMsg.textContent = `${moves} moves · ${s}s.`;
    overlay.classList.add('show');
    statusEl.innerHTML = `Cleared in ${moves} moves.`;
  }

  const raycaster = new THREE.Raycaster();
  function pick(cx, cy) {
    const rect = container.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -(((cy - rect.top) / rect.height) * 2 - 1));
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(cards.map(c => c.mesh));
    if (hits.length) { const card = cards.find(c => c.mesh === hits[0].object); if (card) onPick(card); }
  }
  container.addEventListener('mousedown', e => pick(e.clientX, e.clientY));
  container.addEventListener('touchstart', e => { e.preventDefault(); const t = e.touches[0]; pick(t.clientX, t.clientY); }, {passive: false});

  // keep newly-created meshes visually consistent
  let __polishTick = 0;
  function __polish() {
    if (window.SceneKit && (__polishTick++ % 30 === 0)) SceneKit.polishMaterials(scene);
  }


  function animate() {
    if (cards) cards.forEach(c => {
      c.flip += (c.targetFlip - c.flip) * 0.2;
      // face-down = 0 (back up), face-up = rotate 180° around X (emoji face up)
      c.mesh.rotation.x = Math.PI * c.flip;
      // lift while flipping / matched hover
      const lift = c.matched ? 0.5 + Math.sin(performance.now() * 0.004) * 0.1 : Math.sin(c.flip * Math.PI) * 0.8 + 0.15;
      c.mesh.position.y = lift;
      if (c.matched) {
        c.mesh.material[3].emissive = new THREE.Color(0x22c55e);
        c.mesh.material[3].emissiveIntensity = 0.35;
      }
    });
    __polish();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  document.getElementById('newBtn').addEventListener('click', newGame);
  document.getElementById('restartOverlay').addEventListener('click', newGame);
  diffSel.addEventListener('change', newGame);

  newGame();
  animate();
})();
