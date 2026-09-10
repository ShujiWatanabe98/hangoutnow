(() => {
  const pages = [...document.querySelectorAll('[data-page]')];
  const navItems = [...document.querySelectorAll('.nav-item')];
  const sidebar = document.querySelector('#sidebar');
  const menuButton = document.querySelector('#menuButton');
  const toast = document.querySelector('#toast');
  let toastTimer;

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3300);
  }

  function showPage(name, updateHash = true) {
    const selected = pages.find((page) => page.dataset.page === name) ?? pages[0];
    pages.forEach((page) => page.classList.toggle('active', page === selected));
    navItems.forEach((item) => item.classList.toggle('active', item.dataset.view === selected.dataset.page));
    if (updateHash) history.replaceState(null, '', `#${selected.dataset.page}`);
    document.title = `${selected.querySelector('h1')?.textContent ?? 'スマリハ'}｜スマリハ統合ポータル`;
    sidebar.classList.remove('open');
    menuButton?.setAttribute('aria-expanded', 'false');
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  navItems.forEach((item) => item.addEventListener('click', () => showPage(item.dataset.view)));
  document.querySelectorAll('[data-go]').forEach((item) => item.addEventListener('click', () => showPage(item.dataset.go)));
  menuButton?.addEventListener('click', () => {
    const open = sidebar.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
  });
  addEventListener('hashchange', () => showPage(location.hash.slice(1) || 'home', false));
  showPage(location.hash.slice(1) || 'home', false);

  const patientSearch = document.querySelector('#patientSearch');
  const wardFilter = document.querySelector('#wardFilter');
  function filterPatients() {
    const query = patientSearch.value.trim().toLowerCase();
    const ward = wardFilter.value;
    let visible = 0;
    document.querySelectorAll('#patientRows tr').forEach((row) => {
      const match = (!query || row.textContent.toLowerCase().includes(query)) && (ward === 'all' || row.dataset.ward === ward);
      row.hidden = !match;
      if (match) visible += 1;
    });
    document.querySelector('#patientEmpty').hidden = visible > 0;
  }
  patientSearch?.addEventListener('input', filterPatients);
  wardFilter?.addEventListener('change', filterPatients);

  const patientDialog = document.querySelector('#patientDialog');
  document.querySelectorAll('.patient-detail').forEach((button) => button.addEventListener('click', () => {
    document.querySelector('#dialogPatient').textContent = button.textContent;
    patientDialog.showModal();
  }));

  const addPatientDialog = document.querySelector('#addPatientDialog');
  document.querySelector('#addPatient')?.addEventListener('click', () => addPatientDialog.showModal());
  document.querySelector('[data-close="addPatientDialog"]')?.addEventListener('click', () => addPatientDialog.close());
  document.querySelector('#addPatientForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const row = document.createElement('tr');
    row.dataset.ward = data.get('ward');
    row.innerHTML = `<td><button class="text-button patient-detail">${data.get('id')}</button></td><td>${data.get('ward')}</td><td>${data.get('therapist')}</td><td>9/10</td><td>未評価</td><td>調整中</td><td><span class="status blue">新規</span></td>`;
    row.querySelector('.patient-detail').addEventListener('click', () => {
      document.querySelector('#dialogPatient').textContent = data.get('id');
      patientDialog.showModal();
    });
    document.querySelector('#patientRows').append(row);
    addPatientDialog.close();
    filterPatients();
    showToast(`${data.get('id')} を架空患者として登録しました。`);
  });

  document.querySelectorAll('.record-item').forEach((item) => item.addEventListener('click', () => {
    document.querySelectorAll('.record-item').forEach((candidate) => candidate.classList.toggle('active', candidate === item));
    document.querySelector('#recordPatient').textContent = item.dataset.record;
  }));
  document.querySelector('#soapForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const active = document.querySelector('.record-item.active');
    active?.querySelector('span')?.replaceChildren('保存済み');
    showToast(`${document.querySelector('#recordPatient').textContent} のSOAP記録を保存しました。`);
  });

  const fimInputs = [...document.querySelectorAll('.fim-input')];
  function updateFim() {
    let motor = 27;
    let cognitive = 6;
    fimInputs.forEach((input) => {
      input.closest('label').querySelector('output').value = input.value;
      if (input.classList.contains('motor')) motor += Number(input.value);
      else cognitive += Number(input.value);
    });
    const total = motor + cognitive;
    document.querySelector('#motorScore').textContent = motor;
    document.querySelector('#cognitiveScore').textContent = cognitive;
    document.querySelector('#fimTotal').textContent = total;
    document.querySelector('#fimDelta').textContent = `${total - 56 >= 0 ? '+' : ''}${total - 56}`;
    document.querySelector('#motorBar').style.width = `${Math.round(motor / 91 * 100)}%`;
    document.querySelector('#cognitiveBar').style.width = `${Math.round(cognitive / 35 * 100)}%`;
  }
  fimInputs.forEach((input) => input.addEventListener('input', updateFim));
  updateFim();
  document.querySelector('#fimForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    showToast(`FIM評価 ${document.querySelector('#fimTotal').textContent}点を保存しました。`);
  });

  let clockedIn = false;
  document.querySelector('#clockButton')?.addEventListener('click', (event) => {
    clockedIn = !clockedIn;
    event.currentTarget.textContent = clockedIn ? '退勤を記録' : '出勤を記録';
    document.querySelector('#presentCount').textContent = clockedIn ? '19' : '18';
    showToast(clockedIn ? '出勤 10:42 を記録しました。' : '退勤 10:43 を記録しました。');
  });

  document.querySelector('#billingCheck')?.addEventListener('click', () => {
    document.querySelectorAll('.check-state').forEach((state) => {
      state.textContent = '差分確認済';
      state.className = 'status blue check-state';
    });
    document.querySelector('#billingMismatch').textContent = '0';
    document.querySelector('#billingPending').textContent = '2';
    showToast('実施記録と請求データを照合し、差分2件を確認対象にしました。');
  });

  const ocrButton = document.querySelector('#ocrButton');
  const ocrProgress = document.querySelector('#ocrProgress');
  const ocrApply = document.querySelector('#ocrApply');
  ocrButton?.addEventListener('click', () => {
    ocrButton.disabled = true;
    ocrProgress.hidden = false;
    document.querySelector('#ocrStatus').textContent = '画像の傾きと帳票形式を確認しています…';
    setTimeout(() => { document.querySelector('#ocrStatus').textContent = '評価項目と数値を読み取っています…'; }, 550);
    setTimeout(() => {
      document.querySelector('#ocrPatient').value = 'SR-24042';
      document.querySelector('#ocrDate').value = '2026-09-10';
      document.querySelector('#ocrType').value = 'FIM評価表';
      document.querySelector('#ocrScore').value = '91';
      document.querySelector('#ocrConfidence').textContent = '信頼度 94%';
      document.querySelector('#ocrStatus').textContent = '読み取りが完了しました。原本と照合してください。';
      ocrApply.disabled = false;
      showToast('AI OCRの候補値を抽出しました。確認後に反映できます。');
    }, 1200);
  });
  ocrApply?.addEventListener('click', () => {
    ocrApply.disabled = true;
    ocrApply.textContent = '反映済み';
    showToast('確認済みの評価値を架空患者データへ反映しました。');
  });

  function updateApprovalCount() {
    const count = document.querySelectorAll('#approvalList .approval-card').length;
    document.querySelector('#approvalCount').textContent = `承認待ち ${count}件`;
  }
  document.querySelectorAll('.approve,.reject').forEach((button) => button.addEventListener('click', () => {
    const card = button.closest('.approval-card');
    const action = button.classList.contains('approve') ? '承認' : '差し戻し';
    card.remove();
    updateApprovalCount();
    showToast(`${card.querySelector('h2').textContent}を${action}しました。`);
  }));

  document.querySelector('#auditFilter')?.addEventListener('change', (event) => {
    document.querySelectorAll('#auditRows tr').forEach((row) => { row.hidden = event.target.value !== 'all' && row.dataset.kind !== event.target.value; });
  });
  document.querySelector('#auditExport')?.addEventListener('click', () => showToast('監査ログCSVの出力を確認しました（デモのためファイルは保存しません）。'));
})();
