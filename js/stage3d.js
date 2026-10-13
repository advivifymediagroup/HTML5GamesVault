/* Shared bootstrap for the newer 3D games: renderer + scene + camera, HUD/overlay
   wiring, game loop, particle bursts, camera shake, tiny WebAudio sfx, fullscreen. */
window.Stage3D = function (o) {
  if (window.__hasWebGL === false || typeof THREE === 'undefined') return null;
  const el = document.getElementById('game3d'), wrap = el.parentElement;
  const $ = id => document.getElementById(id);
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

  const S = {scene, camera, renderer, el, wrap, $, running: false};
  const bestKey = (o.key || 'game3d') + '-best';
  let shakeAmt = 0, ac;
  const bursts = [];

  S.polish = () => window.SceneKit && SceneKit.polishMaterials(scene, {envMapIntensity: o.envIntensity});
  const fsHud = document.createElement('div');
  fsHud.style.cssText = 'position:absolute;top:10px;left:12px;display:none;gap:16px;font:700 15px "Space Grotesk",sans-serif;color:#fff;text-shadow:0 1px 5px #000;pointer-events:none';
  const fsVals = [...document.querySelectorAll('.score-box')].map(b => {
    const d = document.createElement('div'); d.innerHTML = `<span style="opacity:.75;font-size:11px;letter-spacing:.1em;text-transform:uppercase">${b.querySelector('span').textContent}</span> <b></b>`;
    fsHud.appendChild(d); return d.lastChild;
  });
  wrap.appendChild(fsHud);
  document.addEventListener('fullscreenchange', () => {
    fsHud.style.display = document.fullscreenElement === wrap ? 'flex' : 'none';
    fsVals.forEach((e, i) => { e.textContent = $('s' + (i + 1)).textContent; });
  });
  S.hud = (n, v) => { const e = $('s' + n); if (e) e.textContent = v; if (fsVals[n - 1]) fsVals[n - 1].textContent = v; };
  S.bestScore = () => { try { return +localStorage.getItem(bestKey) || 0; } catch (e) { return 0; } };
  S.best = score => {
    const b = S.bestScore(), isNew = score > b;
    if (isNew) try { localStorage.setItem(bestKey, score); } catch (e) {}
    S.hud(o.bestHud || 3, Math.max(b, score));
    return isNew;
  };
  S.show = (title, msg, btn) => {
    $('overTitle').textContent = title; $('overMsg').textContent = msg;
    $('overlayBtn').textContent = btn || 'Play again'; $('overlay').classList.add('show');
  };
  S.onStart = fn => {
    const go = () => { $('overlay').classList.remove('show'); fn(); };
    $('startBtn').addEventListener('click', go); $('overlayBtn').addEventListener('click', go);
  };
  S.status = t => { $('status').textContent = t; };
  S.shake = a => { shakeAmt = Math.max(shakeAmt, a); };

  S.flash = (text, ms) => {
    let f = $('flash');
    if (!f) {
      f = document.createElement('div'); f.id = 'flash';
      f.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;font:800 clamp(28px,7vw,64px) "Space Grotesk",sans-serif;color:#fff;text-shadow:0 0 24px #6aa6ff,0 4px 0 rgba(0,0,0,.4);opacity:0;transition:opacity .25s,transform .25s;transform:scale(.8)';
      wrap.appendChild(f);
    }
    f.textContent = text; f.style.opacity = 1; f.style.transform = 'scale(1)';
    clearTimeout(f.t); f.t = setTimeout(() => { f.style.opacity = 0; f.style.transform = 'scale(1.2)'; }, ms || 900);
  };

  S.beep = (freq, dur, type, vol) => {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const t = ac.currentTime, osc = ac.createOscillator(), g = ac.createGain();
      osc.type = type || 'sine'; osc.frequency.value = freq || 440;
      g.gain.setValueAtTime(vol || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.1));
      osc.connect(g); g.connect(ac.destination); osc.start(t); osc.stop(t + (dur || 0.1));
    } catch (e) {}
  };

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
        renderer.render(scene, camera);
        camera.position.copy(home);
      } catch (e) { if (!S.err) { S.err = e; console.error(e); } }
      requestAnimationFrame(frame);
    })(last);
  };

  const fs = $('fsBtn');
  if (fs) fs.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (wrap.requestFullscreen) wrap.requestFullscreen();
  });
  return S;
};
