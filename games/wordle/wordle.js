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
  const guessNumEl = document.getElementById('guessNum');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  let target, currentRow, currentCol, guesses, finished, wins, streak, keyState;

  wins = +localStorage.getItem('wordle-wins') || 0;
  streak = +localStorage.getItem('wordle-streak') || 0;
  winsEl.textContent = wins;
  streakEl.textContent = streak;

  function newGame() {
    target = ANSWERS[Math.floor(Math.random() * ANSWERS.length)].toLowerCase();
    currentRow = 0;
    currentCol = 0;
    guesses = [];
    finished = false;
    keyState = {};
    guessNumEl.textContent = `1/${MAX_GUESSES}`;
    overlay.classList.remove('show');
    statusEl.innerHTML = 'Type a 5-letter word. Enter to guess.';
    renderBoard();
    renderKeyboard();
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
          t.classList.add('flip', guess.result[c]);
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

  let inputBuffer = [];

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
    if (finished) return;
    if (inputBuffer.length >= WORD_LEN) return;
    inputBuffer.push(ch);
    currentCol = inputBuffer.length;
    renderBoard();
  }

  function backspace() {
    if (finished || !inputBuffer.length) return;
    inputBuffer.pop();
    currentCol = inputBuffer.length;
    renderBoard();
  }

  function submit() {
    if (finished) return;
    if (inputBuffer.length !== WORD_LEN) return shake('Need 5 letters.');
    const guess = inputBuffer.join('').toLowerCase();
    if (!WORD_SET.has(guess)) return shake(`"${guess.toUpperCase()}" not in word list.`);

    const result = evaluate(guess, target);
    guesses.push({letters: inputBuffer.slice(), result});
    // update key state
    for (let i = 0; i < WORD_LEN; i++) {
      const k = guess[i];
      const r = result[i];
      const prev = keyState[k];
      if (r === 'green') keyState[k] = 'green';
      else if (r === 'yellow' && prev !== 'green') keyState[k] = 'yellow';
      else if (!prev) keyState[k] = 'gray';
    }
    inputBuffer = [];
    currentRow++;
    currentCol = 0;
    guessNumEl.textContent = `${Math.min(currentRow + 1, MAX_GUESSES)}/${MAX_GUESSES}`;
    renderBoard();
    renderKeyboard();

    if (guess === target) {
      finished = true;
      wins++; streak++;
      localStorage.setItem('wordle-wins', wins);
      localStorage.setItem('wordle-streak', streak);
      winsEl.textContent = wins;
      streakEl.textContent = streak;
      setTimeout(() => {
        overTitle.textContent = 'Got it!';
        overMsg.textContent = `Solved in ${currentRow} guess${currentRow > 1 ? 'es' : ''}.`;
        overlay.classList.add('show');
        statusEl.innerHTML = `${target.toUpperCase()} — nice!`;
      }, 1400);
    } else if (currentRow >= MAX_GUESSES) {
      finished = true;
      streak = 0;
      localStorage.setItem('wordle-streak', 0);
      streakEl.textContent = 0;
      setTimeout(() => {
        overTitle.textContent = 'Out of guesses';
        overMsg.textContent = `The word was ${target.toUpperCase()}.`;
        overlay.classList.add('show');
        statusEl.innerHTML = `Word was <strong>${target.toUpperCase()}</strong>.`;
      }, 1400);
    }
  }

  // Two-pass evaluation handles repeated letters correctly
  function evaluate(guess, target) {
    const result = Array(WORD_LEN).fill('gray');
    const tArr = target.split('');
    // first pass — greens
    for (let i = 0; i < WORD_LEN; i++) {
      if (guess[i] === tArr[i]) { result[i] = 'green'; tArr[i] = null; }
    }
    // second pass — yellows
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

  document.addEventListener('keydown', e => {
    if (finished) return;
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    else if (e.key === 'Backspace') { e.preventDefault(); backspace(); }
    else if (/^[a-zA-Z]$/.test(e.key)) typeChar(e.key.toLowerCase());
  });

  document.getElementById('newBtn').addEventListener('click', newGame);
  document.getElementById('restartOverlay').addEventListener('click', newGame);

  newGame();
})();
