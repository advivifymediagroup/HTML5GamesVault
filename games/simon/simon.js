(() => {
  if (window.__hasWebGL === false) return;
  const container = document.getElementById('game3d');
  const roundEl = document.getElementById('round');
  const bestEl = document.getElementById('best');
  const stepEl = document.getElementById('step');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');
  const speedSel = document.getElementById('speed');

  const TONES = [329.63, 261.63, 220.00, 164.81];
  const SPEEDS = { slow: {flash: 700, gap: 350}, normal: {flash: 480, gap: 220}, fast: {flash: 280, gap: 130} };
  const BASE_COLORS = [0x047857, 0xb91c1c, 0xca8a04, 0x1d4ed8];
  const LIT_COLORS  = [0x34d399, 0xf87171, 0xfde047, 0x60a5fa];

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a25);
  scene.fog = new THREE.Fog(0x0a0a25, 18, 40);

  const camera = new THREE.PerspectiveCamera(46, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 13.9, 0.01);
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

  scene.add(new THREE.AmbientLight(0x9099cc, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(-5, 14, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -8; sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8;
  scene.add(sun);

  // base disc
  const base = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.6, 0.8, 48), new THREE.MeshStandardMaterial({color: 0x14122e, roughness: 0.8}));
  base.position.y = -0.4; base.receiveShadow = true; scene.add(base);
  // center hub
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 1.2, 32), new THREE.MeshStandardMaterial({color: 0x1e1b4b, roughness: 0.5, metalness: 0.3}));
  hub.position.y = 0.3; hub.castShadow = true; scene.add(hub);
  const hubTop = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.1, 32), new THREE.MeshStandardMaterial({color: 0x8b5cf6, emissive: 0x6d28d9, emissiveIntensity: 0.4}));
  hubTop.position.y = 0.95; scene.add(hubTop);

  // 4 quadrant pads (ring sectors)
  const pads = [];
  for (let i = 0; i < 4; i++) {
    const start = i * Math.PI / 2 + 0.04;
    const len = Math.PI / 2 - 0.08;
    // annular sector via ExtrudeGeometry from a shape
    const shape = new THREE.Shape();
    const rIn = 1.7, rOut = 5.0;
    shape.absarc(0, 0, rOut, start, start + len, false);
    shape.absarc(0, 0, rIn, start + len, start, true);
    const geo = new THREE.ExtrudeGeometry(shape, {depth: 0.7, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2});
    const mat = new THREE.MeshStandardMaterial({color: BASE_COLORS[i], roughness: 0.45, metalness: 0.15, emissive: BASE_COLORS[i], emissiveIntensity: 0.12});
    const pad = new THREE.Mesh(geo, mat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.1;
    pad.castShadow = true; pad.receiveShadow = true;
    pad.userData.index = i;
    scene.add(pad);
    pads.push({mesh: pad, base: BASE_COLORS[i], lit: LIT_COLORS[i], y: 0.1, targetY: 0.1, glow: 0});
  }

  // center label text (canvas texture)
  const centerCv = document.createElement('canvas'); centerCv.width = centerCv.height = 128;
  const cctx = centerCv.getContext('2d');
  const centerTex = new THREE.CanvasTexture(centerCv);
  const centerPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({map: centerTex, transparent: true}));
  centerPlane.rotation.x = -Math.PI / 2; centerPlane.position.set(0, 1.02, 0); scene.add(centerPlane);
  function setCenter(text) {
    cctx.clearRect(0, 0, 128, 128);
    cctx.fillStyle = '#06d4f7'; cctx.font = 'bold 22px "Space Grotesk", sans-serif';
    cctx.textAlign = 'center'; cctx.textBaseline = 'middle';
    text.split('\n').forEach((line, i, arr) => cctx.fillText(line, 64, 64 + (i - (arr.length - 1) / 2) * 26));
    centerTex.needsUpdate = true;
  }

  // ---- state ----
  let sequence, playerIdx, round, best, accepting, audioCtx;
  best = +localStorage.getItem('simon3d-best') || 0;
  bestEl.textContent = best;
  setCenter('SIMON');

  function ensureAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); }
  function playTone(freq, ms) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.value = freq;
    osc.connect(gain).connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.02);
    gain.gain.linearRampToValueAtTime(0, now + ms / 1000);
    osc.start(now); osc.stop(now + ms / 1000 + 0.05);
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));

  function litPad(i, ms) {
    const p = pads[i];
    p.glow = 1; p.targetY = 0.7;
    playTone(TONES[i], ms);
    return new Promise(res => setTimeout(() => { p.glow = 0; p.targetY = 0.1; res(); }, ms));
  }

  async function playSequence() {
    accepting = false;
    setCenter('WATCH');
    statusEl.innerHTML = `Round ${round} — watch.`;
    const {flash, gap} = SPEEDS[speedSel.value];
    await wait(500);
    for (const i of sequence) { await litPad(i, flash); await wait(gap); }
    accepting = true; playerIdx = 0;
    stepEl.textContent = `0/${sequence.length}`;
    setCenter('YOUR\nTURN');
    statusEl.innerHTML = `Repeat the ${sequence.length}-step pattern.`;
  }

  function startGame() { ensureAudio(); sequence = []; round = 0; overlay.classList.remove('show'); nextRound(); }
  function nextRound() { round++; roundEl.textContent = round; sequence.push(Math.floor(Math.random() * 4)); playSequence(); }

  async function press(i) {
    if (!accepting) return;
    ensureAudio();
    await litPad(i, 220);
    if (sequence[playerIdx] !== i) return gameOver();
    playerIdx++; stepEl.textContent = `${playerIdx}/${sequence.length}`;
    if (playerIdx === sequence.length) { accepting = false; setCenter('NICE!'); await wait(650); nextRound(); }
  }

  function gameOver() {
    accepting = false;
    setCenter('GAME\nOVER');
    if (audioCtx) { playTone(196, 500); setTimeout(() => playTone(146, 600), 60); }
    if (round - 1 > best) { best = round - 1; localStorage.setItem('simon3d-best', best); bestEl.textContent = best; overTitle.textContent = 'New Best!'; overMsg.textContent = `Reached round ${round}.`; }
    else { overTitle.textContent = 'Wrong Pad'; overMsg.textContent = `Round ${round}. Best ${best}.`; }
    overlay.classList.add('show');
    statusEl.innerHTML = `Wrong at step ${playerIdx + 1}.`;
  }

  const raycaster = new THREE.Raycaster();
  function pick(cx, cy) {
    if (!accepting) return;
    const rect = container.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -(((cy - rect.top) / rect.height) * 2 - 1));
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pads.map(p => p.mesh));
    if (hits.length) press(hits[0].object.userData.index);
  }
  container.addEventListener('mousedown', e => pick(e.clientX, e.clientY));
  container.addEventListener('touchstart', e => { e.preventDefault(); const t = e.touches[0]; pick(t.clientX, t.clientY); }, {passive: false});

  // keep newly-created meshes visually consistent
  let __polishTick = 0;
  function __polish() {
    if (window.SceneKit && (__polishTick++ % 30 === 0)) SceneKit.polishMaterials(scene);
  }


  function animate() {
    pads.forEach(p => {
      p.y += (p.targetY - p.y) * 0.25;
      p.mesh.position.y = p.y;
      const col = new THREE.Color(p.base).lerp(new THREE.Color(p.lit), p.glow);
      p.mesh.material.color.copy(col);
      p.mesh.material.emissive.copy(new THREE.Color(p.lit));
      p.mesh.material.emissiveIntensity = 0.12 + p.glow * 0.9;
    });
    __polish();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  document.getElementById('startBtn').addEventListener('click', startGame);
  document.getElementById('restartOverlay').addEventListener('click', startGame);

  animate();
})();
