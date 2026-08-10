(() => {
  if (window.__hasWebGL === false) return;
  const container = document.getElementById('game3d');
  const holeEl = document.getElementById('hole');
  const strokesEl = document.getElementById('strokes');
  const totalEl = document.getElementById('total');
  const parEl = document.getElementById('par');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a25);
  scene.fog = new THREE.Fog(0x0a0a25, 52, 120);

  const FOV = 46;
  const TILT = 0.34; // radians off vertical — enough for the flag to read as upright
  const camera = new THREE.PerspectiveCamera(FOV, container.clientWidth / container.clientHeight, 0.1, 300);

  const renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  if (window.SceneKit) SceneKit.enhance(renderer, scene, {exposure: 0.82});

  // Pull the camera back just far enough that the whole green fits, in both axes.
  function frameGreen(w, d) {
    const vt = Math.tan((FOV * Math.PI / 180) / 2);
    const ht = vt * camera.aspect;
    const dist = Math.max((d / 2) / vt, (w / 2) / ht) * 1.16;
    camera.position.set(0, dist * Math.cos(TILT), dist * Math.sin(TILT));
    camera.lookAt(0, 0, 0);
  }

  new ResizeObserver(() => {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    const g = HOLES[idx] || HOLES[0];
    frameGreen(g.w + 2, g.d + 2);
  }).observe(container);

  scene.add(new THREE.AmbientLight(0x5a648f, 0.26));
  const sun = new THREE.DirectionalLight(0xfff6e0, 1.35);
  sun.position.set(-10, 24, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -20; sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20; sun.shadow.camera.bottom = -20;
  scene.add(sun);

  // r128 treats material colours as linear, but the renderer gamma-encodes on
  // output — so a hex picked in sRGB comes out washed unless it is converted.
  function std(props) {
    const m = new THREE.MeshStandardMaterial(props);
    if (m.color.convertSRGBToLinear) m.color.convertSRGBToLinear();
    if (m.emissive && m.emissive.convertSRGBToLinear) m.emissive.convertSRGBToLinear();
    m.__sk = true; // already linear — tell SceneKit not to convert it again
    return m;
  }

  const BALL_R = 0.42;
  const FRICTION = 0.976;
  const STOP = 0.012;
  const MAX_POWER = 0.86;

  const course = new THREE.Group();
  scene.add(course);

  // Nine short holes, laid out wide so the green fills a landscape viewport.
  // green size, tee [x,z], cup [x,z], obstacle blocks [x,z,w,d], par
  const HOLES = [
    {w: 22, d: 13, tee: [-7, 0],  cup: [7, 0],   par: 2, walls: []},
    {w: 24, d: 13, tee: [-9, 3],  cup: [9, -3],  par: 3, walls: [[0, 0, 0.8, 7]]},
    {w: 24, d: 14, tee: [-9, 4],  cup: [9, -4],  par: 3, walls: [[-2, -3, 9, 0.8], [3, 3, 9, 0.8]]},
    {w: 26, d: 14, tee: [-10, 0], cup: [10, 0],  par: 3, walls: [[0, -4.5, 0.8, 5], [0, 4.5, 0.8, 5]]},
    {w: 26, d: 15, tee: [-10, 4], cup: [10, -4], par: 4, walls: [[-4, 0, 0.8, 9], [4, 0, 0.8, 9]]},
    {w: 28, d: 15, tee: [-11, 4], cup: [11, -4], par: 4, walls: [[-3, -2, 8, 0.8], [4, 2, 8, 0.8]]},
    {w: 28, d: 16, tee: [-11, 0], cup: [11, 0],  par: 3, walls: [[0, -4, 10, 0.8], [0, 4, 10, 0.8]]},
    {w: 28, d: 16, tee: [-11, 5], cup: [11, -5], par: 4, walls: [[-4, 0, 0.8, 10], [4, 0, 0.8, 10], [0, -5, 5, 0.8]]},
    {w: 30, d: 16, tee: [-12, 0], cup: [12, 0],  par: 4, walls: [[-5, -3, 0.8, 7], [0, 3, 0.8, 7], [5, -3, 0.8, 7]]}
  ];

  let idx = 0, walls = [], cup = null, ball, vel, strokes, total, state, aim, dragging, aimPower;

  const ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 26, 20),
    std({color: 0xffffff, roughness: 0.28, metalness: 0.06})
  );
  ballMesh.castShadow = true;
  scene.add(ballMesh);

  const aimLine = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 0.14),
    new THREE.MeshBasicMaterial({color: 0xfde047, transparent: true, opacity: 0.85})
  );
  aimLine.rotation.x = -Math.PI / 2;
  aimLine.visible = false;
  scene.add(aimLine);

  function clearCourse() {
    while (course.children.length) {
      const c = course.children.pop();
      if (c.geometry) c.geometry.dispose();
      course.remove(c);
    }
    walls = [];
  }

  function buildHole(i) {
    clearCourse();
    const h = HOLES[i];
    const hw = h.w / 2, hd = h.d / 2;

    const green = new THREE.Mesh(
      new THREE.BoxGeometry(h.w, 0.6, h.d),
      std({color: 0x146b39, roughness: 1})
    );
    green.position.y = -0.3; green.receiveShadow = true;
    course.add(green);

    // subtle mow stripes so the green reads as turf, not a flat slab
    for (let s = 0; s < h.d; s += 2) {
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(h.w, 1),
        std({color: 0x1a7d43, roughness: 1})
      );
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, 0.005, -hd + s + 0.5);
      stripe.receiveShadow = true;
      course.add(stripe);
    }

    const railMat = std({color: 0x6d4bd6, roughness: 0.5, metalness: 0.15, emissive: 0x2a1466, emissiveIntensity: 0.35});
    function wall(x, z, w, d) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, d), railMat);
      m.position.set(x, 0.55, z);
      m.castShadow = true; m.receiveShadow = true;
      course.add(m);
      walls.push({x, z, w, d});
    }
    wall(0, -hd - 0.4, h.w + 1.6, 0.8);
    wall(0, hd + 0.4, h.w + 1.6, 0.8);
    wall(-hw - 0.4, 0, 0.8, h.d + 1.6);
    wall(hw + 0.4, 0, 0.8, h.d + 1.6);
    h.walls.forEach(w => wall(w[0], w[1], w[2], w[3]));

    // cup
    cup = {x: h.cup[0], z: h.cup[1], r: 0.78};
    const hole = new THREE.Mesh(
      new THREE.CylinderGeometry(cup.r, cup.r, 0.5, 26),
      std({color: 0x05050f, roughness: 1})
    );
    hole.position.set(cup.x, 0.06, cup.z);
    course.add(hole);
    const flagPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 3.4, 8),
      std({color: 0xe5e7eb, roughness: 0.4, metalness: 0.4})
    );
    flagPole.position.set(cup.x, 1.7, cup.z); flagPole.castShadow = true;
    course.add(flagPole);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 0.8),
      std({color: 0xef4444, side: THREE.DoubleSide, roughness: 0.7})
    );
    flag.position.set(cup.x + 0.66, 3.0, cup.z); flag.castShadow = true;
    course.add(flag);

    ball = {x: h.tee[0], z: h.tee[1]};
    vel = {x: 0, z: 0};
    ballMesh.position.set(ball.x, BALL_R, ball.z);
    strokes = 0;
    holeEl.textContent = (i + 1) + '/' + HOLES.length;
    strokesEl.textContent = 0;
    parEl.textContent = h.par;
    frameGreen(h.w + 2, h.d + 2);
    // turf should read as grass, not chrome — keep reflections subtle
    if (window.SceneKit) SceneKit.polishMaterials(scene, {envMapIntensity: 0.10});
  }

  function startGame() {
    idx = 0; total = 0; totalEl.textContent = 0;
    state = 'aim';
    buildHole(idx);
    overlay.classList.remove('show');
    statusEl.textContent = 'Drag back from the ball, release to putt.';
  }

  function nextHole() {
    idx++;
    if (idx >= HOLES.length) {
      state = 'done';
      const parTotal = HOLES.reduce((a, h) => a + h.par, 0);
      const diff = total - parTotal;
      overTitle.textContent = 'Course complete';
      overMsg.textContent = `${total} strokes, par ${parTotal} (${diff === 0 ? 'even' : diff > 0 ? '+' + diff : diff}).`;
      overlay.classList.add('show');
      statusEl.textContent = 'Round finished.';
      return;
    }
    state = 'aim';
    buildHole(idx);
    statusEl.textContent = 'Hole ' + (idx + 1) + '.';
  }

  function sink() {
    state = 'sunk';
    total += strokes;
    totalEl.textContent = total;
    const par = HOLES[idx].par;
    const d = strokes - par;
    const name = strokes === 1 ? 'Hole in one' : d < 0 ? 'Under par' : d === 0 ? 'Par' : 'Over par';
    statusEl.textContent = name + ' — ' + strokes + ' strokes.';
    setTimeout(nextHole, 1100);
  }

  function putt(dx, dz, power) {
    const len = Math.hypot(dx, dz) || 1;
    vel.x = (dx / len) * power;
    vel.z = (dz / len) * power;
    strokes++;
    strokesEl.textContent = strokes;
    state = 'roll';
    aimLine.visible = false;
  }

  function step() {
    if (state !== 'roll') return;
    ball.x += vel.x; ball.z += vel.z;
    vel.x *= FRICTION; vel.z *= FRICTION;

    for (const w of walls) {
      const hw = w.w / 2 + BALL_R, hd = w.d / 2 + BALL_R;
      const dx = ball.x - w.x, dz = ball.z - w.z;
      if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
        const ox = hw - Math.abs(dx), oz = hd - Math.abs(dz);
        if (ox < oz) { ball.x = w.x + Math.sign(dx || 1) * hw; vel.x *= -0.72; }
        else { ball.z = w.z + Math.sign(dz || 1) * hd; vel.z *= -0.72; }
      }
    }

    const dc = Math.hypot(ball.x - cup.x, ball.z - cup.z);
    const speed = Math.hypot(vel.x, vel.z);
    if (dc < cup.r && speed < 0.42) { ballMesh.position.set(cup.x, BALL_R * 0.4, cup.z); return sink(); }

    if (speed < STOP) { vel.x = vel.z = 0; state = 'aim'; }
    ballMesh.position.set(ball.x, BALL_R, ball.z);
    ballMesh.rotation.x += vel.z * 1.6;
    ballMesh.rotation.z -= vel.x * 1.6;
  }

  // pointer -> world position on the green plane
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function world(cx, cy) {
    const r = container.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -(((cy - r.top) / r.height) * 2 - 1));
    ray.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    return ray.ray.intersectPlane(plane, hit) ? hit : null;
  }

  function beginAim(cx, cy) {
    if (state !== 'aim') return;
    const p = world(cx, cy);
    if (!p) return;
    if (Math.hypot(p.x - ball.x, p.z - ball.z) > 4) return; // must grab near the ball
    dragging = true;
    aim = {x: p.x, z: p.z};
  }
  function moveAim(cx, cy) {
    if (!dragging) return;
    const p = world(cx, cy);
    if (!p) return;
    aim = {x: p.x, z: p.z};
    // pull back from the ball to set direction + power
    const dx = ball.x - aim.x, dz = ball.z - aim.z;
    const len = Math.hypot(dx, dz);
    aimPower = Math.min(MAX_POWER, len * 0.075);
    if (len < 0.2) { aimLine.visible = false; return; }
    aimLine.visible = true;
    aimLine.position.set(ball.x + dx * 0.5, 0.12, ball.z + dz * 0.5);
    aimLine.scale.set(len, 1, 1);
    // plane lies flat (rotation.x = -90); rotation.z is applied first, so it
    // spins the strip within the green. world dir = (cos z, 0, -sin z)
    aimLine.rotation.z = Math.atan2(-dz, dx);
    const k = aimPower / MAX_POWER;
    aimLine.material.color.setRGB(1, 1 - k * 0.75, 0.25);
  }
  function endAim() {
    if (!dragging) return;
    dragging = false;
    aimLine.visible = false;
    if (state !== 'aim' || !aim) return;
    const dx = ball.x - aim.x, dz = ball.z - aim.z;
    if (Math.hypot(dx, dz) < 0.4) return;
    putt(dx, dz, aimPower);
  }

  container.addEventListener('mousedown', e => beginAim(e.clientX, e.clientY));
  window.addEventListener('mousemove', e => moveAim(e.clientX, e.clientY));
  window.addEventListener('mouseup', endAim);
  container.addEventListener('touchstart', e => { const t = e.touches[0]; beginAim(t.clientX, t.clientY); }, {passive: true});
  container.addEventListener('touchmove', e => { e.preventDefault(); const t = e.touches[0]; moveAim(t.clientX, t.clientY); }, {passive: false});
  container.addEventListener('touchend', endAim);

  document.getElementById('startBtn').addEventListener('click', startGame);
  document.getElementById('restartOverlay').addEventListener('click', startGame);

  function loop() { step(); renderer.render(scene, camera); requestAnimationFrame(loop); }

  // initial idle view
  state = 'idle';
  total = 0;
  buildHole(0);
  overTitle.textContent = 'Mini Golf';
  overMsg.textContent = 'Nine holes. Drag back from the ball and release to putt.';
  overlay.classList.add('show');
  loop();
})();
