(() => {
  const pad = document.getElementById('pad');
  const icon = document.getElementById('rxnIcon');
  const text = document.getElementById('rxnText');
  const sub = document.getElementById('rxnSub');
  const lastEl = document.getElementById('last');
  const bestEl = document.getElementById('best');
  const avgEl = document.getElementById('avg');
  const historyEl = document.getElementById('history');

  let state = 'idle'; // 'idle' | 'wait' | 'go' | 'result' | 'fail'
  let timer = null;
  let goAt = 0;
  let history = JSON.parse(localStorage.getItem('rxn-history') || '[]');
  let best = +localStorage.getItem('rxn-best') || null;

  function render() {
    bestEl.textContent = best ? `${best} ms` : '— ms';
    renderAvg();
    renderHistory();
  }
  function renderAvg() {
    const last5 = history.slice(-5);
    if (!last5.length) { avgEl.textContent = '— ms'; return; }
    const avg = Math.round(last5.reduce((a,b)=>a+b,0) / last5.length);
    avgEl.textContent = `${avg} ms`;
  }
  function renderHistory() {
    historyEl.innerHTML = '';
    history.slice(-8).forEach(t => {
      const s = document.createElement('span');
      s.textContent = `${t}ms`;
      if (best !== null && t === best) s.classList.add('best');
      historyEl.appendChild(s);
    });
  }

  function setIdle() {
    state = 'idle';
    pad.className = 'reaction-pad';
    icon.textContent = '👆';
    text.textContent = 'Click to Start';
    sub.textContent = 'Wait for green, then tap as fast as you can.';
  }
  function setWait() {
    state = 'wait';
    pad.className = 'reaction-pad wait';
    icon.textContent = '⏳';
    text.textContent = 'Wait for it...';
    sub.textContent = 'Don\'t click yet!';
    const delay = 1500 + Math.random() * 2500;
    timer = setTimeout(() => {
      goAt = performance.now();
      state = 'go';
      pad.className = 'reaction-pad go';
      icon.textContent = '⚡';
      text.textContent = 'TAP NOW!';
      sub.textContent = '';
    }, delay);
  }
  function setGo(ms) {
    state = 'result';
    pad.className = 'reaction-pad result';
    icon.textContent = '⚡';
    text.textContent = `${ms} ms`;
    let rating;
    if (ms < 200) rating = 'Pro reflexes!';
    else if (ms < 300) rating = 'Quick!';
    else if (ms < 400) rating = 'Average';
    else rating = 'Click to try again';
    sub.textContent = rating + ' · Click to go again';
    history.push(ms);
    if (history.length > 50) history = history.slice(-50);
    localStorage.setItem('rxn-history', JSON.stringify(history));
    if (best === null || ms < best) {
      best = ms;
      localStorage.setItem('rxn-best', best);
    }
    lastEl.textContent = `${ms} ms`;
    render();
  }
  function setFail() {
    state = 'fail';
    pad.className = 'reaction-pad fail';
    icon.textContent = '😅';
    text.textContent = 'Too early!';
    sub.textContent = 'Wait for green. Click to retry.';
    clearTimeout(timer);
  }

  function onTap() {
    if (state === 'idle' || state === 'result' || state === 'fail') {
      setWait();
    } else if (state === 'wait') {
      setFail();
    } else if (state === 'go') {
      const ms = Math.round(performance.now() - goAt);
      setGo(ms);
    }
  }

  pad.addEventListener('click', onTap);
  pad.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onTap(); }
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    history = [];
    best = null;
    localStorage.removeItem('rxn-history');
    localStorage.removeItem('rxn-best');
    lastEl.textContent = '— ms';
    render();
    setIdle();
  });

  setIdle();
  render();
})();
