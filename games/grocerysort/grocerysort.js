const aisleOrder = ['Produce', 'Dairy', 'Bakery', 'Pantry'];
const groceryItems = [
  { name: 'Apple', emoji: '🍎', aisle: 'Produce' },
  { name: 'Milk', emoji: '🥛', aisle: 'Dairy' },
  { name: 'Bread', emoji: '🍞', aisle: 'Bakery' },
  { name: 'Rice', emoji: '🍚', aisle: 'Pantry' },
  { name: 'Banana', emoji: '🍌', aisle: 'Produce' },
  { name: 'Yogurt', emoji: '🥣', aisle: 'Dairy' },
  { name: 'Croissant', emoji: '🥐', aisle: 'Bakery' },
  { name: 'Pasta', emoji: '🍝', aisle: 'Pantry' }
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
let best = Number(localStorage.getItem('grocerysort-best') || 0);

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
  aisleOrder.forEach((aisle) => {
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'aisle-slot empty';
    slot.dataset.aisle = aisle;
    slot.innerHTML = `<span class="slot-label">${aisle}</span><span class="aisle-name">Drop here</span>`;
    slot.addEventListener('click', () => handleSlotClick(aisle));
    slotsEl.appendChild(slot);
  });
}

function renderBank() {
  bankEl.innerHTML = '';
  bank.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'grocery-item';
    if (selected && selected.name === item.name) btn.classList.add('selected');
    btn.innerHTML = `<span class="item-emoji">${item.emoji}</span><span>${item.name}</span>`;
    btn.addEventListener('click', () => {
      selected = item;
      renderBank();
      statusEl.textContent = `${item.name} is selected. Now choose the matching aisle.`;
    });
    bankEl.appendChild(btn);
  });
}

function updateStats() {
  movesEl.textContent = String(moves);
  placedEl.textContent = `${placedCount}/${groceryItems.length}`;
  bestEl.textContent = String(best || 0);
}

function handleSlotClick(aisle) {
  if (!selected) {
    statusEl.textContent = 'Select an item before placing it.';
    return;
  }

  moves += 1;
  const correct = selected.aisle === aisle;
  const slot = document.querySelector(`.aisle-slot[data-aisle="${aisle}"]`);

  if (correct) {
    slot.classList.remove('empty');
    slot.innerHTML = `<span class="slot-label">${aisle}</span><span class="placed-item">${selected.emoji} ${selected.name}</span>`;
    bank = bank.filter((item) => item.name !== selected.name);
    placedCount += 1;
    selected = null;
    renderBank();
    statusEl.textContent = `${aisle} is right — great job!`;
  } else {
    slot.classList.add('wrong');
    statusEl.textContent = `Not quite. ${selected.name} belongs in ${selected.aisle}, not ${aisle}.`;
    setTimeout(() => slot.classList.remove('wrong'), 250);
    selected = null;
    renderBank();
  }

  updateStats();

  if (placedCount === groceryItems.length) {
    if (!best || moves < best) {
      best = moves;
      localStorage.setItem('grocerysort-best', String(best));
    }
    statusEl.textContent = `All sorted! You finished in ${moves} moves.`;
    updateStats();
  }
}

function startRound() {
  bank = shuffle(groceryItems);
  selected = null;
  moves = 0;
  placedCount = 0;
  renderSlots();
  renderBank();
  updateStats();
  statusEl.textContent = 'Pick a grocery item, then place it in the correct aisle.';
}

newRoundBtn.addEventListener('click', startRound);
startRound();
