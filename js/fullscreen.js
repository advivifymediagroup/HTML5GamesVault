/* Fullscreen for every game page: expands the whole stage (scoreboard, canvas, buttons, status),
   shows how to exit, and falls back to a fixed-position "pseudo" fullscreen where the API is missing (iPhone). */
(() => {
  const stage = document.querySelector('.game-stage');
  if (!stage) return;
  const controls = stage.querySelector('.controls') || stage.appendChild(Object.assign(document.createElement('div'), {className: 'controls'}));
  let btn = document.getElementById('fsBtn');
  if (!btn) { btn = document.createElement('button'); btn.id = 'fsBtn'; btn.className = 'btn btn-alt'; controls.appendChild(btn); }
  btn.type = 'button';

  const exitBtn = Object.assign(document.createElement('button'), {className: 'fs-exit', type: 'button', textContent: '✕ Exit fullscreen (Esc)'});
  const toast = Object.assign(document.createElement('div'), {className: 'fs-toast', textContent: 'Press Esc or tap Exit to leave fullscreen'});
  stage.append(exitBtn, toast);

  const canvases = () => [...stage.querySelectorAll('canvas')].filter(c => !c.closest('#game3d'));
  let toastT, ro;
  const active = () => stage.classList.contains('is-fs');

  function fit() {
    if (!active()) return;
    const cs = getComputedStyle(stage), kids = [...stage.children].filter(k => !k.classList.contains('fs-exit') && !k.classList.contains('fs-toast'));
    const gap = parseFloat(cs.rowGap) || 0;
    canvases().forEach(cv => {
      const holder = kids.find(k => k === cv || k.contains(cv)), others = kids.filter(k => k !== holder && k.offsetHeight);
      const availH = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - others.reduce((h, k) => h + k.offsetHeight + gap, 0) - 8;
      const availW = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const s = Math.min(availW / cv.width, availH / cv.height);
      if (s > 0) { cv.style.width = Math.floor(cv.width * s) + 'px'; cv.style.height = Math.floor(cv.height * s) + 'px'; cv.style.maxWidth = 'none'; }
    });
  }
  function setState(on) {
    stage.classList.toggle('is-fs', on); document.documentElement.classList.toggle('fs-lock', on);
    btn.textContent = on ? '✕ Exit fullscreen (Esc)' : '⛶ Fullscreen';
    if (!on) canvases().forEach(cv => { cv.style.width = cv.style.height = cv.style.maxWidth = ''; });
    clearTimeout(toastT); toast.classList.toggle('show', on); if (on) toastT = setTimeout(() => toast.classList.remove('show'), 3800);
    if (ro) ro.disconnect();
    if (on) { ro = new ResizeObserver(fit); [...stage.children].forEach(k => { if (!k.contains(stage.querySelector('canvas'))) ro.observe(k); }); ro.observe(stage); }
    requestAnimationFrame(() => { fit(); window.dispatchEvent(new Event('resize')); });
  }
  const nativeFs = () => document.fullscreenElement || document.webkitFullscreenElement;
  function enter() {
    const req = stage.requestFullscreen || stage.webkitRequestFullscreen;
    if (!req) return setState(true);
    Promise.resolve().then(() => req.call(stage)).catch(() => setState(true));
  }
  function leave() { if (nativeFs()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else setState(false); }
  btn.addEventListener('click', () => (active() ? leave() : enter()));
  exitBtn.addEventListener('click', leave);
  document.addEventListener('fullscreenchange', () => setState(document.fullscreenElement === stage));
  document.addEventListener('webkitfullscreenchange', () => setState(document.webkitFullscreenElement === stage));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && active() && !nativeFs()) setState(false); });
  window.addEventListener('resize', fit);
})();
