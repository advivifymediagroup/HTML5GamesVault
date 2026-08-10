(() => {
  const levelNumEl = document.getElementById('levelNum');
  const hintsEl = document.getElementById('hintsLeft');
  const triesEl = document.getElementById('tries');
  const questionEl = document.getElementById('question');
  const stageEl = document.getElementById('stage');
  const feedbackEl = document.getElementById('feedback');
  const hintBtn = document.getElementById('hintBtn');
  const resetBtn = document.getElementById('resetBtn');
  const nextBtn = document.getElementById('nextBtn');
  const statusEl = document.getElementById('status');

  let levelIdx = 0;
  let hintsLeft = 3;
  let tries = 0;
  hintsEl.textContent = hintsLeft;

  // Each level: question text, hint, setup(stageEl, win, lose) returns nothing
  const LEVELS = [
    {
      q: 'Find the panda 🐼 among the bears.',
      hint: 'Look very carefully — the panda has white ears, not brown.',
      setup(stage, win, lose) {
        const positions = 25;
        const pandaAt = 17;
        const grid = document.createElement('div');
        grid.className = 'emoji-grid';
        for (let i = 0; i < positions; i++) {
          const sp = document.createElement('span');
          sp.textContent = i === pandaAt ? '🐼' : '🐻';
          sp.addEventListener('click', () => i === pandaAt ? win() : lose('Not that one — it\'s a bear.'));
          grid.appendChild(sp);
        }
        stage.appendChild(grid);
      }
    },
    {
      q: 'Tap the smallest number.',
      hint: 'Don\'t overthink it — pick the actual smallest value.',
      setup(stage, win, lose) {
        const nums = [9, 5, 8, 2, 7];
        const row = document.createElement('div');
        row.className = 'num-row';
        nums.forEach(n => {
          const b = document.createElement('button');
          b.textContent = n;
          b.addEventListener('click', () => n === 2 ? win() : lose(`${n} isn't the smallest.`));
          row.appendChild(b);
        });
        stage.appendChild(row);
      }
    },
    {
      q: 'Tap the largest number.',
      hint: 'Largest by SIZE, not by value.',
      setup(stage, win, lose) {
        const nums = [9, 5, 8, 2, 7];
        const bigIdx = 1; // the "5" is huge
        const row = document.createElement('div');
        row.className = 'num-row';
        nums.forEach((n, i) => {
          const b = document.createElement('button');
          b.textContent = n;
          if (i === bigIdx) {
            b.style.width = '110px';
            b.style.height = '110px';
            b.style.fontSize = '60px';
            b.style.background = 'linear-gradient(135deg, #ec4899, #8b5cf6)';
          }
          b.addEventListener('click', () => {
            if (i === bigIdx) win();
            else lose('Look again — biggest doesn\'t mean highest value.');
          });
          row.appendChild(b);
        });
        stage.appendChild(row);
      }
    },
    {
      q: 'How many holes does this T-shirt have?',
      hint: 'Count the head opening, the two sleeves, the bottom, and the two damaged spots.',
      setup(stage, win, lose) {
        const wrap = document.createElement('div');
        wrap.className = 'tshirt-wrap';
        wrap.innerHTML = `
          <svg class="tshirt-svg" viewBox="0 0 200 200">
            <path d="M40 60 L70 30 L80 40 Q100 55 120 40 L130 30 L160 60 L145 80 L135 70 L135 170 L65 170 L65 70 L55 80 Z"
                  fill="#8b5cf6" stroke="#312e81" stroke-width="3"/>
            <circle cx="90" cy="100" r="6" fill="#050514"/>
            <circle cx="115" cy="135" r="5" fill="#050514"/>
          </svg>
          <div style="display:flex; gap:8px; margin-top:10px;">
            <input class="tshirt-input" id="tshirtIn" type="number" min="0" max="20" placeholder="?" />
            <button class="tshirt-submit" id="tshirtSub">Check</button>
          </div>
        `;
        stage.appendChild(wrap);
        const inp = wrap.querySelector('#tshirtIn');
        const btn = wrap.querySelector('#tshirtSub');
        btn.addEventListener('click', () => {
          const v = +inp.value;
          // 4 anatomical (head + 2 sleeves + bottom) + 2 damaged = 6
          if (v === 6) win();
          else lose(v > 6 ? 'Too many.' : 'Not enough — count ALL the openings.');
        });
      }
    },
    {
      q: 'Wake up the sleeping dog.',
      hint: 'Drag the "Zzz" away from the dog.',
      setup(stage, win, lose) {
        const wrap = document.createElement('div');
        wrap.className = 'sleep-wrap';
        wrap.innerHTML = `
          <div class="sleep-zzz" id="zzz" draggable="true">Zzz</div>
          <div class="sleep-emoji" id="dog">🐶</div>
        `;
        stage.appendChild(wrap);
        const zzz = wrap.querySelector('#zzz');
        const dog = wrap.querySelector('#dog');
        let dragging = false;
        let startX = 0, startY = 0;

        const onMove = (cx, cy) => {
          const dx = cx - startX, dy = cy - startY;
          zzz.style.transform = `translate(${dx}px, ${dy}px)`;
          if (Math.abs(dx) > 80 || Math.abs(dy) > 80) {
            zzz.style.opacity = '0';
            dog.textContent = '🐕';
            dog.classList.add('awake');
            win();
          }
        };

        zzz.addEventListener('mousedown', e => { dragging = true; startX = e.clientX; startY = e.clientY; e.preventDefault(); });
        document.addEventListener('mousemove', e => { if (dragging) onMove(e.clientX, e.clientY); });
        document.addEventListener('mouseup', () => dragging = false);
        zzz.addEventListener('touchstart', e => {
          const t = e.touches[0]; dragging = true; startX = t.clientX; startY = t.clientY;
        });
        zzz.addEventListener('touchmove', e => {
          if (!dragging) return;
          e.preventDefault();
          const t = e.touches[0]; onMove(t.clientX, t.clientY);
        });
        zzz.addEventListener('touchend', () => dragging = false);
      }
    },
    {
      q: 'Catch the fly! 🪰',
      hint: 'Click it the moment it stops moving.',
      setup(stage, win, lose) {
        const arena = document.createElement('div');
        arena.className = 'fly-arena';
        const fly = document.createElement('div');
        fly.className = 'fly';
        fly.textContent = '🪰';
        arena.appendChild(fly);
        stage.appendChild(arena);

        let active = true;
        function moveFly() {
          if (!active) return;
          const ar = arena.getBoundingClientRect();
          const x = Math.random() * (ar.width - 50);
          const y = Math.random() * (ar.height - 50);
          fly.style.left = x + 'px';
          fly.style.top = y + 'px';
          setTimeout(moveFly, 350 + Math.random() * 250);
        }
        moveFly();
        fly.addEventListener('click', e => {
          if (!active) return;
          active = false;
          fly.textContent = '💥';
          win();
        });
        fly.addEventListener('touchstart', e => {
          e.preventDefault();
          if (!active) return;
          active = false;
          fly.textContent = '💥';
          win();
        }, {passive: false});
      }
    },
    {
      q: 'Drag a number to make this true: 4 + 5 = ?',
      hint: 'Drag the "9" into the slot.',
      setup(stage, win, lose) {
        const row = document.createElement('div');
        row.innerHTML = `
          <div class="eq-row">
            <span>4</span><span>+</span><span>5</span><span>=</span>
            <div class="eq-slot" id="slot"></div>
          </div>
          <div class="eq-tokens" id="tokens">
            <div class="eq-token" data-v="3" draggable="true">3</div>
            <div class="eq-token" data-v="7" draggable="true">7</div>
            <div class="eq-token" data-v="9" draggable="true">9</div>
            <div class="eq-token" data-v="11" draggable="true">11</div>
          </div>
        `;
        stage.appendChild(row);
        const slot = row.querySelector('#slot');
        const tokens = [...row.querySelectorAll('.eq-token')];
        tokens.forEach(t => {
          t.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', t.dataset.v);
          });
          // tap-to-place (mobile fallback)
          t.addEventListener('click', () => place(t));
        });
        slot.addEventListener('dragover', e => e.preventDefault());
        slot.addEventListener('drop', e => {
          e.preventDefault();
          const v = e.dataTransfer.getData('text/plain');
          const tok = tokens.find(t => t.dataset.v === v);
          if (tok) place(tok);
        });
        function place(tok) {
          slot.textContent = tok.dataset.v;
          slot.classList.add('filled');
          tok.classList.add('used');
          if (tok.dataset.v === '9') win();
          else lose(`${tok.dataset.v} doesn't equal 4 + 5.`);
        }
      }
    },
    {
      q: 'Turn on the light. 💡',
      hint: 'Tap the lightbulb emoji — the one in the question text.',
      setup(stage, win, lose) {
        const room = document.createElement('div');
        room.className = 'dark-room';
        room.innerHTML = `
          <span class="bulb">💡</span>
          <div class="hint-text">Hmm... it's still dark.</div>
        `;
        stage.appendChild(room);
        const bulb = room.querySelector('.bulb');
        bulb.addEventListener('click', () => {
          lose('That bulb isn\'t plugged in. Look elsewhere...');
        });
        // The actual answer: tap the 💡 inside the question text
        const trickTarget = questionEl.querySelector('.brain-bulb');
        if (trickTarget) {
          trickTarget.style.cursor = 'pointer';
          trickTarget.addEventListener('click', () => {
            room.classList.add('lit');
            room.querySelector('.hint-text').textContent = '☀️ Let there be light!';
            win();
          });
        }
      }
    }
  ];

  function renderLevel() {
    const lvl = LEVELS[levelIdx];
    levelNumEl.textContent = `${levelIdx + 1}/${LEVELS.length}`;
    triesEl.textContent = tries = 0;
    feedbackEl.textContent = '';
    feedbackEl.className = 'brain-feedback';
    stageEl.innerHTML = '';
    nextBtn.style.display = 'none';

    // Special: level 8 has the trick where you tap a 💡 in the question
    if (levelIdx === 7) {
      questionEl.innerHTML = `Turn on the light. <span class="brain-bulb">💡</span>`;
    } else {
      questionEl.textContent = lvl.q;
    }

    lvl.setup(
      stageEl,
      () => onWin(),
      (msg) => onLose(msg)
    );
    statusEl.innerHTML = `Level ${levelIdx + 1} — ${lvl.q.replace(/<[^>]+>/g, '')}`;
  }

  function onWin() {
    feedbackEl.textContent = '✅ Correct!';
    feedbackEl.className = 'brain-feedback win';
    const banner = document.createElement('div');
    banner.className = 'win-banner';
    banner.textContent = '🎉 Solved!';
    stageEl.appendChild(banner);

    if (levelIdx === LEVELS.length - 1) {
      nextBtn.textContent = '🏆 You finished — Play Again';
      nextBtn.style.display = '';
      nextBtn.onclick = () => { levelIdx = 0; hintsLeft = 3; hintsEl.textContent = 3; renderLevel(); };
    } else {
      nextBtn.textContent = 'Next Level →';
      nextBtn.style.display = '';
      nextBtn.onclick = () => { levelIdx++; renderLevel(); };
    }
  }

  function onLose(msg) {
    tries++;
    triesEl.textContent = tries;
    feedbackEl.textContent = '❌ ' + (msg || 'Not quite.');
    feedbackEl.className = 'brain-feedback fail';
  }

  hintBtn.addEventListener('click', () => {
    if (hintsLeft <= 0) {
      feedbackEl.textContent = '😬 Out of hints. Keep trying!';
      feedbackEl.className = 'brain-feedback fail';
      return;
    }
    hintsLeft--;
    hintsEl.textContent = hintsLeft;
    feedbackEl.textContent = '💡 ' + LEVELS[levelIdx].hint;
    feedbackEl.className = 'brain-feedback hint';
  });
  resetBtn.addEventListener('click', renderLevel);

  renderLevel();
})();
