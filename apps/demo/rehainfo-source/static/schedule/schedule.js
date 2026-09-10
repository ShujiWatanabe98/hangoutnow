(function () {
	'use strict';

	const API = '/rehainfo/schedule/api';
	const START_MINUTES = 8 * 60;
	const SLOT_MINUTES = 20;
	const SLOT_COUNT = 30;
	const SLOT_HEIGHT = 24;
	let scheduleData = { patients: [], therapists: [], entries: [], staffAvailability: [], patientEvents: [], unassignedEntries: [], capacity: {}, orcaMasters: [], billingMasterVersion: '', minimumGapMinutes: 2, maxDailyUnits: 9, monthlyUnits: { total: 0, reserved: 0 } };
	let currentView = 'therapist';
	let modal;
	let mouseSelection = null;
	let workflowActual = null;
	let billingManualOverride = false;
	let billingSelectionReason = '';

	document.addEventListener('DOMContentLoaded', function () {
		modal = new bootstrap.Modal(document.getElementById('scheduleModal'));
		bindControls();
		document.getElementById('scheduleDate').value = localDateString(new Date());
		loadSchedule();
	});

	function bindControls() {
		document.getElementById('scheduleDate').addEventListener('change', loadSchedule);
		document.getElementById('todayButton').addEventListener('click', function () { changeDate(0, true); });
		document.getElementById('previousDate').addEventListener('click', function () { changeDate(-1); });
		document.getElementById('nextDate').addEventListener('click', function () { changeDate(1); });
		document.getElementById('therapistView').addEventListener('click', function () { switchView('therapist'); });
		document.getElementById('patientView').addEventListener('click', function () { switchView('patient'); });
		document.getElementById('saveEntryButton').addEventListener('click', saveEntry);
		document.getElementById('deleteEntryButton').addEventListener('click', deleteEntry);
		document.getElementById('entryDate').addEventListener('change', loadBillingChecks);
		document.getElementById('entryPatient').addEventListener('change', function () { billingManualOverride = false; loadBillingChecks(); });
		document.getElementById('entryTherapist').addEventListener('change', function () { billingManualOverride = false; populateOrcaCodes(); updateScheduleTimePreview(); loadBillingChecks(); });
		document.getElementById('entryPatient').addEventListener('change', updateScheduleTimePreview);
		document.getElementById('entryStart').addEventListener('input', updateScheduleTimePreview);
		document.getElementById('entryUnits').addEventListener('change', function () { updateOrcaBillingSummary(); updateScheduleTimePreview(); });
		document.getElementById('entryOrcaCode').addEventListener('change', function () { billingManualOverride = true; billingSelectionReason = '利用者がORCA診療行為コードを選択しました。'; updateOrcaBillingSummary(); loadBillingChecks(); });
		document.getElementById('entryNote').addEventListener('change', function () { billingManualOverride = false; loadBillingChecks(); });
		document.getElementById('teamFilter').addEventListener('change', render);
		document.getElementById('wardFilter').addEventListener('change', render);
		document.getElementById('copySchedule').addEventListener('click', copySchedule);
		document.getElementById('bulkComplete').addEventListener('click', bulkComplete);
	}

	async function loadSchedule() {
		const date = document.getElementById('scheduleDate').value;
		try {
			const response = await fetch(API + '/bootstrap?date=' + encodeURIComponent(date) + '&mode=day');
			if (!response.ok) throw new Error('スケジュールを取得できませんでした。');
			scheduleData = await response.json();
			renderMonthlyUnits(date);
			populateSelects();
			renderQuickPanels();
			render();
		} catch (error) {
			window.alert(error.message);
		}
	}

	function renderMonthlyUnits(date) {
		const summary = scheduleData.monthlyUnits || {};
		document.getElementById('summaryMonth').textContent = Number(date.substring(5, 7)) + '月';
		document.getElementById('monthlyTotalUnits').textContent = Number(summary.total || 0).toLocaleString('ja-JP');
		document.getElementById('monthlyReservedUnits').textContent = Number(summary.reserved || 0).toLocaleString('ja-JP');
	}

	function render() {
		const team=document.getElementById('teamFilter').value,ward=document.getElementById('wardFilter').value;
		const resources = (currentView === 'therapist' ? scheduleData.therapists.filter(function(r){return !team||r.team===team;}) : scheduleData.patients.filter(function(r){return !ward||r.ward===ward;}));
		const board = document.getElementById('scheduleBoard');
		if (!resources.length) {
			board.innerHTML = '<div class="schedule-empty">表示対象がありません</div>';
			return;
		}
		const columns = 'repeat(' + resources.length + ', minmax(178px, 1fr))';
		board.innerHTML = '<div class="time-header">時間</div>'
			+ '<div class="resource-headers" style="grid-template-columns:' + columns + '">'
			+ resources.map(resourceHeader).join('') + '</div>'
			+ '<div class="time-rail">' + timeLabels() + '</div>'
			+ '<div class="resource-columns" style="grid-template-columns:' + columns + '">'
			+ resources.map(resourceColumn).join('') + '</div>';
		bindBoardEvents();
	}

	function resourceHeader(resource) {
		const capacity=currentView==='therapist'?' <small>空き'+Number((scheduleData.capacity||{})[resource.id]||0)+'単位</small>':'';
		return '<div class="resource-header"><strong>（' + escapeHtml(resource.subLabel || '') + '）'
			+ escapeHtml(resource.name) + capacity + '</strong></div>';
	}

	function resourceColumn(resource) {
		let slots = '';
		for (let index = 0; index < SLOT_COUNT; index++) {
			slots += '<div class="time-drop-slot" data-resource-id="' + escapeHtml(resource.id)
				+ '" data-slot-index="' + index + '" data-time="' + minutesToTime(START_MINUTES + index * SLOT_MINUTES) + '"></div>';
		}
		const events = scheduleData.entries.filter(function (entry) {
			return currentView === 'therapist' ? entry.therapistId === resource.id : entry.patientId === resource.id;
		}).map(eventHtml).join('');
		return '<div class="resource-column" data-resource-id="' + escapeHtml(resource.id) + '">' + slots + availabilityHtml(resource) + hospitalEventsHtml(resource) + events + '</div>';
	}

	function hospitalEventsHtml(resource) {
		if (currentView !== 'patient') return '';
		return (scheduleData.patientEvents || []).filter(function (event) { return event.patientId === resource.id; }).map(function (event) {
			const top = ((timeToMinutes(event.startTime) - START_MINUTES) / SLOT_MINUTES) * SLOT_HEIGHT;
			const height = Math.max(30, ((timeToMinutes(event.endTime) - timeToMinutes(event.startTime)) / SLOT_MINUTES) * SLOT_HEIGHT - 4);
			return '<div class="hospital-event ' + hospitalEventClass(event.eventType) + '" style="top:' + top + 'px;height:' + height + 'px" title="' + escapeHtml(event.sourceSystem) + '"><strong>' + escapeHtml(event.startTime + ' ' + event.title) + '</strong><span>' + escapeHtml(event.eventType + '・' + (event.conflictLevel === 'BLOCK' ? '予約不可' : '要確認')) + '</span></div>';
		}).join('');
	}

	function hospitalEventClass(type) {
		return { 'CT':'event-exam', 'MRI':'event-exam', '診察':'event-consult', '入浴':'event-bath', '透析':'event-dialysis', '食事':'event-meal', '外出外泊':'event-outing', 'カンファレンス':'event-conference' }[type] || '';
	}

	function availabilityHtml(resource) {
		if (currentView !== 'therapist') return '';
		const item = (scheduleData.staffAvailability || []).find(function (record) { return record.therapistId === resource.id; });
		if (!item) return '';
		if (item.workType === '公休' || item.workType === '有休' || item.workType === '院内研修') {
			return '<div class="availability-block full"><span>' + escapeHtml(item.workType) + '・予約不可</span></div>';
		}
		let result = '';
		const visibleEnd = START_MINUTES + SLOT_COUNT * SLOT_MINUTES;
		const shiftStart = Math.max(START_MINUTES, timeToMinutes(item.scheduledStart));
		const shiftEnd = Math.min(visibleEnd, timeToMinutes(item.scheduledEnd));
		if (shiftStart > START_MINUTES) result += availabilityBlock(START_MINUTES, shiftStart, '勤務時間外');
		if (shiftEnd < visibleEnd) result += availabilityBlock(shiftEnd, visibleEnd, '勤務時間外');
		if (item.breakStart && item.breakEnd) result += availabilityBlock(timeToMinutes(item.breakStart), timeToMinutes(item.breakEnd), '休憩');
		return result;
	}

	function availabilityBlock(start, end, label) {
		const clippedStart = Math.max(START_MINUTES, start), clippedEnd = Math.min(START_MINUTES + SLOT_COUNT * SLOT_MINUTES, end);
		if (clippedEnd <= clippedStart) return '';
		const top = ((clippedStart - START_MINUTES) / SLOT_MINUTES) * SLOT_HEIGHT;
		const height = ((clippedEnd - clippedStart) / SLOT_MINUTES) * SLOT_HEIGHT;
		return '<div class="availability-block" style="top:' + top + 'px;height:' + height + 'px"><span>' + label + '</span></div>';
	}

	function eventHtml(entry) {
		const top = ((timeToMinutes(entry.startTime) - START_MINUTES) / SLOT_MINUTES) * SLOT_HEIGHT;
		const height = Math.max(34, ((timeToMinutes(entry.endTime) - timeToMinutes(entry.startTime)) / SLOT_MINUTES) * SLOT_HEIGHT - 4);
		const counterpart = currentView === 'therapist' ? entry.patientName : entry.therapistRole + ' ' + entry.therapistName;
		const billing = entry.orcaCode ? '・ORCA ' + entry.orcaCode + '・' + Number(entry.billingPoints || 0).toLocaleString('ja-JP') + '点' : '・ORCA未選択';
		return '<button type="button" draggable="true" class="schedule-event ' + workflowEventClass(entry.status)
			+ '" data-entry-id="' + entry.id + '" style="top:' + top + 'px;height:' + height + 'px">'
			+ '<strong>' + escapeHtml(entry.startTime + '～' + entry.endTime + ' ' + counterpart) + '</strong>'
			+ '<span>' + escapeHtml(entry.units + '単位・' + entry.status + billing + '・' + (entry.note || '内容未設定')) + '</span></button>';
	}

	function workflowEventClass(status) {
		if (status === '受付') return 'received';
		if (status === '実施中') return 'in-progress';
		if (status === '中止') return 'cancelled';
		return status === '実績' || status === '実施済み' || status === '記録完了' || status === '算定確認済み' ? 'actual' : '';
	}

	function timeLabels() {
		let result = '';
		for (let index = 0; index < SLOT_COUNT; index++) {
			result += '<div class="time-label">' + minutesToTime(START_MINUTES + index * SLOT_MINUTES) + '</div>';
		}
		return result;
	}

	function bindBoardEvents() {
		document.querySelectorAll('.schedule-event').forEach(function (element) {
			element.addEventListener('click', function () { openEditor(findEntry(element.dataset.entryId)); });
			element.addEventListener('dragstart', function (event) {
				event.dataTransfer.setData('text/plain', element.dataset.entryId);
				event.dataTransfer.effectAllowed = 'move';
			});
		});
		document.querySelectorAll('.time-drop-slot').forEach(function (slot) {
			slot.addEventListener('mousedown', beginMouseSelection);
			slot.addEventListener('mouseenter', extendMouseSelection);
			slot.addEventListener('dragover', function (event) { event.preventDefault(); slot.classList.add('drag-over'); });
			slot.addEventListener('dragleave', function () { slot.classList.remove('drag-over'); });
			slot.addEventListener('drop', async function (event) {
				event.preventDefault();
				slot.classList.remove('drag-over');
				const entry = Object.assign({}, findEntry(event.dataTransfer.getData('text/plain')));
				if (!entry.id) return;
				entry.startTime = slot.dataset.time;
				entry.endTime = addMinutes(entry.startTime, Number(entry.units) * SLOT_MINUTES);
				if (currentView === 'therapist') entry.therapistId = slot.dataset.resourceId;
				else entry.patientId = slot.dataset.resourceId;
				await persistEntry(entry, true);
			});
		});
		document.removeEventListener('mouseup', finishMouseSelection);
		document.addEventListener('mouseup', finishMouseSelection);
	}

	function beginMouseSelection(event) {
		if (event.button !== 0) return;
		event.preventDefault();
		const slot = event.currentTarget;
		mouseSelection = {
			column: slot.parentElement,
			startIndex: Number(slot.dataset.slotIndex),
			endIndex: Number(slot.dataset.slotIndex),
			slot: slot
		};
		paintMouseSelection();
	}

	function extendMouseSelection(event) {
		if (!mouseSelection || event.buttons !== 1 || event.currentTarget.parentElement !== mouseSelection.column) return;
		const hoveredIndex = Number(event.currentTarget.dataset.slotIndex);
		const direction = hoveredIndex < mouseSelection.startIndex ? -1 : 1;
		mouseSelection.endIndex = mouseSelection.startIndex + direction * Math.min(2, Math.abs(hoveredIndex - mouseSelection.startIndex));
		paintMouseSelection();
	}

	function paintMouseSelection() {
		document.querySelectorAll('.time-drop-slot.mouse-selected').forEach(function (slot) {
			slot.classList.remove('mouse-selected');
		});
		if (!mouseSelection) return;
		const first = Math.min(mouseSelection.startIndex, mouseSelection.endIndex);
		const last = Math.max(mouseSelection.startIndex, mouseSelection.endIndex);
		mouseSelection.column.querySelectorAll('.time-drop-slot').forEach(function (slot) {
			const index = Number(slot.dataset.slotIndex);
			if (index >= first && index <= last) slot.classList.add('mouse-selected');
		});
	}

	function finishMouseSelection() {
		if (!mouseSelection) return;
		const first = Math.min(mouseSelection.startIndex, mouseSelection.endIndex);
		const defaults = {
			date: mouseSelection.slot.dataset.date || document.getElementById('scheduleDate').value,
			startTime: minutesToTime(START_MINUTES + first * SLOT_MINUTES),
			units: Math.abs(mouseSelection.endIndex - mouseSelection.startIndex) + 1
		};
		if (currentView === 'therapist') {
			defaults.therapistId = mouseSelection.slot.dataset.resourceId;
		} else {
			defaults.patientId = mouseSelection.slot.dataset.resourceId;
		}
		clearMouseSelection();
		openEditor(defaults);
	}

	function clearMouseSelection() {
		mouseSelection = null;
		document.querySelectorAll('.time-drop-slot.mouse-selected').forEach(function (slot) {
			slot.classList.remove('mouse-selected');
		});
	}

	function openEditor(entry) {
		const editing = entry || {};
		document.getElementById('scheduleModalTitle').textContent = editing.id ? '予約を編集' : '予約を追加';
		document.getElementById('entryId').value = editing.id || '';
		document.getElementById('entryDate').value = editing.date || document.getElementById('scheduleDate').value;
		document.getElementById('entryPatient').value = editing.patientId || scheduleData.patients[0].id;
		document.getElementById('entryTherapist').value = editing.therapistId || scheduleData.therapists[0].id;
		document.getElementById('entryStart').value = editing.startTime || '09:00';
		document.getElementById('entryUnits').value = editing.units || '1';
		billingManualOverride = !!editing.orcaCode && !editing.billingAutoSelected;
		billingSelectionReason = editing.billingSelectionReason || '';
		populateOrcaCodes(editing.orcaCode || '');
		document.getElementById('entryStatus').value = '予約';
		document.getElementById('entryStatusRow').classList.toggle('d-none', !!editing.id);
		document.getElementById('entryNote').value = editing.note || '';
		document.getElementById('entryPreferredPeriod').value = editing.preferredPeriod || '';
		document.getElementById('deleteEntryButton').classList.toggle('d-none', !editing.id);
		document.getElementById('modalValidation').classList.add('d-none');
		modal.show();
		updateScheduleTimePreview();
		loadBillingChecks();
		document.getElementById('actualWorkflowPanel').classList.add('d-none');
		if (editing.id) loadActual(editing.id); else { workflowActual = null; }
	}

	async function loadBillingChecks() {
		const date = document.getElementById('entryDate').value;
		const patientId = document.getElementById('entryPatient').value;
		const list = document.getElementById('billingCheckList');
		if (!date || !patientId) return;
		list.textContent = '確認中...';
		try {
			const therapistId = document.getElementById('entryTherapist').value;
			const note = document.getElementById('entryNote').value;
			const units = document.getElementById('entryUnits').value;
			const response = await fetch(API + '/billing-checks?date=' + encodeURIComponent(date) + '&patientId=' + encodeURIComponent(patientId)
				+ '&therapistId=' + encodeURIComponent(therapistId) + '&note=' + encodeURIComponent(note) + '&units=' + encodeURIComponent(units));
			const result = await response.json();
			if (!billingManualOverride && result.suggestion && result.suggestion.item) {
				const suggestedCode = result.suggestion.item.code;
				const select = document.getElementById('entryOrcaCode');
				if (Array.from(select.options).some(function (option) { return option.value === suggestedCode; })) select.value = suggestedCode;
				billingSelectionReason = result.suggestion.reason || 'リハビリ内容から自動選択しました。';
				updateOrcaBillingSummary();
			}
			document.getElementById('billingRuleVersion').textContent = result.ruleVersion || '検証用ルール';
			const checks = (result.checks || []).slice();
			checks.unshift(document.getElementById('entryOrcaCode').value
				? { level: 'OK', message: '療法士職種に対応するORCA診療行為コードを選択しています。' }
				: { level: 'WARNING', message: 'ORCA診療行為コードが未選択です。算定確認前に選択してください。' });
			list.innerHTML = checks.map(function (check) { return '<div class="billing-check ' + check.level.toLowerCase() + '"><strong>' + escapeHtml(check.level) + '</strong><span>' + escapeHtml(check.message) + '</span></div>'; }).join('');
		} catch (error) { list.textContent = '算定チェックを取得できませんでした。'; }
	}

	async function loadActual(appointmentId) {
		const response = await fetch(API + '/entries/' + appointmentId + '/actual');
		const result = await response.json();
		if (!response.ok || !result.success) return;
		workflowActual = result.actual;
		document.getElementById('actualWorkflowPanel').classList.remove('d-none');
		document.getElementById('workflowStatus').textContent = workflowActual.status;
		document.getElementById('actualTherapist').value = workflowActual.actualTherapistId || '';
		document.getElementById('actualLocation').value = workflowActual.location || 'リハビリ室';
		document.getElementById('actualStart').value = workflowActual.actualStart || '';
		document.getElementById('actualEnd').value = workflowActual.actualEnd || '';
		document.getElementById('actualUnits').value = workflowActual.actualUnits || '1';
		document.getElementById('actualCancelReason').value = workflowActual.cancelReason || '';
		document.getElementById('actualNote').value = workflowActual.note || '';
		renderWorkflowActions();
	}

	function renderWorkflowActions() {
		const actions = { '予約':['受付','中止'], '受付':['実施中','中止'], '実施中':['実施済み','中止'], '実施済み':['記録完了'], '記録完了':['算定確認済み'] }[workflowActual.status] || [];
		document.getElementById('workflowActions').innerHTML = actions.map(function (status) {
			return '<button type="button" class="' + (status === '中止' ? 'cancel' : 'primary') + '" data-workflow-status="' + status + '">' + status + 'にする</button>';
		}).join('') || '<span>この実績は確定済みです</span>';
		document.querySelectorAll('[data-workflow-status]').forEach(function (button) { button.addEventListener('click', function () { transitionWorkflow(button.dataset.workflowStatus); }); });
	}

	async function transitionWorkflow(nextStatus) {
		const appointmentId = document.getElementById('entryId').value;
		const request = { status: nextStatus, actualTherapistId: document.getElementById('actualTherapist').value, actualStart: document.getElementById('actualStart').value, actualEnd: document.getElementById('actualEnd').value, actualUnits: Number(document.getElementById('actualUnits').value), location: document.getElementById('actualLocation').value, cancelReason: document.getElementById('actualCancelReason').value, note: document.getElementById('actualNote').value.trim() };
		const response = await fetch(API + '/entries/' + appointmentId + '/workflow', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
		const result = await response.json();
		if (!response.ok || !result.success) { const validation = document.getElementById('modalValidation'); validation.textContent = result.message || '状態を更新できませんでした。'; validation.classList.remove('d-none'); return; }
		modal.hide(); await loadSchedule();
	}

	async function saveEntry() {
		const units = Number(document.getElementById('entryUnits').value);
		const start = document.getElementById('entryStart').value;
		const editingId = document.getElementById('entryId').value || null;
		const original = editingId ? findEntry(editingId) : {};
		const entry = {
			id: editingId,
			date: document.getElementById('entryDate').value,
			startTime: start,
			endTime: addMinutes(start, units * SLOT_MINUTES),
			patientId: document.getElementById('entryPatient').value,
			therapistId: document.getElementById('entryTherapist').value,
			requiredRole: document.getElementById('entryTherapist').value.indexOf('UNASSIGNED_')===0?document.getElementById('entryTherapist').value.replace('UNASSIGNED_',''):'',
			preferredPeriod: document.getElementById('entryPreferredPeriod').value,
			orcaCode: document.getElementById('entryOrcaCode').value,
			billingAutoSelected: !billingManualOverride && !!document.getElementById('entryOrcaCode').value,
			billingSelectionReason: billingSelectionReason,
			units: units,
			status: original.status || document.getElementById('entryStatus').value,
			note: document.getElementById('entryNote').value.trim(),
			versionNo: original.versionNo || 0
		};
		await persistEntry(entry, false);
	}

	async function persistEntry(entry, fromDrop) {
		const url = API + '/entries' + (entry.id ? '/' + entry.id : '');
		try {
			const response = await fetch(url, {
				method: entry.id ? 'PUT' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(entry)
			});
			const result = await response.json();
			if ((!response.ok || !result.success) && result.warning && !entry.conflictOverride) {
				if (window.confirm(result.message)) { entry.conflictOverride = true; return persistEntry(entry, fromDrop); }
			}
			if (!response.ok || !result.success) throw new Error(result.message || '保存できませんでした。');
			if (!fromDrop) modal.hide();
			await loadSchedule();
			if (result.gapAdjusted) showScheduleNotice(result.message);
		} catch (error) {
			if (fromDrop) {
				window.alert(error.message);
				render();
			} else {
				const validation = document.getElementById('modalValidation');
				validation.textContent = error.message;
				validation.classList.remove('d-none');
			}
		}
	}

	async function deleteEntry() {
		const id = document.getElementById('entryId').value;
		if (!id || !window.confirm('この予約を削除しますか？')) return;
		const response = await fetch(API + '/entries/' + id, { method: 'DELETE' });
		if (response.ok) {
			modal.hide();
			await loadSchedule();
		}
	}

	function populateSelects() {
		document.getElementById('entryPatient').innerHTML = scheduleData.patients.map(function (resource) {
			return '<option value="' + escapeHtml(resource.id) + '">' + escapeHtml(resource.id + ' ' + resource.name) + '</option>';
		}).join('');
		document.getElementById('entryTherapist').innerHTML = scheduleData.therapists.map(function (resource) {
			return '<option value="' + escapeHtml(resource.id) + '">' + escapeHtml(resource.subLabel + ' ' + resource.name) + '</option>';
		}).join('')+'<option value="UNASSIGNED_PT">PT・担当未定</option><option value="UNASSIGNED_OT">OT・担当未定</option><option value="UNASSIGNED_ST">ST・担当未定</option>';
		document.getElementById('actualTherapist').innerHTML = scheduleData.therapists.map(function (resource) {
			return '<option value="' + escapeHtml(resource.id) + '">' + escapeHtml(resource.subLabel + ' ' + resource.name) + '</option>';
		}).join('');
		const teams=[...new Set(scheduleData.therapists.map(function(r){return r.team;}).filter(Boolean))],wards=[...new Set(scheduleData.patients.map(function(r){return r.ward;}).filter(Boolean))];
		const tf=document.getElementById('teamFilter'),wf=document.getElementById('wardFilter'),tv=tf.value,wv=wf.value;
		tf.innerHTML='<option value="">全チーム</option>'+teams.map(function(v){return'<option>'+escapeHtml(v)+'</option>';}).join('');wf.innerHTML='<option value="">全病棟</option>'+wards.map(function(v){return'<option>'+escapeHtml(v)+'</option>';}).join('');tf.value=tv;wf.value=wv;
	}

	function populateOrcaCodes(preferredCode) {
		const select = document.getElementById('entryOrcaCode');
		const keepCode = preferredCode === undefined ? select.value : preferredCode;
		const role = selectedTherapistRole();
		const items = (scheduleData.orcaMasters || []).filter(function (item) { return item.therapistRole === role; });
		select.innerHTML = '<option value="">診療行為コードを選択してください</option>' + items.map(function (item) {
			return '<option value="' + escapeHtml(item.code) + '">' + escapeHtml(item.sectionCode + ' ' + item.name + ' / ' + item.code + ' / ' + item.pointsPerUnit + '点') + '</option>';
		}).join('');
		if (items.some(function (item) { return item.code === keepCode; })) select.value = keepCode;
		document.getElementById('orcaMasterVersion').textContent = scheduleData.billingMasterVersion || '現行マスター';
		updateOrcaBillingSummary();
	}

	function selectedTherapistRole() {
		const therapistId = document.getElementById('entryTherapist').value;
		if (therapistId.indexOf('UNASSIGNED_') === 0) return therapistId.replace('UNASSIGNED_', '');
		const therapist = (scheduleData.therapists || []).find(function (item) { return item.id === therapistId; });
		return therapist ? therapist.subLabel : '';
	}

	function updateOrcaBillingSummary() {
		const code = document.getElementById('entryOrcaCode').value;
		const item = (scheduleData.orcaMasters || []).find(function (candidate) { return candidate.code === code; });
		const units = Number(document.getElementById('entryUnits').value || 0);
		document.getElementById('orcaSelectedCode').textContent = item ? item.code : '未選択';
		document.getElementById('orcaUnitPoints').textContent = item ? Number(item.pointsPerUnit).toLocaleString('ja-JP') + '点' : '—';
		document.getElementById('orcaTotalPoints').textContent = item ? Number(item.pointsPerUnit * units).toLocaleString('ja-JP') + '点' : '—';
		document.getElementById('orcaSelectionMode').textContent = item ? (billingManualOverride ? '手動選択' : '自動選択') : '自動候補なし';
		document.getElementById('orcaSelectionReason').textContent = billingSelectionReason || (item ? 'リハビリ内容・疾患別リハ情報・療法士職種を参照しました。' : '内容を入力すると候補を計算します。');
	}

	function renderQuickPanels(){const queue=scheduleData.unassignedEntries||[];document.getElementById('unassignedCount').textContent=queue.length+'件';document.getElementById('unassignedQueue').innerHTML=queue.map(function(e){return'<button type="button" data-unassigned-id="'+e.id+'"><strong>('+escapeHtml(e.requiredRole||'')+') '+escapeHtml(e.patientName)+'</strong><span>'+escapeHtml(e.preferredPeriod||e.startTime)+'・'+e.units+'単位</span></button>';}).join('')||'<span class="quick-empty">未配置予約はありません</span>';document.querySelectorAll('[data-unassigned-id]').forEach(function(b){b.addEventListener('click',function(){openEditor(findEntry(b.dataset.unassignedId));});});const candidates=scheduleData.entries.filter(function(e){return e.status==='予約'&&!e.unassigned;});document.getElementById('bulkActualList').innerHTML=candidates.slice(0,100).map(function(e){return'<label><input type="checkbox" value="'+e.id+'"/> '+escapeHtml(e.startTime+' '+e.patientName+' / '+e.therapistName)+'</label>';}).join('')||'<span class="quick-empty">対象予約はありません</span>';}

	async function bulkComplete(){const ids=Array.from(document.querySelectorAll('#bulkActualList input:checked')).map(function(e){return Number(e.value);});if(!ids.length){alert('実施済みにする予約を選択してください。');return;}const r=await fetch(API+'/bulk-complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:ids})}),d=await r.json();if(!r.ok||!d.success){alert(d.message||'一括登録できませんでした。');return;}await loadSchedule();}

	async function copySchedule(){const source=document.getElementById('scheduleDate').value,start=prompt('コピー先の開始日を入力してください（YYYY-MM-DD）',source),end=start&&prompt('コピー先の終了日を入力してください（YYYY-MM-DD）',start);if(!start||!end)return;const dates=[];for(let d=new Date(start+'T12:00:00'),last=new Date(end+'T12:00:00');d<=last;d.setDate(d.getDate()+1)){if(d.getDay()!==0&&d.getDay()!==6)dates.push(localDateString(d));}const r=await fetch(API+'/copy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sourceDate:source,targetDates:dates})}),data=await r.json();alert((data.copied||0)+'件コピー、'+(data.skipped||0)+'件除外');await loadSchedule();}

	function switchView(view) {
		currentView = view;
		document.getElementById('therapistView').classList.toggle('active', view === 'therapist');
		document.getElementById('patientView').classList.toggle('active', view === 'patient');
		render();
	}

	function changeDate(delta, today) {
		const input = document.getElementById('scheduleDate');
		const date = today ? new Date() : new Date(input.value + 'T12:00:00');
		if (!today) date.setDate(date.getDate() + delta);
		input.value = localDateString(date);
		loadSchedule();
	}

	function findEntry(id) {
		return scheduleData.entries.find(function (entry) { return String(entry.id) === String(id); }) || {};
	}

	function updateScheduleTimePreview() {
		const startValue = document.getElementById('entryStart').value;
		const units = Number(document.getElementById('entryUnits').value || 0);
		const output = document.getElementById('entryEndPreview');
		const panel = document.getElementById('scheduleTimePreview');
		if (!startValue || !units) { output.textContent = '—'; panel.classList.remove('adjusted'); return; }
		const adjusted = adjustedTime(startValue, units);
		output.textContent = adjusted.start + '～' + adjusted.end + (adjusted.start !== startValue ? '（2分空きへ自動調整）' : '（前後2分を確保）');
		panel.classList.toggle('adjusted', adjusted.start !== startValue);
	}

	function adjustedTime(startValue, units) {
		let start = timeToMinutes(startValue), duration = units * SLOT_MINUTES;
		const date = document.getElementById('entryDate').value;
		const therapistId = document.getElementById('entryTherapist').value;
		const patientId = document.getElementById('entryPatient').value;
		const editingId = document.getElementById('entryId').value;
		const gap = Number(scheduleData.minimumGapMinutes || 2);
		const related = (scheduleData.entries || []).filter(function(entry){return entry.date===date&&String(entry.id)!==String(editingId)&&(entry.therapistId===therapistId||entry.patientId===patientId);}).sort(function(a,b){return a.startTime.localeCompare(b.startTime)||Number(a.id)-Number(b.id);});
		let moved, guard=0;
		do { moved=false; related.forEach(function(entry){const existingStart=timeToMinutes(entry.startTime),existingEnd=timeToMinutes(entry.endTime);if(start+duration+gap<=existingStart||start>=existingEnd+gap)return;start=existingEnd+gap;moved=true;}); } while(moved&&++guard<=related.length+1);
		return {start:minutesToTime(start),end:minutesToTime(start+duration)};
	}

	function showScheduleNotice(text) { const notice=document.getElementById('scheduleNotice');notice.textContent=text;notice.classList.toggle('d-none',!text); }

	function timeToMinutes(value) { const parts = value.split(':'); return Number(parts[0]) * 60 + Number(parts[1]); }
	function minutesToTime(value) { const hours = Math.floor(value / 60); const minutes = value % 60; return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0'); }
	function addMinutes(value, amount) { return minutesToTime(timeToMinutes(value) + amount); }
	function localDateString(date) { return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0'); }
	function escapeHtml(value) { return String(value == null ? '' : value).replace(/[&<>'"]/g, function (char) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]; }); }
}());
