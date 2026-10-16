(() => {
  const SIZE = 11;
  const WORDS_PER_GAME = 8;
  const DIRECTIONS = [
    [0, 1], [1, 0], [1, 1], [1, -1],
    [0, -1], [-1, 0], [-1, -1], [-1, 1]
  ];
  const WORD_BANK = [
    'AMBER', 'ANCHOR', 'BADGER', 'BALLOON', 'BAMBOO', 'BEACON', 'BLOSSOM', 'BREEZE',
    'CABIN', 'CANDLE', 'CANYON', 'CASTLE', 'CHEESE', 'CIRCLE', 'CLOUD', 'COBALT',
    'COMET', 'CORAL', 'CRICKET', 'DANCER', 'DESERT', 'DIAMOND', 'DRAGON', 'FEATHER',
    'FESTIVAL', 'FIREPLACE', 'FLOWER', 'FOREST', 'GALAXY', 'GARDEN', 'GIRAFFE', 'GLACIER',
    'HAMMER', 'HARBOR', 'HARMONY', 'HORIZON', 'ISLAND', 'JASMINE', 'JOURNEY', 'KETTLE',
    'LANTERN', 'LEOPARD', 'LIBRARY', 'MARBLE', 'MEADOW', 'MERMAID', 'MIRROR', 'MOSAIC',
    'MOUNTAIN', 'MUSICAL', 'NEBULA', 'OCTOPUS', 'ORCHARD', 'PARADE', 'PENGUIN', 'PICNIC',
    'PLANET', 'POCKET', 'PUZZLE', 'RAINBOW', 'RIBBON', 'ROCKET', 'SAFFRON', 'SAPPHIRE',
    'SCARLET', 'SEASHELL', 'SHADOW', 'SILVER', 'SPARROW', 'SPIRAL', 'STARDUST', 'SUNFLOWER',
    'THUNDER', 'TIGER', 'TRUMPET', 'TURTLE', 'VIOLET', 'VOLCANO', 'WALNUT', 'WILLOW'
  ];
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const gridEl = document.getElementById('letterGrid');
  const listEl = document.getElementById('wordList');
  const statusEl = document.getElementById('status');
  const foundCountEl = document.getElementById('foundCount');
  const timerEl = document.getElementById('timer');
  const hintsEl = document.getElementById('hints');
  const hintBtn = document.getElementById('hintBtn');

  let grid = [];
  let placedWords = [];
  let foundWords = new Set();
  let foundCells = new Set();
  let selection = null;
  let keyboardStart = null;
  let hintCount = 3;
  let elapsedSeconds = 0;
  let gameFinished = false;
  let hintTimer = 0;

  function shuffle(items) {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function canPlace(word, row, col, rowStep, colStep) {
    for (let i = 0; i < word.length; i++) {
      const nextRow = row + rowStep * i;
      const nextCol = col + colStep * i;
      if (nextRow < 0 || nextRow >= SIZE || nextCol < 0 || nextCol >= SIZE) return false;
      const letter = grid[nextRow][nextCol];
      if (letter && letter !== word[i]) return false;
    }
    return true;
  }

  function placeWord(word) {
    for (let attempt = 0; attempt < 250; attempt++) {
      const [rowStep, colStep] = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
      const row = Math.floor(Math.random() * SIZE);
      const col = Math.floor(Math.random() * SIZE);
      if (!canPlace(word, row, col, rowStep, colStep)) continue;
      const cells = [];
      for (let i = 0; i < word.length; i++) {
        const cellRow = row + rowStep * i;
        const cellCol = col + colStep * i;
        grid[cellRow][cellCol] = word[i];
        cells.push(cellRow * SIZE + cellCol);
      }
      placedWords.push({ word, row, col, rowStep, colStep, cells });
      return true;
    }
    return false;
  }

  function createPuzzle() {
    for (let buildAttempt = 0; buildAttempt < 12; buildAttempt++) {
      grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(''));
      placedWords = [];
      const words = shuffle(WORD_BANK).slice(0, WORDS_PER_GAME).sort((a, b) => b.length - a.length);
      if (words.every(placeWord)) return;
    }
    throw new Error('Unable to place all words in the grid.');
  }

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
    const remainder = (seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remainder}`;
  }

  function updateScoreboard() {
    foundCountEl.textContent = `${foundWords.size}/${WORDS_PER_GAME}`;
    timerEl.textContent = formatTime(elapsedSeconds);
    hintsEl.textContent = hintCount;
    hintBtn.disabled = hintCount === 0 || gameFinished;
  }

  function renderWords() {
    listEl.replaceChildren();
    placedWords.forEach(({ word }) => {
      const item = document.createElement('li');
      item.className = 'word-item';
      item.textContent = word;
      item.dataset.word = word;
      item.classList.toggle('is-found', foundWords.has(word));
      listEl.appendChild(item);
    });
  }

  function renderGrid() {
    gridEl.replaceChildren();
    grid.forEach((row, rowIndex) => row.forEach((letter, colIndex) => {
      const index = rowIndex * SIZE + colIndex;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'letter-cell';
      cell.textContent = letter || ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
      cell.dataset.index = index;
      cell.dataset.row = rowIndex;
      cell.dataset.col = colIndex;
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', `Row ${rowIndex + 1}, column ${colIndex + 1}, ${cell.textContent}`);
      cell.classList.toggle('is-found', foundCells.has(index));
      gridEl.appendChild(cell);
    }));
  }

  function getCellAtPoint(x, y) {
    const element = document.elementFromPoint(x, y);
    return element instanceof Element ? element.closest('.letter-cell') : null;
  }

  function makePath(startIndex, endIndex) {
    const startRow = Math.floor(startIndex / SIZE);
    const startCol = startIndex % SIZE;
    const endRow = Math.floor(endIndex / SIZE);
    const endCol = endIndex % SIZE;
    const rowDiff = endRow - startRow;
    const colDiff = endCol - startCol;
    const distance = Math.max(Math.abs(rowDiff), Math.abs(colDiff));
    if (distance === 0 || (rowDiff !== 0 && colDiff !== 0 && Math.abs(rowDiff) !== Math.abs(colDiff))) return [];
    const rowStep = Math.sign(rowDiff);
    const colStep = Math.sign(colDiff);
    return Array.from({ length: distance + 1 }, (_, index) => (startRow + rowStep * index) * SIZE + startCol + colStep * index);
  }

  function updateSelection(endIndex) {
    if (!selection || endIndex == null) return;
    const path = makePath(selection.start, endIndex);
    selection.end = endIndex;
    selection.path = path;
    gridEl.querySelectorAll('.letter-cell').forEach(cell => {
      cell.classList.toggle('is-preview', path.includes(Number(cell.dataset.index)) && !foundCells.has(Number(cell.dataset.index)));
    });
  }

  function finishSelection() {
    if (!selection) return;
    const path = selection.path || [];
    const letters = path.map(index => {
      const cell = gridEl.querySelector(`[data-index="${index}"]`);
      return cell ? cell.textContent : '';
    }).join('');
    const match = placedWords.find(({ word }) => !foundWords.has(word) && (word === letters || word === [...letters].reverse().join('')));
    selection = null;
    gridEl.querySelectorAll('.is-preview').forEach(cell => cell.classList.remove('is-preview'));
    if (match) {
      foundWords.add(match.word);
      match.cells.forEach(index => foundCells.add(index));
      renderWords();
      renderGrid();
      statusEl.textContent = `${match.word} found!`;
      statusEl.className = 'game-status is-success';
      if (foundWords.size === WORDS_PER_GAME) {
        gameFinished = true;
        statusEl.textContent = `All words found in ${formatTime(elapsedSeconds)}. Start a new puzzle to play again.`;
      }
      updateScoreboard();
    } else if (path.length > 1) {
      statusEl.textContent = 'No hidden word on that line. Try another direction.';
      statusEl.className = 'game-status is-error';
    }
  }

  function startNewPuzzle() {
    window.clearInterval(window.exploreWordsTimer);
    window.clearTimeout(hintTimer);
    createPuzzle();
    foundWords = new Set();
    foundCells = new Set();
    selection = null;
    keyboardStart = null;
    hintCount = 3;
    elapsedSeconds = 0;
    gameFinished = false;
    statusEl.textContent = 'Drag from the first letter to the last.';
    statusEl.className = 'game-status';
    renderWords();
    renderGrid();
    updateScoreboard();
    window.exploreWordsTimer = window.setInterval(() => {
      if (gameFinished) return;
      elapsedSeconds++;
      updateScoreboard();
    }, 1000);
  }

  gridEl.addEventListener('pointerdown', event => {
    const cell = event.target.closest('.letter-cell');
    if (!cell || gameFinished) return;
    event.preventDefault();
    selection = { start: Number(cell.dataset.index), end: Number(cell.dataset.index), path: [] };
    gridEl.setPointerCapture(event.pointerId);
    statusEl.textContent = 'Keep dragging to the last letter.';
    statusEl.className = 'game-status';
  });

  gridEl.addEventListener('pointermove', event => {
    if (!selection) return;
    const cell = getCellAtPoint(event.clientX, event.clientY);
    if (cell) updateSelection(Number(cell.dataset.index));
  });

  gridEl.addEventListener('pointerup', event => {
    if (!selection) return;
    const cell = getCellAtPoint(event.clientX, event.clientY);
    if (cell) updateSelection(Number(cell.dataset.index));
    finishSelection();
  });

  gridEl.addEventListener('pointercancel', () => {
    selection = null;
    gridEl.querySelectorAll('.is-preview').forEach(cell => cell.classList.remove('is-preview'));
  });

  gridEl.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const cell = event.target.closest('.letter-cell');
    if (!cell || gameFinished) return;
    event.preventDefault();
    const index = Number(cell.dataset.index);
    if (keyboardStart == null) {
      keyboardStart = index;
      statusEl.textContent = 'Starting letter selected. Choose the last letter.';
      return;
    }
    selection = { start: keyboardStart, end: index, path: makePath(keyboardStart, index) };
    keyboardStart = null;
    finishSelection();
  });

  document.getElementById('newPuzzleBtn').addEventListener('click', startNewPuzzle);
  hintBtn.addEventListener('click', () => {
    if (!hintCount || gameFinished) return;
    const nextWord = placedWords.find(({ word }) => !foundWords.has(word));
    if (!nextWord) return;
    hintCount--;
    updateScoreboard();
    const firstCell = gridEl.querySelector(`[data-index="${nextWord.cells[0]}"]`);
    firstCell?.classList.add('is-hint');
    window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => firstCell?.classList.remove('is-hint'), 2800);
    statusEl.textContent = `Hint: ${nextWord.word.length} letters. Look for a flash in the grid.`;
    statusEl.className = 'game-status';
  });

  startNewPuzzle();
})();