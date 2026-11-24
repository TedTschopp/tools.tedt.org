const form = document.querySelector<HTMLFormElement>('[data-filters]');
if (form) {
  const search = document.querySelector<HTMLInputElement>('#search')!;
  const category = document.querySelector<HTMLSelectElement>('#category')!;
  const status = document.querySelector<HTMLSelectElement>('#status')!;
  const tag = document.querySelector<HTMLSelectElement>('#tag')!;
  const sort = document.querySelector<HTMLSelectElement>('#sort')!;
  const countLabel = document.querySelector<HTMLElement>('[data-count]')!;
  const liveLabel = document.querySelector<HTMLElement>('[data-results-live]')!;
  const emptyState = document.querySelector<HTMLElement>('[data-empty]')!;
  const groups = Array.from(document.querySelectorAll<HTMLElement>('[data-tool-grid]'), grid => ({
    grid,
    section: grid.closest<HTMLElement>('[data-tool-section]'),
    cards: Array.from(grid.querySelectorAll<HTMLElement>('[data-tool-card]')),
  }));
  const initial = new URLSearchParams(location.search);
  search.value = initial.get('q') || '';
  category.value = initial.get('category') || '';
  status.value = initial.get('status') || '';
  tag.value = initial.get('tag') || '';
  sort.value = initial.get('sort') || 'featured';
  let displayedSort = 'featured';

  function compareCards(a: HTMLElement, b: HTMLElement) {
    if (sort.value === 'title') return a.dataset.title!.localeCompare(b.dataset.title!);
    if (sort.value === 'recent') {
      return b.dataset.updated!.localeCompare(a.dataset.updated!) || a.dataset.title!.localeCompare(b.dataset.title!);
    }
    return Number(a.dataset.index) - Number(b.dataset.index);
  }

  function filter() {
    const terms = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let count = 0;
    for (const { grid, section, cards } of groups) {
      if (displayedSort !== sort.value) grid.append(...[...cards].sort(compareCards));
      let groupCount = 0;
      for (const card of cards) {
        const show = terms.every(term => card.dataset.search!.includes(term))
          && (!category.value || card.dataset.category === category.value)
          && (!status.value || card.dataset.status === status.value)
          && (!tag.value || JSON.parse(card.dataset.tags!).includes(tag.value));
        card.hidden = !show;
        if (show) groupCount++;
      }
      if (section) section.hidden = groupCount === 0;
      count += groupCount;
    }
    displayedSort = sort.value;
    countLabel.textContent = `(${count})`;
    liveLabel.textContent = `${count} tools shown.`;
    emptyState.hidden = count !== 0;

    const params = new URLSearchParams();
    if (search.value) params.set('q', search.value);
    if (category.value) params.set('category', category.value);
    if (status.value) params.set('status', status.value);
    if (tag.value) params.set('tag', tag.value);
    if (sort.value !== 'featured') params.set('sort', sort.value);
    const query = params.size ? `?${params}` : '';
    history.replaceState(null, '', `${location.pathname}${query}${location.hash}`);
  }

  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', filter);
  form.addEventListener('change', filter);
  sort.addEventListener('change', filter);
  form.addEventListener('reset', () => {
    sort.value = 'featured';
    setTimeout(filter, 0);
  });
  document.querySelector('[data-clear]')!.addEventListener('click', () => {
    search.value = '';
    search.focus();
    filter();
  });
  filter();
}
