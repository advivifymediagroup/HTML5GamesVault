(() => {
  const G = Arcade2D({ bestHud: 3 });

  let tubes = [], selected = null, state = 0, moves = 0;

  function init() {
    // 6 tubes, 4 colors, 2 empty. Capacity is 5 coins each.
    tubes = [
        [0, 1, 2, 3, 0],
        [1, 2, 3, 0, 1],
        [2, 3, 0, 1, 2],
        [3, 0, 1, 2, 3],
        [],
        []
    ];
    selected = null; state = 1; moves = 0; G.hud(1, moves);
  }

  init(); G.onStart(() => { init(); });

  function checkWin() {
    for (let tube of tubes) {
        if (tube.length > 0) {
            if (tube.length < 5) return false;
            let first = tube[0];
            for (let i=1; i<5; i++) if (tube[i] !== first) return false;
        }
    }
    return true;
  }

  G.loop((dt) => {
    // Dark arcade background
    G.ctx.fillStyle = '#0f172a';
    G.ctx.fillRect(0, 0, G.W, G.H);

    let tW = 40, tH = 140, gap = 15;
    let startX = (G.W - (6 * tW + 5 * gap)) / 2;
    let tY = G.H * 0.4;

    if (state === 1) {
        for (let i=0; i<tubes.length; i++) {
            let tube = tubes[i];
            let tX = startX + i * (tW + gap);

            // Draw tube
            G.ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            G.ctx.lineWidth = 3;
            G.ctx.beginPath();
            G.ctx.moveTo(tX, tY); G.ctx.lineTo(tX, tY + tH); G.ctx.lineTo(tX + tW, tY + tH); G.ctx.lineTo(tX + tW, tY);
            G.ctx.stroke();

            // Highlight if selected
            if (selected && selected.tube === i) {
                G.ctx.fillStyle = 'rgba(255,255,255,0.1)';
                G.ctx.fillRect(tX, tY, tW, tH);
            }

            // Draw coins (vertical stacking)
            let cH = 20, cW = 34;
            for (let j=0; j<tube.length; j++) {
                // Gold, Silver, Bronze, Platinum
                let color = ['#fbbf24', '#cbd5e1', '#b45309', '#e2e8f0'][tube[j]];
                let innerColor = ['#d97706', '#94a3b8', '#78350f', '#94a3b8'][tube[j]];

                let yOff = 0;
                if (selected && selected.tube === i && j === tube.length - 1) yOff = -tH*0.4; // Lift up

                let cY = tY + tH - (j+1)*cH - 4 + yOff;

                // Coin base
                G.ctx.fillStyle = color;
                G.ctx.beginPath(); G.ctx.ellipse(tX + tW/2, cY + cH/2, cW/2, cH/2, 0, 0, Math.PI*2); G.ctx.fill();
                G.ctx.strokeStyle = '#000'; G.ctx.lineWidth = 1; G.ctx.stroke();

                // Inner ring
                G.ctx.strokeStyle = innerColor;
                G.ctx.beginPath(); G.ctx.ellipse(tX + tW/2, cY + cH/2, cW/2 - 4, cH/2 - 4, 0, 0, Math.PI*2); G.ctx.stroke();
            }

            // Interaction
            if (G.p.justDown && G.p.x > tX && G.p.x < tX + tW) {
                if (!selected && tube.length > 0) {
                    selected = { tube: i, val: tube[tube.length - 1] };
                    G.beep(600, 0.05, 'triangle');
                } else if (selected && selected.tube !== i) {
                    if (tube.length < 5 && (tube.length === 0 || tube[tube.length - 1] === selected.val)) {
                        tubes[selected.tube].pop();
                        tube.push(selected.val);
                        selected = null;
                        moves++; G.hud(1, moves);
                        G.beep(800, 0.08, 'triangle');

                        if (checkWin()) {
                            state = 2; G.best(100 - moves);
                            setTimeout(() => G.show('Level Complete', 'Coins sorted in ' + moves + ' moves!'), 1000);
                        }
                    } else {
                         G.beep(200, 0.15, 'sawtooth');
                    }
                } else if (selected && selected.tube === i) {
                    selected = null;
                }
            }
        }
    }
  });
})();
