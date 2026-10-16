/* Shared bootstrap for the newer 3D games: renderer + scene + camera, HUD/overlay
   wiring (via GameKit), game loop, particle bursts and camera shake. */
window.Stage3D = function (o) {
  if (window.__hasWebGL === false || typeof THREE === 'undefined') return null;
  const K = GameKit(o), el = K.el;
  const bg = o.bg == null ? 0x05061a : o.bg;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);
  if (o.sky) {
    const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, o.sky[0]); g.addColorStop(.6, o.sky[1]); g.addColorStop(1, o.sky[2] || o.sky[1]);
    x.fillStyle = g; x.fillRect(0, 0, 4, 256);
    scene.background = new THREE.CanvasTexture(c); scene.background.encoding = THREE.sRGBEncoding;
  }
  if (o.fog) scene.fog = new THREE.Fog(bg, o.fog[0], o.fog[1]);
  const camera = new THREE.PerspectiveCamera(o.fov || 60, el.clientWidth / el.clientHeight, 0.1, 600);
  const renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(el.clientWidth, el.clientHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  el.appendChild(renderer.domElement);
  if (window.SceneKit) SceneKit.enhance(renderer, scene, {exposure: o.exposure, env: o.env});
  new ResizeObserver(() => {
    const w = el.clientWidth, h = el.clientHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
  }).observe(el);

  const S = Object.assign(K, {scene, camera, renderer});
  let shakeAmt = 0;
  const bursts = [];

  S.polish = () => window.SceneKit && SceneKit.polishMaterials(scene, {envMapIntensity: o.envIntensity});
  S.shake = a => { shakeAmt = Math.max(shakeAmt, a); };

  S.burst = (p, color, n, speed) => {
    n = n || 26; speed = speed || 4;
    const pos = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) {
      pos.set([p.x, p.y, p.z], i * 3);
      const v = new THREE.Vector3(Math.random() - .5, Math.random() - .3, Math.random() - .5).normalize().multiplyScalar(speed * (.35 + Math.random()));
      vel.push(v);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({color, size: .22, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending});
    const pts = new THREE.Points(g, m); pts.frustumCulled = false;
    scene.add(pts); S.polish();
    bursts.push({pts, g, m, vel, life: 1});
  };

  S.loop = fn => {
    let last = performance.now();
    const tmp = new THREE.Vector3();
    (function frame(t) {
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
      try {
        fn(dt);
        for (let i = bursts.length - 1; i >= 0; i--) {
          const b = bursts[i]; b.life -= dt * 1.3;
          if (b.life <= 0) { scene.remove(b.pts); b.g.dispose(); b.m.dispose(); bursts.splice(i, 1); continue; }
          const a = b.g.attributes.position;
          b.vel.forEach((v, k) => { v.y -= 5 * dt; a.setXYZ(k, a.getX(k) + v.x * dt, a.getY(k) + v.y * dt, a.getZ(k) + v.z * dt); });
          a.needsUpdate = true; b.m.opacity = b.life;
        }
        const home = tmp.copy(camera.position);
        if (shakeAmt > 0.001) {
          camera.position.x += (Math.random() - .5) * shakeAmt; camera.position.y += (Math.random() - .5) * shakeAmt;
          shakeAmt *= Math.pow(0.002, dt);
        }
        const base = camera.fov, narrow = 4 / 3 / camera.aspect; // keep the same horizontal view on portrait screens
        if (narrow > 1) { camera.fov = 2 * Math.atan(Math.tan(base * Math.PI / 360) * narrow) * 180 / Math.PI; camera.updateProjectionMatrix(); }
        renderer.render(scene, camera);
        if (narrow > 1) { camera.fov = base; camera.updateProjectionMatrix(); }
        camera.position.copy(home);
      } catch (e) { if (!S.err) { S.err = e; console.error(e); } }
      requestAnimationFrame(frame);
    })(last);
  };

  return S;
};
