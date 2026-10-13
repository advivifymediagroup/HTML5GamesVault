(() => {
  const S = Stage3D({key: 'borderline2', bg: 0x0c1c26, sky: ['#17404f', '#0e2530', '#07141c'], fog: [30, 80], fov: 42, bestHud: 4, exposure: 1.05});
  if (!S) return;
  const {scene, camera, wrap} = S;

  // ---- puzzle data ----
  const places = {
    Portugal: [9, 52], Spain: [20, 67], France: [35, 48], Belgium: [43, 29], Netherlands: [47, 15], Luxembourg: [48, 42],
    Germany: [57, 37], Denmark: [57, 12], Switzerland: [49, 59], Italy: [59, 77], Austria: [68, 58], Czechia: [69, 37],
    Poland: [78, 29], Slovakia: [78, 48], Hungary: [79, 63], Slovenia: [67, 76], Croatia: [77, 80]
  };
  const borders = {
    Portugal: ['Spain'], Spain: ['Portugal', 'France'], France: ['Spain', 'Belgium', 'Luxembourg', 'Germany', 'Switzerland', 'Italy'],
    Belgium: ['France', 'Netherlands', 'Germany', 'Luxembourg'], Netherlands: ['Belgium', 'Germany'], Luxembourg: ['France', 'Belgium', 'Germany'],
    Germany: ['France', 'Belgium', 'Netherlands', 'Luxembourg', 'Denmark', 'Switzerland', 'Austria', 'Czechia', 'Poland'],
    Denmark: ['Germany'], Switzerland: ['France', 'Germany', 'Austria', 'Italy'], Italy: ['France', 'Switzerland', 'Austria', 'Slovenia'],
    Austria: ['Germany', 'Switzerland', 'Italy', 'Czechia', 'Slovakia', 'Hungary', 'Slovenia'],
    Czechia: ['Germany', 'Poland', 'Slovakia', 'Austria'], Poland: ['Germany', 'Czechia', 'Slovakia'],
    Slovakia: ['Poland', 'Czechia', 'Austria', 'Hungary'], Hungary: ['Austria', 'Slovakia', 'Slovenia', 'Croatia'],
    Slovenia: ['Italy', 'Austria', 'Hungary', 'Croatia'], Croatia: ['Slovenia', 'Hungary']
  };
  const routes = [{from: 'Portugal', to: 'Poland', limit: 7}, {from: 'Netherlands', to: 'Hungary', limit: 6}, {from: 'Italy', to: 'Denmark', limit: 6}, {from: 'Spain', to: 'Slovakia', limit: 6}];
  const region = {Portugal: 0xe9a23b, Spain: 0xe9a23b, France: 0x4aa3df, Belgium: 0x4aa3df, Netherlands: 0x4aa3df, Luxembourg: 0x4aa3df, Germany: 0x7bc67b, Switzerland: 0x7bc67b, Austria: 0x7bc67b, Czechia: 0x7bc67b, Denmark: 0x9a8be0, Poland: 0xd9776b, Slovakia: 0xd9776b, Hungary: 0xd9776b, Italy: 0xe5c96a, Slovenia: 0xe5c96a, Croatia: 0xe5c96a};
  function shortest(from, to) {
    const q = [[from, 0]], seen = new Set([from]);
    while (q.length) { const [c, d] = q.shift(); if (c === to) return d; for (const n of borders[c]) if (!seen.has(n)) { seen.add(n); q.push([n, d + 1]); } }
    return Infinity;
  }

  // ---- 3D map ----
  scene.add(new THREE.AmbientLight(0xa8cfe0, .7));
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.0); sun.position.set(-8, 16, 10); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -16, right: 16, top: 11, bottom: -11, near: 1, far: 50}); scene.add(sun);
  const pos2 = n => new THREE.Vector3((places[n][0] - 44) * .34, 0, (places[n][1] - 46) * .2);

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({color: 0x0f3a4a, roughness: .25, metalness: .3})); sea.position.y = -1.4; sea.receiveShadow = true; scene.add(sea);
  const base = new THREE.Mesh(new THREE.BoxGeometry(31, 1.2, 18.5), new THREE.MeshStandardMaterial({color: 0x20384a, roughness: .7})); base.position.y = -.7; base.receiveShadow = true; scene.add(base);
  const edgeGlow = new THREE.Mesh(new THREE.BoxGeometry(31.2, .08, 18.7), new THREE.MeshBasicMaterial({color: 0x3fb7c9})); edgeGlow.position.y = -.12; scene.add(edgeGlow);
  const topPlane = new THREE.Mesh(new THREE.BoxGeometry(30.6, .05, 18.1), new THREE.MeshStandardMaterial({color: 0x163545, roughness: .8})); topPlane.position.y = -.1; topPlane.receiveShadow = true; scene.add(topPlane);

  function label(text) {
    const c = document.createElement('canvas'); c.width = 320; c.height = 80; const x = c.getContext('2d');
    x.font = '700 40px "Space Grotesk",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 8; x.strokeStyle = 'rgba(5,15,22,.9)'; x.strokeText(text, 160, 42); x.fillStyle = '#f4f7ef'; x.fillText(text, 160, 42);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: t, transparent: true, depthWrite: false})); sp.scale.set(4.7, 1.18, 1); return sp;
  }
  const nodes = {}, tileList = [];
  Object.keys(places).forEach(name => {
    const g = new THREE.Group(), col = region[name];
    const tile = new THREE.Mesh(new THREE.CylinderGeometry(.92, 1.0, .5, 6), new THREE.MeshStandardMaterial({color: col, roughness: .55, metalness: .1, emissive: 0x000000}));
    tile.position.y = .25; tile.castShadow = tile.receiveShadow = true; tile.userData.name = name; g.add(tile);
    const lab = label(name); lab.position.y = 1.15; g.add(lab);
    g.position.copy(pos2(name)); scene.add(g); tileList.push(tile);
    nodes[name] = {g, tile, lab, hover: 0, shake: 0, visited: 0, col};
  });
  const edges = [];
  Object.entries(borders).forEach(([a, ns]) => ns.forEach(b => {
    if (a.localeCompare(b) >= 0) return;
    const pa = pos2(a).setY(.55), pb = pos2(b).setY(.55), mid = pa.clone().add(pb).multiplyScalar(.5).setY(1.1), curve = new THREE.QuadraticBezierCurve3(pa, mid, pb);
    const thin = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, .03, 6), new THREE.MeshBasicMaterial({color: 0x6fb3bf, transparent: true, opacity: .45}));
    const thick = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, .1, 8), new THREE.MeshBasicMaterial({color: 0xfacc15})); thick.visible = false;
    scene.add(thin, thick); edges.push({a, b, thin, thick, curve});
  }));
  const edgeOf = (a, b) => edges.find(e => (e.a === a && e.b === b) || (e.a === b && e.b === a));
  const startRing = new THREE.Mesh(new THREE.TorusGeometry(1.1, .07, 8, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({color: 0x4ade80}));
  const goalRing = new THREE.Mesh(new THREE.TorusGeometry(1.1, .07, 8, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({color: 0xfacc15}));
  const flag = new THREE.Group(), pole = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1.5, 6), new THREE.MeshStandardMaterial({color: 0xe5e7eb})), pennant = new THREE.Mesh(new THREE.ConeGeometry(.35, .7, 3).rotateZ(-Math.PI / 2), new THREE.MeshStandardMaterial({color: 0xfacc15, emissive: 0xb45309}));
  pennant.position.set(.35, .55, 0); flag.add(pole, pennant);
  scene.add(startRing, goalRing, flag);
  const trav = new THREE.Group();
  const wing = new THREE.Mesh(new THREE.BoxGeometry(.8, .04, .3), new THREE.MeshStandardMaterial({color: 0x38bdf8, emissive: 0x0c4a6e})); wing.position.z = .2;
  trav.add(new THREE.Mesh(new THREE.ConeGeometry(.2, .75, 6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({color: 0xf8fafc, emissive: 0x223344, metalness: .4, roughness: .3})), wing);
  trav.children.forEach(m => { m.castShadow = true; }); scene.add(trav);
  S.polish();

  // ---- DOM objective ----
  const obj = document.createElement('div');
  obj.style.cssText = 'position:absolute;top:10px;left:50%;transform:translateX(-50%);padding:6px 14px;border-radius:10px;background:rgba(5,15,22,.62);border:1px solid rgba(255,255,255,.2);color:#fff;font:700 clamp(12px,2.6vw,16px) "Space Grotesk",sans-serif;pointer-events:none;white-space:nowrap';
  wrap.appendChild(obj);

  // ---- game state ----
  let ri = 0, path = [], complete = false, finished = false, stars = 0, perfect = 0, T = 0, tween = null, hoverName = null;
  const tweenPos = new THREE.Vector3(), cam = {az: 0, el: 1.02, dist: 31};
  const top = n => pos2(n).setY(.55);
  const here = () => path[path.length - 1];

  function beginRoute() {
    const r = routes[ri]; path = [r.from]; complete = false; tween = null;
    S.hud(1, `${ri + 1} / ${routes.length}`); S.hud(2, 0); S.hud(3, stars);
    obj.textContent = `${r.from} → ${r.to}  ·  ${r.limit} moves max`;
    document.getElementById('nextBtn').disabled = true; document.getElementById('nextBtn').textContent = ri === routes.length - 1 ? 'Finish' : 'Next route';
    S.status(`Start in ${r.from}. Cross one border at a time.`);
    trav.position.copy(top(r.from)).setY(1.05); refresh();
  }
  function refresh() {
    const r = routes[ri], vis = new Set(path);
    edges.forEach(e => { const on = vis.has(e.a) && vis.has(e.b) && Math.abs(path.indexOf(e.a) - path.indexOf(e.b)) === 1; e.thick.visible = on; e.thin.visible = !on; });
    const sp = pos2(r.from), gp = pos2(r.to);
    startRing.position.set(sp.x, .52, sp.z); goalRing.position.set(gp.x, .52, gp.z); flag.position.set(gp.x, .5, gp.z);
    Object.entries(nodes).forEach(([n, o]) => { o.visited = vis.has(n) ? 1 : 0; });
  }
  function go(from, to) { tween = {from, to, t: 0}; }

  function moveTo(name) {
    if (complete || !routes[ri]) return;
    const cur = here(), r = routes[ri];
    if (name === cur) return;
    if (name === path[path.length - 2]) { path.pop(); go(cur, name); S.hud(2, path.length - 1); S.beep(330, .08, 'triangle', .04); afterMove(); return; }
    if (!borders[cur].includes(name)) { nodes[name].shake = 1; S.status(`${name} does not share a border with ${cur}.`); S.beep(130, .15, 'square', .04); return; }
    if (path.includes(name)) { nodes[name].shake = 1; S.status('That country is already on your route.'); S.beep(130, .15, 'square', .04); return; }
    if (path.length - 1 >= r.limit) { nodes[name].shake = 1; S.flash('MOVE LIMIT', 700); S.status('Move limit reached. Undo a step or restart this route.'); S.beep(130, .15, 'square', .04); return; }
    path.push(name); go(cur, name); S.hud(2, path.length - 1); S.beep(440 + path.length * 60, .1, 'triangle', .05); afterMove();
  }
  function afterMove() {
    const r = routes[ri], moves = path.length - 1; refresh();
    if (here() === r.to) {
      complete = true; const best = shortest(r.from, r.to), st = moves === best ? 3 : moves <= best + 1 ? 2 : 1;
      stars += st; if (st === 3) perfect++; S.hud(3, stars);
      S.status(st === 3 ? 'Perfect route: shortest possible! ★★★' : `Route complete in ${moves} border crossings. ${'★'.repeat(st)}`);
      S.flash(st === 3 ? 'PERFECT ROUTE' : 'ROUTE COMPLETE', 1100); S.burst(top(r.to).setY(1), 0xfacc15, 50, 6); S.beep(660, .15, 'triangle'); setTimeout(() => S.beep(990, .3, 'triangle'), 160);
      document.getElementById('nextBtn').disabled = false; return;
    }
    S.status(path.length - 1 >= r.limit ? 'Move limit reached. Undo a step or restart this route.' : `${r.to} is ${shortest(here(), r.to)} borders away from here.`);
  }
  function undo() { if (path.length > 1 && !complete) { const cur = here(); path.pop(); go(cur, here()); S.hud(2, path.length - 1); S.beep(330, .08, 'triangle', .04); afterMove(); } }
  function next() {
    if (!complete) return;
    if (ri === routes.length - 1) {
      finished = true; const isNew = S.best(stars);
      S.show('Tour complete!', `${stars} of ${routes.length * 3} stars · ${perfect} perfect route${perfect === 1 ? '' : 's'}${isNew ? ' — new best!' : '.'}`, 'Play again'); return;
    }
    ri++; beginRoute();
  }
  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('nextBtn').addEventListener('click', next);
  S.onStart(() => { if (finished) { finished = false; ri = 0; stars = 0; perfect = 0; } beginRoute(); });
  document.addEventListener('keydown', e => { if (e.key === 'Backspace' || (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey)) || e.key.toLowerCase() === 'u') { e.preventDefault(); undo(); } else if (e.key === 'Enter' && complete) next(); });

  // ---- input: hover, click, orbit ----
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  const pick = e => { const r = S.el.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ptr, camera); const h = ray.intersectObjects(tileList)[0]; return h ? h.object.userData.name : null; };
  let down = null, dragged = false;
  S.el.addEventListener('pointerdown', e => { down = {x: e.clientX, y: e.clientY, az: cam.az, el: cam.el}; dragged = false; });
  S.el.addEventListener('pointermove', e => {
    if (down) { const dx = e.clientX - down.x, dy = e.clientY - down.y; if (Math.abs(dx) + Math.abs(dy) > 6) dragged = true; if (dragged) { cam.az = Math.max(-1.1, Math.min(1.1, down.az - dx * .006)); cam.el = Math.max(.55, Math.min(1.3, down.el + dy * .005)); } }
    else if (e.pointerType === 'mouse') { hoverName = pick(e); S.el.style.cursor = hoverName ? 'pointer' : 'grab'; }
  });
  window.addEventListener('pointerup', e => { if (down && !dragged && e.target === S.el.querySelector('canvas')) { const n = pick(e); if (n) moveTo(n); } down = null; });
  S.el.addEventListener('wheel', e => { e.preventDefault(); cam.dist = Math.max(15, Math.min(36, cam.dist + e.deltaY * .02)); }, {passive: false});

  // ---- loop ----
  S.loop(dt => {
    T += dt;
    const cx = Math.sin(cam.az) * Math.cos(cam.el) * cam.dist, cz = Math.cos(cam.az) * Math.cos(cam.el) * cam.dist, cy = Math.sin(cam.el) * cam.dist;
    camera.position.set(cx, cy, cz + 1.2); camera.lookAt(0, 0, .6);
    startRing.rotation.y += dt; goalRing.rotation.y -= dt; flag.rotation.y = Math.sin(T * 2) * .3;
    const nb = new Set(!complete && path.length ? borders[here()] : []);
    Object.entries(nodes).forEach(([n, o]) => {
      const h = n === hoverName ? 1 : 0; o.hover += (h - o.hover) * Math.min(1, dt * 12); o.shake = Math.max(0, o.shake - dt * 3);
      const lift = o.visited * .12 + o.hover * .14, target = .25 + lift;
      o.tile.position.y += (target - o.tile.position.y) * Math.min(1, dt * 10);
      o.g.position.x = pos2(n).x + Math.sin(T * 60) * o.shake * .08;
      const m = o.tile.material; m.emissive.setRGB(0, 0, 0);
      if (o.visited) m.emissive.setHex(0x6b4a10).convertSRGBToLinear();
      else if (nb.has(n) && !path.includes(n)) m.emissive.setHex(0x0e3b46).convertSRGBToLinear().multiplyScalar(.6 + .4 * Math.sin(T * 4));
      if (o.shake > .3) m.emissive.setHex(0x7f1d1d).convertSRGBToLinear();
      if (o.hover > .1) m.emissive.addScalar(.08 * o.hover);
    });
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / .5); const u = tween.t * tween.t * (3 - 2 * tween.t);
      const pa = top(tween.from), pb = top(tween.to); tweenPos.lerpVectors(pa, pb, u); tweenPos.y = 1.05 + Math.sin(Math.PI * u) * .9;
      trav.rotation.y = Math.atan2(-(pb.x - pa.x), -(pb.z - pa.z)); trav.position.copy(tweenPos);
      if (tween.t >= 1) tween = null;
    } else { trav.position.y = 1.05 + Math.sin(T * 3) * .06; }
  });

  S.hud(4, S.bestScore()); beginRoute();
})();
