(() => {
  const board = document.getElementById('board');
  const objectiveEl = document.getElementById('objective');
  const levelEl = document.getElementById('level');
  const movesEl = document.getElementById('moves');
  const bestEl = document.getElementById('best');
  const statusEl = document.getElementById('status');
  const undoBtn = document.getElementById('undoBtn');
  const resetBtn = document.getElementById('resetBtn');
  const nextBtn = document.getElementById('nextBtn');
  const places = {
    Portugal:[9,52], Spain:[20,67], France:[35,48], Belgium:[43,29], Netherlands:[47,15], Luxembourg:[48,42],
    Germany:[57,37], Denmark:[57,12], Switzerland:[49,59], Italy:[59,77], Austria:[68,58], Czechia:[69,37],
    Poland:[78,29], Slovakia:[78,48], Hungary:[79,63], Slovenia:[67,76], Croatia:[77,80]
  };
  const borders = {
    Portugal:['Spain'], Spain:['Portugal','France'], France:['Spain','Belgium','Luxembourg','Germany','Switzerland','Italy'],
    Belgium:['France','Netherlands','Germany','Luxembourg'], Netherlands:['Belgium','Germany'], Luxembourg:['France','Belgium','Germany'],
    Germany:['France','Belgium','Netherlands','Luxembourg','Denmark','Switzerland','Austria','Czechia','Poland'],
    Denmark:['Germany'], Switzerland:['France','Germany','Austria','Italy'], Italy:['France','Switzerland','Austria','Slovenia'],
    Austria:['Germany','Switzerland','Italy','Czechia','Slovakia','Hungary','Slovenia'],
    Czechia:['Germany','Poland','Slovakia','Austria'], Poland:['Germany','Czechia','Slovakia'],
    Slovakia:['Poland','Czechia','Austria','Hungary'], Hungary:['Austria','Slovakia','Slovenia','Croatia'],
    Slovenia:['Italy','Austria','Hungary','Croatia'], Croatia:['Slovenia','Hungary']
  };
  const routes = [
    {from:'Portugal',to:'Poland',limit:7}, {from:'Netherlands',to:'Hungary',limit:6},
    {from:'Italy',to:'Denmark',limit:6}, {from:'Spain',to:'Slovakia',limit:6}
  ];
  let routeIndex = 0, path = [], complete = false;
  let best = +localStorage.getItem('borderline-best') || 0;
  bestEl.textContent = best || '—';

  function shortest(from, to) {
    const queue = [[from]], seen = new Set([from]);
    while (queue.length) {
      const currentPath = queue.shift(), current = currentPath[currentPath.length - 1];
      if (current === to) return currentPath.length - 1;
      for (const neighbor of borders[current]) if (!seen.has(neighbor)) { seen.add(neighbor); queue.push([...currentPath, neighbor]); }
    }
    return Infinity;
  }

  function render() {
    const route = routes[routeIndex], visited = new Set(path);
    board.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg>';
    const svg = board.querySelector('svg');
    for (const [country, neighbors] of Object.entries(borders)) for (const neighbor of neighbors) {
      if (country.localeCompare(neighbor) >= 0) continue;
      const a = places[country], b = places[neighbor], line = document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('x1',a[0]); line.setAttribute('y1',a[1]); line.setAttribute('x2',b[0]); line.setAttribute('y2',b[1]);
      line.classList.add('route-edge');
      if (visited.has(country) && visited.has(neighbor) && Math.abs(path.indexOf(country)-path.indexOf(neighbor)) === 1) line.classList.add('active');
      svg.appendChild(line);
    }
    for (const [country, point] of Object.entries(places)) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'country-node'; button.textContent = country;
      button.style.left = `${point[0]}%`; button.style.top = `${point[1]}%`;
      if (visited.has(country)) button.classList.add('visited');
      if (country === route.from) button.classList.add('start');
      if (country === route.to) button.classList.add('goal');
      button.disabled = complete;
      button.addEventListener('click', () => moveTo(country)); board.appendChild(button);
    }
  }

  function beginRoute() {
    const route = routes[routeIndex]; path = [route.from]; complete = false;
    levelEl.textContent = `${routeIndex + 1} / ${routes.length}`;
    objectiveEl.textContent = `${route.from} to ${route.to} · ${route.limit} moves max`;
    movesEl.textContent = '0'; statusEl.textContent = `Start in ${route.from}. Cross one border at a time.`;
    nextBtn.disabled = true; nextBtn.textContent = routeIndex === routes.length - 1 ? 'Finish' : 'Next route'; render();
  }

  function moveTo(country) {
    if (complete) return;
    const current = path[path.length - 1];
    if (country === current && path.length === 1) return;
    if (country === path[path.length - 2]) { path.pop(); update(); return; }
    if (!borders[current].includes(country)) { statusEl.textContent = `${country} does not share a border with ${current}.`; return; }
    if (path.includes(country)) { statusEl.textContent = 'That country is already on your route.'; return; }
    path.push(country); update();
  }

  function update() {
    const route = routes[routeIndex], moves = path.length - 1;
    movesEl.textContent = moves; render();
    if (path[path.length - 1] === route.to) {
      complete = true; const efficient = moves === shortest(route.from,route.to);
      statusEl.textContent = efficient ? 'Perfect route: shortest possible.' : `Route complete in ${moves} border crossings.`;
      if (!best || moves < best) { best = moves; localStorage.setItem('borderline-best',best); bestEl.textContent = best; }
      nextBtn.disabled = false; render(); return;
    }
    if (moves >= route.limit) { statusEl.textContent = 'Move limit reached. Undo a step or restart this route.'; return; }
    statusEl.textContent = `${route.to} is ${shortest(path[path.length - 1],route.to)} borders away from here.`;
  }

  undoBtn.addEventListener('click', () => { if (path.length > 1 && !complete) { path.pop(); update(); } });
  resetBtn.addEventListener('click', beginRoute);
  nextBtn.addEventListener('click', () => { if (!complete) return; routeIndex = (routeIndex + 1) % routes.length; beginRoute(); });
  beginRoute();
})();