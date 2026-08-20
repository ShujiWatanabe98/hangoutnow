(() => {
  const form = document.querySelector('#newsletter-form');
  if (!form) return;
  const status = document.querySelector('#newsletter-status');
  const button = form.querySelector('button[type="submit"]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    button.disabled = true;
    status.textContent = '登録しています…';
    try {
      const response = await fetch('/api/newsletter/subscriptions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: form.elements.email.value, consent: form.elements.consent.checked, source: 'homepage' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error('登録内容を確認してください。');
      if (result.unsubscribeToken) localStorage.setItem('hangout-now-newsletter-token', result.unsubscribeToken);
      status.textContent = result.alreadyRegistered ? 'このメールアドレスは登録済みです。' : '登録しました。新着や重要なお知らせをメールでご案内します。';
      status.className = 'newsletter-status success';
      globalThis.hangoutAnalyticsEvent?.('generate_lead', { lead_type: 'newsletter', form_location: 'homepage' });
      form.reset();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : '登録できませんでした。時間を置いてお試しください。';
      status.className = 'newsletter-status error';
    } finally {
      button.disabled = false;
    }
  });
})();
