(() => {
  const LEVELS = [
    { wonder: 'The Colosseum', region: 'ITALY', icon: '🏛️', fact: 'A Roman amphitheatre that could hold tens of thousands of spectators.', letters: 'AEINRST', words: ['STARE', 'STAR', 'RATE', 'EARN', 'TEA'] },
    { wonder: 'The Great Wall', region: 'CHINA', icon: '🧱', fact: 'Its many sections stretch across mountains, deserts, and grasslands.', letters: 'AEGNORS', words: ['ORGAN', 'ORE', 'ROSE', 'GAS', 'EARN'] },
    { wonder: 'Petra', region: 'JORDAN', icon: '🪨', fact: 'Rose-red sandstone cliffs were carved into a thriving ancient city.', letters: 'AELNPST', words: ['PLANT', 'PEA', 'LAP', 'PALE', 'NET'] },
    { wonder: 'Chichén Itzá', region: 'MEXICO', icon: '🔺', fact: 'The stepped pyramid of El Castillo marks the heart of this Maya city.', letters: 'ACNORST', words: ['CARTS', 'CAT', 'ART', 'RAN', 'TACO'] },
    { wonder: 'Machu Picchu', region: 'PERU', icon: '⛰️', fact: 'Inca stonework crowns a high ridge in the Andes Mountains.', letters: 'AELPRST', words: ['PEARL', 'PEA', 'EAT', 'PAL', 'RAT'] },
    { wonder: 'Taj Mahal', region: 'INDIA', icon: '🕌', fact: 'White marble, gardens, and a reflecting pool frame this mausoleum.', letters: 'AEGINSR', words: ['RAISE', 'RAG', 'AIR', 'RIG', 'SIR'] },
    { wonder: 'Angkor Wat', region: 'CAMBODIA', icon: '🛕', fact: 'A vast temple complex whose towers rise above a broad moat.', letters: 'AEILORT', words: ['LATER', 'LET', 'ART', 'TIE', 'EAT'] },
    { wonder: 'The Pyramids', region: 'EGYPT', icon: '🔺', fact: 'The Giza pyramids have watched over the Nile for more than four millennia.', letters: 'ADEILNR', words: ['LINED', 'LID', 'ILL', 'NIL', 'DEN'] },
    { wonder: 'The Eiffel Tower', region: 'FRANCE', icon: '🗼', fact: 'Built for the 1889 World’s Fair, it became a lasting Paris landmark.', letters: 'ACEHRTW', words: ['REACT', 'RAT', 'TEA', 'ACE', 'CAT'] },
    { wonder: 'The Acropolis', region: 'GREECE', icon: '🏺', fact: 'The Parthenon stands above Athens on a rocky citadel.', letters: 'ACEINOT', words: ['OCEAN', 'ONE', 'CAN', 'TEN', 'ANT'] },
    { wonder: 'Stonehenge', region: 'ENGLAND', icon: '🪨', fact: 'Massive stones form a prehistoric circle on Salisbury Plain.', letters: 'AEGHILT', words: ['LIGHT', 'LIE', 'LIT', 'GET', 'HAT'] },
    { wonder: 'The Statue of Liberty', region: 'UNITED STATES', icon: '🗽', fact: 'A gift from France, the statue has welcomed visitors to New York Harbor since 1886.', letters: 'AEGILNT', words: ['GIANT', 'GET', 'TIN', 'ANT', 'NET'] }
  ];

  const STORAGE_KEY = 'wow-words-progress-v1';
  const gridEl = document.getElementById('crosswordGrid');
  const wheelEl = document.getElementById('letterWheel');
  const entryEl = document.getElementById('entryDisplay');
  const statusEl = document.getElementById('status');
  const bonusEl = document.getElementById('bonusLine');
  const resultEl = document.getElementById('resultPanel');
  const collectionDialog = document.getElementById('collectionDialog');
  const collectionGrid = document.getElementById('collectionGrid');
  const letterDictionary = new Set((window.WORDS || []).map(word => word.toUpperCase()));

  let progress = loadProgress();
  let levelIndex = Math.min(progress.level, progress.unlocked - 1, LEVELS.length - 1);
  let level, entries, cells, rows, cols, current, foundWords, bonusWords, selectedCell, hammerMode, hints, hammers, wheelOrder;

  function loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        level: Number.isInteger(saved.level) ? saved.level : 0,
        unlocked: Math.max(1, Math.min(LEVELS.length, Number(saved.unlocked) || 1)),
        score: Math.max(0, Number(saved.score) || 0),
        collected: Array.isArray(saved.collected) ? saved.collected.filter(index => Number.isInteger(index) && index >= 0 && index < LEVELS.length) : []
      };
    } catch {
      return { level: 0, unlocked: 1, score: 0, collected: [] };
    }
  }

  function saveProgress() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch { /* Storage can be disabled by the browser. */ }
  }

  function makeEntries() {
    const verticalWord = level.words[0];
    const raw = [{ word: verticalWord, direction: 'down', row: 0, col: 4 }];
    const usedRows = new Set();
    level.words.slice(1).forEach(word => {
      let crossing = -1;
      for (let row = 0; row < verticalWord.length; row++) {
        if (!usedRows.has(row) && word.includes(verticalWord[row])) { crossing = row; break; }
      }
      if (crossing < 0) return;
      usedRows.add(crossing);
      const offset = word.indexOf(verticalWord[crossing]);
      raw.push({ word, direction: 'across', row: crossing, col: 4 - offset });
    });

    const minRow = Math.min(...raw.map(entry => entry.row));
    const minCol = Math.min(...raw.map(entry => entry.col));
    const maxRow = Math.max(...raw.map(entry => entry.row + (entry.direction === 'down' ? entry.word.length - 1 : 0)));
    const maxCol = Math.max(...raw.map(entry => entry.col + (entry.direction === 'across' ? entry.word.length - 1 : 0)));
    return {
      rows: maxRow - minRow + 1,
      cols: maxCol - minCol + 1,
      entries: raw.map(entry => ({ ...entry, row: entry.row - minRow, col: entry.col - minCol }))
    };
  }

  function loadLevel(index) {
    levelIndex = index;
    progress.level = index;
    level = LEVELS[index];
    const layout = makeEntries();
    rows = layout.rows;
    cols = layout.cols;
    entries = layout.entries;
    cells = new Map();
    entries.forEach(entry => {
      entry.cells = [];
      [...entry.word].forEach((letter, offset) => {
        const row = entry.row + (entry.direction === 'down' ? offset : 0);
        const col = entry.col + (entry.direction === 'across' ? offset : 0);
        const key = row * cols + col;
        const cell = cells.get(key) || { key, row, col, letter, entries: [] };
        if (cell.letter !== letter) throw new Error(`Crossword mismatch in level ${index + 1}.`);
        cell.entries.push(entry);
        cells.set(key, cell);
        entry.cells.push(key);
      });
    });
    current = '';
    foundWords = new Set();
    bonusWords = new Set();
    selectedCell = null;
    hammerMode = false;
    hints = 3;
    hammers = 2;
    wheelOrder = [...level.letters];
    resultEl.hidden = true;
    document.getElementById('levelLabel').textContent = `${index + 1} / ${LEVELS.length}`;
    document.getElementById('scoreLabel').textContent = progress.score;
    document.getElementById('wonderRegion').textContent = level.region;
    document.getElementById('wonderName').textContent = level.wonder;
    document.getElementById('wonderFact').textContent = level.fact;
    document.getElementById('wonderScene').textContent = level.icon;
    const collected = progress.collected.includes(index);
    const wonderState = document.getElementById('wonderState');
    wonderState.textContent = collected ? 'COLLECTED' : 'TO DISCOVER';
    wonderState.classList.toggle('is-found', collected);
    statusEl.textContent = 'Tap letters to build a word. You can reuse letters.';
    bonusEl.textContent = '';
    renderBoard();
    renderWheel();
    updateCounters();
    saveProgress();
  }

  function renderBoard() {
    gridEl.replaceChildren();
    gridEl.style.setProperty('--cols', cols);
    gridEl.setAttribute('aria-label', `${rows} by ${cols} crossword. ${foundWords.size} of ${entries.length} words found.`);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const key = row * cols + col;
        const cellData = cells.get(key);
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'crossword-cell';
        cell.dataset.cell = key;
        if (!cellData) {
          cell.classList.add('is-empty');
          cell.disabled = true;
        } else {
          const visible = cellData.entries.some(entry => foundWords.has(entry.word)) || Boolean(cellData.revealed);
          cell.textContent = visible ? cellData.letter : '';
          cell.setAttribute('role', 'gridcell');
          cell.setAttribute('aria-label', visible ? `Row ${row + 1}, column ${col + 1}, ${cellData.letter}` : `Row ${row + 1}, column ${col + 1}, hidden letter`);
          cell.classList.toggle('is-known', visible);
          cell.classList.toggle('is-selected', selectedCell === key);
          cell.classList.toggle('is-hammer-target', hammerMode && !visible);
          if (hammerMode) cell.addEventListener('click', () => useHammer(key));
        }
        gridEl.appendChild(cell);
      }
    }
    const foundCount = foundWords.size;
    document.getElementById('wordCount').textContent = `${foundCount} / ${entries.length}`;
    document.getElementById('crosswordProgress').textContent = `${Math.round(foundCount / entries.length * 100)}% complete`;
    updateEntryDisplay();
  }

  function renderWheel() {
    wheelEl.replaceChildren();
    wheelOrder.forEach((letter, index) => {
      const key = document.createElement('button');
      key.type = 'button';
      key.className = 'wheel-letter';
      key.textContent = letter;
      key.setAttribute('aria-label', `Add ${letter}`);
      key.style.setProperty('--angle', `${index * (360 / wheelOrder.length)}deg`);
      key.addEventListener('click', () => addLetter(letter));
      wheelEl.appendChild(key);
    });
  }

  function updateEntryDisplay() {
    entryEl.textContent = current || 'TAP LETTERS TO BUILD A WORD';
    entryEl.classList.toggle('is-placeholder', !current);
  }

  function updateCounters() {
    document.getElementById('hintCount').textContent = hints;
    document.getElementById('hammerCount').textContent = hammers;
    document.getElementById('hintBtn').disabled = hints === 0 || resultEl.hidden === false;
    document.getElementById('hammerBtn').disabled = hammers === 0 || resultEl.hidden === false;
    document.getElementById('hammerBtn').classList.toggle('is-active', hammerMode);
    document.getElementById('collectionCount').textContent = `${progress.collected.length} / ${LEVELS.length}`;
  }

  function addLetter(letter) {
    if (!resultEl.hidden) return;
    current += letter;
    updateEntryDisplay();
    statusEl.textContent = 'Keep going, or press Enter to submit.';
  }

  function deleteLetter() {
    current = current.slice(0, -1);
    updateEntryDisplay();
  }

  function submitWord() {
    if (!current || !resultEl.hidden) return;
    const word = current;
    current = '';
    updateEntryDisplay();
    const entry = entries.find(candidate => candidate.word === word);
    if (entry) {
      if (foundWords.has(word)) return say('That crossword word is already filled.');
      foundWords.add(word);
      progress.score += word.length * 10;
      entry.cells.forEach(key => { const cell = cells.get(key); if (cell) cell.revealed = true; });
      say(`${word} fits! +${word.length * 10} points.`);
      renderBoard();
      document.getElementById('scoreLabel').textContent = progress.score;
      saveProgress();
      if (foundWords.size === entries.length) finishLevel();
      return;
    }
    const canSpell = [...word].every(letter => level.letters.includes(letter));
    if (word.length >= 3 && word.length <= 5 && canSpell && letterDictionary.has(word) && !bonusWords.has(word)) {
      bonusWords.add(word);
      const points = word.length * 5;
      progress.score += points;
      document.getElementById('scoreLabel').textContent = progress.score;
      bonusEl.textContent = `Bonus word: ${word}  +${points}`;
      say('Bonus word found!');
      saveProgress();
      return;
    }
    say(bonusWords.has(word) ? 'You already found that bonus word.' : 'No matching word in this crossword.');
  }

  function say(message) {
    statusEl.textContent = message;
  }

  function revealCell(key) {
    const cell = cells.get(key);
    if (!cell || cell.revealed || cell.entries.every(entry => foundWords.has(entry.word))) return false;
    cell.revealed = true;
    selectedCell = key;
    renderBoard();
    for (const entry of entries) {
      if (!foundWords.has(entry.word) && entry.cells.every(cellKey => cells.get(cellKey).revealed)) {
        foundWords.add(entry.word);
      }
    }
    renderBoard();
    if (foundWords.size === entries.length) finishLevel();
    return true;
  }

  function useHint() {
    if (!hints || !resultEl.hidden) return;
    const hidden = [...cells.keys()].filter(key => !cells.get(key).revealed && cells.get(key).entries.some(entry => !foundWords.has(entry.word)));
    if (!hidden.length) return;
    hints--;
    revealCell(hidden[Math.floor(Math.random() * hidden.length)]);
    say('A letter has been revealed.');
    updateCounters();
  }

  function useHammer(key) {
    if (!hammerMode || !hammers) return;
    if (!revealCell(key)) {
      say('Choose an empty crossword square.');
      return;
    }
    hammers--;
    hammerMode = false;
    renderBoard();
    say('Hammer used. A letter has been revealed.');
    updateCounters();
  }

  function finishLevel() {
    if (progress.collected.includes(levelIndex)) {
      resultEl.hidden = false;
      document.getElementById('nextBtn').textContent = levelIndex === LEVELS.length - 1 ? 'Replay expedition' : 'Next expedition';
      showResult();
      return;
    }
    progress.collected.push(levelIndex);
    progress.unlocked = Math.max(progress.unlocked, Math.min(LEVELS.length, levelIndex + 2));
    resultEl.hidden = false;
    document.getElementById('nextBtn').textContent = levelIndex === LEVELS.length - 1 ? 'Replay expedition' : 'Next expedition';
    showResult();
    saveProgress();
  }

  function showResult() {
    document.getElementById('resultIcon').textContent = level.icon;
    document.getElementById('resultTitle').textContent = level.wonder;
    document.getElementById('resultFact').textContent = level.fact;
    document.getElementById('wonderState').textContent = 'COLLECTED';
    document.getElementById('wonderState').classList.add('is-found');
    updateCounters();
  }

  function showCollection() {
    collectionGrid.replaceChildren();
    LEVELS.forEach((wonder, index) => {
      const unlocked = index < progress.unlocked;
      const collected = progress.collected.includes(index);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'collection-item';
      button.disabled = !unlocked;
      button.innerHTML = `<span aria-hidden="true">${unlocked ? wonder.icon : '🔒'}</span><span><strong>${wonder.wonder}</strong><small>${collected ? 'Collected' : unlocked ? 'Ready to explore' : `Expedition ${index + 1}`}</small></span>`;
      if (unlocked) button.addEventListener('click', () => {
        collectionDialog.close();
        loadLevel(index);
      });
      collectionGrid.appendChild(button);
    });
    if (!collectionDialog.open) collectionDialog.showModal();
  }

  function shuffleWheel() {
    for (let index = wheelOrder.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [wheelOrder[index], wheelOrder[other]] = [wheelOrder[other], wheelOrder[index]];
    }
    renderWheel();
  }

  function nextLevel() {
    const next = levelIndex + 1 < progress.unlocked ? levelIndex + 1 : 0;
    loadLevel(next);
  }

  document.getElementById('submitBtn').addEventListener('click', submitWord);
  document.getElementById('deleteBtn').addEventListener('click', deleteLetter);
  document.getElementById('shuffleBtn').addEventListener('click', shuffleWheel);
  document.getElementById('hintBtn').addEventListener('click', useHint);
  document.getElementById('hammerBtn').addEventListener('click', () => {
    if (!hammers || !resultEl.hidden) return;
    hammerMode = !hammerMode;
    say(hammerMode ? 'Choose a hidden square to reveal.' : 'Hammer cancelled.');
    renderBoard();
    updateCounters();
  });
  document.getElementById('nextBtn').addEventListener('click', nextLevel);
    document.getElementById('resultCollectionBtn').addEventListener('click', showCollection);
  document.getElementById('collectionBtn').addEventListener('click', showCollection);
  document.getElementById('closeCollection').addEventListener('click', () => collectionDialog.close());
  document.addEventListener('keydown', event => {
    if (!resultEl.hidden || collectionDialog.open) return;
    if (event.key === 'Enter') { event.preventDefault(); submitWord(); }
    else if (event.key === 'Backspace') { event.preventDefault(); deleteLetter(); }
    else if (/^[a-z]$/i.test(event.key)) addLetter(event.key.toUpperCase());
  });

  loadLevel(levelIndex);
})();