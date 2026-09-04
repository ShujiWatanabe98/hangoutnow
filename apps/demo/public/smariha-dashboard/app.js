(() => {
  const environments = {
    prod: {
      title: 'Prodサンプル',
      notice: 'Prodを想定した固定サンプルを表示しています。',
      healthy: 24,
      warning: 1,
      responseTime: 286,
      checks: [
        ['ログイン画面', 'ページ応答と主要要素', '正常'],
        ['アプリケーション稼働', 'HTTP応答とサービス状態', '正常'],
        ['患者機能チェック', '画面遷移と応答確認', '正常'],
        ['内部監視', '実行環境と依存サービス', '要確認'],
      ],
      history: [
        ['09:30', '定期監視', '24件正常・1件要確認'],
        ['09:15', '患者機能チェック', '正常終了'],
        ['09:00', '定期監視', '25件正常'],
      ],
    },
    preprod: {
      title: 'PreProdサンプル',
      notice: 'PreProdを想定した固定サンプルを表示しています。',
      healthy: 23,
      warning: 2,
      responseTime: 341,
      checks: [
        ['ログイン画面', 'ページ応答と主要要素', '正常'],
        ['アプリケーション稼働', 'HTTP応答とサービス状態', '正常'],
        ['患者機能チェック', '画面遷移と応答確認', '要確認'],
        ['内部監視', '実行環境と依存サービス', '要確認'],
      ],
      history: [
        ['09:30', '定期監視', '23件正常・2件要確認'],
        ['09:15', '患者機能チェック', '1件要確認'],
        ['09:00', '定期監視', '24件正常・1件要確認'],
      ],
    },
  };

  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

  function render(environment) {
    const data = environments[environment];
    byId('environmentTitle').textContent = data.title;
    byId('environmentNotice').textContent = data.notice;
    byId('healthyCount').textContent = data.healthy;
    byId('warningCount').textContent = data.warning;
    byId('responseTime').textContent = data.responseTime;
    byId('checkList').innerHTML = data.checks.map(([name, detail, status]) => `
      <article class="check-row">
        <div><strong>${escapeHtml(name)}</strong><small>${escapeHtml(detail)}</small></div>
        <span class="status-pill${status === '要確認' ? ' warning' : ''}">${escapeHtml(status)}</span>
      </article>`).join('');
    byId('historyList').innerHTML = data.history.map(([time, name, result]) => `
      <article class="history-row">
        <time>サンプル ${escapeHtml(time)}</time>
        <strong>${escapeHtml(name)}</strong>
        <small>${escapeHtml(result)}</small>
      </article>`).join('');
  }

  document.querySelectorAll('.environment-tab').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.environment-tab').forEach((item) => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      render(button.dataset.environment);
    });
  });

  render('prod');
})();
