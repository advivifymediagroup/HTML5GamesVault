const basketOrder = ['Citrus', 'Berries', 'Tropical', 'Stone'];
const fruitItems = [
  { name: 'Orange', emoji: '🍊', basket: 'Citrus' },
  { name: 'Lime', emoji: '🍋', basket: 'Citrus' },
  { name: 'Strawberry', emoji: '🍓', basket: 'Berries' },
  { name: 'Blueberry', emoji: '🫐', basket: 'Berries' },
  { name: 'Mango', emoji: '🥭', basket: 'Tropical' },
  { name: 'Pineapple', emoji: '🍍', basket: 'Tropical' },
  { name: 'Peach', emoji: '🍑', basket: 'Stone' },
  { name: 'Plum', emoji: '🫐', basket: 'Stone' }
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
let best = Number(localStorage.getItem('fruitsort-best') || 0);

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
  basketOrder.forEach((basket) => {
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'basket-slot empty';
    slot.dataset.basket = basket;
    slot.innerHTML = `<span class="slot-label">${basket}</span><span class="basket-name">Drop here</span>`;
    slot.addEventListener('click', () => handleSlotClick(basket));
    slotsEl.appendChild(slot);
  });
}

function renderBank() {
  bankEl.innerHTML = '';
  bank.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fruit-item';
    if (selected && selected.name === item.name) btn.classList.add('selected');
    btn.innerHTML = `<span class="item-emoji">${item.emoji}</span><span>${item.name}</span>`;
    btn.addEventListener('click', () => {
      selected = item;
      renderBank();
      statusEl.textContent = `${item.name} is selected. Pick the correct basket.`;
    });
    bankEl.appendChild(btn);
  });
}

function updateStats() {
  movesEl.textContent = String(moves);
  placedEl.textContent = `${placedCount}/${fruitItems.length}`;
  bestEl.textContent = String(best || 0);
}

function handleSlotClick(basket) {
  if (!selected) {
    statusEl.textContent = 'Choose a fruit before sorting it.';
    return;
  }

  moves += 1;
  const correct = selected.basket === basket;
  const slot = document.querySelector(`.basket-slot[data-basket="${basket}"]`);

  if (correct) {
    slot.classList.remove('empty');
    slot.innerHTML = `<span class="slot-label">${basket}</span><span class="placed-item">${selected.emoji} ${selected.name}</span>`;
    bank = bank.filter((item) => item.name !== selected.name);
    placedCount += 1;
    selected = null;
    renderBank();
    statusEl.textContent = `Nice! ${basket} is the correct basket.`;
  } else {
    slot.classList.add('wrong');
    statusEl.textContent = `Almost! ${selected.name} belongs in ${selected.basket}.`;
    setTimeout(() => slot.classList.remove('wrong'), 250);
    selected = null;
    renderBank();
  }

  updateStats();

  if (placedCount === fruitItems.length) {
    if (!best || moves < best) {
      best = moves;
      localStorage.setItem('fruitsort-best', String(best));
    }
    statusEl.textContent = `Fruit basket complete in ${moves} moves!`;
    updateStats();
  }
}

function startRound() {
  bank = shuffle(fruitItems);
  selected = null;
  moves = 0;
  placedCount = 0;
  renderSlots();
  renderBank();
  updateStats();
  statusEl.textContent = 'Choose a fruit and place it in the right basket.';
}

newRoundBtn.addEventListener('click', startRound);
startRound();
