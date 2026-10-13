/* HUD / overlay / best-score / flash text / tiny WebAudio beeps shared by every Stage3D and Arcade2D game. */
window.GameKit = function (o) {
  const $ = id => document.getElementById(id), el = $('game3d'), wrap = el.parentElement;
  const K = {$, el, wrap}, bestKey = (o.key || 'game') + '-best';
  let ac;
  K.hud = (n, v) => { const e = $('s' + n); if (e) e.textContent = v; };
  K.bestScore = () => { try { return +localStorage.getItem(bestKey) || 0; } catch (e) { return 0; } };
  K.best = score => {
    const b = K.bestScore(), isNew = score > b;
    if (isNew) try { localStorage.setItem(bestKey, score); } catch (e) {}
    K.hud(o.bestHud || 3, Math.max(b, score));
    return isNew;
  };
  K.show = (title, msg, btn) => {
    $('overTitle').textContent = title; $('overMsg').textContent = msg;
    $('overlayBtn').textContent = btn || 'Play again'; $('overlay').classList.add('show');
  };
  K.onStart = fn => {
    const go = () => { $('overlay').classList.remove('show'); fn(); };
    $('startBtn').addEventListener('click', go); $('overlayBtn').addEventListener('click', go);
  };
  K.status = t => { $('status').textContent = t; };
  K.flash = (text, ms) => {
    let f = $('flash');
    if (!f) {
      f = document.createElement('div'); f.id = 'flash';
      f.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;font:800 clamp(28px,7vw,64px) "Space Grotesk",sans-serif;color:#fff;text-shadow:0 0 24px #6aa6ff,0 4px 0 rgba(0,0,0,.4);opacity:0;transition:opacity .25s,transform .25s;transform:scale(.8);text-align:center';
      wrap.appendChild(f);
    }
    f.textContent = text; f.style.opacity = 1; f.style.transform = 'scale(1)';
    clearTimeout(f.t); f.t = setTimeout(() => { f.style.opacity = 0; f.style.transform = 'scale(1.2)'; }, ms || 900);
  };
  K.beep = (freq, dur, type, vol) => {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const t = ac.currentTime, osc = ac.createOscillator(), g = ac.createGain();
      osc.type = type || 'sine'; osc.frequency.value = freq || 440;
      g.gain.setValueAtTime(vol || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.1));
      osc.connect(g); g.connect(ac.destination); osc.start(t); osc.stop(t + (dur || 0.1));
    } catch (e) {}
  };
  return K;
};
