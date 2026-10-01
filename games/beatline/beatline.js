(() => {
  const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score'), comboEl = document.getElementById('combo');
  const bestEl = document.getElementById('best'), notesEl = document.getElementById('notes');
  const statusEl = document.getElementById('status'), overlay = document.getElementById('overlay');
  const W = canvas.width, H = canvas.height, HIT_Y = 425, TRAVEL = 1900, BPM_MS = 470;
  const colors = ['#5eead4','#93c5fd','#f9a8d4','#fcd34d'];
  const pattern = [0,1,2,3,1,0,3,2,0,2,1,3,2,1,0,3,1,3,0,2,3,1,2,0,0,1,3,2,1,2,0,3];
  const bestKey = 'beatline-best';
  let notes = [], score = 0, combo = 0, best = +localStorage.getItem(bestKey) || 0, startedAt = 0, running = false, judged = 0, feedback = '';
  bestEl.textContent = best;

  function makeChart() {
    return Array.from({length:64}, (_, beat) => ({lane:pattern[beat % pattern.length], hitAt:startedAt + 1400 + beat * BPM_MS, judged:false, grade:''}));
  }

  function draw(now = performance.now()) {
    const bg = ctx.createLinearGradient(0,0,0,H); bg.addColorStop(0,'#15191e'); bg.addColorStop(1,'#101923');
    ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);
    const laneW = W / 4;
    for (let lane=0; lane<4; lane++) {
      const x = lane * laneW;
      ctx.fillStyle = lane % 2 ? 'rgba(255,255,255,.018)' : 'rgba(255,255,255,.04)'; ctx.fillRect(x,0,laneW,H);
      ctx.fillStyle = colors[lane]; ctx.globalAlpha = .13; ctx.fillRect(x+2,H-64,laneW-4,60); ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke();
      ctx.fillStyle = colors[lane]; ctx.font = '700 17px JetBrains Mono,monospace'; ctx.textAlign = 'center'; ctx.fillText(['D','F','J','K'][lane],x+laneW/2,H-22);
    }
    ctx.fillStyle = '#e9f2f2'; ctx.shadowColor = '#5eead4'; ctx.shadowBlur = 16; ctx.fillRect(0,HIT_Y,W,3); ctx.shadowBlur = 0;
    for (const note of notes) {
      if (note.judged && note.grade !== 'miss') continue;
      const y = HIT_Y - ((note.hitAt - now) / TRAVEL) * (HIT_Y - 34);
      if (y < -30 || y > H + 20) continue;
      const x = note.lane * laneW + laneW/2;
      ctx.shadowColor = colors[note.lane]; ctx.shadowBlur = 18;
      ctx.fillStyle = note.judged ? '#fb7185' : colors[note.lane];
      ctx.beginPath(); ctx.roundRect(x-32,y-9,64,18,9); ctx.fill(); ctx.shadowBlur = 0;
    }
    if (feedback) { ctx.fillStyle = '#f3f5e9'; ctx.font = '700 28px Space Grotesk,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(feedback,W/2,100); }
  }

  function updateHud() { scoreEl.textContent = score.toLocaleString(); comboEl.textContent = combo; notesEl.textContent = `${judged} / 64`; }
  function finish() {
    running = false;
    if (score > best) { best = score; localStorage.setItem(bestKey,best); bestEl.textContent = best; }
    document.getElementById('overTitle').textContent = 'Song complete';
    document.getElementById('overMsg').textContent = `${score.toLocaleString()} points · ${judged - notes.filter(n => n.grade === 'miss').length} hits.`;
    document.getElementById('restartOverlay').textContent = 'Play again'; overlay.classList.add('show');
    statusEl.textContent = 'Run it back and beat your best score.'; draw();
  }

  function tick(now) {
    if (!running) return;
    for (const note of notes) if (!note.judged && now > note.hitAt + 150) {
      note.judged = true; note.grade = 'miss'; combo = 0; judged++; feedback = 'MISS'; updateHud();
    }
    draw(now);
    if (notes.every(note => note.judged)) { finish(); return; }
    requestAnimationFrame(tick);
  }

  function start() {
    score = 0; combo = 0; judged = 0; feedback = ''; running = true; startedAt = performance.now(); notes = makeChart();
    updateHud(); overlay.classList.remove('show'); statusEl.textContent = 'Get ready…'; requestAnimationFrame(tick);
  }

  function hit(lane) {
    if (!running) return;
    const now = performance.now();
    let candidate = null, error = Infinity;
    for (const note of notes) if (!note.judged && note.lane === lane) {
      const gap = Math.abs(note.hitAt - now); if (gap < error) { candidate = note; error = gap; }
    }
    if (!candidate || error > 150) { feedback = 'EARLY'; statusEl.textContent = 'Keep your timing on the beat.'; return; }
    candidate.judged = true; judged++; combo++;
    const perfect = error <= 65; candidate.grade = perfect ? 'perfect' : 'good';
    score += (perfect ? 100 : 55) + Math.min(combo,30) * 2;
    feedback = perfect ? 'PERFECT' : 'GOOD'; statusEl.textContent = `${feedback} · ${combo} combo`;
    updateHud();
  }

  document.addEventListener('keydown', event => {
    const lane = {'d':0,'f':1,'j':2,'k':3}[event.key.toLowerCase()];
    if (lane !== undefined && !event.repeat) { event.preventDefault(); hit(lane); }
  });
  document.querySelectorAll('.lane-key').forEach(button => button.addEventListener('pointerdown', () => hit(+button.dataset.lane)));
  document.getElementById('startBtn').addEventListener('click', start);
  document.getElementById('restartOverlay').addEventListener('click', start);
  draw();
})();