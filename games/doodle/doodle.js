(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const springsEl = document.getElementById('springs');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  const GRAVITY = 0.25;
  const JUMP_V = -11;
  const SPRING_V = -19;
  const MOVE_ACCEL = 0.55;
  const MAX_SPEED = 6.5;
  const FRICTION = 0.92;
  const PLATFORM_W = 62, PLATFORM_H = 10;

  let player;    // {x, y, vx, vy, w, h}
  let platforms; // [{x, y, w, kind, dir?, hasSpring, broken}]
  let cameraY;   // world y offset for scroll
  let highest;   // best world-y (lowest y value)
  let springCount;
  let gameState; // 'ready' | 'play' | 'over'
  let keys;
  let mouseTargetX = null;
  let best = +localStorage.getItem('doodle-best') || 0;
  bestEl.textContent = best;

  function reset() {
    player = {x: W / 2 - 18, y: H - 80, vx: 0, vy: JUMP_V, w: 36, h: 42};
    platforms = [];
    springCount = 0;
    springsEl.textContent = 0;
    cameraY = 0;
    highest = player.y;
    // starting platforms
    platforms.push({x: W / 2 - PLATFORM_W / 2, y: H - 30, w: PLATFORM_W, kind: 'normal', hasSpring: false});
    let py = H - 30;
    while (py > -600) {
      py -= 60 + Math.random() * 40;
      platforms.push(makePlatform(py));
    }
    gameState = 'ready';
    scoreEl.textContent = 0;
    overTitle.textContent = 'Ready?';
    overMsg.textContent = 'Move left/right. You auto-bounce.';
    overlay.classList.add('show');
    statusEl.innerHTML = 'Press Start.';
  }

  function makePlatform(y) {
    const kinds = ['normal', 'normal', 'normal', 'normal', 'moving', 'breakable'];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    return {
      x: 10 + Math.random() * (W - PLATFORM_W - 20),
      y,
      w: PLATFORM_W,
      kind,
      dir: Math.random() < 0.5 ? -1 : 1,
      hasSpring: Math.random() < 0.15 && kind !== 'breakable',
      broken: false
    };
  }

  function start() {
    reset();
    gameState = 'play';
    overlay.classList.remove('show');
    statusEl.innerHTML = 'Jump!';
  }

  function gameOver() {
    gameState = 'over';
    const heightScore = Math.floor(Math.max(0, (H - 80 - highest) / 5));
    if (heightScore > best) {
      best = heightScore;
      localStorage.setItem('doodle-best', best);
      bestEl.textContent = best;
      overTitle.textContent = 'New Best!';
      overMsg.textContent = `${best} m climbed.`;
    } else {
      overTitle.textContent = 'You fell!';
      overMsg.textContent = `${heightScore} m · Best ${best}.`;
    }
    overlay.classList.add('show');
    statusEl.innerHTML = 'Press Start to try again.';
  }

  function update() {
    if (gameState !== 'play') return;

    // horizontal input
    if (keys.left)  player.vx = Math.max(-MAX_SPEED, player.vx - MOVE_ACCEL);
    if (keys.right) player.vx = Math.min( MAX_SPEED, player.vx + MOVE_ACCEL);
    if (!keys.left && !keys.right) player.vx *= FRICTION;
    // mouse-follow (soft)
    if (mouseTargetX !== null) {
      const targetVx = (mouseTargetX - (player.x + player.w / 2)) * 0.13;
      player.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, targetVx));
    }

    player.x += player.vx;
    // wrap sides
    if (player.x > W) player.x = -player.w;
    if (player.x + player.w < 0) player.x = W;

    // gravity
    player.vy += GRAVITY;
    player.y += player.vy;

    // camera scroll if player above mid
    if (player.y < H / 2) {
      const dy = H / 2 - player.y;
      player.y += dy;
      cameraY += dy;
      // recycle offscreen platforms
      for (let i = platforms.length - 1; i >= 0; i--) {
        platforms[i].y += dy;
        if (platforms[i].y > H + 20) platforms.splice(i, 1);
      }
      // spawn new above
      while (platforms.length < 14) {
        const topY = Math.min(...platforms.map(p => p.y));
        platforms.push(makePlatform(topY - 60 - Math.random() * 40));
      }
    }

    // track highest position (in world coords)
    const worldY = player.y - cameraY;
    if (worldY < highest) {
      highest = worldY;
      const heightScore = Math.floor(Math.max(0, (H - 80 - highest) / 5));
      scoreEl.textContent = heightScore;
    }

    // moving platforms
    for (const p of platforms) {
      if (p.kind === 'moving' && !p.broken) {
        p.x += p.dir * 1.6;
        if (p.x <= 0 || p.x + p.w >= W) p.dir *= -1;
      }
    }

    // collisions — only when falling
    if (player.vy > 0) {
      for (const p of platforms) {
        if (p.broken) continue;
        if (
          player.x + player.w > p.x && player.x < p.x + p.w &&
          player.y + player.h >= p.y && player.y + player.h <= p.y + PLATFORM_H + 6
        ) {
          if (p.hasSpring) {
            player.vy = SPRING_V;
            p.hasSpring = false;
            springCount++;
            springsEl.textContent = springCount;
          } else {
            player.vy = JUMP_V;
          }
          if (p.kind === 'breakable') p.broken = true;
        }
      }
    }

    // fell off bottom
    if (player.y > H + 40) gameOver();
  }

  function draw() {
    // bg
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#3b82f6');
    g.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // parallax clouds
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 6; i++) {
      const y = ((i * 90 + cameraY * 0.15) % (H + 60)) - 30;
      const x = (i * 61 + 30) % (W - 40);
      ctx.beginPath();
      ctx.ellipse(x, y, 26, 12, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 20, y + 3, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // platforms
    for (const p of platforms) {
      if (p.broken) continue;
      let color = '#22c55e';
      if (p.kind === 'moving') color = '#06d4f7';
      if (p.kind === 'breakable') color = '#f97316';
      const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + PLATFORM_H);
      grad.addColorStop(0, color);
      grad.addColorStop(1, shade(color, -40));
      ctx.fillStyle = grad;
      roundRect(p.x, p.y, p.w, PLATFORM_H, 4);
      ctx.fill();
      // subtle highlight
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(p.x + 2, p.y + 2, p.w - 4, 2);
      // spring
      if (p.hasSpring) {
        ctx.fillStyle = '#fde047';
        roundRect(p.x + p.w / 2 - 8, p.y - 8, 16, 8, 3);
        ctx.fill();
        ctx.fillStyle = '#92400e';
        ctx.fillRect(p.x + p.w / 2 - 6, p.y - 6, 12, 2);
        ctx.fillRect(p.x + p.w / 2 - 6, p.y - 3, 12, 2);
      }
    }

    // player (blocky doodler)
    const px = player.x, py = player.y;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(px + player.w / 2, py + player.h + 3, 16, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // body
    const bg2 = ctx.createLinearGradient(px, py, px, py + player.h);
    bg2.addColorStop(0, '#fde047');
    bg2.addColorStop(1, '#f59e0b');
    ctx.fillStyle = bg2;
    roundRect(px, py, player.w, player.h, 8);
    ctx.fill();
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 2;
    ctx.stroke();
    // face
    ctx.fillStyle = '#fff';
    const eyeOffset = player.vx > 0 ? 4 : (player.vx < 0 ? -4 : 0);
    ctx.beginPath();
    ctx.arc(px + 12 + eyeOffset, py + 14, 5, 0, Math.PI * 2);
    ctx.arc(px + 24 + eyeOffset, py + 14, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(px + 12 + eyeOffset + 1, py + 14, 2.5, 0, Math.PI * 2);
    ctx.arc(px + 24 + eyeOffset + 1, py + 14, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // smile
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px + player.w / 2, py + 26, 6, 0, Math.PI);
    ctx.stroke();

    // starting hint
    if (gameState === 'ready') {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = 'bold 14px "Space Grotesk"';
      ctx.textAlign = 'center';
      ctx.fillText('← → to move', W / 2, 30);
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function shade(hex, amt) {
    let h = hex.replace('#','');
    const num = parseInt(h, 16);
    let r = ((num >> 16) & 0xff) + amt; r = Math.max(0, Math.min(255, r));
    let g = ((num >> 8) & 0xff) + amt; g = Math.max(0, Math.min(255, g));
    let b = (num & 0xff) + amt; b = Math.max(0, Math.min(255, b));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  keys = {left: false, right: false};
  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (['arrowleft', 'a'].includes(k))  { e.preventDefault(); keys.left = true; mouseTargetX = null; }
    if (['arrowright', 'd'].includes(k)) { e.preventDefault(); keys.right = true; mouseTargetX = null; }
  });
  document.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (['arrowleft', 'a'].includes(k)) keys.left = false;
    if (['arrowright', 'd'].includes(k)) keys.right = false;
  });
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const scale = W / rect.width;
    mouseTargetX = (e.clientX - rect.left) * scale;
  });
  canvas.addEventListener('mouseleave', () => { mouseTargetX = null; });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scale = W / rect.width;
    mouseTargetX = (e.touches[0].clientX - rect.left) * scale;
  }, {passive: false});
  canvas.addEventListener('touchstart', e => {
    if (gameState === 'ready') start();
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scale = W / rect.width;
    mouseTargetX = (e.touches[0].clientX - rect.left) * scale;
  }, {passive: false});

  document.getElementById('startBtn').addEventListener('click', start);
  document.getElementById('restartOverlay').addEventListener('click', start);

  reset();
  loop();
})();
