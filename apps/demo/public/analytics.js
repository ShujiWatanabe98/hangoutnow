(() => {
  const measurementId = 'G-VZB1R06SCH';
  globalThis.dataLayer = globalThis.dataLayer || [];
  globalThis.gtag = function gtag() { globalThis.dataLayer.push(arguments); };
  globalThis.gtag('js', new Date());
  globalThis.gtag('config', measurementId, {
    allow_google_signals: false,
    anonymize_ip: true,
  });

  const loader = document.createElement('script');
  loader.async = true;
  loader.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.append(loader);

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (href.startsWith('/demo.html')) globalThis.gtag('event', 'demo_open', { link_url: '/demo.html' });
    if (href.startsWith('mailto:')) globalThis.gtag('event', 'contact_click', { contact_method: 'email' });
  });
})();
