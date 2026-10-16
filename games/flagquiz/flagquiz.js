(() => {
  const G = Arcade2D({ bestHud: 3 });

  const flags = [
    { country: 'Japan', colors: ['#fff', '#bc002d', '#fff'] }, // simplification
    { country: 'France', colors: ['#002395', '#fff', '#ed2939'], vertical: true },
    { country: 'Germany', colors: ['#000', '#dd0000', '#ffce00'] },
    { country: 'Italy', colors: ['#009246', '#fff', '#ce2b37'], vertical: true },
    { country: 'Sweden', colors: ['#006aa7', '#fecc00', '#006aa7'] }, // cross approx
    { country: 'Nigeria', colors: ['#008751', '#fff', '#008751'], vertical: true }
  ];

  let currentFlag = null;
  let options = [];
  let score = 0;
  let state = 0;

  function nextFlag() {
    currentFlag = flags[Math.floor(Math.random() * flags.length)];

    options = [currentFlag.country];
    while(options.length < 3) {
        let f = flags[Math.floor(Math.random() * flags.length)].country;
        if (!options.includes(f)) options.push(f);
    }
    options.sort(() => Math.random() - 0.5);
  }

  function init() {
    score = 0; state = 1; G.hud(1, score);
    nextFlag();
  }

  init(); G.onStart(() => { init(); });

  G.loop((dt) => {
    G.ctx.fillStyle = '#222';
    G.ctx.fillRect(0, 0, G.W, G.H);

    if (state === 1) {
        G.text("Which country?", G.W/2, G.H * 0.15, 24, '#fff');

        // Draw Flag (Simplified Abstract rep)
        let fW = G.W * 0.6, fH = fW * 0.6;
        let fX = (G.W - fW) / 2, fY = G.H * 0.25;

        G.ctx.fillStyle = '#fff';
        G.ctx.fillRect(fX-2, fY-2, fW+4, fH+4); // border

        if (currentFlag.country === 'Japan') {
             G.ctx.fillStyle = currentFlag.colors[0]; G.ctx.fillRect(fX, fY, fW, fH);
             G.ctx.fillStyle = currentFlag.colors[1]; G.ctx.beginPath(); G.ctx.arc(fX + fW/2, fY + fH/2, fH * 0.3, 0, Math.PI*2); G.ctx.fill();
        } else if (currentFlag.country === 'Sweden') {
             G.ctx.fillStyle = currentFlag.colors[0]; G.ctx.fillRect(fX, fY, fW, fH);
             G.ctx.fillStyle = currentFlag.colors[1];
             G.ctx.fillRect(fX + fW*0.3, fY, fW*0.15, fH);
             G.ctx.fillRect(fX, fY + fH*0.4, fW, fH*0.2);
        } else {
             // 3 stripes
             for(let i=0; i<3; i++) {
                 G.ctx.fillStyle = currentFlag.colors[i];
                 if (currentFlag.vertical) {
                     G.ctx.fillRect(fX + (fW/3)*i, fY, fW/3, fH);
                 } else {
                     G.ctx.fillRect(fX, fY + (fH/3)*i, fW, fH/3);
                 }
             }
        }

        // Draw Options
        for (let i=0; i<3; i++) {
            let oY = G.H * 0.65 + i * 60;
            G.ctx.fillStyle = '#444';
            G.ctx.fillRect(G.W * 0.1, oY, G.W * 0.8, 50);
            G.text(options[i], G.W/2, oY + 25, 20, '#fff');

            if (G.p.justDown && G.p.x > G.W*0.1 && G.p.x < G.W*0.9 && G.p.y > oY && G.p.y < oY+50) {
                if (options[i] === currentFlag.country) {
                    score++; G.hud(1, score); G.beep(500, 0.1);
                    nextFlag();
                } else {
                    state = 2; G.beep(200, 0.4, 'sawtooth'); G.best(score);
                    setTimeout(() => G.show('Game Over', 'That was ' + currentFlag.country + '! Score: ' + score), 1000);
                }
            }
        }
    }
  });
})();
