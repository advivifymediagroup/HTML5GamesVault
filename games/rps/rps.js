(() => {
  const handP = document.getElementById('handP');
  const handC = document.getElementById('handC');
  const vs = document.getElementById('vs');
  const winsPEl = document.getElementById('winsP');
  const winsCEl = document.getElementById('winsC');
  const tiesEl = document.getElementById('ties');
  const statusEl = document.getElementById('status');
  const buttons = [...document.querySelectorAll('.rps-btn')];

  const EMOJI = {rock: '🪨', paper: '📄', scissors: '✂️'};
  const FIST = '✊';
  const BEATS = {rock: 'scissors', paper: 'rock', scissors: 'paper'};
  const CHOICES = ['rock', 'paper', 'scissors'];

  let winsP = 0, winsC = 0, ties = 0, busy = false;

  function setHands(p, c) {
    handP.textContent = p;
    handC.textContent = c;
  }

  function play(choice) {
    if (busy) return;
    busy = true;
    buttons.forEach(b => b.disabled = true);
    handP.classList.remove('win','lose');
    handC.classList.remove('win','lose');
    setHands(FIST, FIST);
    handP.classList.add('shake');
    handC.classList.add('shake');
    vs.textContent = '...';
    statusEl.innerHTML = 'Shoot!';

    setTimeout(() => {
      handP.classList.remove('shake');
      handC.classList.remove('shake');
      const cpu = CHOICES[Math.floor(Math.random() * 3)];
      setHands(EMOJI[choice], EMOJI[cpu]);
      let result;
      if (choice === cpu) {
        ties++; tiesEl.textContent = ties;
        result = '🤝 Tie';
        vs.textContent = '=';
      } else if (BEATS[choice] === cpu) {
        winsP++; winsPEl.textContent = winsP;
        result = '🎉 You win!';
        handP.classList.add('win');
        handC.classList.add('lose');
        vs.textContent = '>';
      } else {
        winsC++; winsCEl.textContent = winsC;
        result = '🤖 CPU wins.';
        handC.classList.add('win');
        handP.classList.add('lose');
        vs.textContent = '<';
      }
      statusEl.innerHTML = `${result} — pick again.`;
      busy = false;
      buttons.forEach(b => b.disabled = false);
    }, 600);
  }

  buttons.forEach(b => b.addEventListener('click', () => play(b.dataset.choice)));
  document.getElementById('resetBtn').addEventListener('click', () => {
    winsP = winsC = ties = 0;
    winsPEl.textContent = 0; winsCEl.textContent = 0; tiesEl.textContent = 0;
    setHands(FIST, FIST);
    vs.textContent = 'VS';
    handP.classList.remove('win','lose');
    handC.classList.remove('win','lose');
    statusEl.innerHTML = 'Score reset. Pick your move.';
  });
})();
