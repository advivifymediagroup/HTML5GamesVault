(function () {
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    }
  };

  const audio = (() => {
    let ctx;
    let enabled = store.get("h5gv-sound", false);
    function ensure() {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }
    function tone(freq, dur, type) {
      if (!enabled) return;
      const ac = ensure();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type || "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, ac.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      osc.connect(gain).connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + dur + 0.02);
    }
    return {
      get enabled() { return enabled; },
      setEnabled(value) { enabled = !!value; store.set("h5gv-sound", enabled); },
      click() { tone(420, 0.06, "triangle"); },
      correct() { tone(720, 0.09, "sine"); setTimeout(() => tone(960, 0.08, "sine"), 70); },
      wrong() { tone(150, 0.12, "sawtooth"); },
      done() { [520, 720, 980].forEach((f, i) => setTimeout(() => tone(f, 0.1, "triangle"), i * 85)); }
    };
  })();

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  function stars(score, max) {
    const n = Math.max(1, Math.min(3, Math.ceil((score / Math.max(1, max)) * 3)));
    return "*".repeat(n).replace(/\*/g, "★") + "☆".repeat(3 - n);
  }

  function wireCommonControls({ onRestart, onPause, onFullscreen } = {}) {
    const soundBtn = document.getElementById("soundBtn");
    if (soundBtn) {
      soundBtn.textContent = audio.enabled ? "Sound On" : "Sound Off";
      soundBtn.addEventListener("click", () => {
        audio.setEnabled(!audio.enabled);
        soundBtn.textContent = audio.enabled ? "Sound On" : "Sound Off";
        audio.click();
      });
    }
    const pauseBtn = document.getElementById("pauseBtn");
    if (pauseBtn && onPause) pauseBtn.addEventListener("click", () => { audio.click(); onPause(); });
    const restartBtn = document.getElementById("resetBtn");
    if (restartBtn && onRestart) restartBtn.addEventListener("click", () => { audio.click(); onRestart(); });
    const fullBtn = document.getElementById("fullscreenBtn");
    if (fullBtn) fullBtn.addEventListener("click", () => {
      audio.click();
      const target = document.querySelector(".game-stage") || document.documentElement;
      if (!document.fullscreenElement) target.requestFullscreen?.();
      else document.exitFullscreen?.();
      if (onFullscreen) onFullscreen();
    });
  }

  window.H5GV = { store, audio, formatTime, stars, wireCommonControls };
})();
