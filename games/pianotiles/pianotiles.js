(() => {
  const G = Arcade2D({ bestHud: 3 });

  let tiles = [], score = 0, state = 0, speed = 300, spawnTimer = 0;

  function init() {
    tiles = []; score = 0; state = 1; speed = 300; spawnTimer = 0;
    G.hud(1, score);
    for(let i=0; i<4; i++) spawnTile(-i * (G.H / 4));
  }

  function spawnTile(yOffset) {
    tiles.push({
        col: Math.floor(Math.random() * 4),
        y: yOffset || -G.H / 4,
        h: G.H / 4,
        tapped: false
    });
  }

  init(); G.onStart(() => { init(); });

  G.loop((dt) => {
    G.ctx.fillStyle = '#fff';
    G.ctx.fillRect(0, 0, G.W, G.H);

    const colW = G.W / 4;

    // Draw columns
    for(let i=1; i<4; i++) {
        G.ctx.strokeStyle = '#eee';
        G.ctx.beginPath(); G.ctx.moveTo(i*colW, 0); G.ctx.lineTo(i*colW, G.H); G.ctx.stroke();
    }

    if (state === 1) {
        speed += dt * 5; // slowly increase speed

        for (let i = tiles.length - 1; i >= 0; i--) {
            let t = tiles[i];
            t.y += speed * dt;

            // Draw tile
            if (!t.tapped) {
                G.ctx.fillStyle = '#000';
                G.ctx.fillRect(t.col * colW, t.y, colW, t.h);
            } else {
                G.ctx.fillStyle = '#ccc';
                G.ctx.fillRect(t.col * colW, t.y, colW, t.h);
            }

            // Missed a tile
            if (t.y > G.H && !t.tapped) {
                state = 2;
                G.beep(100, 0.5, 'sawtooth');
                G.best(score);
                G.ctx.fillStyle = '#f00'; G.ctx.fillRect(t.col * colW, t.y - speed*dt, colW, t.h); // highlight missed
                setTimeout(() => G.show('Game Over', 'You missed a tile! Score: ' + score), 500);
            }

            // Cleanup old tiles & spawn new
            if (t.y > G.H) {
                tiles.splice(i, 1);
                spawnTile();
            }
        }

        if (G.p.justDown) {
            let col = Math.floor(G.p.x / colW);
            let hit = false;

            // Check lowest untapped tile in that column
            let targetTile = null;
            for(let t of tiles) {
                if(t.col === col && !t.tapped && t.y + t.h > 0) {
                    if(!targetTile || t.y > targetTile.y) targetTile = t;
                }
            }

            if (targetTile && G.p.y > targetTile.y && G.p.y < targetTile.y + targetTile.h) {
                targetTile.tapped = true;
                score++;
                G.hud(1, score);
                G.beep(400 + (score%8)*50, 0.1, 'sine');
                hit = true;
            }

            if (!hit) {
                state = 2;
                G.beep(100, 0.5, 'sawtooth');
                G.best(score);
                G.ctx.fillStyle = '#f00'; G.ctx.fillRect(col * colW, G.p.y - G.H/8, colW, G.H/4); // highlight wrong tap
                setTimeout(() => G.show('Game Over', 'You tapped the wrong tile! Score: ' + score), 500);
            }
        }
    } else {
        // Draw static tiles for game over screen
        for (let t of tiles) {
            G.ctx.fillStyle = t.tapped ? '#ccc' : '#000';
            G.ctx.fillRect(t.col * colW, t.y, colW, t.h);
        }
    }
  });
})();
