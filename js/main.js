// Registry-backed cards for newly added games. Existing cards remain in HTML.
const registry = window.HTML5GamesVaultGames || [];
const grid = document.querySelector('.games-grid');
if (grid && registry.length) {
  const existing = new Set([...grid.querySelectorAll('.game-card')].map(card => card.getAttribute('href')));
  registry.forEach(game => {
    if (existing.has(game.url)) return;
    const tags = game.tags.map(tag => tag.toLowerCase()).join(' ');
    const tagHtml = game.tags.slice(1, 3).map(tag => `<span class="tag">${tag}</span>`).join('');
    const card = document.createElement('a');
    card.href = game.url;
    card.className = 'game-card';
    card.dataset.tags = tags;
    card.innerHTML = `
      <div class="game-thumb ${game.thumbnailClass}">${game.thumbHtml || ''}</div>
      <div class="game-meta">
        <div class="game-tags">${tagHtml}</div>
        <h3>${game.title}</h3>
        <p>${game.description}</p>
        <span class="play-link">Play &rarr;</span>
      </div>`;
    grid.prepend(card);
  });
}

// Game filter chips
const chips = document.querySelectorAll('.chip');
const cards = document.querySelectorAll('.game-card');

chips.forEach(chip => {
  chip.addEventListener('click', () => {
    chips.forEach(c => c.classList.remove('chip-active'));
    chip.classList.add('chip-active');
    const filter = chip.dataset.filter;

    cards.forEach(card => {
      const tags = card.dataset.tags || '';
      const show = filter === 'all' || tags.includes(filter);
      card.style.display = show ? '' : 'none';
    });
  });
});

// Smooth-scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id === '#') return;
    const target = document.querySelector(id);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
