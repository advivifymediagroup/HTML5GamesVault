(() => {
  const G = Arcade2D({ bestHud: 3 });

  const locations = [
    { name: 'London', x: 0.48, y: 0.32 },
    { name: 'New York', x: 0.28, y: 0.38 },
    { name: 'Tokyo', x: 0.85, y: 0.35 },
    { name: 'Sydney', x: 0.88, y: 0.78 },
    { name: 'Rio de Janeiro', x: 0.35, y: 0.72 },
    { name: 'Cairo', x: 0.55, y: 0.45 },
    { name: 'Mumbai', x: 0.68, y: 0.52 },
    { name: 'Moscow', x: 0.60, y: 0.25 },
    { name: 'Cape Town', x: 0.53, y: 0.80 },
    { name: 'Buenos Aires', x: 0.32, y: 0.82 }
  ];

  let currentTarget = null;
  let score = 0;
  let state = 0; // 0: playing, 1: game over
  let guessPos = null;

  function nextLocation() {
    currentTarget = locations[Math.floor(Math.random() * locations.length)];
    G.status("Find: " + currentTarget.name);
    guessPos = null;
  }

  function init() {
    score = 0;
    state = 0;
    G.hud(1, score);
    nextLocation();
  }

  init(); G.onStart(() => { init(); });

  G.loop((dt) => {
    // Draw map background (simplified as a blue ocean with green landmass representation)
    G.ctx.fillStyle = '#1e3a8a'; // Ocean blue
    G.ctx.fillRect(0, 0, G.W, G.H);

    // Draw pseudo-continents (very stylized for Arcade2D)
    G.ctx.fillStyle = '#166534'; // Land green
    G.ctx.beginPath(); G.ctx.ellipse(G.W * 0.25, G.H * 0.4, G.W * 0.2, G.H * 0.3, 0, 0, Math.PI * 2); G.ctx.fill(); // Americas
    G.ctx.beginPath(); G.ctx.ellipse(G.W * 0.6, G.H * 0.35, G.W * 0.25, G.H * 0.25, 0, 0, Math.PI * 2); G.ctx.fill(); // Eurasia
    G.ctx.beginPath(); G.ctx.ellipse(G.W * 0.55, G.H * 0.6, G.W * 0.15, G.H * 0.2, 0, 0, Math.PI * 2); G.ctx.fill(); // Africa
    G.ctx.beginPath(); G.ctx.ellipse(G.W * 0.85, G.H * 0.75, G.W * 0.1, G.H * 0.1, 0, 0, Math.PI * 2); G.ctx.fill(); // Australia

    // Grid lines for style
    G.ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    G.ctx.lineWidth = 1;
    for(let i=1; i<10; i++) {
        G.ctx.beginPath(); G.ctx.moveTo(0, G.H * i / 10); G.ctx.lineTo(G.W, G.H * i / 10); G.ctx.stroke();
        G.ctx.beginPath(); G.ctx.moveTo(G.W * i / 10, 0); G.ctx.lineTo(G.W * i / 10, G.H); G.ctx.stroke();
    }

    if (state === 0) {
        G.text("Where is " + currentTarget.name + "?", G.W / 2, 40, 24, '#fff');

        if (G.p.justDown) {
            guessPos = { x: G.p.x, y: G.p.y };

            const targetX = currentTarget.x * G.W;
            const targetY = currentTarget.y * G.H;

            const dx = guessPos.x - targetX;
            const dy = guessPos.y - targetY;
            const dist = Math.sqrt(dx*dx + dy*dy);

            // Draw the actual target for feedback
            G.ctx.fillStyle = '#f00';
            G.ctx.beginPath(); G.ctx.arc(targetX, targetY, 8, 0, Math.PI * 2); G.ctx.fill();
            G.ctx.strokeStyle = '#fff'; G.ctx.lineWidth = 2; G.ctx.stroke();

            // Draw guess
            G.ctx.fillStyle = '#ff0';
            G.ctx.beginPath(); G.ctx.arc(guessPos.x, guessPos.y, 6, 0, Math.PI * 2); G.ctx.fill();

            // Draw line between
            G.ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            G.ctx.beginPath(); G.ctx.moveTo(targetX, targetY); G.ctx.lineTo(guessPos.x, guessPos.y); G.ctx.stroke();

            if (dist < 50) {
                let pts = Math.max(10, Math.floor(100 - dist));
                score += pts;
                G.hud(1, score);
                G.flash("+" + pts, 500);
                G.beep(600, 0.1);
                setTimeout(nextLocation, 1000);
            } else {
                G.beep(200, 0.3);
                state = 1;
                G.best(score);
                setTimeout(() => { G.show('Game Over', 'You missed ' + currentTarget.name + ' by ' + Math.floor(dist) + 'km!'); }, 1500);
            }
        }
    } else if (guessPos) {
        // Keep drawing the result while waiting for overlay
        const targetX = currentTarget.x * G.W;
        const targetY = currentTarget.y * G.H;

        G.ctx.fillStyle = '#f00';
        G.ctx.beginPath(); G.ctx.arc(targetX, targetY, 8, 0, Math.PI * 2); G.ctx.fill();
        G.ctx.strokeStyle = '#fff'; G.ctx.lineWidth = 2; G.ctx.stroke();

        G.ctx.fillStyle = '#ff0';
        G.ctx.beginPath(); G.ctx.arc(guessPos.x, guessPos.y, 6, 0, Math.PI * 2); G.ctx.fill();

        G.ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        G.ctx.beginPath(); G.ctx.moveTo(targetX, targetY); G.ctx.lineTo(guessPos.x, guessPos.y); G.ctx.stroke();
    }
  });
})();
