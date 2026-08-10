(() => {
  if (window.__hasWebGL === false) return;
  const container = document.getElementById('game3d');
  const floorEl = document.getElementById('floor');
  const bestEl = document.getElementById('best');
  const comboEl = document.getElementById('combo');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a25);
  scene.fog = new THREE.Fog(0x0a0a25, 25, 60);

  const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 200);
  camera.position.set(0, 8, 10.5);
  camera.lookAt(0, 4, 0);

  const renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);
  if (window.SceneKit) SceneKit.enhance(renderer, scene);

  new ResizeObserver(() => {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }).observe(container);

  scene.add(new THREE.AmbientLight(0xaaaaff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(8, 20, 8);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  scene.add(dir);

  const BLOCK_H = 1;
  const INIT_SIZE = 5;

  const stack = [];    // {mesh, x, z, w, d, y}
  const falling = [];  // {mesh, vy, vRot}
  let moving;          // {mesh, axis:'x'|'z', dir, w, d}
  let floors, best, combo, gameState, camTargetY, hueBase;

  best = +localStorage.getItem('towerstack3d-best') || 0;
  bestEl.textContent = best;

  function colorForFloor(i) {
    const hue = (hueBase + i * 12) % 360;
    return new THREE.Color(`hsl(${hue}, 65%, 58%)`);
  }

  function makeBlockMesh(w, d, color) {
    const geom = new THREE.BoxGeometry(w, BLOCK_H, d);
    const mat = new THREE.MeshStandardMaterial({color, roughness: 0.5, metalness: 0.15});
    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }

  function reset() {
    [...stack, ...falling].forEach(o => scene.remove(o.mesh));
    if (moving) scene.remove(moving.mesh);
    stack.length = 0; falling.length = 0;
    floors = 0; combo = 0;
    hueBase = Math.random() * 360;
    floorEl.textContent = 0;
    comboEl.textContent = 0;
    camTargetY = 4;

    // base block
    const base = makeBlockMesh(INIT_SIZE, INIT_SIZE, colorForFloor(0));
    base.position.set(0, 0, 0);
    scene.add(base);
    stack.push({mesh: base, x: 0, z: 0, w: INIT_SIZE, d: INIT_SIZE, y: 0});

    spawnMoving();
    gameState = 'ready';
    overTitle.textContent = 'Tap to Stack';
    overMsg.textContent = 'Time the drop so blocks line up.';
    overlay.classList.add('show');
    statusEl.innerHTML = 'Press Start.';
  }

  function spawnMoving() {
    const top = stack[stack.length - 1];
    const axis = floors % 2 === 0 ? 'x' : 'z';
    const color = colorForFloor(floors + 1);
    const mesh = makeBlockMesh(top.w, top.d, color);
    const y = (floors + 1) * BLOCK_H;
    const startOffset = 8;
    if (axis === 'x') mesh.position.set(-startOffset, y, top.z);
    else mesh.position.set(top.x, y, -startOffset);
    scene.add(mesh);
    moving = {mesh, axis, dir: 1, w: top.w, d: top.d, y};
  }

  function start() {
    reset();
    gameState = 'play';
    overlay.classList.remove('show');
    statusEl.innerHTML = 'Stack!';
  }

  function gameOver() {
    gameState = 'over';
    if (floors > best) {
      best = floors; localStorage.setItem('towerstack3d-best', best); bestEl.textContent = best;
      overTitle.textContent = 'New Best!'; overMsg.textContent = `${floors} floors.`;
    } else {
      overTitle.textContent = 'Missed!'; overMsg.textContent = `${floors} floors · Best ${best}.`;
    }
    overlay.classList.add('show');
    statusEl.innerHTML = 'Tap Start to rebuild.';
  }

  function drop() {
    if (gameState === 'over') { start(); return; }
    if (gameState === 'ready') { start(); return; }
    if (gameState !== 'play' || !moving) return;

    const top = stack[stack.length - 1];
    let overlap, newW, newD, newX, newZ, overhang, overhangCenter;

    if (moving.axis === 'x') {
      const delta = moving.mesh.position.x - top.x;
      overlap = top.w - Math.abs(delta);
      if (overlap <= 0) return missDrop();
      newW = overlap;
      newD = top.d;
      newX = top.x + delta / 2;
      newZ = top.z;
      overhang = Math.abs(delta);
      overhangCenter = moving.mesh.position.x + Math.sign(delta) * (top.w / 2);
    } else {
      const delta = moving.mesh.position.z - top.z;
      overlap = top.d - Math.abs(delta);
      if (overlap <= 0) return missDrop();
      newW = top.w;
      newD = overlap;
      newX = top.x;
      newZ = top.z + delta / 2;
      overhang = Math.abs(delta);
      overhangCenter = moving.mesh.position.z + Math.sign(delta) * (top.d / 2);
    }

    const PERFECT = 0.35;
    scene.remove(moving.mesh);

    let placedW = newW, placedD = newD, placedX = newX, placedZ = newZ;
    if (overhang < PERFECT) {
      // perfect — keep full size, combo, regrow a touch
      combo++;
      comboEl.textContent = combo;
      placedW = top.w; placedD = top.d; placedX = top.x; placedZ = top.z;
      // regrow tiny bit (capped)
      if (combo >= 2) {
        placedW = Math.min(INIT_SIZE, top.w + 0.2);
        placedD = Math.min(INIT_SIZE, top.d + 0.2);
      }
      pulse(placedX, moving.y, placedZ, colorForFloor(floors + 1));
    } else {
      combo = 0;
      comboEl.textContent = 0;
      // spawn falling remainder
      const color = colorForFloor(floors + 1);
      let remW, remD, remX, remZ;
      if (moving.axis === 'x') {
        remW = overhang; remD = top.d;
        remX = overhangCenter; remZ = top.z;
      } else {
        remW = top.w; remD = overhang;
        remX = top.x; remZ = overhangCenter;
      }
      if (remW > 0.02 && remD > 0.02) {
        const rem = makeBlockMesh(remW, remD, color);
        rem.position.set(remX, moving.y, remZ);
        scene.add(rem);
        falling.push({mesh: rem, vy: 0, vRot: (Math.random() - 0.5) * 0.1, vx: (remX - placedX) * 0.05, vz: (remZ - placedZ) * 0.05});
      }
    }

    // place the trimmed block
    const placed = makeBlockMesh(placedW, placedD, colorForFloor(floors + 1));
    placed.position.set(placedX, moving.y, placedZ);
    scene.add(placed);
    stack.push({mesh: placed, x: placedX, z: placedZ, w: placedW, d: placedD, y: moving.y});

    floors++;
    floorEl.textContent = floors;
    camTargetY = 4 + floors * BLOCK_H;

    spawnMoving();
  }

  function missDrop() {
    // block missed entirely — it falls, game over
    if (moving) {
      falling.push({mesh: moving.mesh, vy: 0, vRot: 0.1, vx: 0, vz: 0});
      moving = null;
    }
    gameOver();
  }

  function pulse(x, y, z, color) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.08, 8, 24),
      new THREE.MeshBasicMaterial({color: 0xfde047, transparent: true, opacity: 0.9})
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, y, z);
    scene.add(ring);
    let s = 1;
    const grow = () => {
      s += 0.15;
      ring.scale.set(s, s, s);
      ring.material.opacity -= 0.06;
      if (ring.material.opacity <= 0) { scene.remove(ring); return; }
      requestAnimationFrame(grow);
    };
    grow();
  }

  // keep newly-created meshes visually consistent
  let __polishTick = 0;
  function __polish() {
    if (window.SceneKit && (__polishTick++ % 30 === 0)) SceneKit.polishMaterials(scene);
  }


  function update() {
    // camera rise
    camera.position.y += (camTargetY + 4 - camera.position.y) * 0.06;
    camera.lookAt(0, camTargetY - 1, 0);

    // move current block
    if (gameState === 'play' && moving) {
      const range = 8;
      const spd = 0.06 + Math.min(0.035, floors * 0.0012);  // gentle speed
      if (moving.axis === 'x') {
        moving.mesh.position.x += moving.dir * spd * 60 * 0.016;
        if (moving.mesh.position.x > range) moving.dir = -1;
        if (moving.mesh.position.x < -range) moving.dir = 1;
      } else {
        moving.mesh.position.z += moving.dir * spd * 60 * 0.016;
        if (moving.mesh.position.z > range) moving.dir = -1;
        if (moving.mesh.position.z < -range) moving.dir = 1;
      }
    }

    // falling debris
    for (let i = falling.length - 1; i >= 0; i--) {
      const f = falling[i];
      f.vy -= 0.02;
      f.mesh.position.y += f.vy;
      f.mesh.position.x += (f.vx || 0);
      f.mesh.position.z += (f.vz || 0);
      f.mesh.rotation.x += f.vRot;
      f.mesh.rotation.z += f.vRot * 0.6;
      if (f.mesh.position.y < camTargetY - 30) { scene.remove(f.mesh); falling.splice(i, 1); }
    }

    __polish();

    renderer.render(scene, camera);
  }

  function loop() { update(); requestAnimationFrame(loop); }

  container.addEventListener('mousedown', drop);
  container.addEventListener('touchstart', e => { e.preventDefault(); drop(); }, {passive: false});
  document.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); drop(); }
  });
  document.getElementById('dropBtn').addEventListener('click', drop);
  document.getElementById('restartOverlay').addEventListener('click', start);

  reset();
  loop();
})();
