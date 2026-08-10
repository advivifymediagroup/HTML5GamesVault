(() => {
  const COLORS = ['#ef4444', '#f97316', '#fde047', '#22c55e', '#06d4f7', '#a855f7'];
  const CODE_LEN = 4;
  const MAX_GUESSES = 10;

  const boardEl = document.getElementById('board');
  const currentEl = document.getElementById('current');
  const paletteEl = document.getElementById('palette');
  const winsEl = document.getElementById('wins');
  const guessNumEl = document.getElementById('guessNum');
  const colorsLeftEl = document.getElementById('colorsLeft');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  let code, current, activeSlot, guesses, finished, wins;

  wins = +localStorage.getItem('mm-wins') || 0;
  winsEl.textContent = wins;
  colorsLeftEl.textContent = COLORS.length;

  function newGame() {
    code = Array.from({length: CODE_LEN}, () => Math.floor(Math.random() * COLORS.length));
    current = Array(CODE_LEN).fill(null);
    activeSlot = 0;
    guesses = [];
    finished = false;
    guessNumEl.textContent = `1/${MAX_GUESSES}`;
    overlay.classList.remove('show');
    statusEl.innerHTML = 'Pick 4 colors. Click slots, click colors, submit.';
    renderBoard();
    renderCurrent();
    renderPalette();
  }

  function renderBoard() {
    boardEl.innerHTML = '';
    // Show all 10 rows, filled bottom-up
    for (let i = 0; i < MAX_GUESSES; i++) {
      const row = document.createElement('div');
      row.className = 'mm-row';
      const num = document.createElement('div');
      num.className = 'row-num';
      num.textContent = (i + 1).toString().padStart(2, ' ');
      const pegs = document.createElement('div');
      pegs.className = 'mm-pegs';
      const fb = document.createElement('div');
      fb.className = 'mm-feedback';
      if (guesses[i]) {
        guesses[i].guess.forEach(c => {
          const p = document.createElement('div');
          p.className = 'mm-peg';
          p.style.setProperty('--c', COLORS[c]);
          pegs.appendChild(p);
        });
        const {black, white} = guesses[i].feedback;
        const dots = [];
        for (let k = 0; k < black; k++) dots.push('black');
        for (let k = 0; k < white; k++) dots.push('white');
        while (dots.length < CODE_LEN) dots.push('none');
        dots.forEach(d => {
          const dot = document.createElement('div');
          dot.className = 'mm-dot ' + d;
          fb.appendChild(dot);
        });
      } else {
        for (let k = 0; k < CODE_LEN; k++) {
          const p = document.createElement('div');
          p.className = 'mm-peg empty';
          pegs.appendChild(p);
          const dot = document.createElement('div');
          dot.className = 'mm-dot none';
          fb.appendChild(dot);
        }
      }
      row.appendChild(num);
      row.appendChild(pegs);
      row.appendChild(fb);
      boardEl.appendChild(row);
    }
  }

  function renderCurrent() {
    [...currentEl.children].forEach((slot, i) => {
      const v = current[i];
      slot.className = 'mm-slot' + (i === activeSlot ? ' active' : '') + (v !== null ? ' filled' : '');
      if (v !== null) slot.style.setProperty('--c', COLORS[v]);
      else slot.style.removeProperty('--c');
      slot.onclick = () => { activeSlot = i; renderCurrent(); };
    });
  }

  function renderPalette() {
    paletteEl.innerHTML = '';
    COLORS.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'mm-color';
      b.style.setProperty('--c', c);
      b.addEventListener('click', () => {
        if (finished) return;
        current[activeSlot] = i;
        // auto-advance to next empty slot
        let next = (activeSlot + 1) % CODE_LEN;
        for (let k = 0; k < CODE_LEN; k++) {
          if (current[next] === null) break;
          next = (next + 1) % CODE_LEN;
        }
        activeSlot = next;
        renderCurrent();
      });
      paletteEl.appendChild(b);
    });
  }

  // Two-pass scoring — handles duplicate colors correctly
  function score(guess, target) {
    let black = 0, white = 0;
    const tLeft = [], gLeft = [];
    for (let i = 0; i < CODE_LEN; i++) {
      if (guess[i] === target[i]) black++;
      else { tLeft.push(target[i]); gLeft.push(guess[i]); }
    }
    for (const g of gLeft) {
      const idx = tLeft.indexOf(g);
      if (idx >= 0) { white++; tLeft.splice(idx, 1); }
    }
    return {black, white};
  }

  function submitGuess() {
    if (finished) return;
    if (current.includes(null)) {
      statusEl.innerHTML = 'Fill all 4 slots first.';
      return;
    }
    const guess = current.slice();
    const feedback = score(guess, code);
    guesses.push({guess, feedback});
    current = Array(CODE_LEN).fill(null);
    activeSlot = 0;
    guessNumEl.textContent = `${Math.min(guesses.length + 1, MAX_GUESSES)}/${MAX_GUESSES}`;
    renderBoard();
    renderCurrent();

    if (feedback.black === CODE_LEN) {
      finished = true;
      wins++;
      localStorage.setItem('mm-wins', wins);
      winsEl.textContent = wins;
      overTitle.textContent = 'Cracked!';
      overMsg.textContent = `${guesses.length}/${MAX_GUESSES} guesses.`;
      overlay.classList.add('show');
      statusEl.innerHTML = `Solved in ${guesses.length}!`;
    } else if (guesses.length >= MAX_GUESSES) {
      finished = true;
      revealCode();
      overTitle.textContent = 'Out of guesses';
      overMsg.textContent = 'See the secret code above.';
      overlay.classList.add('show');
      statusEl.innerHTML = 'Code revealed.';
    } else {
      statusEl.innerHTML = `${feedback.black} right · ${feedback.white} wrong spot`;
    }
  }

  function revealCode() {
    // Show secret as a phantom row above the board
    const phantom = document.createElement('div');
    phantom.className = 'mm-row';
    phantom.style.borderTop = '1px solid rgba(139, 92, 246, 0.4)';
    phantom.style.paddingTop = '6px';
    const label = document.createElement('div');
    label.className = 'row-num';
    label.textContent = '★';
    const pegs = document.createElement('div');
    pegs.className = 'mm-pegs';
    code.forEach(c => {
      const p = document.createElement('div');
      p.className = 'mm-peg';
      p.style.setProperty('--c', COLORS[c]);
      pegs.appendChild(p);
    });
    phantom.appendChild(label);
    phantom.appendChild(pegs);
    boardEl.appendChild(phantom);
  }

  document.getElementById('submitBtn').addEventListener('click', submitGuess);
  document.getElementById('newBtn').addEventListener('click', newGame);
  document.getElementById('restartOverlay').addEventListener('click', newGame);

  newGame();
})();
