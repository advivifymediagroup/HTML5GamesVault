(() => {
  // Bundled word list — common 5-letter words used as both targets and valid guesses
  const WORDS = [
    'apple','beach','crane','dream','eagle','flame','grape','heart','image','joker',
    'knife','lemon','music','noble','ocean','pearl','quiet','river','snake','tiger',
    'unity','vivid','water','xenon','yacht','zebra','aroma','blame','cloud','daily',
    'earth','field','glove','house','input','jolly','kayak','light','magic','night',
    'olive','plant','quick','round','sword','table','urban','voice','witch','young',
    'angel','blast','clamp','dance','elite','funny','globe','happy','ivory','jumbo',
    'koala','laser','melon','novel','organ','phone','queen','radar','sugar','tooth',
    'ultra','virus','wagon','agent','brake','child','dwarf','enemy','fault','glade',
    'honey','index','jewel','knock','liver','match','nerve','onion','paint','quilt',
    'rapid','solid','total','under','vault','whale','xenia','yummy','zesty','about',
    'alarm','bench','chair','drink','event','flute','grain','horse','idiot','judge',
    'kneel','lunch','mango','nurse','offer','party','quail','rebel','sweet','train',
    'urine','value','watch','blade','crisp','dance','eight','flesh','gravy','haunt',
    'inbox','jolly','kraft','lever','mount','nymph','onset','peach','quark','royal',
    'spine','tribe','usher','vapor','wheat','admit','blaze','crown','dough','equal',
    'froth','green','hatch','icily','jumpy','klutz','lyric','mince','noisy','oxide',
    'piano','quote','reach','sniff','treat','uncle','vinyl','woven','adept','bingo',
    'curse','depot','enact','focal','gauze','hover','infer','jaunt','kitty','large',
    'merge','niche','overt','prism','quart','rhino','spade','timid','utter','vexed',
    'woken','axiom','beard','cabin','dimly','eerie','flair','grand','heron','irate'
  ];
  // Dedup
  const WORD_SET = new Set(WORDS);
  const ANSWERS = [...WORD_SET];

  const MAX_GUESSES = 6;
  const WORD_LEN = 5;
  const board = document.getElementById('board');
  const kb = document.getElementById('keyboard');
  const winsEl = document.getElementById('wins');
  const streakEl = document.getElementById('streak');
  const bestStreakEl = document.getElementById('bestStreak');
  const guessNumEl = document.getElementById('guessNum');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  // Titles vary with how many guesses it took to win, classic-Wordle style.
  const WIN_TITLES = {1: 'Genius', 2: 'Magnificent', 3: 'Impressive', 4: 'Splendid', 5: 'Great', 6: 'Phew'};
  const REVEAL_STAGGER = 220; // ms between each tile's flip start (left to right)
  const FLIP_DURATION = 500;  // must match the CSS .wordle-tile.flip animation-duration

  let target, currentRow, currentCol, guesses, finished, animating, wins, streak, bestStreak, keyState, inputBuffer, pendingTimers;

  wins = +localStorage.getItem('wordle-wins') || 0;
  streak = +localStorage.getItem('wordle-streak') || 0;
  bestStreak = +localStorage.getItem('wordle-best-streak') || 0;
  winsEl.textContent = wins;
  streakEl.textContent = streak;
  bestStreakEl.textContent = bestStreak;

  function newGame() {
    clearPending();
    target = ANSWERS[Math.floor(Math.random() * ANSWERS.length)].toLowerCase();
    currentRow = 0;
    currentCol = 0;
    guesses = [];
    finished = false;
    animating = false;
    keyState = {};
    inputBuffer = [];
    guessNumEl.textContent = `1/${MAX_GUESSES}`;
    overlay.classList.remove('show');
    statusEl.innerHTML = 'Type a 5-letter word. Enter to guess.';
    renderBoard();
    renderKeyboard();
  }

  function clearPending() {
    if (pendingTimers) pendingTimers.forEach(id => clearTimeout(id));
    pendingTimers = [];
  }
  function later(fn, ms) {
    const id = setTimeout(fn, ms);
    pendingTimers.push(id);
    return id;
  }

  function renderBoard() {
    board.innerHTML = '';
    for (let r = 0; r < MAX_GUESSES; r++) {
      const row = document.createElement('div');
      row.className = 'wordle-row';
      row.dataset.r = r;
      for (let c = 0; c < WORD_LEN; c++) {
        const t = document.createElement('div');
        t.className = 'wordle-tile';
        const guess = guesses[r];
        if (guess) {
          t.textContent = guess.letters[c];
          if (guess.revealed) {
            t.classList.add(guess.result[c]);
          } else {
            // letters are in place but colour/flip is applied by revealRow()
            t.classList.add('filled');
          }
        } else if (r === currentRow && c < currentCol) {
          // current letters live in inputBuffer
          t.textContent = inputBuffer[c] || '';
          t.classList.add('filled');
        }
        row.appendChild(t);
      }
      board.appendChild(row);
    }
  }

  function renderKeyboard() {
    const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
    kb.innerHTML = '';
    rows.forEach((row, i) => {
      const r = document.createElement('div');
      r.className = 'kb-row';
      if (i === 2) {
        const enter = document.createElement('button');
        enter.className = 'kb-key wide';
        enter.textContent = 'Enter';
        enter.addEventListener('click', submit);
        r.appendChild(enter);
      }
      for (const ch of row) {
        const b = document.createElement('button');
        b.className = 'kb-key';
        b.textContent = ch;
        if (keyState[ch]) b.classList.add(keyState[ch]);
        b.addEventListener('click', () => typeChar(ch));
        r.appendChild(b);
      }
      if (i === 2) {
        const back = document.createElement('button');
        back.className = 'kb-key wide';
        back.textContent = '⌫';
        back.addEventListener('click', backspace);
        r.appendChild(back);
      }
      kb.appendChild(r);
    });
  }

  function typeChar(ch) {
    if (finished || animating) return;
    if (inputBuffer.length >= WORD_LEN) return;
    inputBuffer.push(ch);
    currentCol = inputBuffer.length;
    renderBoard();
  }

  function backspace() {
    if (finished || animating || !inputBuffer.length) return;
    inputBuffer.pop();
    currentCol = inputBuffer.length;
    renderBoard();
  }

  function submit() {
    if (finished || animating) return;
    if (inputBuffer.length !== WORD_LEN) return shake('Need 5 letters.');
    const guess = inputBuffer.join('').toLowerCase();
    if (!WORD_SET.has(guess)) return shake(`"${guess.toUpperCase()}" not in word list.`);

    const result = evaluate(guess, target);
    const rowIndex = currentRow;
    guesses.push({letters: inputBuffer.slice(), result, revealed: false});
    inputBuffer = [];
    currentCol = 0;
    animating = true;
    renderBoard();
    revealRow(rowIndex, guess, result);
  }

  // Reveals a submitted row tile-by-tile: each tile squashes flat and its
  // colour is applied exactly at the flip's midpoint, staggered left to
  // right so the row reads in sequence instead of flashing all at once.
  function revealRow(r, guess, result) {
    const row = board.querySelector(`.wordle-row[data-r="${r}"]`);
    const tiles = row ? row.children : [];
    for (let c = 0; c < WORD_LEN; c++) {
      const tile = tiles[c];
      const delay = c * REVEAL_STAGGER;
      later(() => { if (tile) tile.classList.add('flip'); }, delay);
      later(() => {
        if (tile) {
          tile.classList.remove('filled');
          tile.classList.add(result[c]);
        }
      }, delay + FLIP_DURATION / 2);
    }
    const totalTime = (WORD_LEN - 1) * REVEAL_STAGGER + FLIP_DURATION;
    later(() => finishReveal(r, guess, result), totalTime);
  }

  function finishReveal(r, guess, result) {
    guesses[r].revealed = true;
    animating = false;

    // Key state can only ever upgrade: absent -> present(yellow) -> correct(green).
    // A key already known green from an earlier guess must never be downgraded.
    for (let i = 0; i < WORD_LEN; i++) {
      const k = guess[i];
      const rr = result[i];
      const prev = keyState[k];
      if (rr === 'green') keyState[k] = 'green';
      else if (rr === 'yellow' && prev !== 'green') keyState[k] = 'yellow';
      else if (!prev) keyState[k] = 'gray';
    }
    renderKeyboard();

    currentRow++;
    guessNumEl.textContent = `${Math.min(currentRow + 1, MAX_GUESSES)}/${MAX_GUESSES}`;
    renderBoard();

    if (guess === target) {
      finished = true;
      wins++; streak++;
      if (streak > bestStreak) bestStreak = streak;
      localStorage.setItem('wordle-wins', wins);
      localStorage.setItem('wordle-streak', streak);
      localStorage.setItem('wordle-best-streak', bestStreak);
      winsEl.textContent = wins;
      streakEl.textContent = streak;
      bestStreakEl.textContent = bestStreak;
      celebrate();
      later(() => {
        overTitle.textContent = WIN_TITLES[r + 1] || 'Solved!';
        overMsg.textContent = `Solved in ${r + 1} guess${r + 1 > 1 ? 'es' : ''}.`;
        overlay.classList.add('show');
        statusEl.innerHTML = `${target.toUpperCase()} — nice!`;
      }, 500);
    } else if (currentRow >= MAX_GUESSES) {
      finished = true;
      streak = 0;
      localStorage.setItem('wordle-streak', 0);
      streakEl.textContent = 0;
      later(() => {
        overTitle.textContent = 'Out of guesses';
        overMsg.textContent = `The word was ${target.toUpperCase()}.`;
        overlay.classList.add('show');
        statusEl.innerHTML = `Word was <strong>${target.toUpperCase()}</strong>.`;
      }, 500);
    }
  }

  // Two-pass evaluation handles repeated letters correctly:
  // pass 1 resolves every exact (green) match and removes those letters from
  // the answer's pool; pass 2 matches remaining guess letters against what's
  // left of that pool for yellow. This caps yellow highlights at however many
  // copies of a letter the answer actually has, even if the guess has more.
  function evaluate(guess, target) {
    const result = Array(WORD_LEN).fill('gray');
    const tArr = target.split('');
    // first pass — greens
    for (let i = 0; i < WORD_LEN; i++) {
      if (guess[i] === tArr[i]) { result[i] = 'green'; tArr[i] = null; }
    }
    // second pass — yellows, against the leftover letter pool only
    for (let i = 0; i < WORD_LEN; i++) {
      if (result[i] === 'green') continue;
      const idx = tArr.indexOf(guess[i]);
      if (idx >= 0) { result[i] = 'yellow'; tArr[idx] = null; }
    }
    return result;
  }

  function shake(msg) {
    const row = board.querySelector(`.wordle-row[data-r="${currentRow}"]`);
    if (row) {
      row.classList.add('shake');
      setTimeout(() => row.classList.remove('shake'), 400);
    }
    statusEl.innerHTML = `${msg}`;
  }

  // Confetti-style flourish for a win — a burst of falling coloured pieces
  // fixed to the viewport near the board, stronger than a normal tile flash.
  function celebrate() {
    const colors = ['#22c55e', '#facc15', '#3b82f6', '#ec4899', '#8b5cf6', '#06d4f7'];
    const rect = board.getBoundingClientRect();
    for (let i = 0; i < 70; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.left = (rect.left + Math.random() * rect.width) + 'px';
      p.style.top = (rect.top - 10) + 'px';
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      p.style.setProperty('--drift', (Math.random() * 260 - 130) + 'px');
      p.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      p.style.animationDelay = (Math.random() * 0.3) + 's';
      p.style.animationDuration = (1 + Math.random() * 0.8) + 's';
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 2400);
    }
  }

  document.addEventListener('keydown', e => {
    if (finished || animating) return;
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    else if (e.key === 'Backspace') { e.preventDefault(); backspace(); }
    else if (/^[a-zA-Z]$/.test(e.key)) typeChar(e.key.toLowerCase());
  });

  document.getElementById('newBtn').addEventListener('click', newGame);
  document.getElementById('restartOverlay').addEventListener('click', newGame);

  newGame();
})();
