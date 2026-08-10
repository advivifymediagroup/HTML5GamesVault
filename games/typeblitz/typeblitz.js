(() => {
  const words = [
    'pixel', 'arcade', 'canvas', 'combo', 'vector', 'sprite', 'syntax', 'rocket',
    'fusion', 'signal', 'puzzle', 'memory', 'reflex', 'binary', 'galaxy', 'meteor',
    'cascade', 'velocity', 'function', 'keyboard', 'collision', 'variable',
    'animation', 'challenge', 'algorithm', 'checkpoint', 'javascript', 'leaderboard'
  ];
  const promptEl = document.getElementById('prompt');
  const answerEl = document.getElementById('answer');
  const feedbackEl = document.getElementById('feedback');
  const scoreEl = document.getElementById('score');
  const streakEl = document.getElementById('streak');
  const timeEl = document.getElementById('time');
  const startBtn = document.getElementById('startBtn');

  let current = '';
  let score = 0;
  let streak = 0;
  let time = 60;
  let timer = null;
  let running = false;
  let lastWord = '';
  let best = +localStorage.getItem('typeblitz-best') || 0;

  function start() {
    score = 0;
    streak = 0;
    time = 60;
    running = true;
    startBtn.textContent = 'Restart';
    feedbackEl.className = 'feedback';
    feedbackEl.textContent = best ? `Best score: ${best}` : 'Go fast. Streaks are worth more.';
    updateHud();
    nextWord();
    answerEl.disabled = false;
    answerEl.focus();
    clearInterval(timer);
    timer = setInterval(() => {
      time--;
      updateHud();
      if (time <= 0) finish();
    }, 1000);
  }

  function nextWord() {
    do {
      current = words[Math.floor(Math.random() * words.length)];
    } while (current === lastWord);
    lastWord = current;
    promptEl.textContent = current;
    promptEl.classList.toggle('combo', streak >= 5);
    answerEl.value = '';
  }

  function submit() {
    if (!running) return start();
    const typed = answerEl.value.trim().toLowerCase();
    if (!typed) return;
    if (typed === current) {
      const gain = current.length * 10 + Math.min(10, streak) * 8;
      score += gain;
      streak++;
      feedbackEl.className = 'feedback good';
      feedbackEl.textContent = `+${gain} points`;
      if (streak > 0 && streak % 5 === 0) {
        time += 4;
        feedbackEl.textContent += ' +4s streak bonus';
      }
      nextWord();
    } else {
      streak = 0;
      score = Math.max(0, score - 25);
      feedbackEl.className = 'feedback bad';
      feedbackEl.textContent = `Missed "${current}". -25 points`;
      nextWord();
    }
    updateHud();
  }

  function skip() {
    if (!running) return;
    streak = 0;
    time = Math.max(0, time - 3);
    feedbackEl.className = 'feedback bad';
    feedbackEl.textContent = `Skipped "${current}". -3 seconds`;
    nextWord();
    updateHud();
  }

  function finish() {
    running = false;
    clearInterval(timer);
    answerEl.disabled = true;
    if (score > best) {
      best = score;
      localStorage.setItem('typeblitz-best', best);
      feedbackEl.className = 'feedback good';
      feedbackEl.textContent = `New best: ${best}. Press Start to play again.`;
    } else {
      feedbackEl.className = 'feedback';
      feedbackEl.textContent = `Final score: ${score}. Best: ${best}.`;
    }
    promptEl.textContent = 'Time!';
    startBtn.textContent = 'Start';
  }

  function updateHud() {
    scoreEl.textContent = score;
    streakEl.textContent = streak;
    timeEl.textContent = time;
  }

  answerEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') skip();
  });
  startBtn.addEventListener('click', start);
  document.getElementById('skipBtn').addEventListener('click', skip);
  document.getElementById('resetBtn').addEventListener('click', () => {
    clearInterval(timer);
    running = false;
    score = 0;
    streak = 0;
    time = 60;
    promptEl.textContent = 'Type Blitz';
    feedbackEl.className = 'feedback';
    feedbackEl.textContent = best ? `Best score: ${best}` : 'Press Start, then type each word before the timer ends.';
    answerEl.value = '';
    answerEl.disabled = true;
    startBtn.textContent = 'Start';
    updateHud();
  });

  answerEl.disabled = true;
  promptEl.textContent = 'Type Blitz';
  updateHud();
})();
