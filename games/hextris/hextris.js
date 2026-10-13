(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const levelEl = document.getElementById('level');
  const comboEl = document.getElementById('combo');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayMessage = document.getElementById('overlayMessage');
  const overlayButton = document.getElementById('overlayButton');
  const statusEl = document.getElementById('status');

  const COLORS = ['#ff526f', '#ffc857', '#55d6be', '#48a9ff', '#b78cff', '#ff8a4c'];
  const LANES = 6;
  const DEPTH = 6;
  const CELL = 28;
  const INNER_RADIUS = 62;
  const OUTER_RADIUS = INNER_RADIUS + DEPTH * CELL;
  const STORAGE_KEY = 'hextris-best';

  let blocks = [];
  let activeBlock = null;
  let score = 0;
  let best = readBest();
  let combo = 0;
  let running = false;
  let paused = false;
  let ended = false;
  let respawnMs = 360;
  let moveMs = 780;
  let respawnTimer = 0;
  let moveTimer = 0;
  let lastFrame = 0;
  let animationId = 0;
  let width = 620;
  let height = 620;
  let pixelRatio = 1;

  function readBest() {
    try { return Number(localStorage.getItem(STORAGE_KEY)) || 0; } catch (error) { return 0; }
  }

  function saveBest() {
    try { localStorage.setItem(STORAGE_KEY, String(best)); } catch (error) {}
  }

  function updateHud() {
    scoreEl.textContent = score;
    bestEl.textContent = best;
    levelEl.textContent = Math.floor(score / 180) + 1;
    comboEl.textContent = `x${combo}`;
  }

  function showOverlay(title, message, buttonText) {
    overlayTitle.textContent = title;
    overlayMessage.textContent = message;
    overlayButton.textContent = buttonText;
    overlay.classList.add('show');
  }

  function startGame() {
    blocks = [];
    activeBlock = null;
    score = 0;
    combo = 0;
    respawnTimer = 0;
    moveTimer = 0;
    moveMs = 780;
    running = true;
    paused = false;
    ended = false;
    document.getElementById('pause').textContent = 'Pause';
    overlay.classList.remove('show');
    statusEl.textContent = 'Match three or more blocks. The pace picks up as your score climbs.';
    updateHud();
    spawnBlock();
    if (!animationId) animationId = requestAnimationFrame(frame);
  }

  function endGame() {
    running = false;
    paused = false;
    ended = true;
    statusEl.textContent = `Game over. Final score: ${score}.`;
    showOverlay('Game over', `Score ${score}  ·  Best ${best}`, 'Play again');
  }

  function rotateLanes(direction) {
    if (!running || paused) return;
    blocks.forEach(block => { block.lane = (block.lane + direction + LANES) % LANES; });
    resolveMatches();
    updateHud();
  }

  function spawnBlock() {
    const openLanes = Array.from({length: LANES}, (_, lane) => lane)
      .filter(lane => !blocks.some(block => block.lane === lane && block.depth === DEPTH - 1));
    if (!openLanes.length) {
      endGame();
      return;
    }
    const lane = openLanes[Math.floor(Math.random() * openLanes.length)];
    activeBlock = {lane, depth: DEPTH - 1, color: Math.floor(Math.random() * COLORS.length)};
  }

  function advanceActiveBlock() {
    if (!activeBlock) return;
    const nextDepth = activeBlock.depth - 1;
    const blocked = nextDepth < 0 || blocks.some(block => block.lane === activeBlock.lane && block.depth === nextDepth);
    if (!blocked) {
      activeBlock.depth = nextDepth;
      return;
    }
    if (activeBlock.depth === DEPTH - 1) {
      endGame();
      return;
    }
    blocks.push(activeBlock);
    activeBlock = null;
    respawnTimer = 0;
    moveTimer = 0;
    resolveMatches();
    if (!running) return;
    moveMs = Math.max(520, 780 - Math.floor(score / 180) * 30);
    updateHud();
  }

  function resolveMatches() {
    let clearedInChain = 0;
    while (true) {
      const byCell = new Map(blocks.map(block => [`${block.lane}:${block.depth}`, block]));
      const visited = new Set();
      const toRemove = new Set();

      for (const block of blocks) {
        const key = `${block.lane}:${block.depth}`;
        if (visited.has(key)) continue;
        const group = [];
        const stack = [block];
        visited.add(key);
        while (stack.length) {
          const current = stack.pop();
          group.push(current);
          const neighbors = [
            [current.lane, current.depth - 1],
            [current.lane, current.depth + 1],
            [(current.lane + LANES - 1) % LANES, current.depth],
            [(current.lane + 1) % LANES, current.depth]
          ];
          for (const [lane, depth] of neighbors) {
            const neighbor = byCell.get(`${lane}:${depth}`);
            const neighborKey = `${lane}:${depth}`;
            if (neighbor && neighbor.color === current.color && !visited.has(neighborKey)) {
              visited.add(neighborKey);
              stack.push(neighbor);
            }
          }
        }
        if (group.length >= 3) group.forEach(item => toRemove.add(item));
      }

      if (!toRemove.size) break;
      clearedInChain += 1;
      const multiplier = combo + clearedInChain;
      score += [...toRemove].length * 10 * Math.max(1, multiplier);
      blocks = blocks.filter(block => !toRemove.has(block));
    }

    if (clearedInChain) {
      combo += clearedInChain;
      statusEl.textContent = `${clearedInChain > 1 ? 'Chain clear!' : 'Nice clear!'} Combo x${combo}`;
      if (score > best) {
        best = score;
        saveBest();
      }
    } else if (running) {
      combo = 0;
    }
    updateHud();
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    draw();
  }

  function polygon(radius, sides = 6, offset = -Math.PI / 2) {
    ctx.beginPath();
    for (let side = 0; side < sides; side++) {
      const angle = offset + side * Math.PI * 2 / sides;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (side === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawBlock(block, centerX, centerY, scale) {
    const lane = block.lane;
    const angle = -Math.PI / 2 + lane * Math.PI / 3;
    const inner = INNER_RADIUS + block.depth * CELL + 2;
    const outer = inner + CELL - 4;
    const halfAngle = Math.PI / 6 - 0.035;
    const points = [
      [inner, angle - halfAngle], [outer, angle - halfAngle],
      [outer, angle + halfAngle], [inner, angle + halfAngle]
    ];
    ctx.beginPath();
    points.forEach(([radius, theta], index) => {
      const x = centerX + Math.cos(theta) * radius * scale;
      const y = centerY + Math.sin(theta) * radius * scale;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = COLORS[block.color];
    ctx.shadowColor = COLORS[block.color];
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.38)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function draw() {
    if (!ctx) return;
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = Math.min(width, height) / 540;
    const radius = OUTER_RADIUS * scale;
    ctx.clearRect(0, 0, width, height);
    const background = ctx.createRadialGradient(centerX, centerY, 20, centerX, centerY, width * 0.7);
    background.addColorStop(0, '#202b43');
    background.addColorStop(1, '#101624');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(centerX, centerY);
    polygon(radius);
    ctx.fillStyle = 'rgba(6, 10, 18, 0.42)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(180, 194, 211, 0.72)';
    ctx.lineWidth = 3 * scale;
    ctx.stroke();
    for (let lane = 0; lane < LANES; lane++) {
      const angle = -Math.PI / 2 + lane * Math.PI / 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * INNER_RADIUS * scale, Math.sin(angle) * INNER_RADIUS * scale);
      ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      ctx.strokeStyle = 'rgba(171, 184, 203, 0.24)';
      ctx.lineWidth = 1 * scale;
      ctx.stroke();
    }
    ctx.restore();

    blocks.forEach(block => drawBlock(block, centerX, centerY, scale));
    if (activeBlock) {
      const progress = running && !paused ? moveTimer / moveMs : 0;
      drawBlock({...activeBlock, depth: Math.max(0, activeBlock.depth - progress)}, centerX, centerY, scale);
    }

    ctx.save();
    ctx.translate(centerX, centerY);
    polygon(INNER_RADIUS * 0.88 * scale);
    ctx.fillStyle = '#8793a4';
    ctx.shadowColor = 'rgba(0,0,0,0.48)';
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.42)';
    ctx.lineWidth = 2 * scale;
    ctx.stroke();
    ctx.fillStyle = '#202a38';
    ctx.font = `700 ${Math.max(11, 16 * scale)}px Space Grotesk, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HEX', 0, 0);
    ctx.restore();
  }

  function frame(timestamp) {
    animationId = 0;
    if (running && !paused) {
      const elapsed = lastFrame ? Math.min(timestamp - lastFrame, 100) : 0;
      if (activeBlock) {
        moveTimer += elapsed;
        while (moveTimer >= moveMs && activeBlock && running) {
          moveTimer -= moveMs;
          advanceActiveBlock();
        }
      } else if (running) {
        respawnTimer += elapsed;
        if (respawnTimer >= respawnMs) {
          respawnTimer = 0;
          spawnBlock();
        }
      }
      lastFrame = timestamp;
    } else {
      lastFrame = timestamp;
    }
    draw();
    if (running || paused) animationId = requestAnimationFrame(frame);
  }

  function togglePause() {
    if (ended || !running) return;
    paused = !paused;
    document.getElementById('pause').textContent = paused ? 'Resume' : 'Pause';
    if (paused) showOverlay('Paused', 'Take a breath. Your stack is waiting.', 'Resume');
    else overlay.classList.remove('show');
    if (paused && !animationId) animationId = requestAnimationFrame(frame);
    statusEl.textContent = paused ? 'Paused.' : 'Back in the game.';
  }

  document.getElementById('rotateLeft').addEventListener('click', () => rotateLanes(-1));
  document.getElementById('rotateRight').addEventListener('click', () => rotateLanes(1));
  document.getElementById('pause').addEventListener('click', togglePause);
  overlayButton.addEventListener('click', () => {
    if (paused) togglePause();
    else startGame();
  });
  window.addEventListener('keydown', event => {
    if (['ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') rotateLanes(-1);
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') rotateLanes(1);
    if (event.key.toLowerCase() === 'p' || event.key === 'Escape') togglePause();
    if ((event.key === ' ' || event.key === 'Enter') && !running && !paused) startGame();
  });
  window.addEventListener('resize', resizeCanvas);
  if ('ResizeObserver' in window) new ResizeObserver(resizeCanvas).observe(canvas);

  bestEl.textContent = best;
  updateHud();
  resizeCanvas();
})();