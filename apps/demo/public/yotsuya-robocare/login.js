const params = new URLSearchParams(window.location.search);
const error = params.get('error');
const errorNode = document.querySelector('#loginError');

if (errorNode && error === 'invalid') {
  errorNode.textContent = 'ユーザー名またはパスワードが違います。入力内容を確認してください。';
  errorNode.hidden = false;
} else if (errorNode && error === 'locked') {
  errorNode.textContent = 'ログイン試行が続いたため、一時的に利用できません。15分後にもう一度お試しください。';
  errorNode.hidden = false;
}

const toggle = document.querySelector('#togglePassword');
const password = document.querySelector('#password');
toggle?.addEventListener('click', () => {
  const showing = password?.type === 'text';
  if (password) password.type = showing ? 'password' : 'text';
  toggle.textContent = showing ? '表示' : '隠す';
  toggle.setAttribute('aria-pressed', String(!showing));
});
