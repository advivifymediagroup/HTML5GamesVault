(() => {
  const S = Stage3D({key: 'beatline', bg: 0x070a14, sky: ['#1a1040', '#0b0e22', '#05060f'], fog: [20, 70], fov: 58, bestHud: 4, exposure: 1.15});
  if (!S) return;
  const {scene, camera, wrap} = S;
  const BPM = 128, BEAT = 60 / BPM, SPEED = 21, LEAD = 2, LW = 1.8, TOTAL_BEATS = 108;
  const COLORS = [0x5eead4, 0x93c5fd, 0xf9a8d4, 0xfcd34d], KEYS = ['D', 'F', 'J', 'K'], FREQ = [440, 523.25, 659.25, 783.99];
  const laneX = i => (i - 1.5) * LW;

  // ---- chart ----
  const PAT = [0, 1, 2, 3, 1, 0, 3, 2, 0, 2, 1, 3, 2, 1, 0, 3, 1, 3, 0, 2, 3, 1, 2, 0, 0, 1, 3, 2, 1, 2, 0, 3];
  function makeChart() {
    const ch = []; let p = 0;
    for (let b = 4; b < 100; b++) {
      const lane = PAT[p++ % PAT.length];
      ch.push({lane, beat: b});
      if (b >= 36 && b % 2 === 1) ch.push({lane: PAT[p++ % PAT.length], beat: b + .5});
      if (b >= 68 && b % 4 === 2) ch.push({lane: PAT[p++ % PAT.length], beat: b + .5});
      if (b >= 68 && b % 8 === 0) ch.push({lane: (lane + 2) % 4, beat: b});
    }
    return ch.sort((a, b) => a.beat - b.beat).map(n => ({...n, judged: false, grade: '', mesh: null}));
  }

  // ---- audio ----
  let ac, t0 = 0, nextBeat = 0, timer = 0, noiseBuf;
  const clock = () => ac ? ac.currentTime : performance.now() / 1000;
  function env(node, t, a, d, v) { node.gain.setValueAtTime(.0001, t); node.gain.exponentialRampToValueAtTime(v, t + a); node.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
  function osc(type, f, t, d, v, f2) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    env(g, t, .005, d, v); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + .05);
  }
  function noise(t, d, v, hp) {
    const s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter(); s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp;
    env(g, t, .002, d, v); s.connect(f); f.connect(g); g.connect(ac.destination); s.start(t); s.stop(t + d + .05);
  }
  const ROOT = [110, 87.31, 130.81, 98], CHORD = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]];
  function playBeat(b, t) {
    osc('sine', 150, t, .16, .5, 40);                                         // kick
    if (b % 2 === 1) { noise(t, .12, .22, 1800); osc('triangle', 200, t, .08, .12, 120); } // snare
    noise(t, .04, .06, 7000); noise(t + BEAT / 2, .04, .09, 7000);           // hats
    const bar = Math.floor(b / 4) % 4;
    if (b >= 4) { osc('sawtooth', ROOT[bar], t, BEAT * .9, .16); if (b >= 36) osc('sawtooth', ROOT[bar], t + BEAT * .75, BEAT * .2, .1); }
    if (b % 4 === 0 && b >= 4) CHORD[bar].forEach(f => osc('triangle', f, t, BEAT * 3.8, .05));
    if (b >= 20) for (let k = 0; k < 2; k++) osc('square', CHORD[bar][(b * 2 + k) % 3] * 2, t + k * BEAT / 2, BEAT * .4, .025);
  }
  function sched() {
    while (nextBeat < TOTAL_BEATS && t0 + nextBeat * BEAT < ac.currentTime + .3) { playBeat(nextBeat, t0 + nextBeat * BEAT); nextBeat++; }
    if (nextBeat >= TOTAL_BEATS) clearInterval(timer);
  }

  // ---- scene ----
  scene.add(new THREE.AmbientLight(0x6670c0, .6));
  const keyL = new THREE.PointLight(0xffffff, 1.2, 40); keyL.position.set(0, 6, 2); scene.add(keyL);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(LW * 4 + .3, .2, 90), new THREE.MeshStandardMaterial({color: 0x0c1124, roughness: .35, metalness: .6}));
  floor.position.set(0, -.1, -42); scene.add(floor);
  const strips = COLORS.map((c, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(LW - .1, 90).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({color: c, transparent: true, opacity: .07, blending: THREE.AdditiveBlending, depthWrite: false}));
    m.position.set(laneX(i), .01, -42); scene.add(m); return m;
  });
  for (let i = 0; i <= 4; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(.05, .05, 90), new THREE.MeshBasicMaterial({color: 0x6d7cff})); l.position.set((i - 2) * LW, .02, -42); scene.add(l); }
  const rails = [-1, 1].map(s => { const r = new THREE.Mesh(new THREE.BoxGeometry(.25, .5, 90), new THREE.MeshStandardMaterial({color: 0x1b1f45, emissive: 0x4f46e5, emissiveIntensity: .6, roughness: .3})); r.position.set(s * (LW * 2 + .35), .2, -42); scene.add(r); return r; });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(LW * 4, .08, .12), new THREE.MeshBasicMaterial({color: 0xeafffb})); bar.position.set(0, .06, 0); scene.add(bar);
  const beatLines = Array.from({length: 22}, () => { const l = new THREE.Mesh(new THREE.BoxGeometry(LW * 4, .015, .04), new THREE.MeshBasicMaterial({color: 0x3b4590, transparent: true, opacity: .55})); scene.add(l); return l; });

  function keyTex(ch, col) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#0b1020'; x.fillRect(0, 0, 128, 128); x.strokeStyle = col; x.lineWidth = 8; x.strokeRect(6, 6, 116, 116);
    x.fillStyle = col; x.font = '800 70px "JetBrains Mono",monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, 64, 70);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }
  const pads = COLORS.map((c, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(LW - .15, .22, 1.3), [0, 1, 2, 3, 4, 5].map(f => f === 2 ? new THREE.MeshStandardMaterial({map: keyTex(KEYS[i], '#' + c.toString(16).padStart(6, '0')), emissive: c, emissiveIntensity: .2}) : new THREE.MeshStandardMaterial({color: 0x10162d, emissive: c, emissiveIntensity: .25})));
    m.position.set(laneX(i), .02, 1.2); scene.add(m); return m;
  });
  const noteGeo = new THREE.BoxGeometry(LW - .3, .28, .55), noteMats = COLORS.map(c => new THREE.MeshStandardMaterial({color: c, emissive: c, emissiveIntensity: .45, roughness: .3, metalness: .1}));
  const missMat = new THREE.MeshStandardMaterial({color: 0xfb7185, emissive: 0xe11d48, emissiveIntensity: .5, transparent: true});
  const rings = [0xff3da6, 0x22d3ee, 0x7c3aed].map((c, i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(12 + i * 4, .12, 8, 90), new THREE.MeshBasicMaterial({color: c, transparent: true, opacity: .8})); r.position.set(0, 7, -78 - i * 6); scene.add(r); return r; });
  const stars = new Float32Array(500 * 3); for (let i = 0; i < 500; i++) stars.set([(Math.random() - .5) * 160, Math.random() * 60 + 4, -Math.random() * 120 - 20], i * 3);
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(stars, 3));
  scene.add(new THREE.Points(sgeo, new THREE.PointsMaterial({color: 0xffffff, size: 1.2, sizeAttenuation: false, fog: false})));
  S.polish();

  // ---- DOM: judgement + combo ----
  const mkEl = css => { const e = document.createElement('div'); e.style.cssText = css; wrap.appendChild(e); return e; };
  const judgeEl = mkEl('position:absolute;left:50%;bottom:30%;transform:translateX(-50%);font:800 clamp(18px,4vw,30px) "Space Grotesk",sans-serif;color:#fff;text-shadow:0 0 16px currentColor;pointer-events:none;opacity:0;transition:opacity .25s');
  const comboEl = mkEl('position:absolute;left:50%;top:10px;transform:translateX(-50%);font:800 clamp(16px,3.4vw,26px) "Space Grotesk",sans-serif;color:#fff;opacity:.85;text-shadow:0 0 14px #6d7cff;pointer-events:none');
  let judgeT;
  const say = (t, col) => { judgeEl.textContent = t; judgeEl.style.color = col; judgeEl.style.opacity = 1; clearTimeout(judgeT); judgeT = setTimeout(() => { judgeEl.style.opacity = 0; }, 420); };

  // ---- game state ----
  let notes = [], score = 0, combo = 0, maxCombo = 0, judged = 0, hits = 0, mode = 'idle', endAt = 0, lastBeat = -1, pulse = 0;
  const glow = [0, 0, 0, 0], press = [0, 0, 0, 0];
  const total = () => notes.length;
  const hud = () => { S.hud(1, score.toLocaleString()); S.hud(2, combo); S.hud(3, `${judged} / ${total()}`); comboEl.textContent = combo >= 3 ? combo + ' COMBO' : ''; };

  function start() {
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); ac.resume(); } catch (e) { ac = null; }
    if (ac) { noiseBuf = ac.createBuffer(1, ac.sampleRate * .3, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    clearInterval(timer);
    notes.forEach(n => n.mesh && scene.remove(n.mesh));
    notes = makeChart(); score = combo = maxCombo = judged = hits = 0; lastBeat = -1;
    t0 = clock() + LEAD; nextBeat = 0; mode = 'play';
    if (ac) { timer = setInterval(sched, 40); sched(); }
    endAt = t0 + 100 * BEAT + 1.5; hud(); S.status('Hit D F J K as the notes cross the line.');
  }
  function finish() {
    mode = 'over'; clearInterval(timer);
    const isNew = S.best(score), acc = Math.round(hits / total() * 100);
    S.show('Song complete', `${score.toLocaleString()} points · ${acc}% hit · best combo ${maxCombo}${isNew ? ' — new best!' : ''}`, 'Play again');
  }

  function judge(n, grade, err) {
    n.judged = true; n.grade = grade; judged++;
    if (grade === 'miss') { combo = 0; say('MISS', '#fb7185'); S.beep(90, .12, 'sawtooth', .05); }
    else {
      combo++; hits++; maxCombo = Math.max(maxCombo, combo);
      score += (grade === 'perfect' ? 100 : 55) + Math.min(combo, 30) * 2;
      say(grade === 'perfect' ? 'PERFECT' : 'GOOD', grade === 'perfect' ? '#5eead4' : '#fcd34d');
      glow[n.lane] = 1; S.burst(new THREE.Vector3(laneX(n.lane), .5, 0), COLORS[n.lane], grade === 'perfect' ? 22 : 12, 4);
      if (ac) osc('triangle', FREQ[n.lane], ac.currentTime, .28, .16);
      if (combo === 10 || combo === 25 || combo === 50) { S.flash(combo + ' COMBO!', 700); S.shake(.2); }
    }
    hud();
  }

  function hit(lane) {
    press[lane] = 1;
    if (mode !== 'play') return;
    const t = clock(); let best = null, err = Infinity;
    for (const n of notes) if (!n.judged && n.lane === lane) { const e = Math.abs(t0 + n.beat * BEAT - t); if (e < err) { best = n; err = e; } }
    if (!best || err > .13) { say('', '#fff'); return; }
    judge(best, err <= .06 ? 'perfect' : 'good', err);
  }

  S.loop(dt => {
    const t = clock(), songBeat = (t - t0) / BEAT;
    if (mode === 'play') {
      for (const n of notes) {
        const hitT = t0 + n.beat * BEAT, dtT = hitT - t;
        if (!n.judged && t > hitT + .13) judge(n, 'miss');
        if (dtT < 2.4 && dtT > -.6 && !n.mesh && !(n.judged && n.grade !== 'miss')) { n.mesh = new THREE.Mesh(noteGeo, n.judged ? missMat : noteMats[n.lane]); scene.add(n.mesh); S.polish(); }
        if (n.mesh) {
          if (n.judged && n.grade !== 'miss' || dtT < -.6) { scene.remove(n.mesh); n.mesh = null; continue; }
          n.mesh.position.set(laneX(n.lane), .2, -dtT * SPEED);
          if (n.grade === 'miss') { n.mesh.material = missMat; n.mesh.position.y = .2 - (-dtT) * 1.2; n.mesh.rotation.x = -dtT * 2; }
        }
      }
      if (t > endAt && notes.every(n => n.judged)) finish();
    }
    // beat pulse
    const bi = Math.floor(songBeat);
    if (mode === 'play' && bi !== lastBeat && bi >= 0) { lastBeat = bi; pulse = 1; }
    pulse = Math.max(0, pulse - dt * 4);
    beatLines.forEach((l, i) => { const k = Math.floor(songBeat) - 3 + i; l.position.set(0, .03, (t - (t0 + k * BEAT)) * SPEED); l.visible = l.position.z < 3 && l.position.z > -48; });
    glow.forEach((g, i) => { glow[i] = Math.max(0, g - dt * 3.5); press[i] = Math.max(0, press[i] - dt * 7); strips[i].material.opacity = .07 + glow[i] * .3; pads[i].material.forEach(m => { m.emissiveIntensity = .2 + press[i] * .9 + glow[i] * .6; }); pads[i].position.y = .02 - press[i] * .05; });
    rails.forEach(r => { r.material.emissiveIntensity = .5 + pulse * (.8 + Math.min(combo, 50) / 40); });
    rings.forEach((r, i) => { r.rotation.z += dt * (.3 + i * .15); r.scale.setScalar(1 + pulse * .05); });
    const fever = Math.min(1, combo / 40);
    camera.position.set(Math.sin(t * .3) * .25, 4.7 + pulse * .08, 7.2);
    camera.fov += ((58 + fever * 6 + pulse * 1.5) - camera.fov) * Math.min(1, dt * 6); camera.updateProjectionMatrix();
    camera.lookAt(0, .3, -9);
    keyL.intensity = 1 + pulse * 1.2;
  });

  document.addEventListener('keydown', e => { const lane = {d: 0, f: 1, j: 2, k: 3}[e.key.toLowerCase()]; if (lane !== undefined && !e.repeat) { e.preventDefault(); hit(lane); } });
  document.querySelectorAll('.lane-key').forEach(b => b.addEventListener('pointerdown', () => hit(+b.dataset.lane)));
  S.el.addEventListener('pointerdown', e => { if (mode !== 'play') return; const r = S.el.getBoundingClientRect(); hit(Math.max(0, Math.min(3, Math.floor((e.clientX - r.left) / r.width * 4)))); });

  S.onStart(start);
  S.hud(4, S.bestScore()); S.hud(3, '0 / 0'); notes = [];
})();
