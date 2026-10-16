(() => {
  const G = Arcade2D({ bestHud: 3 });
  let board = [], turn = 1, selected = null, possibleMoves = [];

  function init() {
    board = Array(8).fill(0).map(() => Array(8).fill(0));
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        if ((i + j) % 2 === 1) {
          if (i < 3) board[i][j] = 2; // AI
          if (i > 4) board[i][j] = 1; // Player
        }
      }
    }
    turn = 1; selected = null; possibleMoves = [];
    G.hud(1, 0); // No real score in checkers, just win/loss
  }

  init(); G.onStart(() => { init(); });

  function drawBoard() {
    const s = G.W / 8;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        G.ctx.fillStyle = (i + j) % 2 === 0 ? '#eee' : '#444';
        G.ctx.fillRect(j * s, i * s, s, s);

        if (board[i][j] > 0) {
          G.ctx.beginPath();
          G.ctx.arc(j * s + s / 2, i * s + s / 2, s * 0.4, 0, Math.PI * 2);
          G.ctx.fillStyle = board[i][j] === 1 ? '#f44' : '#44f';
          G.ctx.fill();
        }
      }
    }
    if (selected) {
      G.ctx.strokeStyle = '#ff0';
      G.ctx.lineWidth = 4;
      G.ctx.strokeRect(selected.j * s, selected.i * s, s, s);
    }
    for (let m of possibleMoves) {
      G.ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
      G.ctx.fillRect(m.j * s, m.i * s, s, s);
    }
  }

  function getMoves(i, j) {
    const moves = [];
    if (board[i][j] === 1) { // player
      if (i > 0 && j > 0 && board[i - 1][j - 1] === 0) moves.push({i: i - 1, j: j - 1});
      if (i > 0 && j < 7 && board[i - 1][j + 1] === 0) moves.push({i: i - 1, j: j + 1});
      // Captures
      if (i > 1 && j > 1 && board[i - 1][j - 1] === 2 && board[i - 2][j - 2] === 0) moves.push({i: i - 2, j: j - 2});
      if (i > 1 && j < 6 && board[i - 1][j + 1] === 2 && board[i - 2][j + 2] === 0) moves.push({i: i - 2, j: j - 2});
    } else if (board[i][j] === 2) { // AI
      if (i < 7 && j > 0 && board[i + 1][j - 1] === 0) moves.push({i: i + 1, j: j - 1});
      if (i < 7 && j < 7 && board[i + 1][j + 1] === 0) moves.push({i: i + 1, j: j + 1});
      // Captures
      if (i < 6 && j > 1 && board[i + 1][j - 1] === 1 && board[i + 2][j - 2] === 0) moves.push({i: i + 2, j: j - 2});
      if (i < 6 && j < 6 && board[i + 1][j + 1] === 1 && board[i + 2][j + 2] === 0) moves.push({i: i + 2, j: j + 2});
    }
    return moves;
  }

  function checkWinCondition() {
    let p1 = 0, p2 = 0;
    for(let i=0; i<8; i++) {
        for(let j=0; j<8; j++) {
            if(board[i][j] === 1) p1++;
            else if(board[i][j] === 2) p2++;
        }
    }
    if (p1 === 0) { turn = 0; G.show('Defeat', 'You have no pieces left.'); return true; }
    if (p2 === 0) { turn = 0; G.show('Victory', 'You captured all enemy pieces!'); return true; }

    // Check if current player has moves
    let hasMoves = false;
    let checkTurn = turn;
    for(let i=0; i<8; i++) {
        for(let j=0; j<8; j++) {
            if(board[i][j] === checkTurn && getMoves(i,j).length > 0) hasMoves = true;
        }
    }
    if (!hasMoves) {
        turn = 0;
        G.show(checkTurn === 1 ? 'Defeat' : 'Victory', checkTurn === 1 ? 'You have no valid moves.' : 'The enemy has no valid moves.');
        return true;
    }
    return false;
  }

  G.loop((dt) => {
    G.ctx.fillStyle = '#111';
    G.ctx.fillRect(0, 0, G.W, G.H);

    // Board offset to center vertically
    G.ctx.save();
    G.ctx.translate(0, (G.H - G.W) / 2);
    drawBoard();

    if (turn === 1 && G.p.justDown) {
      const j = Math.floor(G.p.x / (G.W / 8));
      const i = Math.floor((G.p.y - (G.H - G.W) / 2) / (G.W / 8));

      if (i >= 0 && i < 8 && j >= 0 && j < 8) {
          if (board[i][j] === 1) {
            selected = {i, j};
            possibleMoves = getMoves(i, j);
          } else if (selected) {
            let moved = false;
            for (let m of possibleMoves) {
              if (m.i === i && m.j === j) {
                // Capture
                if (Math.abs(m.i - selected.i) === 2) {
                  board[(m.i + selected.i) / 2][(m.j + selected.j) / 2] = 0;
                  G.beep(300, 0.1);
                } else {
                  G.beep(600, 0.1);
                }

                board[i][j] = 1;
                board[selected.i][selected.j] = 0;
                turn = 2; selected = null; possibleMoves = []; moved = true;

                if(!checkWinCondition()) {
                    setTimeout(() => { turn = 2; }, 500); // Give AI a slight delay
                }
                break;
              }
            }
            if (!moved) { selected = null; possibleMoves = []; }
          }
      }
    }
    G.ctx.restore();

    if (turn === 2) {
      let aiMoves = [];
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          if (board[i][j] === 2) {
            let moves = getMoves(i, j);
            for (let m of moves) aiMoves.push({from: {i, j}, to: m});
          }
        }
      }
      if (aiMoves.length > 0) {
        // Prefer captures
        let captures = aiMoves.filter(m => Math.abs(m.to.i - m.from.i) === 2);
        let move = captures.length > 0 ? captures[Math.floor(Math.random() * captures.length)] : aiMoves[Math.floor(Math.random() * aiMoves.length)];

        if (Math.abs(move.to.i - move.from.i) === 2) {
           board[(move.to.i + move.from.i) / 2][(move.to.j + move.from.j) / 2] = 0;
           G.beep(300, 0.1);
        } else {
           G.beep(600, 0.1);
        }

        board[move.to.i][move.to.j] = 2;
        board[move.from.i][move.from.j] = 0;
      }

      turn = 1;
      checkWinCondition();
    }
  });
})();
