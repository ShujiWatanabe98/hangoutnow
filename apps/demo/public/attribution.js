(() => {
  const storageKey = 'hangout-now-acquisition-v1';
  const consentKey = 'hangout-now-analytics-consent';
  const allowed = {
    source: /^(x|instagram|line|facebook|web_share|newsletter|founder|method-more|partner-[a-z0-9-]{1,40})$/,
    medium: /^(organic-social|organic-search|referral|qr|email|paid-social)$/,
    campaign: /^[a-z0-9][a-z0-9-]{2,63}$/,
    content: /^[a-z0-9][a-z0-9-]{1,79}$/,
  };

  const capture = () => {
    if (localStorage.getItem(consentKey) !== 'granted') return;
    try {
      const existing = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      if (existing && Object.entries(existing).every(([key, value]) => allowed[key]?.test(value))) return;
    } catch {
      sessionStorage.removeItem(storageKey);
    }
    const parameters = new URLSearchParams(location.search);
    const acquisition = {
      source: parameters.get('utm_source') || '',
      medium: parameters.get('utm_medium') || '',
      campaign: parameters.get('utm_campaign') || '',
      content: parameters.get('utm_content') || '',
    };
    if (!Object.entries(acquisition).every(([key, value]) => allowed[key].test(value))) return;
    sessionStorage.setItem(storageKey, JSON.stringify(acquisition));
  };

  if (localStorage.getItem(consentKey) === 'denied') sessionStorage.removeItem(storageKey);
  capture();
  addEventListener('hangout:analytics-consent', (event) => {
    if (event.detail === 'granted') capture();
    else sessionStorage.removeItem(storageKey);
  });
})();
