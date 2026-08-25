// Game filter chips
const chips = document.querySelectorAll('.chip');
const navCategoryLinks = document.querySelectorAll('.nav-category');
const cards = document.querySelectorAll('.game-card');

function applyFilter(filter) {
  chips.forEach(c => c.classList.toggle('chip-active', c.dataset.filter === filter));
  cards.forEach(card => {
    const tags = card.dataset.tags || '';
    const show = filter === 'all' || tags.includes(filter);
    card.style.display = show ? '' : 'none';
  });
}

chips.forEach(chip => {
  chip.addEventListener('click', () => {
    applyFilter(chip.dataset.filter);
  });
});

navCategoryLinks.forEach(link => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    const filter = link.dataset.filter;
    applyFilter(filter);
    const target = document.getElementById('games');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
