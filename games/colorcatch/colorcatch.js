(() => {
  const board = document.getElementById('board');
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const targetEl = document.getElementById('target');
  const statusEl = document.getElementById('status');
  const colors = [
    { name: 'Blue', value: '#38bdf8' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Green', value: '#34d399' },
    { name: 'Yellow', value: '#fde047' }
  ];
  let target = colors[0];
  let score = 0;
  let lives = 3;
  let streak = 0;
  let running = false;
  let spawnTimer = null;
  let targetTimer = null;
  let interval = 900;

  function start() {
    reset(false);
    running = true;
    statusEl.textContent = 'Catch the target color. Ignore the rest.';
    scheduleSpawn();
    targetTimer = setInterval(changeTarget, 8000);
  }

  function reset(clearStatus = true) {
    running = false;
    clearTimeout(spawnTimer);
    clearInterval(targetTimer);
    board.innerHTML = '';
    score = 0;
    lives = 3;
    streak = 0;
    interval = 900;
    target = colors[Math.floor(Math.random() * colors.length)];
    updateHud();
    if (clearStatus) statusEl.textContent = 'Catch only the target color before tiles vanish.';
  }

  function scheduleSpawn() {
    if (!running) return;
    spawnTimer = setTimeout(() => {
      spawnTile();
      scheduleSpawn();
    }, interval);
  }

  function spawnTile() {
    const color = Math.random() < 0.42 ? target : colors[Math.floor(Math.random() * colors.length)];
    const tile = document.createElement('button');
    tile.className = 'catch-tile';
    tile.style.background = color.value;
    const rect = board.getBoundingClientRect();
    const size = 56;
    tile.style.left = Math.random() * Math.max(0, rect.width - size) + 'px';
    tile.style.top = Math.random() * Math.max(0, rect.height - size) + 'px';
    tile.setAttribute('aria-label', color.name);
    board.appendChild(tile);

    const ttl = Math.max(650, 1500 - score * 8);
    const expiry = setTimeout(() => {
      if (!tile.isConnected) return;
      tile.remove();
      if (color.name === target.name) loseLife('Missed a target tile.');
    }, ttl);

    tile.addEventListener('click', () => {
      clearTimeout(expiry);
      tile.remove();
      if (color.name === target.name) {
        streak++;
        score += 10 + Math.min(streak, 12) * 3;
        interval = Math.max(360, interval - 12);
        statusEl.textContent = streak >= 5 ? `${streak} streak!` : 'Nice catch.';
      } else {
        streak = 0;
        loseLife(`That was ${color.name}, not ${target.name}.`);
      }
      updateHud();
    });
  }

  function loseLife(message) {
    if (!running) return;
    lives--;
    streak = 0;
    statusEl.textContent = message;
    if (lives <= 0) finish();
    updateHud();
  }

  function changeTarget() {
    const options = colors.filter(c => c.name !== target.name);
    target = options[Math.floor(Math.random() * options.length)];
    statusEl.textContent = `New target: ${target.name}`;
    updateHud();
  }

  function finish() {
    running = false;
    clearTimeout(spawnTimer);
    clearInterval(targetTimer);
    board.innerHTML = '';
    const best = Math.max(+localStorage.getItem('colorcatch-best') || 0, score);
    localStorage.setItem('colorcatch-best', best);
    statusEl.textContent = `Game over. Score ${score}. Best ${best}.`;
  }

  function updateHud() {
    scoreEl.textContent = score;
    livesEl.textContent = lives;
    targetEl.textContent = target.name;
    targetEl.style.color = target.value;
  }

  document.getElementById('startBtn').addEventListener('click', start);
  document.getElementById('resetBtn').addEventListener('click', () => reset());
  updateHud();
})();
