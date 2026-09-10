(function () {
	'use strict';
	const API = '/rehainfo/attendance/api';
	let records = [], therapists = [], editModal, editingDate = '', selectedWorkType = '通常勤務';
	let painting = false, paintedRecords = {}, draggedTherapistId = '';

	document.addEventListener('DOMContentLoaded', function () {
		editModal = new bootstrap.Modal(document.getElementById('attendanceEditModal'));
		const month = document.getElementById('attendanceDate');
		month.value = localMonthString(new Date());
		month.addEventListener('change', loadAttendance);
		document.getElementById('previousAttendanceDate').addEventListener('click', function () { changeMonth(-1); });
		document.getElementById('nextAttendanceDate').addEventListener('click', function () { changeMonth(1); });
		document.getElementById('attendanceToday').addEventListener('click', function () { month.value = localMonthString(new Date()); loadAttendance(); });
		document.getElementById('saveAttendanceEdit').addEventListener('click', saveAttendanceEdit);
		document.querySelectorAll('[data-work-type]').forEach(function (button) {
			button.addEventListener('click', function () {
				selectedWorkType = button.dataset.workType;
				document.querySelectorAll('[data-work-type]').forEach(function (item) { item.classList.toggle('active', item === button); });
			});
		});
		document.addEventListener('mouseup', finishPainting);
		loadAttendance();
	});

	async function loadAttendance() {
		const month = document.getElementById('attendanceDate').value;
		const response = await fetch(API + '/month?month=' + encodeURIComponent(month));
		if (!response.ok) { showAlert('月間出退勤を取得できませんでした。', true); return; }
		const data = await response.json(); records = data.records || []; therapists = data.therapists || [];
		document.getElementById('attendanceCount').textContent = therapists.length; renderMonth();
	}

	function renderMonth() {
		const month = document.getElementById('attendanceDate').value, days = daysInMonth(month);
		const columns = '190px repeat(' + days + ', minmax(20px, 1fr))';
		let html = '<div class="month-grid-row month-grid-header" style="grid-template-columns:' + columns + '"><div class="month-staff-header">療法士（ドラッグで並べ替え）</div>';
		for (let day = 1; day <= days; day++) { const date = dateString(month, day); html += '<div class="month-day-header ' + (isWeekend(date) ? 'weekend' : '') + '"><b>' + day + '</b><span>' + weekday(date) + '</span></div>'; }
		html += '</div>';
		therapists.forEach(function (therapist, index) {
			html += '<div class="month-grid-row" draggable="true" data-therapist-row="' + escapeHtml(therapist.id) + '" style="grid-template-columns:' + columns + '"><div class="month-staff"><span class="month-staff-name"><small>（' + escapeHtml(therapist.subLabel) + '）</small>' + escapeHtml(therapist.name) + '</span><span class="row-order-actions"><button type="button" aria-label="上へ" data-move="-1" data-therapist-id="' + escapeHtml(therapist.id) + '"' + (index === 0 ? ' disabled' : '') + '>▲</button><button type="button" aria-label="下へ" data-move="1" data-therapist-id="' + escapeHtml(therapist.id) + '"' + (index === therapists.length - 1 ? ' disabled' : '') + '>▼</button></span></div>';
			for (let day = 1; day <= days; day++) {
				const date = dateString(month, day), record = findRecord(therapist.id, date);
				html += '<div class="month-cell ' + workTypeClass(record.workType) + ' ' + (isWeekend(date) ? 'weekend' : '') + '" data-therapist-id="' + escapeHtml(therapist.id) + '" data-date="' + date + '" title="' + escapeHtml(date + ' ' + record.workType + ' ' + record.scheduledStart + '～' + record.scheduledEnd) + '">' + workTypeLabel(record.workType) + '</div>';
			}
			html += '</div>';
		});
		document.getElementById('monthlyAttendanceBoard').innerHTML = html; bindMonthEvents();
	}

	function bindMonthEvents() {
		document.querySelectorAll('.month-cell').forEach(function (cell) {
			cell.addEventListener('mousedown', function (event) { if (event.button === 0) { event.preventDefault(); painting = true; paintCell(cell); } });
			cell.addEventListener('mouseenter', function (event) { if (painting && event.buttons === 1) paintCell(cell); });
			cell.addEventListener('dblclick', function (event) { event.preventDefault(); openAttendanceEdit(cell.dataset.therapistId, cell.dataset.date); });
		});
		document.querySelectorAll('[data-move]').forEach(function (button) {
			button.addEventListener('mousedown', function (event) { event.stopPropagation(); });
			button.addEventListener('click', function (event) { event.stopPropagation(); moveTherapist(button.dataset.therapistId, Number(button.dataset.move)); });
		});
		document.querySelectorAll('[data-therapist-row]').forEach(function (row) {
			row.addEventListener('dragstart', function (event) { draggedTherapistId = row.dataset.therapistRow; row.classList.add('dragging'); event.dataTransfer.effectAllowed = 'move'; });
			row.addEventListener('dragend', function () { row.classList.remove('dragging'); document.querySelectorAll('.drop-target').forEach(function (item) { item.classList.remove('drop-target'); }); });
			row.addEventListener('dragover', function (event) { event.preventDefault(); if (row.dataset.therapistRow !== draggedTherapistId) row.classList.add('drop-target'); });
			row.addEventListener('dragleave', function () { row.classList.remove('drop-target'); });
			row.addEventListener('drop', function (event) { event.preventDefault(); row.classList.remove('drop-target'); reorderByDrop(draggedTherapistId, row.dataset.therapistRow); });
		});
	}

	function paintCell(cell) {
		const record = findRecord(cell.dataset.therapistId, cell.dataset.date); applyWorkType(record, selectedWorkType);
		paintedRecords[record.therapistId + '|' + record.date] = record;
		cell.className = 'month-cell ' + workTypeClass(record.workType) + ' ' + (isWeekend(record.date) ? 'weekend' : '') + ' painting'; cell.textContent = workTypeLabel(record.workType);
	}
	async function finishPainting() {
		if (!painting) return; painting = false;
		const updates = Object.keys(paintedRecords).map(function (key) { return paintedRecords[key]; }); paintedRecords = {};
		if (!updates.length) return;
		const response = await fetch(API + '/records', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
		const result = await response.json();
		if (!response.ok || !result.success) { showAlert(result.message || '勤務を保存できませんでした。', true); await loadAttendance(); return; }
		document.querySelectorAll('.month-cell.painting').forEach(function (cell) { cell.classList.remove('painting'); }); showAlert(updates.length + '件の勤務を設定しました。');
	}

	function applyWorkType(record, workType) {
		record.workType = workType; record.clockIn = null; record.clockOut = null;
		record.breakStart = workType === '有休' || workType === '公休' ? null : '12:00';
		record.breakEnd = workType === '有休' || workType === '公休' ? null : '13:00';
		if (workType === '早番') { record.scheduledStart = '07:30'; record.scheduledEnd = '16:30'; record.status = '出勤前'; }
		else if (workType === '遅番') { record.scheduledStart = '09:30'; record.scheduledEnd = '18:30'; record.status = '出勤前'; }
		else if (workType === '院内研修') { record.scheduledStart = '09:00'; record.scheduledEnd = '17:00'; record.status = '出勤前'; }
		else { record.scheduledStart = '08:30'; record.scheduledEnd = '17:30'; record.status = workType === '有休' || workType === '公休' ? workType : '出勤前'; }
	}

	function openAttendanceEdit(therapistId, date) {
		const record = findRecord(therapistId, date); editingDate = date;
		document.getElementById('attendanceEditTitle').textContent = record.therapistName + ' の出退勤を編集';
		document.getElementById('editTherapistRole').textContent = record.role + '・' + record.therapistId + '・' + record.date;
		document.getElementById('editTherapistId').value = record.therapistId;
		setValue('editWorkType', record.workType || '通常勤務'); setValue('editStatus', record.status || '出勤前'); setValue('editScheduledStart', record.scheduledStart); setValue('editScheduledEnd', record.scheduledEnd); setValue('editClockIn', record.clockIn); setValue('editClockOut', record.clockOut); setValue('editBreakStart', record.breakStart); setValue('editBreakEnd', record.breakEnd);
		document.getElementById('attendanceEditValidation').classList.add('d-none'); editModal.show();
	}
	async function saveAttendanceEdit() {
		const request = { date: editingDate, therapistId: valueOf('editTherapistId'), workType: valueOf('editWorkType'), status: valueOf('editStatus'), scheduledStart: valueOf('editScheduledStart'), scheduledEnd: valueOf('editScheduledEnd'), clockIn: valueOf('editClockIn'), clockOut: valueOf('editClockOut'), breakStart: valueOf('editBreakStart'), breakEnd: valueOf('editBreakEnd') };
		try { const response = await fetch(API + '/record', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) }); const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.message || '保存できませんでした。'); editModal.hide(); await loadAttendance(); showAlert('出退勤を更新しました。'); }
		catch (error) { const validation = document.getElementById('attendanceEditValidation'); validation.textContent = error.message; validation.classList.remove('d-none'); }
	}

	function moveTherapist(id, direction) { const index = therapists.findIndex(function (item) { return item.id === id; }), target = index + direction; if (index < 0 || target < 0 || target >= therapists.length) return; const moved = therapists.splice(index, 1)[0]; therapists.splice(target, 0, moved); saveOrder(); }
	function reorderByDrop(sourceId, targetId) { const source = therapists.findIndex(function (item) { return item.id === sourceId; }), target = therapists.findIndex(function (item) { return item.id === targetId; }); if (source < 0 || target < 0 || source === target) return; const moved = therapists.splice(source, 1)[0]; therapists.splice(target, 0, moved); saveOrder(); }
	async function saveOrder() { renderMonth(); const response = await fetch(API + '/order', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(therapists.map(function (item) { return item.id; })) }); if (!response.ok) { showAlert('並び順を保存できませんでした。', true); await loadAttendance(); return; } showAlert('療法士の並び順を更新しました。'); }

	function findRecord(therapistId, date) { return records.find(function (item) { return item.therapistId === therapistId && item.date === date; }); }
	function changeMonth(amount) { const input = document.getElementById('attendanceDate'), parts = input.value.split('-'), date = new Date(Number(parts[0]), Number(parts[1]) - 1 + amount, 1); input.value = localMonthString(date); loadAttendance(); }
	function daysInMonth(month) { const parts = month.split('-'); return new Date(Number(parts[0]), Number(parts[1]), 0).getDate(); }
	function dateString(month, day) { return month + '-' + String(day).padStart(2, '0'); }
	function isWeekend(date) { const day = new Date(date + 'T12:00:00').getDay(); return day === 0 || day === 6; }
	function weekday(date) { return ['日','月','火','水','木','金','土'][new Date(date + 'T12:00:00').getDay()]; }
	function workTypeLabel(type) { return { '早番':'早', '通常勤務':'通', '遅番':'遅', '休日勤務':'休出', '院内研修':'研', '有休':'有', '公休':'公' }[type] || '－'; }
	function workTypeClass(type) { return { '早番':'type-early', '通常勤務':'type-normal', '遅番':'type-late', '休日勤務':'type-holiday-work', '院内研修':'type-training', '有休':'type-paid', '公休':'type-off' }[type] || ''; }
	function showAlert(message, error) { const alert = document.getElementById('attendanceAlert'); alert.textContent = message; alert.classList.remove('d-none'); alert.style.borderLeftColor = error ? '#c44136' : ''; }
	function valueOf(id) { return document.getElementById(id).value; }
	function setValue(id, value) { document.getElementById(id).value = value || ''; }
	function localMonthString(date) { return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0'); }
	function escapeHtml(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) { return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]; }); }
})();
