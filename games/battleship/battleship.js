(() => {
  const G = Arcade2D({ bestHud: 3 });
  let playerBoard = [], aiBoard = [], state = 0, playerHits = 0, aiHits = 0;

  function placeShips(board) {
    for (let i = 0; i < 5; i++) {
      let r = Math.floor(Math.random() * 10), c = Math.floor(Math.random() * 10);
      while(board[r][c] === 1) { r = Math.floor(Math.random() * 10); c = Math.floor(Math.random() * 10); }
      board[r][c] = 1;
    }
  }

  function init() {
    playerBoard = Array(10).fill(0).map(() => Array(10).fill(0));
    aiBoard = Array(10).fill(0).map(() => Array(10).fill(0));
    placeShips(playerBoard);
    placeShips(aiBoard);
    state = 1; playerHits = 0; aiHits = 0;
    G.hud(1, 0);
  }

  init(); G.onStart(() => { init(); });

  function aiTurn() {
    if (state !== 1) return;
    let r, c;
    do {
       r = Math.floor(Math.random() * 10);
       c = Math.floor(Math.random() * 10);
    } while (playerBoard[r][c] > 1); // 2 is miss, 3 is hit

    if (playerBoard[r][c] === 0) {
        playerBoard[r][c] = 2; // miss
        G.beep(300, 0.1, 'square');
    } else if (playerBoard[r][c] === 1) {
        playerBoard[r][c] = 3; // hit
        aiHits++;
        G.beep(150, 0.3, 'sawtooth');
        G.shake(10);
        if (aiHits >= 5) {
            state = 2;
            setTimeout(() => G.show('Defeat', 'The enemy sank all your ships!'), 1000);
        }
    }
  }

  G.loop((dt) => {
    G.ctx.fillStyle = '#0a2a4a';
    G.ctx.fillRect(0, 0, G.W, G.H);

    const s = Math.min(G.W, G.H / 2) / 11;

    // Draw Enemy Board (Top)
    G.ctx.save();
    G.ctx.translate(G.W/2 - (s*10)/2, G.H * 0.05);
    G.text("ENEMY WATERS", s*5, -15, 16, '#ffaa00');

    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        G.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        G.ctx.strokeRect(j * s, i * s, s, s);

        if (aiBoard[i][j] === 2) { // miss
          G.ctx.fillStyle = '#aaa'; G.ctx.beginPath(); G.ctx.arc(j * s + s / 2, i * s + s / 2, s * 0.3, 0, 7); G.ctx.fill();
        } else if (aiBoard[i][j] === 3) { // hit
          G.ctx.fillStyle = '#f00'; G.ctx.beginPath(); G.ctx.arc(j * s + s / 2, i * s + s / 2, s * 0.4, 0, 7); G.ctx.fill();
        }
      }
    }

    // Player Interaction
    if (state === 1 && G.p.justDown) {
      const j = Math.floor((G.p.x - (G.W/2 - (s*10)/2)) / s);
      const i = Math.floor((G.p.y - G.H * 0.05) / s);

      if (i >= 0 && i < 10 && j >= 0 && j < 10 && aiBoard[i][j] < 2) {
        if (aiBoard[i][j] === 0) {
            aiBoard[i][j] = 2;
            G.beep(400, 0.1);
        } else if (aiBoard[i][j] === 1) {
            aiBoard[i][j] = 3;
            playerHits++;
            G.hud(1, playerHits * 100);
            G.beep(800, 0.2);
            G.burst(G.p.x, G.p.y, '#f00', 20, 200, 4);
        }

        if (playerHits >= 5) {
          state = 2; G.best(playerHits * 100);
          setTimeout(() => G.show('Victory', 'You sank the enemy fleet!'), 1000);
        } else {
          setTimeout(aiTurn, 500);
        }
      }
    }
    G.ctx.restore();

    // Draw Player Board (Bottom)
    G.ctx.save();
    G.ctx.translate(G.W/2 - (s*10)/2, G.H * 0.55);
    G.text("YOUR FLEET", s*5, -15, 16, '#00aaff');

    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        G.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        G.ctx.strokeRect(j * s, i * s, s, s);

        if (playerBoard[i][j] === 1 || playerBoard[i][j] === 3) { // ship
           G.ctx.fillStyle = '#555';
           G.ctx.fillRect(j * s + 2, i * s + 2, s - 4, s - 4);
        }

        if (playerBoard[i][j] === 2) { // enemy miss
          G.ctx.fillStyle = '#aaa'; G.ctx.beginPath(); G.ctx.arc(j * s + s / 2, i * s + s / 2, s * 0.3, 0, 7); G.ctx.fill();
        } else if (playerBoard[i][j] === 3) { // enemy hit
          G.ctx.fillStyle = '#f00'; G.ctx.beginPath(); G.ctx.arc(j * s + s / 2, i * s + s / 2, s * 0.4, 0, 7); G.ctx.fill();
        }
      }
    }
    G.ctx.restore();

  });
})();
