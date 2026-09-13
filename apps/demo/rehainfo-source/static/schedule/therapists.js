(function () {
	'use strict';
	const API = '/rehainfo/therapists/api';
	let therapists = [];
	let modal;
	let assignedPatientsModal;
	let activeTherapistId = '';
	let patientLists = { reservation: [], noReservation: [], candidates: [] };
	let expandedPatientLists = { reservation: false, noReservation: false, candidates: false };
	const INITIAL_PATIENT_ROWS = 5;

	document.addEventListener('DOMContentLoaded', function () {
		modal = new bootstrap.Modal(document.getElementById('therapistModal'));
		assignedPatientsModal = new bootstrap.Modal(document.getElementById('assignedPatientsModal'));
		document.getElementById('targetMonth').value = currentMonth();
		document.getElementById('addTherapistButton').addEventListener('click', openEditor);
		document.getElementById('saveTherapistButton').addEventListener('click', saveTherapist);
		document.getElementById('therapistSearch').addEventListener('input', render);
		document.getElementById('targetMonth').addEventListener('change', loadTherapists);
		document.getElementById('therapistTableBody').addEventListener('click', function (event) {
			const targetButton = event.target.closest('.target-save-button');
			if (targetButton) saveMonthlyTarget(targetButton.dataset.therapistId);
			const patientsButton = event.target.closest('.assigned-patients-button');
			if (patientsButton) loadAssignedPatients(patientsButton.dataset.therapistId);
		});
		document.getElementById('assignedPatientsModal').addEventListener('click', function (event) {
			const assignButton = event.target.closest('.assign-patient-button');
			if (assignButton) assignPatient(assignButton);
			const toggleButton = event.target.closest('.patient-list-toggle');
			if (toggleButton) togglePatientList(toggleButton.dataset.section);
		});
		loadTherapists();
	});

	async function loadTherapists() {
		try {
			const month = document.getElementById('targetMonth').value || currentMonth();
			const response = await fetch(API + '?month=' + encodeURIComponent(month));
			if (!response.ok) throw new Error('療法士一覧を取得できませんでした。');
			const data = await response.json();
			therapists = data.therapists || [];
			document.getElementById('therapistCount').textContent = therapists.length;
			render();
		} catch (error) { showAlert(error.message, false); }
	}

	function render() {
		const query = document.getElementById('therapistSearch').value.trim().toLowerCase();
		const filtered = therapists.filter(function (item) {
			return [item.id, item.name, item.nameKana, item.subLabel].join(' ').toLowerCase().indexOf(query) >= 0;
		});
		const body = document.getElementById('therapistTableBody');
		if (!filtered.length) {
			body.innerHTML = '<tr><td class="directory-empty" colspan="9">該当する療法士がいません</td></tr>';
			return;
		}
		body.innerHTML = filtered.map(function (item) {
			return '<tr><td><strong>' + escapeHtml(item.id) + '</strong></td><td>' + escapeHtml(item.name)
				+ '</td><td>' + escapeHtml(item.nameKana || '-') + '</td><td><span class="role-badge">' + escapeHtml(item.subLabel)
				+ '</span></td><td>' + escapeHtml(item.employmentType || '-') + '</td><td><div class="monthly-target-editor"><input class="monthly-target-input" type="number" min="0" max="9999" step="1" value="' + escapeHtml(item.monthlyTargetUnits == null ? 0 : item.monthlyTargetUnits) + '" aria-label="' + escapeHtml(item.name) + 'の月の目標単位" data-therapist-id="' + escapeHtml(item.id) + '" /><span>単位</span><button class="target-save-button" type="button" data-therapist-id="' + escapeHtml(item.id) + '">保存</button></div></td><td>' + escapeHtml(item.phone || '-')
				+ '</td><td>' + escapeHtml(item.email || '-') + '</td><td><button class="assigned-patients-button" type="button" data-therapist-id="' + escapeHtml(item.id) + '"><i class="bi bi-people"></i> 担当患者</button></td></tr>';
		}).join('');
	}

	async function loadAssignedPatients(therapistId) {
		const therapist = therapists.find(function (item) { return item.id === therapistId; });
		const title = document.getElementById('assignedPatientsModalTitle');
		const summary = document.getElementById('assignedPatientsSummary');
		const body = document.getElementById('assignedPatientsTableBody');
		const assignedBody = document.getElementById('assignedWithoutReservationsBody');
		const unassignedBody = document.getElementById('unassignedPatientsBody');
		activeTherapistId = therapistId;
		expandedPatientLists = { reservation: false, noReservation: false, candidates: false };
		title.textContent = (therapist ? therapist.name : therapistId) + ' の担当患者';
		summary.textContent = '読み込み中です…';
		body.innerHTML = '<tr><td class="directory-empty" colspan="8">担当患者を読み込んでいます</td></tr>';
		assignedBody.innerHTML = '<tr><td class="directory-empty" colspan="4">読み込み中です</td></tr>';
		unassignedBody.innerHTML = '<tr><td class="directory-empty" colspan="6">読み込み中です</td></tr>';
		assignedPatientsModal.show();
		try {
			const response = await fetch(API + '/assigned-patients?therapistId=' + encodeURIComponent(therapistId));
			const data = await response.json();
			if (!response.ok || !data.success) throw new Error(data.message || '担当患者を取得できませんでした。');
			patientLists.reservation = data.reservationPatients || data.scheduledPatients || data.patients || [];
			patientLists.noReservation = data.noReservationPatients || data.assignedWithoutReservations || [];
			patientLists.candidates = data.patientCandidates || data.unassignedPatients || [];
			document.getElementById('scheduledPatientsCount').textContent = patientLists.reservation.length + '名';
			document.getElementById('assignedWithoutReservationsCount').textContent = patientLists.noReservation.length + '名';
			document.getElementById('unassignedPatientsCount').textContent = patientLists.candidates.length + '名';
			summary.textContent = patientLists.reservation.length ? '' : '予約がある患者はいません';
			renderPatientLists();
		} catch (error) {
			summary.textContent = error.message;
			body.innerHTML = '<tr><td class="directory-empty" colspan="8">担当患者を表示できませんでした</td></tr>';
			assignedBody.innerHTML = '<tr><td class="directory-empty" colspan="4">表示できませんでした</td></tr>';
			unassignedBody.innerHTML = '<tr><td class="directory-empty" colspan="6">表示できませんでした</td></tr>';
		}
	}

	function renderPatientLists() {
		renderPatientSection('reservation', 'assignedPatientsTableBody', 'reservationPatientsToggle', 8,
			'予約がある患者はいません', reservationPatientRow);
		renderPatientSection('noReservation', 'assignedWithoutReservationsBody', 'noReservationPatientsToggle', 4,
			'予約なしで設定された担当患者はいません', function (patient) { return compactPatientRow(patient, false); });
		renderPatientSection('candidates', 'unassignedPatientsBody', 'patientCandidatesToggle', 6,
			'患者一覧に表示できる患者はいません', candidatePatientRow);
	}

	function renderPatientSection(section, bodyId, toggleId, columnCount, emptyMessage, rowRenderer) {
		const items = patientLists[section] || [];
		const visible = expandedPatientLists[section] ? items : items.slice(0, INITIAL_PATIENT_ROWS);
		document.getElementById(bodyId).innerHTML = items.length
			? visible.map(rowRenderer).join('')
			: '<tr><td class="directory-empty" colspan="' + columnCount + '">' + emptyMessage + '</td></tr>';
		const toggle = document.getElementById(toggleId);
		if (items.length <= INITIAL_PATIENT_ROWS) {
			toggle.classList.add('d-none');
			return;
		}
		const expanded = expandedPatientLists[section];
		toggle.classList.remove('d-none');
		toggle.setAttribute('aria-expanded', String(expanded));
		toggle.innerHTML = expanded
			? '<i class="bi bi-chevron-up"></i><span>5名に戻す</span>'
			: '<i class="bi bi-chevron-down"></i><span>すべて表示（残り' + (items.length - INITIAL_PATIENT_ROWS) + '名）</span>';
	}

	function togglePatientList(section) {
		if (!Object.prototype.hasOwnProperty.call(expandedPatientLists, section)) return;
		expandedPatientLists[section] = !expandedPatientLists[section];
		renderPatientLists();
	}

	function reservationPatientRow(patient) {
		return '<tr><td><strong>' + escapeHtml(patient.patientId) + '</strong></td><td>' + escapeHtml(patient.patientName || '-')
			+ '</td><td>' + escapeHtml(patient.patientCategory || '-') + '</td><td>' + escapeHtml(patient.ward || '-')
			+ '</td><td class="number-cell">' + escapeHtml(patient.appointmentCount) + '件</td><td class="number-cell">' + escapeHtml(patient.totalUnits)
			+ '単位</td><td>' + escapeHtml(formatDate(patient.firstDate)) + '</td><td>' + escapeHtml(formatDate(patient.lastDate)) + '</td></tr>';
	}

	function compactPatientRow(patient, showAction, therapistId) {
		return '<tr><td><strong>' + escapeHtml(patient.patientId) + '</strong></td><td>' + escapeHtml(patient.patientName || '-')
			+ '</td><td>' + escapeHtml(patient.patientCategory || '-') + '</td><td>' + escapeHtml(patient.ward || '-') + '</td>'
			+ (showAction ? '<td><button class="assign-patient-button" type="button" data-therapist-id="' + escapeHtml(therapistId)
				+ '" data-patient-id="' + escapeHtml(patient.patientId) + '">担当にする</button></td>' : '') + '</tr>';
	}

	function candidatePatientRow(patient) {
		return '<tr><td><strong>' + escapeHtml(patient.patientId) + '</strong></td><td>' + escapeHtml(patient.patientName || '-')
			+ '</td><td>' + escapeHtml(patient.patientCategory || '-') + '</td><td>' + escapeHtml(patient.ward || '-')
			+ '</td><td class="candidate-reason">' + escapeHtml(patient.candidateReason || '患者名順') + '</td>'
			+ '<td><button class="assign-patient-button" type="button" data-therapist-id="' + escapeHtml(activeTherapistId)
			+ '" data-patient-id="' + escapeHtml(patient.patientId) + '">担当にする</button></td></tr>';
	}

	async function assignPatient(button) {
		button.disabled = true;
		button.textContent = '設定中…';
		try {
			const response = await fetch(API + '/assigned-patients', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ therapistId: button.dataset.therapistId, patientId: button.dataset.patientId })
			});
			const result = await response.json();
			if (!response.ok || !result.success) throw new Error(result.message || '担当患者に設定できませんでした。');
			showAlert('担当患者に設定しました。', true);
			await loadAssignedPatients(button.dataset.therapistId);
		} catch (error) {
			button.disabled = false;
			button.textContent = '担当にする';
			showAlert(error.message, false);
		}
	}

	async function saveMonthlyTarget(therapistId) {
		const input = document.querySelector('.monthly-target-input[data-therapist-id="' + cssEscape(therapistId) + '"]');
		const targetUnits = Number(input.value);
		const targetMonth = document.getElementById('targetMonth').value;
		if (!Number.isInteger(targetUnits) || targetUnits < 0 || targetUnits > 9999) {
			showAlert('月の目標単位は0～9999単位で入力してください。', false);
			input.focus();
			return;
		}
		try {
			const response = await fetch(API + '/monthly-target', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ therapistId: therapistId, targetMonth: targetMonth, targetUnits: targetUnits })
			});
			const result = await response.json();
			if (!response.ok || !result.success) throw new Error(result.message || '月の目標単位を保存できませんでした。');
			const therapist = therapists.find(function (item) { return item.id === therapistId; });
			if (therapist) therapist.monthlyTargetUnits = targetUnits;
			showAlert(formatMonth(targetMonth) + 'の目標単位を保存しました。', true);
		} catch (error) { showAlert(error.message, false); }
	}

	function openEditor() {
		['therapistId', 'therapistName', 'therapistKana', 'therapistPhone', 'therapistEmail'].forEach(function (id) {
			document.getElementById(id).value = '';
		});
		document.getElementById('therapistRole').value = 'PT';
		document.getElementById('therapistEmployment').value = '常勤';
		document.getElementById('therapistValidation').classList.add('d-none');
		modal.show();
	}

	async function saveTherapist() {
		const therapist = {
			id: document.getElementById('therapistId').value.trim(),
			name: document.getElementById('therapistName').value.trim(),
			nameKana: document.getElementById('therapistKana').value.trim(),
			subLabel: document.getElementById('therapistRole').value,
			employmentType: document.getElementById('therapistEmployment').value,
			phone: document.getElementById('therapistPhone').value.trim(),
			email: document.getElementById('therapistEmail').value.trim()
		};
		try {
			const response = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(therapist) });
			const result = await response.json();
			if (!response.ok || !result.success) throw new Error(result.message || '登録できませんでした。');
			modal.hide();
			await loadTherapists();
			showAlert('療法士を登録しました。', true);
		} catch (error) {
			const validation = document.getElementById('therapistValidation');
			validation.textContent = error.message;
			validation.classList.remove('d-none');
		}
	}

	function showAlert(message, success) {
		const alert = document.getElementById('therapistAlert');
		alert.textContent = message;
		alert.classList.remove('d-none');
		alert.style.borderLeftColor = success ? '#248260' : '#b42318';
	}

	function currentMonth() {
		const now = new Date();
		return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
	}

	function formatMonth(value) {
		const parts = value.split('-');
		return parts[0] + '年' + parts[1] + '月';
	}

	function formatDate(value) {
		if (!value) return '-';
		const parts = value.split('-');
		return parts[0] + '/' + parts[1] + '/' + parts[2];
	}

	function cssEscape(value) {
		return String(value).replace(/(["\\])/g, '\\$1');
	}

	function escapeHtml(value) {
		return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
		});
	}
})();
