import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const demoRoot = join(import.meta.dirname, '..');
const sourceRoot = join(demoRoot, 'rehainfo-source');
const publicRoot = join(demoRoot, 'public', 'rehainfo');
const checkOnly = process.argv.includes('--check');
const manifest = JSON.parse(await readFile(join(sourceRoot, 'source-manifest.json'), 'utf8'));

function hash(text) {
  return createHash('sha256').update(text).digest('hex').toUpperCase();
}

function openingTagStart(html, markerIndex) {
  const start = html.lastIndexOf('<', markerIndex);
  if (start < 0) throw new Error(`Opening tag not found near ${markerIndex}`);
  return start;
}

function elementRange(html, marker) {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Required source marker not found: ${marker}`);
  const start = openingTagStart(html, markerIndex);
  const tagMatch = /^<([A-Za-z][\w:-]*)\b/.exec(html.slice(start));
  if (!tagMatch) throw new Error(`Tag not found for marker: ${marker}`);
  const tag = tagMatch[1];
  const matcher = new RegExp(`<\\/?${tag.replace(':', '\\:')}\\b[^>]*>`, 'gi');
  matcher.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = matcher.exec(html))) {
    const closing = /^<\//.test(match[0]);
    const selfClosing = /\/>$/.test(match[0]);
    if (closing) depth -= 1;
    else if (!selfClosing) depth += 1;
    if (depth === 0) return { start, end: matcher.lastIndex, html: html.slice(start, matcher.lastIndex) };
  }
  throw new Error(`Closing tag not found for marker: ${marker}`);
}

function removeElement(html, marker) {
  while (html.includes(marker)) {
    const range = elementRange(html, marker);
    html = html.slice(0, range.start) + html.slice(range.end);
  }
  return html;
}

function fragment(html, name) {
  return elementRange(html, `th:fragment="${name}"`).html
    .replace(new RegExp(`\\s+th:fragment="${name}"`), '');
}

function stripThymeleafAttributes(html) {
  return html.replace(/\s+th:[\w-]+="[^"]*"/g, '');
}

function publicMeta(common) {
  let meta = fragment(common, 'meta_header');
  meta = removeElement(meta, '<script th:if=');
  meta = removeElement(meta, '(function(w,d,s,l,i)');
  meta = meta.replace('<head>', '<head>\n\t<meta charset="UTF-8" />\n\t<meta name="viewport" content="width=device-width,initial-scale=1" />\n\t<meta name="robots" content="noindex,nofollow,noarchive" />');
  meta = meta.replace('</head>', '\t<script src="/rehainfo/source-demo-adapter.js?v=20260911-6"></script>\n</head>');
  return stripThymeleafAttributes(meta);
}

function publicHeader(common, { patientList = false } = {}) {
  let header = fragment(common, 'topHeader');
  const markersToRemove = [
    '<noscript th:if=',
    '<h4 th:if="${patientInfo',
    '<th:block th:if="${transitionHistoryData',
    '<div th:if="${showTreatmentImplementProgress}',
    '<th:block th:if="(${googleApiMode}',
    '<button th:if="(${useGoogleApi}',
    '<th:block th:if="${fromPatientListFlag} eq true">',
    '<a th:if="${hideLogoutLink} eq true"'
  ];
  if (!patientList) {
    markersToRemove.push('<button th:if="${showOcrLinkButton}');
    markersToRemove.push('<th:block th:if="${fromPatientListFlag} == true');
  }
  for (const marker of markersToRemove) header = removeElement(header, marker);
  header = header.replace('<span th:text="${userName}"', '<span data-source-field="userName"')
    .replace(/(<span data-source-field="userName"[^>]*>)(<\/span>)/, '$1公開デモ$2');
  return stripThymeleafAttributes(header);
}

function publicOcrHeader(common) {
  let header = fragment(common, 'topHeaderOCR');
  header = removeElement(header, '<noscript th:if=');
  header = header.replace('onclick="goToSmartRehab()"', "onclick=\"window.location.href='/rehainfo/'; return false;\"");
  return stripThymeleafAttributes(header);
}

function withoutScripts(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
}

function publicSideMenu(common) {
  let menu = withoutScripts(fragment(common, 'sideMenu'));
  const unsupportedAdminLinks = [
    'href="/rehainfo/adminEvaluationPreset"', 'href="/rehainfo/adminTreatmentPreset"',
    'href="/rehainfo/patientInfoExport"', 'href="/rehainfo/adminImportData"',
    'href="/rehainfo/evaluationCustomizationTop"', 'href="/rehainfo/adminDataTransfer"',
    'href="/rehainfo/assignmentStaff"', 'href="/rehainfo/displayCustomizationTop"'
  ];
  for (const marker of unsupportedAdminLinks) menu = removeElement(menu, marker);
  menu = menu.replace('class="sidebar bg-primary"', 'class="sidebar bg-primary" data-source-fragment="sideMenu"');
  return stripThymeleafAttributes(menu);
}

function publicPatientHeader(common) {
  let header = fragment(common, 'headerPatientInfo');
  header = removeElement(header, 'th:if="${patientInfo.doctorName == \'\'}"');
  header = removeElement(header, 'th:if="${patientInfo.diseasePart == \'\' and patientInfo.diseaseName == \'\'}"');
  header = removeElement(header, 'th:if="${patientInfo.diseasePart == \'\' and patientInfo.diseaseName != \'\'}"');
  header = removeElement(header, 'th:if="${patientInfo.diseasePart != \'\' and patientInfo.diseaseName == \'\'}"');
  const fields = [
    ['th:text="${\'患者ID：\' + patientInfo.patientId}"', 'data-patient-field="patientId"'],
    ['th:text="${patientInfo.name}"', 'data-patient-field="name"'],
    ['th:text="${patientInfo.nameKana}"', 'data-patient-field="nameKana"'],
    ['th:text="${patientInfo.gender}"', 'data-patient-field="gender"'],
    ['th:text="${patientInfo.age + \'歳\'}"', 'data-patient-field="age"'],
    ['th:text="${patientInfo != null and patientInfo.birthG != null and patientInfo.birthJa != null ? patientInfo?.birthG?.substring(0,4) + \'(\' + patientInfo.birthJa + \')\' + patientInfo.birthG.substring(4) : \'\' }"', 'data-patient-field="birth"'],
    ['th:text="${\'主治医：\' + patientInfo.doctorName}"', 'data-patient-field="doctor"'],
    ['th:text="${patientInfo.diseasePart + \'：\' + patientInfo.diseaseName}"', 'data-patient-field="disease"']
  ];
  for (const [source, replacement] of fields) header = header.replace(source, replacement);
  return stripThymeleafAttributes(header);
}

function publicCommonTopButtons(common) {
  let buttons = withoutScripts(fragment(common, 'commonTopButton'));
  while (buttons.includes('<div th:classappend="${aiFeatureEnabled}')) buttons = removeElement(buttons, '<div th:classappend="${aiFeatureEnabled}');
  buttons = removeElement(buttons, '<div th:if="${patientInfo.active} eq false">');
  buttons = removeElement(buttons, '<div th:if="${patientInfo != null and patientPastData');
  buttons = removeElement(buttons, '<div class="role" th:if="${hcRoleCd == \'OccupationalTherapist\'}">');
  buttons = removeElement(buttons, '<div class="role" th:if="${hcRoleCd == \'SpeechTherapist\'}">');
  buttons = buttons.replace('th:text="*{patientInfo.treatmentTimes + \'回目\'}"', 'data-patient-field="treatmentTimes"')
    .replace('th:href="\'/rehainfo/patient/\' + ${recId} + \'/treatment-soap/soap-list\'"', 'data-patient-action="soap" href="#"')
    .replaceAll('../../images/', '/rehainfo/images/');
  return stripThymeleafAttributes(buttons);
}

function publicAutoSaveModal(common) {
  return stripThymeleafAttributes(fragment(common, 'autoSaveModal'));
}

function publicLoading(common) {
  return stripThymeleafAttributes(fragment(common, 'loading'));
}

function publicMessageModal(common) {
  let modal = fragment(common, 'commonMessageModal');
  modal = removeElement(modal, '<th:block th:if="${recId != null and aiFeatureEnabled}">');
  modal = removeElement(modal, '<div th:each="precautionData');
  return stripThymeleafAttributes(modal);
}

function addSourceMarker(html, sourcePath, sourceHash) {
  return html.replace('<html ', `<html data-rehainfo-source-template="${sourcePath}" data-rehainfo-source-sha256="${sourceHash}" `);
}

function renderStandardPage(source, common, sourcePath, sourceHash, options = {}) {
  let html = source;
  html = html.replace(/<head th:replace="common :: meta_header">\s*<\/head>/, publicMeta(common));
  html = html.replace(/<div th:replace="common :: topHeader"><\/div>/, publicHeader(common, options));
  html = html.replace(/<div th:replace="common :: loading"><\/div>/, publicLoading(common));
  html = html.replace(/<div th:replace="common :: commonMessageModal">\s*<\/div>/, publicMessageModal(common));
  html = addSourceMarker(html, sourcePath, sourceHash);
  return stripThymeleafAttributes(html);
}

function renderPatientList(source, common, sourcePath, sourceHash) {
  source = removeElement(source, '<div th:if="${isExcessingLimit} eq true"');
  let html = renderStandardPage(source, common, sourcePath, sourceHash, { patientList: true });
  html = html
    .replace(/addSearcher\("selecter",[^;]+;/, 'addSearcher("selecter", null, null, null, null);')
    .replace(/switchToggle\([^;]+;/, 'switchToggle(true);')
    .replace(/addPatientListTable\(parentNode,[^;]+;/, "addPatientListTable(parentNode, window.REHAINFO_DEMO_PATIENT_COLUMNS, window.REHAINFO_DEMO_PATIENTS, 'PhysicalTherapist');");
  return html;
}

function renderLogin(source, common, sourcePath, sourceHash) {
  let html = source.replace(/<div th:replace="common :: loading"><\/div>/, publicLoading(common));
  html = html.replace('<head>', '<head>\n<meta name="viewport" content="width=device-width,initial-scale=1" />\n<meta name="robots" content="noindex,nofollow,noarchive" />');
  html = html.replace(/<form action="login\.html"[^>]*method="post">/, '<form action="/rehainfo/login" method="post">');
  html = html.replace('<input type="email" th:field="*{email}"', '<input type="text" name="username" autocomplete="username" inputmode="email"');
  html = html.replace('<input type="password" th:field="*{pass}"', '<input type="password" name="password" autocomplete="current-password"');
  const errorRange = elementRange(html, '<div id="errorMsg"');
  const errorOpeningEnd = errorRange.html.indexOf('>') + 1;
  const errorOpening = errorRange.html.slice(0, errorOpeningEnd);
  html = html.slice(0, errorRange.start) + `${errorOpening}</div>` + html.slice(errorRange.end);
  html = html.replace('</body>', '  <script src="/rehainfo/login.js?v=20260910-2" defer="defer"></script>\n</body>');
  html = addSourceMarker(html, sourcePath, sourceHash);
  return stripThymeleafAttributes(html);
}

function renderPrescriptionPatients(source, common, sourcePath, sourceHash) {
  source = removeElement(source, '<script src="/rehainfo/js/Common.js');
  let html = source;
  html = html.replace(/<head th:replace="common :: meta_header">\s*<\/head>/, publicMeta(common));
  html = html.replace(/<div th:replace="common :: topHeaderOCR"><\/div>/, publicOcrHeader(common));
  html = html.replace(/<div th:replace="common :: loading"><\/div>/, publicLoading(common));
  html = html.replace('<title th:text="${prescriptionMode} ? \'患者一覧 - AI処方箋\' : \'患者一覧 - AIOCR\'">患者一覧</title>', '<title>患者一覧 - AI処方箋</title>');
  html = html.replace("window.prescriptionMode = /*[[${prescriptionMode}]]*/ false;", 'window.prescriptionMode = true;');
  html = html.replace('<body th:attr="data-mode=${prescriptionMode} ? \'prescription\' : \'ocr\'">', '<body data-mode="prescription" data-prescription-page="patients">');
  html = html.replace('<h1 class="page-title" th:text="${prescriptionMode} ? \'AI処方箋 患者一覧\' : \'患者一覧\'">患者一覧</h1>', '<h1 class="page-title">AI処方箋 患者一覧</h1>');
  html = addSourceMarker(html, sourcePath, sourceHash);
  return stripThymeleafAttributes(html);
}

function renderPrescriptionRead(source, common, sourcePath, sourceHash) {
  source = removeElement(source, '<script src="/rehainfo/js/jquery-3.6.0.min.js');
  source = removeElement(source, '<script src="/rehainfo/js/Common.js');
  source = removeElement(source, '<script src="/rehainfo/js/bootstrap.bundle.min.js');
  let html = source;
  html = html.replace(/<head th:replace="common :: meta_header">\s*<\/head>/, publicMeta(common));
  html = html.replace(/<div th:replace="common :: topHeaderOCR"><\/div>/, publicOcrHeader(common));
  html = html.replace(/<div th:replace="common :: loading"><\/div>/, publicLoading(common));
  html = html.replace(/<div th:replace="common :: commonMessageModal">\s*<\/div>/, publicMessageModal(common));
  html = html.replace('<body>', '<body data-prescription-page="read">');
  html = html.replace('<input type="hidden" id="patient-rec-id" th:value="${patientInfo.teamId}" />', '<input type="hidden" id="patient-rec-id" value="" />');
  html = html.replace('<span th:text="|${patientInfo.name}さんの処方箋読込|">処方箋読込</span>', '<span data-prescription-patient-title>処方箋読込</span>');
  html = addSourceMarker(html, sourcePath, sourceHash);
  return stripThymeleafAttributes(html);
}

function renderPrescriptionList(source, common, sourcePath, sourceHash) {
  source = removeElement(source, '<script src="/rehainfo/js/Common.js');
  let html = source;
  html = html.replace(/<head th:replace="common :: meta_header">\s*<\/head>/, publicMeta(common));
  html = html.replace(/<div th:replace="common :: topHeaderOCR"><\/div>/, publicOcrHeader(common));
  html = html.replace(/<div th:replace="common :: loading"><\/div>/, publicLoading(common));
  html = html.replace('<body>', '<body data-prescription-page="list">');
  html = html.replace('<span th:text="|${patientInfo.name}さんの保存済み処方箋|">保存済み処方箋</span>', '<span data-prescription-patient-title>保存済み処方箋</span>');
  html = html.replace('<a class="btn-read" th:href="|/rehainfo/prescriptions/patient/${recId}/read|">', '<a class="btn-read" data-prescription-read-link href="/rehainfo/prescriptions/patients">');
  html = html.replace('<table th:if="${totalItems > 0}">', '<table id="prescription-list-table">');
  html = html.replace('<tbody>', '<tbody id="prescription-list-body">');
  html = html.replace('<div class="empty" th:if="${totalItems == 0}">', '<div class="empty" id="prescription-list-empty">');
  html = html.replace('<nav th:if="${totalPages > 1}" aria-label="ページ切替">', '<nav id="prescription-list-pagination" aria-label="ページ切替" hidden="hidden">');
  html = addSourceMarker(html, sourcePath, sourceHash);
  return stripThymeleafAttributes(html);
}

function renderOcrPatients(source, common, sourcePath, sourceHash) {
  source = removeElement(source, '<script src="/rehainfo/js/Common.js');
  let html = source;
  html = html.replace(/<head th:replace="common :: meta_header">\s*<\/head>/, publicMeta(common));
  html = html.replace(/<div th:replace="common :: topHeaderOCR"><\/div>/, publicOcrHeader(common));
  html = html.replace(/<div th:replace="common :: loading"><\/div>/, publicLoading(common));
  html = html.replace(/<title[^>]*>患者一覧<\/title>/, '<title>患者一覧 - AIOCR</title>');
  html = html.replace("window.prescriptionMode = /*[[${prescriptionMode}]]*/ false;", 'window.prescriptionMode = false;');
  html = html.replace(/<body[^>]*>/, '<body data-mode="ocr" data-ocr-page="patients">');
  html = html.replace(/<h1 class="page-title"[^>]*>患者一覧<\/h1>/, '<h1 class="page-title">患者一覧</h1>');
  html = addSourceMarker(html, sourcePath, sourceHash);
  return stripThymeleafAttributes(html);
}

function renderOcrSelect(source, common, sourcePath, sourceHash) {
  for (const marker of [
    '<script src="/rehainfo/js/jquery-3.6.0.min.js',
    '<script src="/rehainfo/js/Common.js',
    '<script src="/rehainfo/js/bootstrap.bundle.min.js',
    '<script src="/rehainfo/js/ocr/PatientList.js'
  ]) source = removeElement(source, marker);
  let html = source;
  html = html.replace(/<head th:replace="common :: meta_header">\s*<\/head>/, publicMeta(common));
  html = html.replace(/<div th:replace="common :: topHeaderOCR"><\/div>/, publicOcrHeader(common));
  html = html.replace(/<div th:replace="common :: loading"><\/div>/, publicLoading(common));
  html = html.replace(/<div th:replace="common :: commonMessageModal">\s*<\/div>/, publicMessageModal(common));
  html = html.replace('<body>', '<body data-ocr-page="read">');
  html = html.replace('<input type="hidden" id="patient-rec-id" th:value="${patientInfo.teamId}" />', '<input type="hidden" id="patient-rec-id" value="" />');
  html = html.replace(/<span th:text="\|\$\{patientInfo\.name\}さんの評価シートを選択\|"><\/span>/, '<span data-ocr-patient-title>評価シートを選択</span>');
  html = addSourceMarker(html, sourcePath, sourceHash);
  return stripThymeleafAttributes(html);
}

function renderOcrList(source, common, sourcePath, sourceHash) {
  for (const marker of ['<script src="/rehainfo/js/Common.js', '<script src="/rehainfo/js/ocr/OcrList.js', '<script th:inline="javascript">']) {
    source = removeElement(source, marker);
  }
  let html = source;
  html = html.replace(/<head th:replace="common :: meta_header">\s*<\/head>/, publicMeta(common));
  html = html.replace(/<div th:replace="common :: topHeaderOCR"><\/div>/, publicOcrHeader(common));
  html = html.replace(/<div th:replace="common :: loading"><\/div>/, publicLoading(common));
  html = html.replace(/<div th:replace="common :: commonMessageModal">\s*<\/div>/, publicMessageModal(common));
  html = html.replace('<body>', '<body data-ocr-page="list">');
  html = html.replace(/<span th:text="\|\$\{patientInfo\.name\}さんのOCR一覧\|"><\/span>/, '<span data-ocr-patient-title>OCR一覧</span>');
  html = html.replace('<table class="ocr-table">', '<table class="ocr-table" id="ocr-list-table">');
  html = html.replace('<button type="button" class="btn-header-action">\n                        <svg', '<button type="button" class="btn-header-action" data-ocr-scan-button>\n                        <svg');
  html = html.replace('<tbody>', '<tbody id="ocr-list-body">');
  html = html.replace('<div class="empty-state" th:if="${evaluations == null or #lists.isEmpty(evaluations)}">', '<div class="empty-state" id="ocr-list-empty">');
  html = html.replace('<div class="pagination-section" th:if="${totalItems > 0}">', '<div class="pagination-section" id="ocr-list-pagination" hidden="hidden">');
  html = addSourceMarker(html, sourcePath, sourceHash);
  return stripThymeleafAttributes(html);
}

function renderPatientTop(source, common, sourcePath, sourceHash) {
  let html = withoutScripts(source);
  html = removeElement(html, '<div th:if="${patientInfo.active} eq true and ${patientPastData.size() > 0}"');
  html = html.replace(/<head th:replace="common :: meta_header">\s*<\/head>/, publicMeta(common));
  html = html.replace(/<div th:replace="common :: topHeader"><\/div>/, publicHeader(common));
  html = html.replace(/<div th:replace="common :: loading"><\/div>/, publicLoading(common));
  html = html.replace(/<div th:replace="common :: commonMessageModal">\s*<\/div>/, publicMessageModal(common));
  html = html.replace(/<nav th:replace="common :: sideMenu"[^>]*>\s*<\/nav>/, publicSideMenu(common));
  html = html.replace(/<div th:replace="common :: headerPatientInfo">\s*<\/div>/, publicPatientHeader(common));
  html = html.replace(/<div th:replace="common :: commonTopButton"><\/div>/, publicCommonTopButtons(common));
  let dashboardHtml = withoutScripts(fragment(dashboard, 'dashboard-content'));
  dashboardHtml = stripThymeleafAttributes(dashboardHtml).replaceAll('../../images/', '/rehainfo/images/');
  html = html.replace(/<div th:replace="fragments\/dashboardContent :: dashboard-content"><\/div>/, dashboardHtml);
  html = html.replace('<body>', '<body data-patient-page="top">');
  html = html.replace('<div id="dashboardContent" class="d-none">', '<div id="dashboardContent">');
  html = html.replaceAll('../../images/', '/rehainfo/images/');
  html = addSourceMarker(html, sourcePath, sourceHash);
  return stripThymeleafAttributes(html);
}

function renderSoapList(source, common, sourcePath, sourceHash) {
  let html = source;
  html = html.replace(/<head th:replace="common :: meta_header">\s*<\/head>/, publicMeta(common));
  html = html.replace(/<div th:replace="common :: topHeader"><\/div>/, publicHeader(common));
  html = html.replace(/<div th:replace="common :: loading"><\/div>/, publicLoading(common));
  html = html.replace(/<div th:replace="common :: commonMessageModal">\s*<\/div>/, publicMessageModal(common));
  html = html.replace(/<div th:replace="common :: autoSaveModal"><\/div>/, publicAutoSaveModal(common));
  html = html.replace(/<nav th:replace="common :: sideMenu"[^>]*>\s*<\/nav>/, publicSideMenu(common));
  html = html.replace(/<div th:replace="common :: headerPatientInfo">\s*<\/div>/, publicPatientHeader(common));
  html = html.replace('<body>', '<body data-patient-page="soap">');
  html = html.replace("const recId = /*[[${recId}]]*/ '';", "const recId = window.REHAINFO_ACTIVE_REC_ID || '';");
  html = html.replace("const hcRoleCd = /*[[${hcRoleCd}]]*/ '';", "const hcRoleCd = 'PhysicalTherapist';");
  html = addSourceMarker(html, sourcePath, sourceHash);
  return stripThymeleafAttributes(html);
}

const commonPath = 'templates/common.html';
const common = await readFile(join(sourceRoot, commonPath), 'utf8');
if (hash(common) !== manifest.templates[commonPath]) throw new Error(`Upstream source hash mismatch: ${commonPath}`);
const dashboardPath = 'templates/fragments/dashboardContent.html';
const dashboard = await readFile(join(sourceRoot, dashboardPath), 'utf8');
if (hash(dashboard) !== manifest.templates[dashboardPath]) throw new Error(`Upstream source hash mismatch: ${dashboardPath}`);
const outputs = [
  { source: 'templates/patientList.html', output: 'index.html', render: renderPatientList },
  { source: 'templates/login.html', output: 'login.html', render: renderLogin },
  { source: 'templates/patientTop.html', output: 'patient-top.html', render: renderPatientTop },
  { source: 'templates/soapList.html', output: 'soap-list.html', render: renderSoapList },
  { source: 'templates/ocr/patientList.html', output: 'ocr-patients.html', render: renderOcrPatients },
  { source: 'templates/ocr/evaluationSelect.html', output: 'ocr-select.html', render: renderOcrSelect },
  { source: 'templates/ocr/ocrList.html', output: 'ocr-list.html', render: renderOcrList },
  { source: 'templates/ocr/patientList.html', output: 'prescription-patients.html', render: renderPrescriptionPatients },
  { source: 'templates/prescription/read.html', output: 'prescription-read.html', render: renderPrescriptionRead },
  { source: 'templates/prescription/list.html', output: 'prescription-list.html', render: renderPrescriptionList },
  { source: 'templates/schedule/index.html', output: 'schedule.html', render: renderStandardPage },
  { source: 'templates/schedule/therapists.html', output: 'therapists.html', render: renderStandardPage },
  { source: 'templates/schedule/attendance.html', output: 'attendance.html', render: renderStandardPage },
  { source: 'templates/schedule/ai.html', output: 'ai-schedule.html', render: renderStandardPage },
  { source: 'templates/schedule/billing-management.html', output: 'billing-management.html', render: renderStandardPage },
  { source: 'templates/schedule/operations.html', output: 'schedule-management.html', render: renderStandardPage }
];

const sourceAssets = [
  'css/bootstrap.min.css', 'css/variables.css', 'css/sidebar.css', 'css/patient_header.css', 'css/common.css',
  'css/custom.css', 'css/tabulator.css', 'css/tableFilter.css', 'css/tooltip.css', 'css/PatientDischarge.css',
  'css/bootstrap-icons-1.9.1/bootstrap-icons.css', 'css/bootstrap-icons-1.9.1/sort-up-alt.svg',
  'css/bootstrap-icons-1.9.1/sort-down.svg', 'css/bootstrap-icons-1.9.1/fonts/bootstrap-icons.woff',
  'css/bootstrap-icons-1.9.1/fonts/bootstrap-icons.woff2',
  'js/jquery-3.6.0.min.js', 'js/bootstrap.bundle.min.js', 'js/Common.js', 'js/BackCancel.js', 'js/sidebar.js',
  'js/PatientListFilter.js', 'js/tabulator.js', 'js/jquery.dataTables.min.js', 'js/dataTables.bootstrap5.min.js',
  'js/SearchPatientList.js', 'js/PatientListTable.js', 'js/PatientDischarge.js',
  'css/jquery.datetimepicker.min.css', 'css/ocr/evaluationSelect.css',
  'js/jquery.datetimepicker.full.min.js', 'js/pdf.min.js', 'js/pdf.worker.min.js',
  'js/ocr/PatientList.js', 'js/ocr/EvaluationSelect.js',
  'css/patientTop.css', 'css/soapList.css', 'css/ocr/ocrList.css',
  'js/soapList.js', 'js/soapDirtyState.js', 'js/AutoSaveManager.js',
  'schedule/schedule.css', 'schedule/schedule.js', 'schedule/therapists.css', 'schedule/therapists.js',
  'schedule/attendance.css', 'schedule/attendance.js', 'schedule/ai.css', 'schedule/ai.js',
  'schedule/billing-management.css', 'schedule/billing-management.js', 'schedule/operations.css', 'schedule/operations.js',
  'images/SmartRehab-R_Available_Transparent.png', 'images/intep360.ico', 'images/intep360.svg',
  'images/ocr/logo.png', 'images/icons/ocr/box-arrow-up-right.svg', 'images/icons/ocr/magic-start.svg',
  'images/warning_icon.svg', 'images/success_icon.svg'
  , 'images/evaluation_plan_icon.svg', 'images/problems_icon.svg', 'images/goals_icon.svg', 'images/plan_icon.svg',
  'images/event_input_icon.svg', 'images/sub_doctor_schedule.svg', 'images/icons/admin-treatment-preset-icon.svg',
  'images/icons/dashboard/arrow-down-icon.svg', 'images/icons/dashboard/arrow-down.svg', 'images/icons/dashboard/arrow-downward.svg',
  'images/icons/dashboard/arrow-up.svg', 'images/icons/dashboard/arrow-upward.svg', 'images/icons/dashboard/column-chart.svg',
  'images/icons/dashboard/goal-and-target.svg', 'images/icons/dashboard/icon-park-outline_share.svg',
  'images/icons/dashboard/image1.png', 'images/icons/dashboard/image2.png', 'images/icons/dashboard/light-bulb.svg',
  'images/icons/dashboard/mdi-light_printer.svg', 'images/icons/dashboard/right-arrow.svg',
  'images/icons/dashboard/star-icon.svg', 'images/icons/dashboard/treatment.svg'
];

const failures = [];
for (const page of outputs) {
  const source = await readFile(join(sourceRoot, page.source), 'utf8');
  const expectedHash = manifest.templates[page.source];
  if (!expectedHash || hash(source) !== expectedHash) throw new Error(`Upstream source hash mismatch: ${page.source}`);
  const rendered = page.render(source, common, page.source, expectedHash);
  const outputPath = join(publicRoot, page.output);
  if (checkOnly) {
    const current = await readFile(outputPath, 'utf8').catch(() => '');
    if (current !== rendered) failures.push(page.output);
  } else {
    await writeFile(outputPath, rendered, 'utf8');
  }
}

for (const asset of sourceAssets) {
  const source = await readFile(join(sourceRoot, 'static', asset));
  const outputPath = join(publicRoot, asset);
  if (checkOnly) {
    const current = await readFile(outputPath).catch(() => Buffer.alloc(0));
    if (!current.equals(source)) failures.push(asset);
  } else {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, source);
  }
}

if (checkOnly && failures.length) {
  throw new Error(`Public rehainfo pages are not source-generated: ${failures.join(', ')}`);
}
console.log(checkOnly ? 'rehainfo source UI check: ok' : `rehainfo source UI synced: ${outputs.length} pages, ${sourceAssets.length} assets`);
