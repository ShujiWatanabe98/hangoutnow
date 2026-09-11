const state = { token: null, patients: [], selectedPatientId: localStorage.getItem('emr-selected-patient') || 'P0001001', route: 'dashboard', recordId: null, latestOrderId: null, activeFhir: null };
const app = document.querySelector('#app');
const strip = document.querySelector('#patient-strip');
const toast = document.querySelector('#toast');
const publicBasePath = '/rehainfo/emr';

function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]); }
function statusClass(status) { return ['有効', 'signed', 'completed', 'connected', 'dispensed', 'validated'].includes(status) ? 'status-ok' : ['確認待ち', 'requested', 'submitted', 'draft'].includes(status) ? 'status-warn' : 'status-info'; }
function ageOf(birthDate) { const today = new Date('2026-09-11T00:00:00+09:00'); const birth = new Date(`${birthDate}T00:00:00+09:00`); let age = today.getFullYear() - birth.getFullYear(); if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age -= 1; return age; }
function showToast(message, error = false) { toast.textContent = message; toast.style.background = error ? '#9f303b' : ''; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2800); }

async function api(path, options = {}) {
  if (!state.token) {
    const form = new URLSearchParams({ grant_type: 'client_credentials', client_id: 'demo-web', scope: 'system/*.read system/*.write' });
    const response = await fetch(`${publicBasePath}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
    state.token = (await response.json()).access_token;
  }
  const response = await fetch(`${publicBasePath}${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.token}`, 'X-Practitioner-ID': 'PRACT-001', 'X-Request-ID': `WEB-${Date.now()}`, ...(options.headers || {}) } });
  if (response.status === 401) { state.token = null; if (!options._retried) return api(path, { ...options, _retried: true }); }
  const body = await response.json();
  if (!response.ok) throw new Error(body.detail || body.issue?.[0]?.diagnostics || 'APIエラー');
  return body;
}

function selectedPatient() { return state.patients.find((p) => p.id === state.selectedPatientId) || state.patients[0]; }
function heading(title, description, actions = '') { return `<div class="page-heading"><div><h1>${title}</h1><p>${description}</p></div><div class="heading-actions">${actions}</div></div>`; }
function patientStrip(patient) {
  if (!patient || ['dashboard', 'patients'].includes(state.route)) { strip.classList.add('hidden'); strip.innerHTML = ''; return; }
  strip.classList.remove('hidden');
  strip.innerHTML = `<div class="patient-avatar">${escapeHtml(patient.name.split(' ')[0][0])}</div><div class="patient-ident"><strong>${escapeHtml(patient.name)}</strong><small>${patient.id} ・ ${escapeHtml(patient.kana)}</small></div><div class="patient-facts"><span>${ageOf(patient.birthDate)}歳 / ${patient.gender === 'female' ? '女性' : '男性'}</span><span>${escapeHtml(patient.department)} / 保険 <b>${escapeHtml(patient.insurance.status)}</b></span><span>${patient.allergies.length ? `アレルギー：${escapeHtml(patient.allergies.join('・'))}` : 'アレルギーなし'}</span></div>`;
}
function setActiveNav() { document.querySelectorAll('#main-nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === state.route)); }
function bindAction(selector, handler) { document.querySelectorAll(selector).forEach((el) => el.addEventListener('click', handler)); }

async function ensurePatients() { if (!state.patients.length) state.patients = (await api('/api/v1/patients')).items; }

async function renderDashboard() {
  const data = await api('/api/v1/dashboard'); state.patients = data.patients;
  app.innerHTML = `${heading('本日の診療', '2026年9月11日（金）・外来業務の進行状況', '<button class="secondary" data-go="patients">患者を検索</button><button class="primary" data-go="encounter">診療を開始</button>')}
  <section class="metrics">
    <article class="card metric"><small>診察待ち</small><strong>${data.counts.waiting}</strong><span>♙</span></article>
    <article class="card metric"><small>未確定カルテ</small><strong>${data.counts.unsigned}</strong><span>▤</span></article>
    <article class="card metric"><small>検査結果待ち</small><strong>${data.counts.pendingLabs}</strong><span>⌁</span></article>
    <article class="card metric"><small>医療DXエラー</small><strong>${data.counts.dxErrors}</strong><span>⇄</span></article>
  </section>
  <section class="dashboard-grid">
    <article class="card"><div class="card-header"><h2>本日の患者</h2><button class="ghost button-small" data-go="patients">一覧を見る</button></div><div class="table-wrap"><table><thead><tr><th>患者</th><th>診療科</th><th>予約</th><th>状態</th><th></th></tr></thead><tbody>${data.patients.map((p) => `<tr class="clickable-row" data-patient="${p.id}"><td class="name-cell"><strong>${escapeHtml(p.name)}</strong><small>${p.id}</small></td><td>${escapeHtml(p.department)}</td><td>${escapeHtml(p.nextAppointment)}</td><td><span class="status ${statusClass(p.status)}">${escapeHtml(p.status)}</span></td><td>›</td></tr>`).join('')}</tbody></table></div></article>
    <div class="stack"><article class="card"><div class="card-header"><h2>クイック操作</h2></div><div class="card-body quick-list">
      <button data-go="encounter"><span><strong>新規カルテ</strong><small>SOAP記録を作成</small></span><b>＋</b></button>
      <button data-go="prescriptions"><span><strong>処方オーダ</strong><small>電子処方箋へ連携</small></span><b>℞</b></button>
      <button data-go="labs"><span><strong>検査オーダ</strong><small>検査部門へ送信</small></span><b>⌁</b></button>
      <button data-go="fhir"><span><strong>FHIR文書</strong><small>送受信・内容確認</small></span><b>{ }</b></button>
    </div></article><article class="card"><div class="card-header"><h2>連携サービス</h2></div><div class="card-body integration-list">${['オンライン資格確認', '電子処方箋', '電カル情報共有', '部門システム'].map((x) => `<div class="integration-row"><span>${x}</span><span class="status status-ok">模擬正常</span></div>`).join('')}</div></article></div>
  </section>`;
  bindPatientRows();
}

async function renderPatients() {
  await ensurePatients();
  app.innerHTML = `${heading('患者一覧', '患者ID・氏名・カナで検索し、診療対象を選択します。', '<button class="primary" id="new-encounter">選択患者の診療を開始</button>')}
  <div class="toolbar"><div class="search"><label class="sr-only" for="patient-search">患者検索</label><input id="patient-search" placeholder="患者ID、氏名、カナを入力"></div><select id="department-filter" aria-label="診療科"><option value="">すべての診療科</option><option>内科</option><option>整形外科</option><option>循環器内科</option></select><button class="ghost" id="clear-search">クリア</button></div>
  <article class="card"><div class="table-wrap"><table><thead><tr><th>患者ID</th><th>患者氏名</th><th>生年月日 / 年齢</th><th>診療科</th><th>資格</th><th>最終受診</th><th>アラート</th><th>状態</th></tr></thead><tbody id="patient-body"></tbody></table></div></article>`;
  const tbody = document.querySelector('#patient-body');
  const draw = () => {
    const q = document.querySelector('#patient-search').value.toLowerCase(); const dept = document.querySelector('#department-filter').value;
    const items = state.patients.filter((p) => (!q || [p.id,p.name,p.kana].some((v) => v.toLowerCase().includes(q))) && (!dept || p.department === dept));
    tbody.innerHTML = items.map((p) => `<tr class="clickable-row ${p.id === state.selectedPatientId ? 'selected' : ''}" data-patient="${p.id}"><td>${p.id}</td><td class="name-cell"><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.kana)}</small></td><td>${p.birthDate}<br><small>${ageOf(p.birthDate)}歳</small></td><td>${escapeHtml(p.department)}</td><td><span class="status ${statusClass(p.insurance.status)}">${escapeHtml(p.insurance.status)}</span></td><td>${p.lastVisit}</td><td>${[...p.allergies,...p.alerts].map((a) => `<span class="tag tag-danger">${escapeHtml(a)}</span>`).join('') || '—'}</td><td><span class="status ${statusClass(p.status)}">${escapeHtml(p.status)}</span></td></tr>`).join('');
    bindPatientRows();
  };
  document.querySelector('#patient-search').addEventListener('input', draw); document.querySelector('#department-filter').addEventListener('change', draw);
  document.querySelector('#clear-search').addEventListener('click', () => { document.querySelector('#patient-search').value = ''; document.querySelector('#department-filter').value = ''; draw(); });
  document.querySelector('#new-encounter').addEventListener('click', () => go('encounter')); draw();
}

function bindPatientRows() { bindAction('[data-patient]', (event) => { state.selectedPatientId = event.currentTarget.dataset.patient; localStorage.setItem('emr-selected-patient', state.selectedPatientId); go('records'); }); }

async function renderRecords() {
  await ensurePatients(); const patient = selectedPatient(); const data = await api(`/api/v1/patients/${patient.id}/records`);
  app.innerHTML = `${heading('カルテ一覧', `${escapeHtml(patient.name)}さんの診療記録`, '<button class="primary" data-go="encounter">新規カルテ</button>')}
  <div class="toolbar"><div class="search"><input id="record-search" aria-label="カルテ検索" placeholder="SOAP本文・診療科・作成者を検索"></div><select aria-label="期間"><option>全期間</option><option>過去3か月</option><option>過去1年</option></select></div>
  <div class="record-list">${data.items.length ? data.items.map((r) => `<article class="card record-card"><div class="record-date"><strong>${r.occurredAt.slice(0,10)}</strong><small>${r.occurredAt.slice(11,16)} / ${escapeHtml(r.department)}</small></div><div><h3>${escapeHtml(r.soap.assessment || '診療記録')}</h3><p><b>S：</b>${escapeHtml(r.soap.subjective)}<br><b>P：</b>${escapeHtml(r.soap.plan)}</p></div><div><span class="status ${statusClass(r.status)}">${r.status === 'signed' ? '確定済' : '下書き'}</span><br><small>${escapeHtml(r.author)}</small></div></article>`).join('') : '<div class="card empty">診療記録はありません。</div>'}</div>`;
}

async function renderEncounter() {
  await ensurePatients(); const patient = selectedPatient(); const summary = await api(`/api/v1/patients/${patient.id}/summary`);
  const conditionText = summary.conditions.map((item) => escapeHtml(item.display)).join('<br>') || '登録なし';
  const rehab = summary.rehabilitationPlans.find((item) => item.status === 'active');
  const rehabText = rehab ? `${escapeHtml(rehab.rehabilitationClass)} / ${escapeHtml(rehab.entryExit)} / ${escapeHtml(rehab.wardName)}<br><small>${escapeHtml(rehab.professions.join('・'))} ${rehab.plannedUnitsPerDay}単位/日　目標：${escapeHtml(rehab.goal)}</small>` : '依頼なし';
  app.innerHTML = `${heading('診療記録', 'SOAP入力、オーダ、文書・サマリーを患者コンテキスト内で管理します。', '<button class="ghost" id="save-draft">下書き保存</button><button class="primary" id="sign-record">カルテを確定</button>')}
  <div class="tabs"><button class="active" data-tab="soap">SOAP</button><button data-tab="injection">注射</button><button data-tab="imaging">画像・文書</button><button data-tab="summary">サマリー</button></div>
  <section class="encounter-grid"><article class="card"><div id="encounter-panel" class="card-body"></div></article>
  <aside class="stack"><article class="card"><div class="card-header"><h3>患者サマリー</h3></div><div class="card-body summary-list"><div class="summary-item"><small>アレルギー・注意事項</small><p>${patient.allergies.length ? patient.allergies.map((a) => `<span class="tag tag-danger">${escapeHtml(a)}</span>`).join('') : 'アレルギーなし'} ${patient.alerts.map((a) => `<span class="tag tag-danger">${escapeHtml(a)}</span>`).join('')}</p></div><div class="summary-item"><small>現病・プロブレム</small><p>${conditionText}</p></div><div class="summary-item"><small>リハビリテーション依頼</small><p>${rehabText}</p></div><div class="summary-item"><small>継続処方</small><p>${summary.medications.map((m) => escapeHtml(m.medicationDisplay)).join('<br>') || 'なし'}</p></div><div class="summary-item"><small>直近検査</small><p>${summary.labs.map((l) => `${escapeHtml(l.name)}：${escapeHtml(l.result || '結果待ち')}`).join('<br>') || 'なし'}</p></div></div></article><div class="notice-box warning-box"><strong>確定前確認</strong><p>確定後の直接編集は不可とし、訂正履歴を追加する設計です。モックでは新規作成と確定を再現します。</p></div></aside></section>`;
  drawEncounterTab('soap', summary);
  bindAction('[data-tab]', (event) => { document.querySelectorAll('[data-tab]').forEach((b) => b.classList.remove('active')); event.currentTarget.classList.add('active'); drawEncounterTab(event.currentTarget.dataset.tab, summary); });
  document.querySelector('#save-draft').addEventListener('click', saveSoap);
  document.querySelector('#sign-record').addEventListener('click', async () => { if (!state.recordId) await saveSoap(); if (!state.recordId) return; try { await api(`/api/v1/records/${state.recordId}/sign`, { method: 'PUT', body: '{}' }); showToast('診療記録を確定しました'); } catch (error) { showToast(error.message, true); } });
}

function drawEncounterTab(tab, summary = {}) {
  const panel = document.querySelector('#encounter-panel');
  const latestRecord = [...(summary.records || [])].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
  const soap = latestRecord?.soap || { subjective: '', objective: '', assessment: '', plan: '' };
  if (tab === 'soap') panel.innerHTML = `<div class="soap-grid"><label class="soap-field"><b><span>S</span>Subjective / 主観</b><textarea id="soap-s">${escapeHtml(soap.subjective)}</textarea></label><label class="soap-field"><b><span>O</span>Objective / 客観</b><textarea id="soap-o">${escapeHtml(soap.objective)}</textarea></label><label class="soap-field"><b><span>A</span>Assessment / 評価</b><textarea id="soap-a">${escapeHtml(soap.assessment)}</textarea></label><label class="soap-field"><b><span>P</span>Plan / 計画</b><textarea id="soap-p">${escapeHtml(soap.plan)}</textarea></label></div>`;
  if (tab === 'injection') { panel.innerHTML = `<h3>注射オーダ</h3><div class="field-grid"><label>注射薬名<input id="inj-med" value="生理食塩液 100mL（架空）"></label><label>投与量<input id="inj-dose" value="100mL"></label><label>投与経路<select id="inj-route"><option>静脈内点滴</option><option>皮下注射</option><option>筋肉内注射</option></select></label><label>開始予定<input id="inj-time" type="datetime-local" value="2026-09-11T14:00"></label></div><div class="form-actions"><button class="primary" id="submit-injection">注射オーダ登録</button></div>`; document.querySelector('#submit-injection').addEventListener('click', submitInjection); }
  if (tab === 'imaging') { panel.innerHTML = `<h3>画像・文書管理</h3><div class="field-grid"><label>種別<select id="doc-type"><option>画像オーダ</option><option>紹介状</option><option>同意書</option><option>検査報告書</option></select></label><label>名称<input id="doc-title" value="胸部X線 2方向"></label></div><label>臨床情報<textarea id="doc-note">咳嗽の精査。肺野の異常陰影の有無を確認。</textarea></label><div class="form-actions"><button class="primary" id="submit-document">登録する</button></div>`; document.querySelector('#submit-document').addEventListener('click', submitDocument); }
  if (tab === 'summary') { const conditions = (summary.conditions || []).map((item) => item.display).join('、'); panel.innerHTML = `<h3>退院時サマリー・診療情報提供書</h3><div class="field-grid"><label>文書種別<select id="summary-type"><option>診療情報提供書</option><option>退院時サマリー</option></select></label><label>紹介先・宛先<input id="summary-to" value="地域医療センター 御中"></label></div><label>傷病名<textarea id="summary-condition">${escapeHtml(conditions)}</textarea></label><label>経過・治療内容<textarea id="summary-course">${escapeHtml(`${soap.assessment} ${soap.plan}`.trim())}</textarea></label><div class="form-actions"><button class="primary" id="submit-summary">FHIR文書として作成</button></div>`; document.querySelector('#submit-summary').addEventListener('click', submitSummary); }
}

async function saveSoap() { const fields = ['s','o','a','p'].map((x) => document.querySelector(`#soap-${x}`)); if (fields.some((x) => !x)) return showToast('SOAPタブで保存してください', true); try { const result = await api('/api/v1/records', { method: 'POST', body: JSON.stringify({ patientId: state.selectedPatientId, department: selectedPatient().department, author: '佐藤 医師', soap: { subjective: fields[0].value, objective: fields[1].value, assessment: fields[2].value, plan: fields[3].value } }) }); state.recordId = result.id; showToast(`下書きを保存しました：${result.id}`); } catch (error) { showToast(error.message, true); } }
async function submitInjection() { try { await api('/api/v1/injection-orders', { method: 'POST', body: JSON.stringify({ patientId: state.selectedPatientId, medicationDisplay: document.querySelector('#inj-med').value, dose: document.querySelector('#inj-dose').value, route: document.querySelector('#inj-route').value, scheduledAt: document.querySelector('#inj-time').value }) }); showToast('注射オーダを登録しました'); } catch (e) { showToast(e.message, true); } }
async function submitDocument() { const type = document.querySelector('#doc-type').value; try { const path = type === '画像オーダ' ? '/api/v1/imaging-orders' : '/api/v1/documents'; await api(path, { method: 'POST', body: JSON.stringify({ patientId: state.selectedPatientId, type, title: document.querySelector('#doc-title').value, note: document.querySelector('#doc-note').value }) }); showToast(`${type}を登録しました`); } catch (e) { showToast(e.message, true); } }
async function submitSummary() { try { await api('/api/v1/summaries', { method: 'POST', body: JSON.stringify({ patientId: state.selectedPatientId, type: document.querySelector('#summary-type').value, recipient: document.querySelector('#summary-to').value, condition: document.querySelector('#summary-condition').value, course: document.querySelector('#summary-course').value, format: 'FHIR R4 document mock' }) }); showToast('サマリー文書を作成しました'); } catch (e) { showToast(e.message, true); } }

async function renderPrescriptions() {
  await ensurePatients(); const orders = (await api(`/api/v1/medication-requests?patientId=${state.selectedPatientId}`)).items;
  app.innerHTML = `${heading('処方オーダ', '処方内容を登録し、JP Core MedicationRequest形式を確認できます。', '<button class="secondary" data-go="erx">電子処方箋連携へ</button>')}
  <section class="dashboard-grid"><article class="card"><div class="card-header"><h2>新規処方</h2><span class="tag">院外処方</span></div><div class="card-body"><div class="field-grid"><label>医薬品コード（YJ）<input id="med-code" value="103831601"></label><label>医薬品名<input id="med-name" value="カルボシステイン錠250mg（架空処方）"></label><label>用法<input id="med-dosage" value="1回2錠 1日3回 毎食後"></label><label>投与経路<select id="med-route"><option>経口</option><option>外用</option></select></label></div><div class="field-grid three"><label>日数<input id="med-days" type="number" min="1" value="7"></label><label>総量<input id="med-quantity" type="number" min="1" value="42"></label><label>単位<select id="med-unit"><option>錠</option><option>包</option><option>mL</option></select></label></div><div class="notice-box warning-box"><strong>重複投薬・併用禁忌チェック（模擬）</strong><p>アレルギー「${escapeHtml(selectedPatient().allergies.join('・') || 'なし')}」。重大な警告は検出されていません。</p></div><div class="form-actions"><button class="ghost" id="preview-fhir">FHIRプレビュー</button><button class="primary" id="submit-medication">処方を登録</button></div></div></article>
  <aside class="card"><div class="card-header"><h2>今回・継続処方</h2></div><div class="card-body summary-list">${orders.map((o) => `<div class="summary-item"><small>${o.authoredOn.slice(0,10)} / ${o.id}</small><p><b>${escapeHtml(o.medicationDisplay)}</b><br>${escapeHtml(o.dosageText)}・${o.days}日<br><span class="status ${statusClass(o.erxStatus)}">${escapeHtml(o.erxStatus)}</span></p></div>`).join('') || '<div class="empty">処方はありません。</div>'}</div></aside></section>`;
  document.querySelector('#submit-medication').addEventListener('click', submitMedication); document.querySelector('#preview-fhir').addEventListener('click', () => showToast('登録後にFHIR文書画面で確認できます'));
}
async function submitMedication() { try { const result = await api('/api/v1/medication-requests', { method: 'POST', body: JSON.stringify({ patientId: state.selectedPatientId, recordId: state.recordId, medicationCode: document.querySelector('#med-code').value, medicationDisplay: document.querySelector('#med-name').value, dosageText: document.querySelector('#med-dosage').value, route: document.querySelector('#med-route').value, days: Number(document.querySelector('#med-days').value), quantity: Number(document.querySelector('#med-quantity').value), unit: document.querySelector('#med-unit').value }) }); state.latestOrderId = result.order.id; showToast(`処方を登録しました：${result.order.id}`); await renderPrescriptions(); } catch (e) { showToast(e.message, true); } }

async function renderLabs() {
  await ensurePatients(); const orders = (await api(`/api/v1/lab-orders?patientId=${state.selectedPatientId}`)).items;
  app.innerHTML = `${heading('検査オーダ', '検体検査・生理検査の依頼と結果取り込みを模擬します。')}
  <section class="dashboard-grid"><article class="card"><div class="card-header"><h2>新規検査依頼</h2></div><div class="card-body"><div class="field-grid"><label>検査セット<select id="lab-set"><option value="CBC|末梢血液一般">末梢血液一般</option><option value="GLU|血糖">血糖</option><option value="CRE|クレアチニン">クレアチニン</option><option value="CRP|CRP定量">CRP定量</option></select></label><label>優先度<select id="lab-priority"><option value="routine">通常</option><option value="urgent">至急</option></select></label><label>検体<select id="lab-specimen"><option>静脈血</option><option>尿</option></select></label><label>採取予定<input type="datetime-local" value="2026-09-11T14:30"></label></div><label>臨床情報<textarea id="lab-note">発熱なし。炎症反応と血算を確認。</textarea></label><div class="form-actions"><button class="primary" id="submit-lab">検査部門へ送信</button></div></div></article>
  <aside class="card"><div class="card-header"><h2>オーダ状況</h2></div><div class="card-body summary-list">${orders.map((o) => `<div class="summary-item"><small>${o.requestedAt.slice(0,16).replace('T',' ')} / ${o.id}</small><p><b>${escapeHtml(o.name)}</b>（${escapeHtml(o.code)}）<br>${escapeHtml(o.specimen || '未指定')} <span class="status ${statusClass(o.status)}">${escapeHtml(o.status)}</span></p>${o.status !== 'completed' ? `<button class="secondary button-small" data-result="${o.id}">模擬結果を取り込む</button>` : `<p>結果：${escapeHtml(o.result)}</p>`}</div>`).join('') || '<div class="empty">検査オーダはありません。</div>'}</div></aside></section>`;
  document.querySelector('#submit-lab').addEventListener('click', submitLab); bindAction('[data-result]', async (event) => { try { await api(`/api/v1/lab-orders/${event.currentTarget.dataset.result}/result`, { method: 'POST', body: JSON.stringify({ result: '基準範囲内（模擬結果）' }) }); showToast('検査結果をObservationとして取り込みました'); await renderLabs(); } catch (e) { showToast(e.message, true); } });
}
async function submitLab() { try { const [code,name] = document.querySelector('#lab-set').value.split('|'); await api('/api/v1/lab-orders', { method: 'POST', body: JSON.stringify({ patientId: state.selectedPatientId, recordId: state.recordId, code, name, priority: document.querySelector('#lab-priority').value, specimen: document.querySelector('#lab-specimen').value, note: document.querySelector('#lab-note').value }) }); showToast('検査オーダを送信しました'); await renderLabs(); } catch (e) { showToast(e.message, true); } }

async function renderErx() {
  await ensurePatients(); const [rxData, ordersData] = await Promise.all([api('/api/v1/dx/e-prescriptions'), api(`/api/v1/medication-requests?patientId=${state.selectedPatientId}`)]); const patientOrders = ordersData.items; const patientRx = rxData.items.filter((x) => x.patientId === state.selectedPatientId); const latest = patientRx.at(-1);
  app.innerHTML = `${heading('電子処方箋連携', '登録・処方内容（控え）取得・調剤結果取得をローカルで模擬します。', '<button class="secondary" id="eligibility-check">オンライン資格確認</button>')}
  <section class="dashboard-grid"><div class="stack"><article class="card"><div class="card-header"><h2>送信対象</h2><span class="status status-ok">HPKI署名：模擬準備完了</span></div><div class="card-body">${patientOrders.map((o) => `<label class="integration-row"><span><input type="checkbox" class="rx-order" value="${o.id}" ${o.erxStatus === 'draft' ? 'checked' : ''}> <b>${escapeHtml(o.medicationDisplay)}</b><br><small>${escapeHtml(o.dosageText)} / ${o.quantity}${escapeHtml(o.unit)}</small></span><span class="status ${statusClass(o.erxStatus)}">${escapeHtml(o.erxStatus)}</span></label>`).join('') || '<div class="empty">処方画面で処方を登録してください。</div>'}<div class="form-actions"><button class="primary" id="send-erx">電子処方箋を送信</button></div></div></article>
  <article class="card"><div class="card-header"><h2>連携履歴</h2></div><div class="table-wrap"><table><thead><tr><th>処方箋ID</th><th>送信日時</th><th>控えID</th><th>状態</th><th>操作</th></tr></thead><tbody>${patientRx.map((rx) => `<tr><td>${rx.id}</td><td>${rx.sentAt.slice(0,16).replace('T',' ')}</td><td>${rx.receiptId}</td><td><span class="status ${statusClass(rx.status)}">${rx.status}</span></td><td><button class="ghost button-small" data-receipt="${rx.id}">控え取得</button> ${rx.status !== 'dispensed' ? `<button class="secondary button-small" data-dispense="${rx.id}">調剤結果取得</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">送信履歴はありません。</td></tr>'}</tbody></table></div></article></div>
  <aside class="card"><div class="card-header"><h2>処理ステータス</h2></div><div class="card-body timeline"><div class="timeline-step done"><strong>資格確認</strong><p>${escapeHtml(selectedPatient().insurance.status)} / ${selectedPatient().insurance.verifiedAt ? '確認済み' : '未確認'}</p></div><div class="timeline-step ${latest ? 'done' : ''}"><strong>処方オーダ確定</strong><p>${patientOrders.length}件のMedicationRequest</p></div><div class="timeline-step ${latest ? 'done' : ''}"><strong>電子署名・送信</strong><p>${latest ? latest.sentAt : '未送信'}</p></div><div class="timeline-step ${latest ? 'done' : ''}"><strong>処方内容（控え）</strong><p>${latest?.receiptId || '未取得'}</p></div><div class="timeline-step ${latest?.status === 'dispensed' ? 'done' : ''}"><strong>調剤結果</strong><p>${latest?.status === 'dispensed' ? '受信済み' : '結果待ち'}</p></div></div></aside></section>`;
  document.querySelector('#eligibility-check').addEventListener('click', async () => { try { const [, medications] = await Promise.all([api('/api/v1/dx/eligibility-verifications', { method: 'POST', body: JSON.stringify({ patientId: state.selectedPatientId, consent: true }) }), api(`/api/v1/dx/patients/${state.selectedPatientId}/medication-history`)]); showToast(`資格情報と薬剤情報${medications.items.length}件を取得しました（模擬）`); await renderErx(); } catch (e) { showToast(e.message, true); } });
  document.querySelector('#send-erx').addEventListener('click', async () => { const ids = [...document.querySelectorAll('.rx-order:checked')].map((x) => x.value); try { await api('/api/v1/dx/e-prescriptions', { method: 'POST', body: JSON.stringify({ patientId: state.selectedPatientId, medicationRequestIds: ids }) }); showToast('電子処方箋管理サービスへ送信しました（模擬）'); await renderErx(); } catch (e) { showToast(e.message, true); } });
  bindAction('[data-receipt]', async (e) => { try { const receipt = await api(`/api/v1/dx/e-prescriptions/${e.currentTarget.dataset.receipt}/receipt`); showToast(`控え取得：確認コード ${receipt.confirmationCode}`); } catch (x) { showToast(x.message, true); } });
  bindAction('[data-dispense]', async (e) => { try { await api(`/api/v1/dx/e-prescriptions/${e.currentTarget.dataset.dispense}/dispensing-result`, { method: 'POST', body: '{}' }); showToast('調剤結果を取り込みました'); await renderErx(); } catch (x) { showToast(x.message, true); } });
}

async function renderFhir() {
  await ensurePatients(); const [bundle, received] = await Promise.all([api(`/api/v1/dx/patients/${state.selectedPatientId}/fhir-bundle`), api('/api/v1/dx/fhir-documents')]); state.activeFhir = bundle;
  const resources = bundle.entry.map((e) => e.resource.resourceType); const counts = Object.entries(resources.reduce((a,x) => ({...a,[x]:(a[x]||0)+1}),{}));
  app.innerHTML = `${heading('FHIR文書閲覧', 'FHIR R4 / JP Core・JP-CLINSを参照したリソース構造を確認します。', '<button class="secondary" id="import-fhir">他院文書を模擬受信</button><button class="secondary" id="send-fhir">FHIR文書を模擬送信</button><button class="primary" id="export-fhir">患者Bundleを更新</button>')}
  <section class="split-view"><article class="card"><div class="card-header"><h2>文書・リソース</h2><span class="tag">FHIR 4.0.1</span></div><div class="card-body document-list"><button class="document-button active" data-fhir="bundle"><strong>患者サマリーBundle</strong><small>${bundle.id}</small></button>${counts.map(([type,count]) => `<button class="document-button" data-resource="${type}"><strong>${type}</strong><small>${count} resource(s)</small></button>`).join('')}${received.items.map((x,i) => `<button class="document-button" data-received="${i}"><strong>受信：${escapeHtml(x.source)}</strong><small>${x.receivedAt}</small></button>`).join('')}</div></article>
  <article class="card"><div class="card-header"><h2>FHIR JSON</h2><span class="status status-ok">構文検証済み</span></div><div class="card-body"><div class="json-toolbar"><small id="fhir-label">${bundle.resourceType} / ${bundle.type}</small><button class="ghost button-small" id="copy-json">JSONをコピー</button></div><pre id="fhir-json"></pre></div></article></section>`;
  drawJson(bundle); bindAction('[data-fhir]', () => drawJson(bundle)); bindAction('[data-resource]', (e) => drawJson({ resourceType: 'Bundle', type: 'collection', entry: bundle.entry.filter((x) => x.resource.resourceType === e.currentTarget.dataset.resource) })); bindAction('[data-received]', (e) => drawJson(received.items[Number(e.currentTarget.dataset.received)].bundle));
  document.querySelector('#copy-json').addEventListener('click', async () => { await navigator.clipboard.writeText(document.querySelector('#fhir-json').textContent); showToast('FHIR JSONをコピーしました'); });
  document.querySelector('#export-fhir').addEventListener('click', async () => { state.activeFhir = await api(`/api/v1/dx/patients/${state.selectedPatientId}/fhir-bundle`); drawJson(state.activeFhir); showToast('最新の患者Bundleを生成しました'); });
  document.querySelector('#send-fhir').addEventListener('click', async () => { try { const sent = await api('/api/v1/dx/fhir-documents/send', { method: 'POST', body: JSON.stringify({ patientId: state.selectedPatientId, documentType: '診療情報提供書' }) }); drawJson(sent.bundle); showToast(`FHIR文書を送信しました（模擬）：${sent.id}`); } catch (e) { showToast(e.message, true); } });
  document.querySelector('#import-fhir').addEventListener('click', async () => { const sample = { resourceType: 'Bundle', id: `received-${Date.now()}`, type: 'document', source: '架空地域病院', timestamp: new Date().toISOString(), entry: [{ resource: { resourceType: 'Composition', id: 'referral-001', status: 'final', type: { text: '診療情報提供書' }, title: '診療情報提供書（架空）', date: new Date().toISOString() } }] }; try { await api('/api/v1/dx/fhir-documents/import', { method: 'POST', body: JSON.stringify(sample) }); showToast('他院FHIR文書を受信・検証しました'); await renderFhir(); } catch (e) { showToast(e.message, true); } });
}
function drawJson(value) { state.activeFhir = value; document.querySelector('#fhir-json').textContent = JSON.stringify(value, null, 2); document.querySelectorAll('.document-button').forEach((b) => b.classList.remove('active')); }

const routes = { dashboard: renderDashboard, patients: renderPatients, records: renderRecords, encounter: renderEncounter, prescriptions: renderPrescriptions, labs: renderLabs, erx: renderErx, fhir: renderFhir };
async function render() {
  state.route = (location.hash.match(/^#\/([^/?]+)/)?.[1] || 'dashboard'); if (!routes[state.route]) state.route = 'dashboard';
  setActiveNav(); app.innerHTML = '<div class="loading">読み込み中…</div>';
  try { await ensurePatients(); patientStrip(selectedPatient()); await routes[state.route](); bindAction('[data-go]', (e) => go(e.currentTarget.dataset.go)); app.focus({ preventScroll: true }); } catch (error) { app.innerHTML = `<div class="card empty"><b>画面を読み込めませんでした。</b><p>${escapeHtml(error.message)}</p><button class="primary" id="retry">再試行</button></div>`; document.querySelector('#retry').addEventListener('click', render); }
}
function go(route) { location.hash = `#/${route}`; }
window.addEventListener('hashchange', render);
document.querySelector('#mobile-menu').addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('open'));
document.querySelectorAll('#main-nav a').forEach((a) => a.addEventListener('click', () => document.querySelector('.sidebar').classList.remove('open')));
document.querySelector('#help-button').addEventListener('click', () => document.querySelector('#about-dialog').showModal());
render();
