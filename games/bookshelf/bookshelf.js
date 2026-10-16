(() => {
  const G = Arcade2D({ bestHud: 3 });

  let shelves = [], selected = null, state = 0, moves = 0;

  function init() {
    // 3 shelves, 6 slots each. Books have colors 0, 1, 2.
    shelves = [
        [0, 1, 2, 0, 1, 2],
        [2, 0, 1, 2, 0, 1],
        [1, 2, 0, 1, 2, 0]
    ];
    // Shuffle them to make a puzzle
    for(let i=0; i<20; i++) {
        let r1 = Math.floor(Math.random()*3), c1 = Math.floor(Math.random()*6);
        let r2 = Math.floor(Math.random()*3), c2 = Math.floor(Math.random()*6);
        let temp = shelves[r1][c1];
        shelves[r1][c1] = shelves[r2][c2];
        shelves[r2][c2] = temp;
    }
    selected = null; state = 1; moves = 0; G.hud(1, moves);
  }

  init(); G.onStart(() => { init(); });

  function checkWin() {
    // Each shelf must contain entirely one color.
    for (let i = 0; i < shelves.length; i++) {
        let shelf = shelves[i];
        let first = shelf[0];
        for (let j = 1; j < shelf.length; j++) {
            if (shelf[j] !== first) return false;
        }
    }
    // Also shelves must have distinct colors
    let cols = new Set([shelves[0][0], shelves[1][0], shelves[2][0]]);
    return cols.size === 3;
  }

  G.loop((dt) => {
    G.ctx.fillStyle = '#3a2010';
    G.ctx.fillRect(0, 0, G.W, G.H);

    let sW = G.W * 0.8, bW = sW / 6, bH = 50;
    let startX = G.W * 0.1;
    let startY = 120;

    if (state === 1) {
        for (let i=0; i<shelves.length; i++) {
            let shelf = shelves[i];
            let sY = startY + i * 100;

            // Draw shelf
            G.ctx.fillStyle = '#6e3c1e';
            G.ctx.fillRect(startX - 10, sY + bH, sW + 20, 15);

            // Draw books (horizontal)
            for (let j=0; j<shelf.length; j++) {
                let color = ['#ef4444', '#22c55e', '#3b82f6'][shelf[j]];

                let yOff = 0;
                let isSelected = (selected && selected.r === i && selected.c === j);
                if (isSelected) yOff = -20;

                let bx = startX + j*bW;

                // Spine details
                G.ctx.fillStyle = color;
                G.ctx.fillRect(bx + 2, sY + yOff, bW - 4, bH);

                G.ctx.strokeStyle = '#fff';
                G.ctx.strokeRect(bx + 2, sY + yOff, bW - 4, bH);

                // Spine lines
                G.ctx.fillStyle = 'rgba(255,255,255,0.4)';
                G.ctx.fillRect(bx + 6, sY + yOff + 5, bW - 12, 3);
                G.ctx.fillRect(bx + 6, sY + yOff + 12, bW - 12, 3);
            }

            // Interaction: click a book to select, click another to swap
            if (G.p.justDown) {
                if (G.p.y > sY - 30 && G.p.y < sY + bH + 20) {
                    let col = Math.floor((G.p.x - startX) / bW);
                    if (col >= 0 && col < 6) {
                        if (!selected) {
                            selected = { r: i, c: col };
                            G.beep(300, 0.1);
                        } else {
                            if (selected.r === i && selected.c === col) {
                                selected = null; // deselect
                            } else {
                                // Swap
                                let temp = shelves[selected.r][selected.c];
                                shelves[selected.r][selected.c] = shelves[i][col];
                                shelves[i][col] = temp;
                                selected = null;
                                moves++; G.hud(1, moves);
                                G.beep(400, 0.1);

                                if (checkWin()) {
                                    state = 2; G.best(100 - moves);
                                    setTimeout(() => G.show('Level Complete', 'You organized the library in ' + moves + ' swaps!'), 1000);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
  });
})();
