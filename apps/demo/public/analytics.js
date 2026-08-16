(() => {
  const measurementId = 'G-VZB1R06SCH';
  const consentKey = 'hangout-now-analytics-consent';
  globalThis.dataLayer = globalThis.dataLayer || [];
  globalThis.gtag = function gtag() { globalThis.dataLayer.push(arguments); };
  globalThis.gtag('consent', 'default', { analytics_storage: 'denied' });

  let analyticsLoaded = false;
  const trackWebVitals = () => {
    let lcp = 0;
    let cls = 0;
    let inp = 0;
    let reported = false;
    const observe = (type, callback) => {
      try {
        const observer = new PerformanceObserver((list) => callback(list.getEntries()));
        observer.observe({ type, buffered: true, durationThreshold: type === 'event' ? 40 : undefined });
      } catch { /* Unsupported performance entry type. */ }
    };
    observe('largest-contentful-paint', (entries) => { const last = entries.at(-1); if (last) lcp = last.startTime; });
    observe('layout-shift', (entries) => { for (const entry of entries) if (!entry.hadRecentInput) cls += entry.value; });
    observe('event', (entries) => { for (const entry of entries) inp = Math.max(inp, entry.duration || 0); });
    const report = () => {
      if (reported) return;
      reported = true;
      if (lcp) globalThis.gtag('event', 'web_vital', { metric_name: 'LCP', metric_value: Math.round(lcp), non_interaction: true });
      globalThis.gtag('event', 'web_vital', { metric_name: 'CLS', metric_value: Math.round(cls * 1000), non_interaction: true });
      if (inp) globalThis.gtag('event', 'web_vital', { metric_name: 'INP', metric_value: Math.round(inp), non_interaction: true });
    };
    addEventListener('pagehide', report, { once: true });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') report(); }, { once: true });
  };
  const loadAnalytics = () => {
    if (analyticsLoaded) return;
    analyticsLoaded = true;
    globalThis.gtag('consent', 'update', { analytics_storage: 'granted' });
    globalThis.gtag('js', new Date());
    globalThis.gtag('config', measurementId, { allow_google_signals: false, anonymize_ip: true });
    const loader = document.createElement('script');
    loader.async = true;
    loader.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.append(loader);
    trackWebVitals();
  };

  const savedConsent = localStorage.getItem(consentKey);
  if (savedConsent === 'granted') loadAnalytics();

  const closeBanner = () => document.querySelector('.cookie-consent')?.remove();
  const saveConsent = (value) => {
    localStorage.setItem(consentKey, value);
    if (value === 'granted') loadAnalytics();
    else globalThis.gtag('consent', 'update', { analytics_storage: 'denied' });
    closeBanner();
  };

  const showConsent = () => {
    if (document.querySelector('.cookie-consent')) return;
    const banner = document.createElement('section');
    banner.className = 'cookie-consent';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'アクセス解析Cookieの設定');
    banner.innerHTML = '<div><strong>アクセス解析Cookieについて</strong><p>サイト改善のため、同意いただいた場合のみGoogle Analyticsを使用します。詳しくは<a href="/privacy.html#analytics">プライバシーポリシー</a>をご確認ください。</p></div><div class="cookie-actions"><button type="button" data-cookie-choice="denied">拒否する</button><button type="button" class="accept" data-cookie-choice="granted">同意する</button></div>';
    banner.addEventListener('click', (event) => {
      const button = event.target.closest('[data-cookie-choice]');
      if (button) saveConsent(button.dataset.cookieChoice);
    });
    document.body.append(banner);
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (!savedConsent) showConsent();
    document.querySelectorAll('[data-cookie-settings]').forEach((button) => button.addEventListener('click', () => {
      localStorage.removeItem(consentKey);
      showConsent();
    }));
  });

  document.addEventListener('click', (event) => {
    if (!analyticsLoaded) return;
    const share = event.target.closest('[data-share-network]');
    if (share) globalThis.gtag('event', 'share', { method: share.dataset.shareNetwork, content_type: 'page', item_id: location.pathname });
    const link = event.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (href.startsWith('/demo.html')) globalThis.gtag('event', 'demo_open', { link_url: '/demo.html' });
    if (href.startsWith('mailto:')) globalThis.gtag('event', 'contact_click', { contact_method: 'email' });
  });
})();
