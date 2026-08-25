(() => {
  const facts = [
    { country: 'France', capital: 'Paris' },
    { country: 'Japan', capital: 'Tokyo' },
    { country: 'Brazil', capital: 'Brasilia' },
    { country: 'Germany', capital: 'Berlin' },
    { country: 'Canada', capital: 'Ottawa' },
    { country: 'Australia', capital: 'Canberra' },
    { country: 'Egypt', capital: 'Cairo' },
    { country: 'India', capital: 'New Delhi' },
    { country: 'Mexico', capital: 'Mexico City' },
    { country: 'Italy', capital: 'Rome' },
    { country: 'Spain', capital: 'Madrid' },
    { country: 'South Africa', capital: 'Pretoria' },
    { country: 'Argentina', capital: 'Buenos Aires' },
    { country: 'Norway', capital: 'Oslo' },
    { country: 'Kenya', capital: 'Nairobi' }
  ];

  const scoreEl = document.getElementById('score');
  const streakEl = document.getElementById('streak');
  const timeEl = document.getElementById('time');
  const promptEl = document.getElementById('prompt');
  const choicesEl = document.getElementById('choices');
  const statusEl = document.getElementById('status');
  const questionTagEl = document.getElementById('questionTag');
  const nextBtn = document.getElementById('nextBtn');
  const restartBtn = document.getElementById('restartBtn');

  let score = 0;
  let streak = 0;
  let timeLeft = 15;
  let currentRound = null;
  let timerId = null;
  let locked = false;

  function shuffle(items) {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function updateHud() {
    scoreEl.textContent = score;
    streakEl.textContent = streak;
    timeEl.textContent = timeLeft;
  }

  function startTimer() {
    if (timerId) clearInterval(timerId);
    timerId = setInterval(() => {
      if (locked) return;
      timeLeft -= 1;
      updateHud();
      if (timeLeft <= 0) {
        clearInterval(timerId);
        loseRound();
      }
    }, 1000);
  }

  function randomRound() {
    const base = facts[Math.floor(Math.random() * facts.length)];
    const direction = Math.random() > 0.5 ? 'country' : 'capital';
    const wrong = shuffle(facts.filter(item => item.country !== base.country)).slice(0, 3);
    const answers = shuffle([
      ...(direction === 'country' ? [base.capital] : [base.country]),
      ...wrong.map(item => direction === 'country' ? item.capital : item.country)
    ]);

    currentRound = {
      question: direction === 'country' ? `Which capital city belongs to ${base.country}?` : `Which country has the capital ${base.capital}?`,
      correct: direction === 'country' ? base.capital : base.country,
      type: direction === 'country' ? 'Capital' : 'Country',
      answers
    };

    locked = false;
    timeLeft = 15;
    updateHud();
    renderQuestion();
    startTimer();
  }

  function renderQuestion() {
    promptEl.textContent = currentRound.question;
    questionTagEl.textContent = currentRound.type + ' clue';
    choicesEl.innerHTML = '';

    currentRound.answers.forEach((answer) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice-btn';
      btn.textContent = answer;
      btn.addEventListener('click', () => handleAnswer(btn, answer));
      choicesEl.appendChild(btn);
    });
  }

  function handleAnswer(btn, answer) {
    if (locked) return;
    locked = true;
    clearInterval(timerId);

    const correct = currentRound.correct;
    const allButtons = [...choicesEl.querySelectorAll('.choice-btn')];
    allButtons.forEach((b) => {
      const isCorrect = b.textContent === correct;
      b.classList.toggle('correct', isCorrect);
      if (b !== btn && b.textContent === answer && answer !== correct) {
        b.classList.add('wrong');
      }
      b.disabled = true;
    });

    if (answer === correct) {
      score += 1 + Math.max(0, streak);
      streak += 1;
      statusEl.textContent = 'Correct — well done.';
      statusEl.className = 'game-status status-good';
    } else {
      streak = 0;
      statusEl.textContent = `Not quite — the correct answer is ${correct}.`;
      statusEl.className = 'game-status status-bad';
    }

    updateHud();
    setTimeout(randomRound, 900);
  }

  function loseRound() {
    locked = true;
    const buttons = [...choicesEl.querySelectorAll('.choice-btn')];
    buttons.forEach((button) => {
      button.disabled = true;
      if (button.textContent === currentRound.correct) button.classList.add('correct');
    });
    streak = 0;
    statusEl.textContent = `Time's up — the answer was ${currentRound.correct}.`;
    statusEl.className = 'game-status status-bad';
    updateHud();
    setTimeout(randomRound, 1100);
  }

  nextBtn.addEventListener('click', () => {
    clearInterval(timerId);
    randomRound();
  });

  restartBtn.addEventListener('click', () => {
    score = 0;
    streak = 0;
    clearInterval(timerId);
    statusEl.className = 'game-status';
    randomRound();
    updateHud();
  });

  updateHud();
  randomRound();
})();
