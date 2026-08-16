(() => {
  const measurementId = 'G-VZB1R06SCH';
  const consentKey = 'hangout-now-analytics-consent';
  globalThis.dataLayer = globalThis.dataLayer || [];
  globalThis.gtag = function gtag() { globalThis.dataLayer.push(arguments); };
  globalThis.gtag('consent', 'default', { analytics_storage: 'denied' });

  let analyticsLoaded = false;
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
    const link = event.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (!analyticsLoaded) return;
    if (href.startsWith('/demo.html')) globalThis.gtag('event', 'demo_open', { link_url: '/demo.html' });
    if (href.startsWith('mailto:')) globalThis.gtag('event', 'contact_click', { contact_method: 'email' });
  });
})();
