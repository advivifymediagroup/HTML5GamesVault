const rounds = [
  { prompt: 'Which range contains Everest?', options: ['Himalayas', 'Andes', 'Alps', 'Rockies'], answer: 'Himalayas' },
  { prompt: 'Which range runs through South America?', options: ['Andes', 'Atlas', 'Caucasus', 'Urals'], answer: 'Andes' },
  { prompt: 'Which range is famous for the Matterhorn?', options: ['Alps', 'Appalachians', 'Pyrenees', 'Himalayas'], answer: 'Alps' },
  { prompt: 'Which range is in western North America?', options: ['Rockies', 'Atlas', 'Apennines', 'Alps'], answer: 'Rockies' },
  { prompt: 'Which range sits between Europe and Asia?', options: ['Ural Mountains', 'Himalayas', 'Andes', 'Pyrenees'], answer: 'Ural Mountains' },
  { prompt: 'Which range is home to Kilimanjaro?', options: ['East African Rift mountains', 'Rockies', 'Alps', 'Andes'], answer: 'East African Rift mountains' }
];

const scoreEl = document.getElementById('score');
const streakEl = document.getElementById('streak');
const timeEl = document.getElementById('time');
const questionTagEl = document.getElementById('questionTag');
const promptEl = document.getElementById('prompt');
const choicesEl = document.getElementById('choices');
const nextBtn = document.getElementById('nextBtn');
const restartBtn = document.getElementById('restartBtn');
const statusEl = document.getElementById('status');

let score = 0;
let streak = 0;
let timeLeft = 15;
let timer = null;
let current = null;

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function updateHud() {
  scoreEl.textContent = String(score);
  streakEl.textContent = String(streak);
  timeEl.textContent = String(timeLeft);
}

function startTimer() {
  clearInterval(timer);
  timeLeft = 15;
  updateHud();
  timer = setInterval(() => {
    timeLeft -= 1;
    updateHud();
    if (timeLeft <= 0) {
      clearInterval(timer);
      statusEl.textContent = `Time's up! The answer was ${current.answer}.`;
      streak = 0;
      updateHud();
      setTimeout(() => nextRound(), 900);
    }
  }, 1000);
}

function renderRound() {
  const round = rounds[Math.floor(Math.random() * rounds.length)];
  current = round;
  const options = shuffle(round.options);
  promptEl.textContent = round.prompt;
  choicesEl.innerHTML = '';
  statusEl.textContent = 'Choose the correct answer before the timer runs out.';

  options.forEach((option) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice-btn';
    btn.textContent = option;
    btn.addEventListener('click', () => handleAnswer(option, btn));
    choicesEl.appendChild(btn);
  });

  questionTagEl.textContent = 'Mountain range';
  startTimer();
}

function handleAnswer(choice, button) {
  clearInterval(timer);
  const correct = choice === current.answer;
  const buttons = [...choicesEl.children];

  buttons.forEach((btn) => {
    if (btn.textContent === current.answer) btn.classList.add('correct');
    if (btn === button && !correct) btn.classList.add('wrong');
    btn.disabled = true;
  });

  if (correct) {
    score += 10 + timeLeft;
    streak += 1;
    statusEl.textContent = 'Correct! Nice work.';
  } else {
    streak = 0;
    statusEl.textContent = `Not quite — the right answer was ${current.answer}.`;
  }

  updateHud();
  nextBtn.disabled = false;
}

function nextRound() {
  nextBtn.disabled = true;
  renderRound();
}

nextBtn.addEventListener('click', nextRound);
restartBtn.addEventListener('click', () => {
  score = 0;
  streak = 0;
  clearInterval(timer);
  nextBtn.disabled = true;
  renderRound();
  updateHud();
});

nextBtn.disabled = true;
updateHud();
renderRound();
