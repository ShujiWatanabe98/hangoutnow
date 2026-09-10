(function () {
	'use strict';
	const API = '/rehainfo-main/therapists/api';
	let therapists = [];
	let modal;

	document.addEventListener('DOMContentLoaded', function () {
		modal = new bootstrap.Modal(document.getElementById('therapistModal'));
		document.getElementById('targetMonth').value = currentMonth();
		document.getElementById('addTherapistButton').addEventListener('click', openEditor);
		document.getElementById('saveTherapistButton').addEventListener('click', saveTherapist);
		document.getElementById('therapistSearch').addEventListener('input', render);
		document.getElementById('targetMonth').addEventListener('change', loadTherapists);
		document.getElementById('therapistTableBody').addEventListener('click', function (event) {
			const button = event.target.closest('.target-save-button');
			if (button) saveMonthlyTarget(button.dataset.therapistId);
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
			body.innerHTML = '<tr><td class="directory-empty" colspan="8">該当する療法士がいません</td></tr>';
			return;
		}
		body.innerHTML = filtered.map(function (item) {
			return '<tr><td><strong>' + escapeHtml(item.id) + '</strong></td><td>' + escapeHtml(item.name)
				+ '</td><td>' + escapeHtml(item.nameKana || '-') + '</td><td><span class="role-badge">' + escapeHtml(item.subLabel)
				+ '</span></td><td>' + escapeHtml(item.employmentType || '-') + '</td><td><div class="monthly-target-editor"><input class="monthly-target-input" type="number" min="0" max="9999" step="1" value="' + escapeHtml(item.monthlyTargetUnits == null ? 0 : item.monthlyTargetUnits) + '" aria-label="' + escapeHtml(item.name) + 'の月の目標単位" data-therapist-id="' + escapeHtml(item.id) + '" /><span>単位</span><button class="target-save-button" type="button" data-therapist-id="' + escapeHtml(item.id) + '">保存</button></div></td><td>' + escapeHtml(item.phone || '-')
				+ '</td><td>' + escapeHtml(item.email || '-') + '</td></tr>';
		}).join('');
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

	function cssEscape(value) {
		return String(value).replace(/(["\\])/g, '\\$1');
	}

	function escapeHtml(value) {
		return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
		});
	}
})();
