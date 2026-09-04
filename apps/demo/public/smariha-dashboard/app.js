(() => {
  const selector = document.getElementById('mvpSelector');
  const views = [...document.querySelectorAll('[data-view]')];

  function showSelector() {
    views.forEach((view) => { view.hidden = true; });
    selector.hidden = false;
    history.replaceState(null, '', window.location.pathname);
    selector.querySelector('button')?.focus({ preventScroll: true });
    selector.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showDashboard(name, updateHistory = true) {
    const target = views.find((view) => view.dataset.view === name);
    if (!target) return;
    selector.hidden = true;
    views.forEach((view) => { view.hidden = view !== target; });
    if (updateHistory) history.replaceState(null, '', `#${name}`);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.querySelector('h2')?.focus?.({ preventScroll: true });
  }

  document.querySelectorAll('[data-dashboard]').forEach((button) => {
    button.addEventListener('click', () => showDashboard(button.dataset.dashboard));
  });
  document.querySelectorAll('[data-back]').forEach((button) => button.addEventListener('click', showSelector));

  const requestedDashboard = window.location.hash.slice(1);
  if (['outcome', 'path'].includes(requestedDashboard)) showDashboard(requestedDashboard, false);
})();
