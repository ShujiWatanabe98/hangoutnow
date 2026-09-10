(() => {
  const error = new URLSearchParams(location.search).get('error');
  const panel = document.querySelector('#loginError');
  if (!error || !panel) return;
  panel.textContent = error === 'locked'
    ? 'ログイン試行回数が上限に達しました。15分後にもう一度お試しください。'
    : 'ユーザー名またはパスワードが違います。';
  panel.hidden = false;
})();
