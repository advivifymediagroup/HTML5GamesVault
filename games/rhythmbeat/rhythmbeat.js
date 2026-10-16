(() => {
  const G = Arcade2D({ bestHud: 3 });

  let beats = [], score = 0, state = 0, spawnTimer = 0, beatSpeed = 200, targetY;

  function init() {
    beats = []; score = 0; state = 1; spawnTimer = 0; beatSpeed = 200;
    targetY = G.H * 0.8;
    G.hud(1, score);
  }

  init(); G.onStart(() => { init(); });

  G.loop((dt) => {
    G.ctx.fillStyle = '#1a0b2e';
    G.ctx.fillRect(0, 0, G.W, G.H);

    // Draw Target Line
    G.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    G.ctx.lineWidth = 4;
    G.ctx.beginPath(); G.ctx.moveTo(0, targetY); G.ctx.lineTo(G.W, targetY); G.ctx.stroke();

    G.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    G.ctx.fillRect(0, targetY - 20, G.W, 40);

    if (state === 1) {
        beatSpeed += dt * 2;
        spawnTimer -= dt;

        if (spawnTimer <= 0) {
            beats.push({ y: -30, type: Math.floor(Math.random() * 3) });
            spawnTimer = 0.8 - Math.min(0.5, score * 0.01); // spawn faster over time
        }

        for (let i = beats.length - 1; i >= 0; i--) {
            let b = beats[i];
            b.y += beatSpeed * dt;

            // Draw beat
            let color = ['#ff0055', '#00ffaa', '#ffaa00'][b.type];
            let x = G.W * 0.25 + (b.type * G.W * 0.25);

            G.ctx.fillStyle = color;
            G.ctx.beginPath(); G.ctx.arc(x, b.y, 25, 0, Math.PI*2); G.ctx.fill();
            G.ctx.strokeStyle = '#fff'; G.ctx.lineWidth=2; G.ctx.stroke();

            if (b.y > G.H + 30) {
                state = 2;
                G.beep(100, 0.5, 'sawtooth');
                G.best(score);
                setTimeout(() => G.show('Game Over', 'You missed a beat! Score: ' + score), 500);
            }
        }

        if (G.p.justDown) {
            let hit = false;
            for (let i = 0; i < beats.length; i++) {
                let b = beats[i];
                let x = G.W * 0.25 + (b.type * G.W * 0.25);

                // check distance
                let dx = G.p.x - x;
                let dy = G.p.y - b.y;
                let dist = Math.sqrt(dx*dx + dy*dy);

                if (dist < 40 && Math.abs(b.y - targetY) < 40) {
                    // Good hit
                    score += 10;
                    G.hud(1, score);
                    G.beep(500 + b.type*100, 0.1, 'square');
                    G.burst(x, b.y, ['#ff0055', '#00ffaa', '#ffaa00'][b.type], 10, 100);
                    beats.splice(i, 1);
                    hit = true;
                    break;
                }
            }
            if (!hit) {
                G.beep(200, 0.1, 'sawtooth');
                score = Math.max(0, score - 5);
                G.hud(1, score);
                G.shake(5);
            }
        }
    } else {
         for (let i = beats.length - 1; i >= 0; i--) {
            let b = beats[i];
            let color = ['#ff0055', '#00ffaa', '#ffaa00'][b.type];
            let x = G.W * 0.25 + (b.type * G.W * 0.25);
            G.ctx.fillStyle = color;
            G.ctx.beginPath(); G.ctx.arc(x, b.y, 25, 0, Math.PI*2); G.ctx.fill();
         }
    }
  });
})();
