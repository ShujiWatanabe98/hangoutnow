(() => {
  const scheduleGrid = document.getElementById('scheduleGrid');
  const roleFilter = document.getElementById('roleFilter');
  const wardFilter = document.getElementById('wardFilter');
  const activeDate = document.getElementById('activeDate');
  const bookingCount = document.getElementById('bookingCount');
  const unitCount = document.getElementById('unitCount');
  const unassignedCount = document.getElementById('unassignedCount');
  const utilizationRate = document.getElementById('utilizationRate');
  const detailDialog = document.getElementById('detailDialog');
  const bookingDialog = document.getElementById('bookingDialog');
  const aiDialog = document.getElementById('aiDialog');
  const toast = document.getElementById('toast');
  const demoToday = new Date('2026-09-10T12:00:00+09:00');
  let selectedDate = new Date(demoToday);
  let toastTimer;

  const formatDate = (date) => new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Tokyo',
  }).format(date).replace('曜日', '');

  const showToast = (message) => {
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3600);
  };

  const visibleAppointments = () => [...scheduleGrid.querySelectorAll('.appointment:not(.training)')]
    .filter((appointment) => !appointment.classList.contains('is-filtered'));

  const updateSummary = () => {
    const appointments = visibleAppointments();
    const units = appointments.reduce((total, appointment) => total + Number(appointment.dataset.units || 0), 0);
    const remaining = document.querySelectorAll('.unassigned-item:not([hidden])').length;
    bookingCount.textContent = String(appointments.length);
    unitCount.textContent = String(units);
    unassignedCount.textContent = String(remaining);
    utilizationRate.textContent = String(Math.min(96, Math.round((units / 22) * 100)));
  };

  const applyFilters = () => {
    const role = roleFilter.value;
    const ward = wardFilter.value;
    scheduleGrid.querySelectorAll('.appointment').forEach((appointment) => {
      const roleMatches = role === 'all' || appointment.dataset.role === role;
      const wardMatches = ward === 'all' || appointment.dataset.ward === ward || appointment.dataset.ward === 'all';
      appointment.classList.toggle('is-filtered', !(roleMatches && wardMatches));
    });
    scheduleGrid.querySelectorAll('.therapist-head').forEach((heading) => {
      heading.style.opacity = role === 'all' || heading.dataset.role === role ? '1' : '.42';
    });
    updateSummary();
  };

  const openDetail = (appointment) => {
    document.getElementById('detailPatient').textContent = appointment.dataset.patient;
    document.getElementById('detailTime').textContent = `${activeDate.textContent} ${appointment.dataset.time}`;
    document.getElementById('detailTherapist').textContent = appointment.dataset.therapist;
    document.getElementById('detailContext').textContent = `${appointment.dataset.role}・${appointment.dataset.ward === 'all' ? '院内予定' : appointment.dataset.ward}`;
    document.getElementById('detailUnits').textContent = `${appointment.dataset.units}単位`;
    detailDialog.showModal();
  };

  const createAppointment = ({ patient, therapist, time, role, ward, units, proposed = false }) => {
    const slot = scheduleGrid.querySelector(`.slot[data-time="${CSS.escape(time)}"][data-therapist="${CSS.escape(therapist)}"]`);
    if (!slot || slot.querySelector('.appointment')) return false;
    const appointment = document.createElement('button');
    appointment.type = 'button';
    appointment.className = `appointment ${proposed ? 'proposed' : 'booked'}`;
    appointment.dataset.role = role;
    appointment.dataset.ward = ward;
    appointment.dataset.patient = patient;
    appointment.dataset.therapist = therapist;
    appointment.dataset.time = `${time}–${String(Number(time.slice(0, 2))).padStart(2, '0')}:40`;
    appointment.dataset.units = String(units);
    appointment.innerHTML = `<strong>${patient}</strong><span>${proposed ? 'AI配置・承認済み' : '個別リハビリ'}</span><small>${units}単位・${ward}</small>`;
    appointment.addEventListener('click', () => openDetail(appointment));
    slot.append(appointment);
    applyFilters();
    return true;
  };

  scheduleGrid.querySelectorAll('.appointment').forEach((appointment) => {
    appointment.addEventListener('click', () => openDetail(appointment));
  });
  roleFilter.addEventListener('change', applyFilters);
  wardFilter.addEventListener('change', applyFilters);

  const setDate = (offset) => {
    selectedDate = new Date(selectedDate.getTime() + offset * 86400000);
    activeDate.textContent = formatDate(selectedDate);
    showToast(offset === 0 ? '今日のスケジュールを表示しています。' : `${activeDate.textContent}のデモ表示に切り替えました。`);
  };
  document.getElementById('previousDay').addEventListener('click', () => setDate(-1));
  document.getElementById('nextDay').addEventListener('click', () => setDate(1));
  document.getElementById('todayButton').addEventListener('click', () => {
    selectedDate = new Date(demoToday);
    activeDate.textContent = formatDate(selectedDate);
    showToast('今日のスケジュールを表示しています。');
  });

  document.querySelectorAll('.view-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.view-tab').forEach((item) => {
        const active = item === tab;
        item.classList.toggle('active', active);
        item.setAttribute('aria-selected', String(active));
      });
      const isDay = tab.dataset.view === 'day';
      document.getElementById('dayView').hidden = !isDay;
      document.getElementById('weekView').hidden = isDay;
    });
  });

  document.getElementById('newBookingButton').addEventListener('click', () => {
    document.getElementById('bookingError').hidden = true;
    bookingDialog.showModal();
  });
  document.getElementById('aiScheduleButton').addEventListener('click', () => aiDialog.showModal());
  document.querySelectorAll('.assign-button').forEach((button) => button.addEventListener('click', () => aiDialog.showModal()));
  document.querySelectorAll('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => document.getElementById(button.dataset.closeDialog).close());
  });

  document.getElementById('bookingForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const patient = document.getElementById('bookingPatient').value.trim();
    const therapist = document.getElementById('bookingTherapist').value;
    const time = document.getElementById('bookingTime').value;
    const units = Number(document.getElementById('bookingUnits').value);
    const context = therapist.startsWith('佐藤') ? ['PT', '回復期A'] : therapist.startsWith('中村') ? ['OT', '回復期B'] : ['ST', '一般'];
    const error = document.getElementById('bookingError');
    if (!createAppointment({ patient, therapist, time, role: context[0], ward: context[1], units })) {
      error.textContent = 'この時間帯には既存予定があります。空き枠を選択してください。';
      error.hidden = false;
      return;
    }
    bookingDialog.close();
    showToast(`${patient}を${therapist}の${time}へ予約しました。重複はありません。`);
  });

  document.querySelectorAll('.adopt-button').forEach((button) => {
    button.addEventListener('click', () => {
      const proposal = button.closest('.proposal');
      const accepted = createAppointment({
        patient: proposal.dataset.patient,
        therapist: proposal.dataset.therapist,
        time: proposal.dataset.time,
        role: proposal.dataset.role,
        ward: proposal.dataset.ward,
        units: Number(proposal.dataset.units),
        proposed: true,
      });
      if (!accepted) {
        showToast('既存予定があるため、この候補は反映できませんでした。');
        return;
      }
      const unassigned = document.querySelector(`.unassigned-item[data-patient="${proposal.dataset.patient}"]`);
      if (unassigned) unassigned.hidden = true;
      button.textContent = '承認済み';
      button.disabled = true;
      updateSummary();
      showToast(`${proposal.dataset.patient}の配置を承認し、スケジュールへ反映しました。`);
    });
  });

  activeDate.textContent = formatDate(selectedDate);
  applyFilters();
})();
