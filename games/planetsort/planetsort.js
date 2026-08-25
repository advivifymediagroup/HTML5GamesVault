(() => {
  const planets = [
    { name: 'Mercury', order: 1, color: '#d8f3ff' },
    { name: 'Venus', order: 2, color: '#ffd166' },
    { name: 'Earth', order: 3, color: '#5ec8ff' },
    { name: 'Mars', order: 4, color: '#ff7a66' },
    { name: 'Jupiter', order: 5, color: '#f5b88b' },
    { name: 'Saturn', order: 6, color: '#f5d7a1' },
    { name: 'Uranus', order: 7, color: '#8de5ff' },
    { name: 'Neptune', order: 8, color: '#4ea3ff' }
  ];

  const bankEl = document.getElementById('bank');
  const slotsEl = document.getElementById('slots');
  const movesEl = document.getElementById('moves');
  const placedEl = document.getElementById('placed');
  const bestEl = document.getElementById('best');
  const statusEl = document.getElementById('status');
  const newRoundBtn = document.getElementById('newRoundBtn');

  let shuffled = [];
  let selected = null;
  let placed = [];
  let moves = 0;
  let best = Number(localStorage.getItem('planetsort-best') || 0);

  bestEl.textContent = best;

  function shuffle(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function updateStats() {
    const filledCount = placed.filter(Boolean).length;
    placedEl.textContent = `${filledCount}/8`;
    movesEl.textContent = moves;
  }

  function renderSlots() {
    slotsEl.innerHTML = '';
    planets.forEach((planet, index) => {
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = `orbit-slot ${placed[index] ? 'filled' : 'empty'}`;
      const current = placed[index];

      slot.addEventListener('click', () => {
        if (!selected) {
          statusEl.textContent = 'Choose a planet from the tray first.';
          return;
        }
        if (current) {
          statusEl.textContent = 'That slot is already filled.';
          return;
        }
        if (selected.name === planet.name) {
          placed[index] = selected;
          shuffled = shuffled.filter(item => item.name !== selected.name);
          selected = null;
          moves += 1;
          statusEl.textContent = `${planet.name} locked into orbit.`;
          updateStats();
          render();
          if (placed.every(Boolean)) {
            finish(true);
          }
        } else {
          slot.classList.add('wrong');
          setTimeout(() => slot.classList.remove('wrong'), 380);
          statusEl.textContent = `${selected.name} does not belong in slot ${index + 1}.`;
          selected = null;
          moves += 1;
          movesEl.textContent = moves;
          render();
        }
      });

      if (current) {
        slot.innerHTML = `
          <span class="slot-order">Orbit ${index + 1}</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="planet-dot" style="background:${current.color}; color:${current.color};"></span>
            <span class="planet-name">${current.name}</span>
          </div>
        `;
      } else {
        slot.innerHTML = `
          <span class="slot-label">Orbit ${index + 1}</span>
          <span class="slot-order">${planet.name}</span>
        `;
      }

      slotsEl.appendChild(slot);
    });
  }

  function renderBank() {
    bankEl.innerHTML = '';
    shuffled.forEach((planet) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `planet-card ${selected && selected.name === planet.name ? 'selected' : ''}`;
      card.style.color = planet.color;
      card.innerHTML = `
        <span class="planet-dot" style="background:${planet.color}; color:${planet.color};"></span>
        <span class="planet-name">${planet.name}</span>
      `;
      card.addEventListener('click', () => {
        selected = planet;
        render();
        statusEl.textContent = `${planet.name} selected. Choose the matching orbit.`;
      });
      bankEl.appendChild(card);
    });
  }

  function render() {
    renderSlots();
    renderBank();
    updateStats();
  }

  function finish(won) {
    if (won) {
      const finalMoves = moves;
      best = Math.min(best || finalMoves, finalMoves);
      if (best === 0 || finalMoves < best) {
        best = finalMoves;
      }
      localStorage.setItem('planetsort-best', String(best));
      bestEl.textContent = best;
      statusEl.textContent = `Orbit complete in ${finalMoves} moves.`;
      const overlay = document.createElement('div');
      overlay.className = 'message-overlay show';
      overlay.innerHTML = '<h3>Solar system sorted</h3><p>You placed every planet in the correct order.</p><button class="btn" id="finishBtn">Play again</button>';
      document.querySelector('.game-stage').appendChild(overlay);
      document.getElementById('finishBtn').addEventListener('click', () => startRound());
    }
  }

  function startRound() {
    selected = null;
    moves = 0;
    placed = Array(8).fill(null);
    shuffled = shuffle(planets);
    statusEl.textContent = 'Pick a planet, then place it into the correct orbit slot.';
    document.querySelectorAll('.message-overlay').forEach(el => el.remove());
    render();
  }

  newRoundBtn.addEventListener('click', startRound);
  startRound();
})();
