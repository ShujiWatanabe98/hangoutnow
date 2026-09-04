(() => {
  const error = new URLSearchParams(window.location.search).get('error');
  const errorElement = document.getElementById('loginError');
  if (!error || !errorElement) return;
  errorElement.textContent = error === 'locked'
    ? '試行回数が多すぎます。15分ほど待ってからお試しください。'
    : 'ユーザー名またはパスワードが違います。';
  errorElement.hidden = false;
})();
