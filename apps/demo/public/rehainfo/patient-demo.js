(function () {
  'use strict';

  const STORAGE_KEY = 'smart-rehab-public-patients-v2';
  const today = new Date().toLocaleDateString('sv-SE');
  const patients = [
    { id:'DEMO260901', recId:'RECDEMO2609001', name:'佐藤 和子', kana:'サトウ カズコ', sex:'女性', birth:'1948-04-12', ward:'回復期3階A', diagnosis:'右中大脳動脈領域脳梗塞', impairment:'左片麻痺、左半側空間無視、軽度嚥下障害', onset:'2026-08-18', admission:'2026-08-26', rehabStart:'2026-08-27', discharge:'', plannedDischarge:'2026-11-20', rehabClass:'脳血管（Ⅰ）', history:'自宅で発症し急性期病院へ搬送。保存的治療後、歩行・更衣・食事動作の再獲得を目的に回復期病棟へ転院。', risk:'転倒、誤嚥、左側への衝突', precaution:'食事は嚥下調整食。左側の障害物確認を促す。' },
    { id:'DEMO260902', recId:'RECDEMO2609002', name:'鈴木 正一', kana:'スズキ ショウイチ', sex:'男性', birth:'1951-09-03', ward:'回復期2階B', diagnosis:'右大腿骨頸部骨折', impairment:'右股関節痛、下肢筋力低下、歩行障害', onset:'2026-08-20', admission:'2026-09-02', rehabStart:'2026-09-03', discharge:'', plannedDischarge:'2026-10-30', rehabClass:'運動器（Ⅰ）', history:'右人工骨頭置換術後。屋内歩行の自立を目標に転院。', risk:'再転倒、脱臼', precaution:'右股関節の過度な屈曲・内転・内旋を避ける。' },
    { id:'DEMO260903', recId:'RECDEMO2609003', name:'高橋 幸子', kana:'タカハシ サチコ', sex:'女性', birth:'1955-01-28', ward:'整形外科4階', diagnosis:'左変形性膝関節症', impairment:'左膝関節可動域制限、階段昇降困難', onset:'2026-08-25', admission:'2026-08-25', rehabStart:'2026-08-26', discharge:'2026-09-08', plannedDischarge:'2026-09-08', rehabClass:'運動器（Ⅰ）', history:'左人工膝関節全置換術後。退院後は外来で継続予定。', risk:'術後疼痛、転倒', precaution:'創部の発赤・腫脹と深部静脈血栓症徴候に注意する。' },
    { id:'DEMO260904', recId:'RECDEMO2609004', name:'田中 博', kana:'タナカ ヒロシ', sex:'男性', birth:'1958-06-17', ward:'神経内科5階', diagnosis:'パーキンソン病', impairment:'すくみ足、姿勢反射障害、小声、服薬オン・オフ変動', onset:'2019-05-10', admission:'2026-08-30', rehabStart:'2026-08-31', discharge:'', plannedDischarge:'2026-10-10', rehabClass:'脳血管（Ⅰ）', history:'薬剤調整と集中的リハビリ目的に入院。屋内移動と服薬自己管理の安定を目指す。', risk:'すくみ足による転倒、起立性低血圧', precaution:'服薬時間とオン・オフ状態を確認し、急な方向転換を避ける。' },
    { id:'DEMO260905', recId:'RECDEMO2609005', name:'伊藤 洋子', kana:'イトウ ヨウコ', sex:'女性', birth:'1962-11-09', ward:'回復期2階A', diagnosis:'第1腰椎圧迫骨折', impairment:'体幹痛、起居動作低下、廃用性筋力低下', onset:'2026-08-24', admission:'2026-08-25', rehabStart:'2026-08-26', discharge:'', plannedDischarge:'2026-09-28', rehabClass:'運動器（Ⅰ）', history:'保存療法と体幹装具を開始し、独居生活への復帰に向けて入院継続中。', risk:'再転倒、骨粗鬆症による再骨折', precaution:'離床時は体幹装具を装着し、強い体幹屈曲と重量物運搬を避ける。' },
    { id:'DEMO260906', recId:'RECDEMO2609006', name:'渡辺 清', kana:'ワタナベ キヨシ', sex:'男性', birth:'1966-03-21', ward:'循環器6階', diagnosis:'急性心筋梗塞後', impairment:'運動耐容能低下、胸骨正中切開後の上肢活動制限', onset:'2026-08-28', admission:'2026-08-28', rehabStart:'2026-09-03', discharge:'', plannedDischarge:'2026-09-18', rehabClass:'心大血管（Ⅰ）', history:'冠動脈バイパス術後、復職に向けた心臓リハビリを開始。', risk:'運動時虚血、不整脈、過負荷', precaution:'胸痛・冷汗・血圧低下・不整脈出現時は運動を中止する。' },
    { id:'DEMO260907', recId:'RECDEMO2609007', name:'山本 恵子', kana:'ヤマモト ケイコ', sex:'女性', birth:'1970-08-14', ward:'呼吸器5階', diagnosis:'慢性閉塞性肺疾患急性増悪後', impairment:'労作時呼吸困難、持久力低下、呼吸筋疲労', onset:'2026-08-31', admission:'2026-09-01', rehabStart:'2026-09-02', discharge:'', plannedDischarge:'2026-09-22', rehabClass:'呼吸器（Ⅰ）', history:'酸素療法下で呼吸法、ペーシング、ADL練習を実施中。', risk:'低酸素血症、呼吸困難増悪', precaution:'酸素流量を自己変更しない。SpO2低下または強い息切れ時は休止する。' },
    { id:'DEMO260908', recId:'RECDEMO2609008', name:'中村 隆', kana:'ナカムラ タカシ', sex:'男性', birth:'1974-12-05', ward:'回復期3階B', diagnosis:'外傷性脳損傷', impairment:'左片麻痺、注意障害、遂行機能障害、易怒性', onset:'2026-07-20', admission:'2026-08-15', rehabStart:'2026-08-16', discharge:'', plannedDischarge:'2026-11-30', rehabClass:'脳血管（Ⅰ）', history:'身体機能に加えて高次脳機能・社会復帰支援を目的に転院。', risk:'転倒、離棟、感情コントロール低下', precaution:'刺激量を調整し、予定変更は短く具体的に説明する。' },
    { id:'DEMO260909', recId:'RECDEMO2609009', name:'小林 久美子', kana:'コバヤシ クミコ', sex:'女性', birth:'1979-05-26', ward:'外科4階', diagnosis:'左乳がん術後', impairment:'左肩可動域制限、倦怠感、上肢機能低下', onset:'2026-06-18', admission:'2026-08-27', rehabStart:'2026-08-29', discharge:'2026-09-07', plannedDischarge:'2026-09-07', rehabClass:'がんリハ', history:'術後上肢機能とセルフケアを確認し、退院後は外来で就労支援を継続。', risk:'リンパ浮腫、倦怠感増悪', precaution:'左上肢の皮膚損傷・過負荷に注意し、浮腫や熱感を確認する。' },
    { id:'DEMO260910', recId:'RECDEMO2609010', name:'加藤 一郎', kana:'カトウ イチロウ', sex:'男性', birth:'1983-10-18', ward:'回復期2階B', diagnosis:'右下腿切断後', impairment:'右下腿欠損、断端感覚過敏、義足歩行未獲得', onset:'2026-06-12', admission:'2026-07-25', rehabStart:'2026-07-26', discharge:'', plannedDischarge:'2026-11-15', rehabClass:'運動器（Ⅰ）', history:'断端管理、義足装着、公共交通利用と復職を目標に転院。', risk:'断端皮膚損傷、松葉杖使用時の転倒', precaution:'義足装着前後に断端の発赤・水疱・疼痛を確認する。' }
  ];

  const seedPrescription = {
    id: 'DEMO-RX-20260910-001', patientId: 'DEMO260901', prescriptionDate: '2026/09/10', institution: 'ローカル確認用医療機関', doctor: '確認用 医師', medications: '確認用薬剤（実データではありません） 1錠 1日1回 3日分', notes: '【ローカル確認モード】外部AIへの画像送信は行っていません。', confidence: 1, savedAt: '2026-09-10T09:00:00+09:00'
  };
  let selectedPatientId = '';
  let latestPrescriptionResult = null;
  let imageDataUrls = [];

  function loadState() {
    try {
      const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (!state.dischargeDates) state.dischargeDates = {};
      if (!Array.isArray(state.prescriptions)) state.prescriptions = [seedPrescription];
      return state;
    } catch (_) {
      return { dischargeDates: {}, prescriptions: [seedPrescription] };
    }
  }

  function saveState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function effectiveDischarge(patient, state) { return Object.prototype.hasOwnProperty.call(state.dischargeDates, patient.id) ? state.dischargeDates[patient.id] : patient.discharge; }
  function formatDate(value) { return value ? value.replace(/-/g, '/') : '―'; }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, function (char) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]; }); }
  function modal(id) { return bootstrap.Modal.getOrCreateInstance(document.getElementById(id)); }

  function renderPatients() {
    const state = loadState();
    const query = document.getElementById('patientSearch').value.trim().toLowerCase();
    const includeDischarged = document.getElementById('showDischargedPatients').checked;
    const active = patients.filter(function (patient) { return !effectiveDischarge(patient, state); });
    const visible = patients.filter(function (patient) {
      const discharged = Boolean(effectiveDischarge(patient, state));
      const matches = !query || [patient.id, patient.name, patient.kana].join(' ').toLowerCase().includes(query);
      return matches && (includeDischarged || !discharged);
    });
    document.getElementById('activePatientCount').textContent = String(active.length);
    document.getElementById('dischargedPatientCount').textContent = String(patients.length - active.length);
    document.getElementById('prescriptionCount').textContent = String(state.prescriptions.length);
    document.getElementById('patientEmpty').hidden = visible.length > 0;
    document.getElementById('patientRows').innerHTML = visible.map(function (patient) {
      const dischargeDate = effectiveDischarge(patient, state);
      const status = dischargeDate ? '<span class="patient-status discharged">退院済</span>' : '<span class="patient-status active">入院</span>';
      const dischargeAction = dischargeDate
        ? '<button type="button" class="btn btn-light" disabled>退院済</button>'
        : '<button type="button" class="btn btn-outline-danger" data-patient-action="discharge" data-patient-id="' + patient.id + '"><i class="bi bi-box-arrow-right"></i> 退院</button>';
      return '<tr><td><strong>' + patient.id + '</strong></td><td class="patient-name-cell"><strong>' + patient.name + '</strong><small>' + patient.kana + '</small></td><td>' + patient.sex + '</td><td>' + formatDate(patient.birth) + '</td><td>' + patient.rehabClass + '</td><td>' + formatDate(patient.onset) + '</td><td>' + status + '</td><td>' + patient.ward + '</td><td><div class="patient-actions"><button type="button" class="btn btn-outline-secondary" data-patient-action="detail" data-patient-id="' + patient.id + '">詳細</button><button type="button" class="btn btn-outline-primary" data-patient-action="prescription" data-patient-id="' + patient.id + '"><i class="bi bi-prescription2"></i> AI処方箋</button>' + dischargeAction + '</div></td></tr>';
    }).join('');
  }

  function showPatientDetail(patientId) {
    const patient = patients.find(function (item) { return item.id === patientId; });
    if (!patient) return;
    const state = loadState();
    const fields = [
      ['患者ID', patient.id], ['氏名', patient.name + '（' + patient.kana + '）'], ['性別・生年月日', patient.sex + ' / ' + formatDate(patient.birth)], ['病棟', patient.ward],
      ['主病名', patient.diagnosis], ['障害・症状', patient.impairment], ['入院日', formatDate(patient.admission)], ['リハ開始日', formatDate(patient.rehabStart)],
      ['退院予定日', formatDate(patient.plannedDischarge)], ['退院日', formatDate(effectiveDischarge(patient, state))], ['経過', patient.history, true], ['リスク', patient.risk, true], ['禁忌・注意事項', patient.precaution, true]
    ];
    document.getElementById('patientDetailModalTitle').textContent = patient.name + 'さん';
    document.getElementById('patientDetailContent').innerHTML = fields.map(function (field) { return '<div class="patient-detail-item' + (field[2] ? ' wide' : '') + '"><small>' + escapeHtml(field[0]) + '</small><strong>' + escapeHtml(field[1]) + '</strong></div>'; }).join('');
    modal('patientDetailModal').show();
  }

  function showDischarge(patientId) {
    const patient = patients.find(function (item) { return item.id === patientId; });
    if (!patient) return;
    selectedPatientId = patientId;
    document.getElementById('patientDischargePatientName').textContent = patient.name;
    document.getElementById('patientDischargePatientId').textContent = '患者ID：' + patient.id;
    document.getElementById('patientDischargeAdmissionDate').textContent = formatDate(patient.admission);
    const input = document.getElementById('patientDischargeDate');
    input.min = patient.admission;
    input.value = effectiveDischarge(patient, loadState()) || today;
    document.getElementById('patientDischargeError').hidden = true;
    modal('patientDischargeModal').show();
  }

  function submitDischarge() {
    const patient = patients.find(function (item) { return item.id === selectedPatientId; });
    const input = document.getElementById('patientDischargeDate');
    const error = document.getElementById('patientDischargeError');
    if (!patient || !input.value || input.value < patient.admission) {
      error.textContent = !input.value ? '退院日を入力してください。' : '退院日は入院日以降の日付を入力してください。';
      error.hidden = false;
      return;
    }
    const state = loadState();
    state.dischargeDates[patient.id] = input.value;
    saveState(state);
    modal('patientDischargeModal').hide();
    const notice = document.getElementById('patientDischargeNotice');
    notice.textContent = patient.name + 'さんを' + formatDate(input.value) + '付で退院にしました。';
    notice.hidden = false;
    renderPatients();
  }

  function fillPatientOptions() {
    document.getElementById('prescriptionPatient').innerHTML = patients.map(function (patient) { return '<option value="' + patient.id + '">' + patient.id + '　' + patient.name + '</option>'; }).join('');
  }

  function showPrescription(patientId) {
    selectedPatientId = patientId || selectedPatientId || patients[0].id;
    document.getElementById('prescriptionPatient').value = selectedPatientId;
    document.getElementById('prescriptionDate').value = today;
    document.getElementById('prescriptionImages').value = '';
    document.getElementById('prescriptionPreview').innerHTML = '';
    document.getElementById('prescriptionStatus').hidden = true;
    imageDataUrls = [];
    latestPrescriptionResult = null;
    clearPrescriptionResult();
    renderPrescriptionHistory();
    modal('prescriptionModal').show();
  }

  function clearPrescriptionResult() {
    ['resultPrescriptionDate','resultInstitution','resultDoctor','resultMedications','resultNotes'].forEach(function (id) { document.getElementById(id).value = ''; });
    document.getElementById('prescriptionConfidence').hidden = true;
    document.getElementById('savePrescription').disabled = true;
  }

  function filesToDataUrls(files) {
    return Promise.all(files.map(function (file) { return new Promise(function (resolve, reject) { const reader = new FileReader(); reader.onload = function () { resolve(String(reader.result)); }; reader.onerror = reject; reader.readAsDataURL(file); }); }));
  }

  async function selectPrescriptionImages(event) {
    const files = Array.from(event.target.files || []).slice(0, 4);
    const status = document.getElementById('prescriptionStatus');
    if (files.some(function (file) { return !/^image\/(png|jpeg|webp)$/.test(file.type); }) || files.reduce(function (sum, file) { return sum + file.size; }, 0) > 14 * 1024 * 1024) {
      imageDataUrls = [];
      status.textContent = 'PNG・JPEG・WebPを最大4枚、合計14MB以内で選択してください。'; status.className = 'prescription-status error'; status.hidden = false;
      return;
    }
    imageDataUrls = await filesToDataUrls(files);
    document.getElementById('prescriptionPreview').innerHTML = imageDataUrls.map(function (url) { return '<img src="' + url + '" alt="選択した処方箋画像" />'; }).join('');
    status.hidden = true;
  }

  function medicationText(items) {
    if (!Array.isArray(items)) return '';
    return items.map(function (item) { return [item.name, item.amount, item.unit, item.usage, item.days, item.notes].filter(Boolean).join(' '); }).join('\n');
  }

  function displayPrescriptionResult(result) {
    latestPrescriptionResult = result;
    document.getElementById('resultPrescriptionDate').value = result.prescriptionDate || '';
    document.getElementById('resultInstitution').value = result.medicalInstitution || '';
    document.getElementById('resultDoctor').value = result.doctorName || '';
    document.getElementById('resultMedications').value = medicationText(result.medications);
    document.getElementById('resultNotes').value = [result.notes, ...(result.warnings || [])].filter(Boolean).join('\n');
    const confidence = document.getElementById('prescriptionConfidence');
    if (Number.isFinite(Number(result.confidence))) { confidence.textContent = '確信度 ' + Math.round(Number(result.confidence) * 100) + '%'; confidence.hidden = false; }
    document.getElementById('savePrescription').disabled = false;
  }

  async function analyzePrescription() {
    const status = document.getElementById('prescriptionStatus');
    const button = document.getElementById('analyzePrescription');
    if (!imageDataUrls.length) { status.textContent = '処方箋画像を選択してください。'; status.className = 'prescription-status error'; status.hidden = false; return; }
    button.disabled = true; button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> AI解析中…';
    status.textContent = '画像を安全に送信し、文字と薬剤情報を読み取っています。'; status.className = 'prescription-status'; status.hidden = false;
    try {
      const response = await fetch('/rehainfo/api/prescriptions/analyze', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ patientId:document.getElementById('prescriptionPatient').value, prescriptionDate:document.getElementById('prescriptionDate').value, images:imageDataUrls }) });
      const body = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(body.message || 'AI処方箋の読取に失敗しました。');
      displayPrescriptionResult(body.result);
      status.textContent = '読取が完了しました。内容を確認して保存してください。';
    } catch (error) { status.textContent = error.message || 'AI処方箋の読取に失敗しました。'; status.className = 'prescription-status error'; }
    finally { button.disabled = false; button.innerHTML = '<i class="bi bi-stars"></i> AIで読み取る'; }
  }

  function savePrescription() {
    const state = loadState();
    const record = {
      id: 'RX-' + Date.now(), patientId: document.getElementById('prescriptionPatient').value,
      prescriptionDate: document.getElementById('resultPrescriptionDate').value.trim(), institution: document.getElementById('resultInstitution').value.trim(),
      doctor: document.getElementById('resultDoctor').value.trim(), medications: document.getElementById('resultMedications').value.trim(), notes: document.getElementById('resultNotes').value.trim(),
      confidence: latestPrescriptionResult ? latestPrescriptionResult.confidence : null, savedAt: new Date().toISOString()
    };
    state.prescriptions.unshift(record); saveState(state); selectedPatientId = record.patientId;
    const status = document.getElementById('prescriptionStatus'); status.textContent = '患者のAI処方箋一覧へ保存しました。'; status.className = 'prescription-status'; status.hidden = false;
    renderPrescriptionHistory(); renderPatients();
  }

  function renderPrescriptionHistory() {
    const patientId = document.getElementById('prescriptionPatient').value || selectedPatientId;
    const records = loadState().prescriptions.filter(function (item) { return item.patientId === patientId; });
    document.getElementById('prescriptionHistory').innerHTML = records.length ? records.map(function (item) {
      return '<article class="prescription-history-card"><strong>' + escapeHtml(item.prescriptionDate || '日付未確認') + '　' + escapeHtml(item.institution || '医療機関未確認') + '</strong><small>' + escapeHtml(item.medications || '薬剤情報なし') + '</small></article>';
    }).join('') : '<div class="prescription-history-empty">保存済みのAI処方箋はありません。</div>';
  }

  function showPage(page) {
    const patientPage = document.getElementById('patientPage');
    const schedulePage = document.getElementById('schedulePage');
    const showSchedule = page === 'schedule';
    patientPage.classList.toggle('d-none', showSchedule);
    schedulePage.classList.toggle('d-none', !showSchedule);
    document.getElementById('patientViewNav').classList.toggle('active', !showSchedule);
    document.getElementById('scheduleViewNav').classList.toggle('active', showSchedule);
    document.title = (showSchedule ? 'スケジュール' : '患者一覧') + ' | Smart Rehab';
    if (showSchedule) setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 0);
  }

  document.addEventListener('DOMContentLoaded', function () {
    fillPatientOptions(); renderPatients();
    document.getElementById('patientSearch').addEventListener('input', renderPatients);
    document.getElementById('showDischargedPatients').addEventListener('change', renderPatients);
    document.getElementById('patientRows').addEventListener('click', function (event) {
      const button = event.target.closest('[data-patient-action]'); if (!button) return;
      if (button.dataset.patientAction === 'detail') showPatientDetail(button.dataset.patientId);
      if (button.dataset.patientAction === 'discharge') showDischarge(button.dataset.patientId);
      if (button.dataset.patientAction === 'prescription') showPrescription(button.dataset.patientId);
    });
    document.getElementById('patientDischargeSubmit').addEventListener('click', submitDischarge);
    document.getElementById('prescriptionImages').addEventListener('change', selectPrescriptionImages);
    document.getElementById('prescriptionPatient').addEventListener('change', function () { selectedPatientId = this.value; renderPrescriptionHistory(); });
    document.getElementById('analyzePrescription').addEventListener('click', analyzePrescription);
    document.getElementById('savePrescription').addEventListener('click', savePrescription);
    document.getElementById('patientViewNav').addEventListener('click', function (event) { event.preventDefault(); showPage('patients'); history.replaceState(null, '', '#patients'); });
    document.getElementById('scheduleViewNav').addEventListener('click', function (event) { event.preventDefault(); showPage('schedule'); history.replaceState(null, '', '#schedule'); });
    document.getElementById('prescriptionViewNav').addEventListener('click', function () { showPrescription(); });
    showPage(location.hash === '#schedule' || location.pathname === '/rehainfo/schedule' ? 'schedule' : 'patients');
  });
}());
