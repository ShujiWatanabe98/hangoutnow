(() => {
  const button = document.querySelector('#unsubscribe-newsletter');
  const status = document.querySelector('#unsubscribe-status');
  if (!button || !status) return;
  const token = new URLSearchParams(location.search).get('token') || localStorage.getItem('hangout-now-newsletter-token');
  if (!token) {
    button.disabled = true;
    status.textContent = '解除用情報がありません。登録時と同じブラウザーで開くか、案内メールの解除リンクをご利用ください。';
    return;
  }
  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = '解除しています…';
    try {
      const response = await fetch('/api/newsletter/subscriptions', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) });
      if (!response.ok) throw new Error('解除できませんでした。');
      localStorage.removeItem('hangout-now-newsletter-token');
      status.textContent = '更新通知の登録を解除しました。';
      status.className = 'success';
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : '解除できませんでした。';
      status.className = 'error';
      button.disabled = false;
    }
  });
})();
