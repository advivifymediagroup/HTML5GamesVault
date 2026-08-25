const oceanOrder = ['Pacific', 'Atlantic', 'Indian', 'Arctic'];
const waterBodies = [
  { name: 'Pacific Ocean', emoji: '🌊', ocean: 'Pacific' },
  { name: 'Atlantic Ocean', emoji: '🌊', ocean: 'Atlantic' },
  { name: 'Indian Ocean', emoji: '🌊', ocean: 'Indian' },
  { name: 'Arctic Ocean', emoji: '❄️', ocean: 'Arctic' },
  { name: 'Mediterranean Sea', emoji: '🌊', ocean: 'Atlantic' },
  { name: 'Arabian Sea', emoji: '🌊', ocean: 'Indian' },
  { name: 'Bering Sea', emoji: '🌊', ocean: 'Pacific' },
  { name: 'Barents Sea', emoji: '❄️', ocean: 'Arctic' }
];

const slotsEl = document.getElementById('slots');
const bankEl = document.getElementById('bank');
const movesEl = document.getElementById('moves');
const placedEl = document.getElementById('placed');
const bestEl = document.getElementById('best');
const statusEl = document.getElementById('status');
const newRoundBtn = document.getElementById('newRoundBtn');

let bank = [];
let selected = null;
let moves = 0;
let placedCount = 0;
let best = Number(localStorage.getItem('oceansort-best') || 0);

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function renderSlots() {
  slotsEl.innerHTML = '';
  oceanOrder.forEach((ocean) => {
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'ocean-slot empty';
    slot.dataset.ocean = ocean;
    slot.innerHTML = `<span class="slot-label">${ocean}</span><span>Drop here</span>`;
    slot.addEventListener('click', () => handleSlotClick(ocean));
    slotsEl.appendChild(slot);
  });
}

function renderBank() {
  bankEl.innerHTML = '';
  bank.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'water-card';
    if (selected && selected.name === item.name) btn.classList.add('selected');
    btn.innerHTML = `<span class="item-emoji">${item.emoji}</span><span>${item.name}</span>`;
    btn.addEventListener('click', () => {
      selected = item;
      renderBank();
      statusEl.textContent = `${item.name} is selected. Match it to the correct ocean.`;
    });
    bankEl.appendChild(btn);
  });
}

function updateStats() {
  movesEl.textContent = String(moves);
  placedEl.textContent = `${placedCount}/${waterBodies.length}`;
  bestEl.textContent = String(best || 0);
}

function handleSlotClick(ocean) {
  if (!selected) {
    statusEl.textContent = 'Pick a water body before placing it.';
    return;
  }

  moves += 1;
  const correct = selected.ocean === ocean;
  const slot = document.querySelector(`.ocean-slot[data-ocean="${ocean}"]`);

  if (correct) {
    slot.classList.remove('empty');
    slot.innerHTML = `<span class="slot-label">${ocean}</span><span class="placed-item">${selected.emoji} ${selected.name}</span>`;
    bank = bank.filter((item) => item.name !== selected.name);
    placedCount += 1;
    selected = null;
    renderBank();
    statusEl.textContent = `${ocean} is correct.`;
  } else {
    slot.classList.add('wrong');
    statusEl.textContent = `Not quite — ${selected.name} belongs with ${selected.ocean}.`;
    setTimeout(() => slot.classList.remove('wrong'), 250);
    selected = null;
    renderBank();
  }

  updateStats();

  if (placedCount === waterBodies.length) {
    if (!best || moves < best) {
      best = moves;
      localStorage.setItem('oceansort-best', String(best));
    }
    statusEl.textContent = `Ocean set complete in ${moves} moves!`;
    updateStats();
  }
}

function startRound() {
  bank = shuffle(waterBodies);
  selected = null;
  moves = 0;
  placedCount = 0;
  renderSlots();
  renderBank();
  updateStats();
  statusEl.textContent = 'Select a water body and place it in the right ocean group.';
}

newRoundBtn.addEventListener('click', startRound);
startRound();
