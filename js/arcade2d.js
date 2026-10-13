/* Shared engine for the one-finger 2D games: fixed logical canvas (letterboxed, HiDPI), primary-pointer tracking,
   particles and screen shake. Game code draws in logical W x H coordinates. */
window.Arcade2D = function (o) {
  const A = GameKit(o), W = o.w || 420, H = o.h || 640, bg = o.bg || '#0a0a24';
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d'), view = {s: 1, ox: 0, oy: 0};
  cv.style.cssText = 'display:block;width:100%;height:100%;border:0;border-radius:0;max-width:none;touch-action:none;background:' + bg;
  A.el.appendChild(cv); Object.assign(A, {ctx, W, H, cv, t: 0});
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.max(1, Math.round(A.el.clientWidth * dpr)); cv.height = Math.max(1, Math.round(A.el.clientHeight * dpr));
    view.s = Math.min(cv.width / W, cv.height / H); view.ox = (cv.width - W * view.s) / 2; view.oy = (cv.height - H * view.s) / 2;
  };
  new ResizeObserver(resize).observe(A.el); resize();

  const P = A.p = {x: W / 2, y: H / 2, down: false, justDown: false, justUp: false, id: null, type: 'mouse'};
  const at = e => { const r = cv.getBoundingClientRect(), k = cv.width / r.width; P.x = ((e.clientX - r.left) * k - view.ox) / view.s; P.y = ((e.clientY - r.top) * k - view.oy) / view.s; };
  cv.addEventListener('pointerdown', e => { if (P.id != null) return; try { cv.setPointerCapture(e.pointerId); } catch (x) {} P.id = e.pointerId; P.type = e.pointerType; at(e); P.down = P.justDown = true; });
  cv.addEventListener('pointermove', e => { if (P.id == null ? e.pointerType === 'mouse' : e.pointerId === P.id) at(e); });
  const up = e => { if (e.pointerId === P.id) { at(e); P.down = false; P.justUp = true; P.id = null; } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

  const parts = []; let shk = 0;
  A.rnd = (a, b) => a + Math.random() * (b - a);
  A.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  A.shake = a => { shk = Math.max(shk, a); };
  A.burst = (x, y, color, n, speed, size) => {
    for (let i = 0; i < (n || 14); i++) { const a = Math.random() * 6.283, v = (speed || 140) * (.3 + Math.random()); parts.push({x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color, size: size || 3}); }
  };
  A.text = (s, x, y, size, color, align, weight) => {
    ctx.font = (weight || 700) + ' ' + size + 'px "Space Grotesk",sans-serif'; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color || '#fff'; ctx.fillText(s, x, y);
  };
  A.loop = fn => {
    let last = performance.now();
    (function frame(t) {
      const dt = Math.min(.05, (t - last) / 1000 || .016); last = t; A.t += dt;
      try {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = bg; ctx.fillRect(0, 0, cv.width, cv.height);
        const sx = shk > .01 ? (Math.random() - .5) * shk : 0, sy = shk > .01 ? (Math.random() - .5) * shk : 0; shk *= Math.pow(.001, dt);
        ctx.setTransform(view.s, 0, 0, view.s, view.ox + sx * view.s, view.oy + sy * view.s);
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
        fn(dt, ctx);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = parts.length - 1; i >= 0; i--) {
          const q = parts[i]; q.life -= dt * 1.6; if (q.life <= 0) { parts.splice(i, 1); continue; }
          q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 140 * dt; ctx.globalAlpha = q.life; ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * q.life + .5, 0, 6.283); ctx.fill();
        }
        ctx.restore(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      } catch (e) { if (!A.err) { A.err = e; console.error(e); } }
      P.justDown = P.justUp = false;
      requestAnimationFrame(frame);
    })(last);
  };
  return A;
};
