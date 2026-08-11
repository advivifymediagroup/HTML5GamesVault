(function () {
  const PRODUCTS = {
    fruits: { label: "Fruits", items: [["Apple","🍎"],["Banana","🍌"],["Pear","🍐"],["Orange","🍊"]] },
    drinks: { label: "Drinks", items: [["Juice","🧃"],["Milk","🥛"],["Soda","🥤"],["Water","💧"]] },
    cleaning: { label: "Cleaning", items: [["Soap","🧼"],["Spray","🧴"],["Sponge","🧽"],["Brush","🪥"]] },
    stationery: { label: "Stationery", items: [["Pencil","✏️"],["Notebook","📓"],["Clips","📎"],["Crayon","🖍️"]] },
    toys: { label: "Toys", items: [["Blocks","🧱"],["Ball","⚽"],["Puzzle","🧩"],["Robot","🤖"]] },
    clothes: { label: "Clothing", items: [["Shirt","👕"],["Socks","🧦"],["Cap","🧢"],["Shoe","👟"]] }
  };
  const LEVELS = [
    { cats:["fruits","drinks"], each:3, limit:10, time:0 },
    { cats:["fruits","cleaning","stationery"], each:3, limit:14, time:0 },
    { cats:["fruits","drinks","cleaning"], each:4, limit:16, time:80 },
    { cats:["fruits","drinks","cleaning","stationery"], each:4, limit:22, time:90 },
    { cats:["fruits","drinks","cleaning","stationery","toys"], each:4, limit:28, time:105 },
    { cats:["fruits","drinks","cleaning","stationery","toys","clothes"], each:4, limit:34, time:120 }
  ];
  const els = ["board","level","score","moves","time","limit","status","overlay","overTitle","overMsg","stars","modalStats","restartOverlay"].reduce((a,id)=>(a[id]=document.getElementById(id),a),{});
  let level = +H5GV.store.get("store-sort-level", 1), score = 0, moves = 0, seconds = 0, paused = true, selected = null, items = [], timer;

  function cfg() { return LEVELS[Math.min(level - 1, LEVELS.length - 1)]; }
  function pick(cat, n) {
    const pool = PRODUCTS[cat].items;
    return Array.from({length:n}, (_, i) => ({ id: `${cat}-${Date.now()}-${Math.random()}-${i}`, cat, name: pool[i % pool.length][0], icon: pool[i % pool.length][1] }));
  }
  function shuffle(a) { for (let i=a.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
  function start() {
    const c = cfg();
    moves = 0; score = 0; seconds = c.time || 0; paused = false; selected = null;
    items = shuffle(c.cats.flatMap(cat => pick(cat, c.each))).map(x => ({...x, placed:false}));
    els.overlay.classList.remove("show");
    render();
    clearInterval(timer);
    timer = setInterval(tick, 1000);
  }
  function tick() {
    if (paused) return;
    if (cfg().time) {
      seconds--;
      if (seconds <= 0) return fail("Shift over", "Time ran out. Replay this level and sort a little faster.");
    } else seconds++;
    updateStats();
  }
  function updateStats() {
    els.level.textContent = level;
    els.score.textContent = score;
    els.moves.textContent = moves;
    els.time.textContent = H5GV.formatTime(seconds);
    els.limit.textContent = cfg().limit || "--";
  }
  function render() {
    updateStats();
    const c = cfg();
    els.board.innerHTML = `<section class="stock-bin"><h2>Mixed stock</h2><div class="stock-list"></div></section><section class="shelves"></section>`;
    const stock = els.board.querySelector(".stock-list");
    const shelves = els.board.querySelector(".shelves");
    items.filter(i => !i.placed).forEach(item => stock.appendChild(itemNode(item)));
    c.cats.forEach(cat => {
      const shelf = document.createElement("button");
      shelf.className = "shelf";
      shelf.type = "button";
      shelf.dataset.cat = cat;
      shelf.innerHTML = `<h3>${PRODUCTS[cat].label}<span>${items.filter(i=>i.cat===cat&&i.placed).length}/${c.each}</span></h3><div class="shelf-items"></div>`;
      shelf.addEventListener("click", () => selected && place(selected, cat));
      shelf.addEventListener("dragover", e => { e.preventDefault(); shelf.classList.add("hot"); });
      shelf.addEventListener("dragleave", () => shelf.classList.remove("hot"));
      shelf.addEventListener("drop", e => { e.preventDefault(); shelf.classList.remove("hot"); place(e.dataTransfer.getData("text/plain"), cat); });
      items.filter(i => i.cat === cat && i.placed).forEach(item => shelf.querySelector(".shelf-items").appendChild(itemNode(item, true)));
      if (items.filter(i => i.cat === cat && i.placed).length === c.each) shelf.classList.add("done");
      shelves.appendChild(shelf);
    });
  }
  function itemNode(item, small) {
    const n = document.createElement("button");
    n.className = "item" + (selected === item.id ? " selected" : "");
    n.type = "button";
    n.draggable = !small;
    n.dataset.id = item.id;
    n.innerHTML = `<strong aria-hidden="true">${item.icon}</strong><span>${item.name}</span>`;
    n.setAttribute("aria-label", `${item.name}, ${PRODUCTS[item.cat].label}`);
    if (!small) {
      n.addEventListener("click", () => { selected = selected === item.id ? null : item.id; H5GV.audio.click(); render(); });
      n.addEventListener("dragstart", e => { selected = item.id; n.classList.add("dragging"); e.dataTransfer.setData("text/plain", item.id); });
      n.addEventListener("dragend", () => n.classList.remove("dragging"));
    }
    return n;
  }
  function place(id, cat) {
    if (paused) return;
    const item = items.find(i => i.id === id && !i.placed);
    if (!item) return;
    moves++;
    if (item.cat === cat) {
      item.placed = true; selected = null; score += Math.max(40, 120 - moves * 2); H5GV.audio.correct();
      els.status.textContent = `${item.name} belongs in ${PRODUCTS[cat].label}.`;
    } else {
      H5GV.audio.wrong(); score = Math.max(0, score - 15); els.status.textContent = `${item.name} goes somewhere else.`;
    }
    if (cfg().limit && moves >= cfg().limit && items.some(i => !i.placed)) return fail("Move limit reached", "You ran out of moves. Try grouping the obvious shelves first.");
    render();
    if (items.every(i => i.placed)) complete();
  }
  function rating() {
    const spare = cfg().limit ? cfg().limit - moves : 8;
    return spare >= 5 ? "★★★" : spare >= 2 ? "★★☆" : "★☆☆";
  }
  function complete() {
    paused = true; clearInterval(timer); H5GV.audio.done();
    const bestKey = "store-sort-best-" + level;
    const best = H5GV.store.get(bestKey, null);
    if (!best || score > best.score) H5GV.store.set(bestKey, { score, moves, seconds });
    H5GV.store.set("store-sort-level", Math.min(level + 1, LEVELS.length));
    els.overTitle.textContent = `Level ${level} complete`;
    els.overMsg.textContent = "The shelves are tidy.";
    els.stars.textContent = rating();
    els.modalStats.textContent = `Score ${score} · Moves ${moves} · Time ${H5GV.formatTime(seconds)}`;
    els.restartOverlay.textContent = level >= LEVELS.length ? "Replay" : "Next Level";
    els.overlay.classList.add("show");
    if (level < LEVELS.length) level++;
  }
  function fail(title, msg) {
    paused = true; clearInterval(timer); H5GV.audio.wrong();
    els.overTitle.textContent = title; els.overMsg.textContent = msg; els.stars.textContent = "★☆☆";
    els.modalStats.textContent = `Score ${score} · Moves ${moves}`; els.restartOverlay.textContent = "Try Again"; els.overlay.classList.add("show");
  }
  function togglePause() {
    paused = !paused;
    document.getElementById("pauseBtn").textContent = paused ? "Resume" : "Pause";
    els.status.textContent = paused ? "Paused." : "Sorting resumed.";
  }
  document.getElementById("nextBtn").addEventListener("click", start);
  els.restartOverlay.addEventListener("click", start);
  H5GV.wireCommonControls({ onRestart:start, onPause:togglePause });
  updateStats();
})();
