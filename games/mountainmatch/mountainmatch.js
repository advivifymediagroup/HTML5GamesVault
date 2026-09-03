const rounds = [
  {
    prompt: "Which range contains Everest?",
    options: ["Himalayas", "Andes", "Alps", "Rockies"],
    answer: "Himalayas",
  },
  {
    prompt: "Which range runs through South America?",
    options: ["Andes", "Atlas", "Caucasus", "Urals"],
    answer: "Andes",
  },
  {
    prompt: "Which range is famous for the Matterhorn?",
    options: ["Alps", "Appalachians", "Pyrenees", "Himalayas"],
    answer: "Alps",
  },
  {
    prompt: "Which range is in western North America?",
    options: ["Rockies", "Atlas", "Apennines", "Alps"],
    answer: "Rockies",
  },
  {
    prompt: "Which range sits between Europe and Asia?",
    options: ["Ural Mountains", "Himalayas", "Andes", "Pyrenees"],
    answer: "Ural Mountains",
  },
  {
    prompt: "Which range is home to Kilimanjaro?",
    options: ["East African Rift mountains", "Rockies", "Alps", "Andes"],
    answer: "East African Rift mountains",
  },
  {
    prompt: "Which mountain range stretches across northern India and Nepal?",
    options: ["Himalayas", "Andes", "Alps", "Atlas"],
    answer: "Himalayas",
  },
  {
    prompt:
      "Which mountain range is the longest continental mountain range in the world?",
    options: ["Andes", "Rockies", "Alps", "Himalayas"],
    answer: "Andes",
  },
  {
    prompt: "Which range is found mainly in France and Spain?",
    options: ["Pyrenees", "Urals", "Rockies", "Atlas"],
    answer: "Pyrenees",
  },
  {
    prompt: "Which range crosses Morocco, Algeria, and Tunisia?",
    options: ["Atlas Mountains", "Alps", "Andes", "Caucasus"],
    answer: "Atlas Mountains",
  },
  {
    prompt: "Which range includes Mount Elbrus?",
    options: ["Caucasus", "Alps", "Himalayas", "Rockies"],
    answer: "Caucasus",
  },
  {
    prompt: "Which range is located in eastern North America?",
    options: ["Appalachian Mountains", "Andes", "Atlas", "Alps"],
    answer: "Appalachian Mountains",
  },
  {
    prompt: "Which range runs along the western side of South America?",
    options: ["Andes", "Rockies", "Urals", "Alps"],
    answer: "Andes",
  },
  {
    prompt: "Which range contains Mont Blanc?",
    options: ["Alps", "Himalayas", "Rockies", "Atlas"],
    answer: "Alps",
  },
  {
    prompt:
      "Which mountain range forms part of the border between Russia and Georgia?",
    options: ["Caucasus", "Pyrenees", "Andes", "Urals"],
    answer: "Caucasus",
  },
  {
    prompt: "Which range separates France from Spain?",
    options: ["Pyrenees", "Alps", "Andes", "Carpathians"],
    answer: "Pyrenees",
  },
  {
    prompt: "Which range is famous for peaks such as Denali?",
    options: ["Alaska Range", "Alps", "Andes", "Atlas"],
    answer: "Alaska Range",
  },
  {
    prompt:
      "Which range is located in central Europe and includes parts of Romania and Slovakia?",
    options: ["Carpathian Mountains", "Rockies", "Himalayas", "Atlas"],
    answer: "Carpathian Mountains",
  },
  {
    prompt: "Which range contains Mount Kosciuszko?",
    options: ["Australian Alps", "Andes", "Rockies", "Alps"],
    answer: "Australian Alps",
  },
  {
    prompt: "Which range is found along the border of India and Pakistan?",
    options: ["Karakoram", "Alps", "Andes", "Appalachians"],
    answer: "Karakoram",
  },
];

let remainingRounds = [];
function setupRounds() {
  remainingRounds = shuffle(rounds);
}

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
  if (remainingRounds.length === 0) {
    clearInterval(timer);
    choicesEl.innerHTML = '';
    questionTagEl.textContent = '';
    promptEl.textContent = `Game complete — final score ${score}.`;
    statusEl.textContent = 'All rounds completed!';
    nextBtn.disabled = true;
    return;
  }

  const round = remainingRounds.pop();
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
  setupRounds();
  renderRound();
  updateHud();
});

nextBtn.disabled = true;
updateHud();
setupRounds();
renderRound();
