const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const DEMOS = window.OYANOTE_DEMOS;
const clone = value => JSON.parse(JSON.stringify(value));

function readDemoState(id) {
  const seed = clone(DEMOS[id]);
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(`oyanote-demo-state-${id}`) || 'null'); } catch {}
  return {
    ...seed,
    ...(saved || {}),
    mother: { ...seed.mother, ...(saved?.mother || {}) },
    demoId: id,
    filter: 'all',
    shareSource: 'family',
    listening: false,
    recognition: null,
    quickRecognition: null,
    quickListening: false,
    seconds: 0,
    timer: null
  };
}

const storedDemoId = localStorage.getItem('oyanote-active-demo');
const state = readDemoState(DEMOS[storedDemoId] ? storedDemoId : 'demo1');

function save() {
  const persisted = {
    mother: state.mother,
    schedules: state.schedules,
    shopping: state.shopping,
    timeline: state.timeline,
    incomingShares: state.incomingShares,
    members: state.members,
    events: state.events,
    motherUpdates: state.motherUpdates,
    calendarMonth: state.calendarMonth,
    selectedDate: state.selectedDate
  };
  localStorage.setItem(`oyanote-demo-state-${state.demoId}`, JSON.stringify(persisted));
  localStorage.setItem('oyanote-active-demo', state.demoId);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function applySpeechCommands(value) {
  return String(value ?? '').replace(/[ 　]*改行[。．、,]?[ 　]*/g, '\n');
}

function toast(message) {
  const node = $('#toast'); node.textContent = message; node.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove('show'), 2400);
}

function navigate(name) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.dataset.screen === name));
  $$('.bottom-nav [data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === name));
  scrollTo({ top: 0, behavior: 'smooth' });
}

function currentRecorderName() {
  return state.members.find(member => member.type === 'family' && member.role.includes('管理者'))?.name || state.members.find(member => member.type === 'family')?.name || 'あなた';
}

function renderHome() {
  const person = state.mother;
  document.body.dataset.demoTheme = state.theme;
  $('#homePatientHeading').textContent = `今日の${person.firstName}さんの様子`;
  $('#patientAvatar').src = person.photo;
  $('#patientAvatar').alt = `${person.name}さん`;
  $('#patientAvatarButton').title = `${person.name}さんを表示中`;
  $('#quickUpdateInput').placeholder = `${person.firstName}さんの様子を入力`;
  $('#quickUpdateInput').setAttribute('aria-label', `今日の${person.firstName}さんの様子を入力`);
  $('#quickUpdateMic').setAttribute('aria-label', `音声で${person.firstName}さんの様子を記録`);
  $('#recordSubject').textContent = `${person.firstName}さんについて記録`;
  $('#patientStory').innerHTML = `
    <img src="${escapeHtml(person.photo)}" alt="${escapeHtml(person.name)}さんの架空ペルソナ画像">
    <div class="patient-story-body">
      <div class="patient-story-status"><span>${escapeHtml(person.sinceDischarge)}</span><span>${escapeHtml(person.careLevel)}</span></div>
      <h3>${escapeHtml(person.name)}さん <small>${escapeHtml(person.age)}歳</small></h3>
      <p class="patient-diagnosis">${escapeHtml(person.diagnosis)} ／ ${escapeHtml(person.living)}</p>
      <p>${escapeHtml(person.story)}</p>
      <dl><div><dt>本人の目標</dt><dd>${escapeHtml(person.goal)}</dd></div><div><dt>介護施設</dt><dd>${escapeHtml(person.facility)}</dd></div><div><dt>病院</dt><dd>${escapeHtml(person.hospital)}</dd></div></dl>
    </div>`;
  const colors = { care: 'green', family: 'orange', hospital: 'blue' };
  $('#todaySchedule').innerHTML = state.schedules.map(item => `
    <article class="schedule-card accent-${colors[item.type] || 'green'}">
      <div class="time-tile"><strong>${escapeHtml(item.time)}</strong><small>から</small></div>
      <div class="grow"><span class="tag ${colors[item.type] || 'green'}">${escapeHtml(item.tag)}</span><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.note)}</p></div>
      ${item.owner ? `<span class="person">${escapeHtml(item.owner)}</span>` : ''}
    </article>`).join('');
  $$('[data-demo]').forEach(button => {
    const active = button.dataset.demo === state.demoId;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function renderAll() {
  renderHome();
  renderTimeline();
  renderMotherUpdates();
  renderShopping();
  renderCalendar();
  renderMother();
  renderMembers();
  $$('[data-share-source]').forEach(tab => {
    const active = tab.dataset.shareSource === state.shareSource;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-pressed', String(active));
  });
  $$('[data-filter]').forEach(button => button.classList.toggle('active', button.dataset.filter === state.filter));
}

function switchDemo(id) {
  if (!DEMOS[id] || id === state.demoId) return;
  if (state.listening) stopRecognition();
  if (state.quickListening) state.quickRecognition?.stop();
  Object.assign(state, readDemoState(id));
  localStorage.setItem('oyanote-active-demo', id);
  $('#quickUpdateInput').value = '';
  $('#quickUpdateStatus').textContent = '文字入力はEnterで追加できます';
  renderAll();
  toast(`${DEMOS[id].label}：${state.mother.name}さんに切り替えました`);
}

$$('[data-nav], [data-go]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.nav || button.dataset.go)));
$$('[data-demo]').forEach(button => button.addEventListener('click', () => switchDemo(button.dataset.demo)));

function renderTimeline() {
  const today = new Date();
  const dateText = date => `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  const items = state.shareSource === 'family'
    ? state.timeline
    : state.incomingShares.filter(item => item.source === state.shareSource);
  $('#timeline').innerHTML = items.map(item => {
    const legacyYesterday = String(item.time).startsWith('昨日');
    const fallbackDate = new Date(today);
    if (legacyYesterday) fallbackDate.setDate(fallbackDate.getDate() - 1);
    const displayDate = item.date || dateText(fallbackDate);
    const displayTime = String(item.time).replace(/^昨日\s*/, '');
    const displayTitle = /^あなたが.*共有$/.test(item.title) ? currentRecorderName() : item.title;
    return `<article class="timeline-card"><span class="timeline-icon">${item.icon}</span><strong>${escapeHtml(displayTitle)}</strong><p>${escapeHtml(item.text)}</p><div class="timeline-date"><span>📅 ${escapeHtml(displayDate)}</span><span>${escapeHtml(displayTime)}</span></div></article>`;
  }).join('') || '<p class="empty-shares">この共有元からの連絡はまだありません</p>';
}

$$('[data-share-source]').forEach(button => button.addEventListener('click', () => {
  state.shareSource = button.dataset.shareSource;
  $$('[data-share-source]').forEach(tab => {
    const active = tab === button;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-pressed', String(active));
  });
  renderTimeline();
}));

function renderMotherUpdates() {
  const container = $('#motherUpdates');
  const today = localDateString(new Date());
  const updates = state.motherUpdates.filter(item => item.createdDay === today);
  container.hidden = updates.length === 0;
  container.innerHTML = updates.map(item => `<article class="mother-update"><span>🌿</span><div><strong>${escapeHtml(item.text)}</strong><small>${escapeHtml(item.time)}</small></div><button type="button" data-delete-update="${item.id}" aria-label="患者の様子を削除">削除</button></article>`).join('');
  $$('[data-delete-update]').forEach(button => button.addEventListener('click', () => {
    state.motherUpdates = state.motherUpdates.filter(item => item.id !== Number(button.dataset.deleteUpdate));
    save(); renderMotherUpdates(); toast(`${state.mother.firstName}さんの様子から削除しました`);
  }));
}

function saveQuickUpdate(text) {
  const value = text.trim();
  if (!value) return;
  const now = new Date();
  state.motherUpdates.unshift({id:Date.now(),text:value,createdDay:localDateString(now),time:`${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`});
  save(); renderMotherUpdates(); $('#quickUpdateInput').value='';
  $('#quickUpdateStatus').textContent=`今日の${state.mother.firstName}さんの様子に追加しました`; toast(`${state.mother.firstName}さんの様子に追加しました`);
}

$('#quickUpdateForm').addEventListener('submit', event => {
  event.preventDefault(); saveQuickUpdate($('#quickUpdateInput').value);
});

$('#quickUpdateMic').addEventListener('click', () => {
  if (state.quickListening) {
    state.quickRecognition?.stop();
    return;
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    $('#quickUpdateStatus').textContent='このブラウザは音声入力に未対応です。文字で入力してください';
    $('#quickUpdateInput').focus(); toast('音声入力に対応していません'); return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang='ja-JP'; recognition.continuous=false; recognition.interimResults=true;
  state.quickRecognition=recognition; state.quickListening=true;
  let confirmed='';
  recognition.onresult=event => {
    let interim='';
    for(let index=event.resultIndex;index<event.results.length;index++) {
      if(event.results[index].isFinal) confirmed+=event.results[index][0].transcript;
      else interim+=event.results[index][0].transcript;
    }
    $('#quickUpdateInput').value=(confirmed+interim).trim();
  };
  recognition.onerror=event => {
    $('#quickUpdateStatus').textContent=event.error==='not-allowed'?'マイクの使用を許可してください':'音声を認識できませんでした';
  };
  recognition.onend=() => {
    state.quickListening=false; $('#quickUpdateMic').classList.remove('listening');
    $('#quickUpdateMic').textContent='🎙️';
    if(confirmed.trim()) saveQuickUpdate(confirmed);
    else if($('#quickUpdateStatus').textContent==='聞いています…') $('#quickUpdateStatus').textContent='音声が聞き取れませんでした。もう一度お試しください';
  };
  recognition.start(); $('#quickUpdateMic').classList.add('listening'); $('#quickUpdateMic').textContent='■';
  $('#quickUpdateStatus').textContent='聞いています…';
});

function renderShopping() {
  const visible = state.shopping.filter(item => state.filter === 'all' || (state.filter === 'done' ? item.done : !item.done));
  $('#shoppingList').innerHTML = visible.map(item => `<article class="shopping-item ${item.done ? 'done' : ''}"><input type="checkbox" aria-label="${item.name}を購入済みにする" data-check="${item.id}" ${item.done ? 'checked' : ''}><div><strong>${item.name}</strong><small>${item.detail}</small></div>${item.owner ? `<span class="owner">${item.owner}</span>` : ''}</article>`).join('') || '<p class="support-note">該当する項目はありません</p>';
  const done = state.shopping.filter(item => item.done).length;
  $('#progressText').textContent = `${done} / ${state.shopping.length}`;
  $('#progressBar').style.width = `${state.shopping.length ? done / state.shopping.length * 100 : 0}%`;
  $$('[data-check]').forEach(input => input.addEventListener('change', () => {
    const item = state.shopping.find(x => x.id === Number(input.dataset.check)); item.done = input.checked; save(); renderShopping(); toast(item.done ? '購入済みにしました' : '未購入に戻しました');
  }));
}

$$('[data-filter]').forEach(button => button.addEventListener('click', () => {
  state.filter = button.dataset.filter; $$('[data-filter]').forEach(b => b.classList.toggle('active', b === button)); renderShopping();
}));

function renderCalendar() {
  const [year, month] = state.calendarMonth.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const gridStart = new Date(year, month - 1, 1 - first.getDay());
  $('#monthLabel').textContent = `${year}年 ${month}月`;
  $('#calendarGrid').innerHTML = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart); date.setDate(gridStart.getDate() + index);
    const iso = localDateString(date);
    const dim = date.getMonth() !== month - 1;
    const dayEvents = state.events.filter(event => event.date === iso);
    const care = dayEvents.some(event => event.type === 'care' || event.type === 'hospital');
    const family = dayEvents.some(event => event.type === 'family');
    return `<button class="day ${dim ? 'dim' : ''} ${iso === state.selectedDate ? 'selected' : ''} ${care ? 'has-care' : ''} ${family ? 'has-family' : ''}" data-date="${iso}" aria-label="${date.getMonth() + 1}月${date.getDate()}日">${date.getDate()}</button>`;
  }).join('');
  renderDayEvents();
  $$('.day').forEach(day => day.addEventListener('click', () => {
    state.selectedDate = day.dataset.date;
    state.calendarMonth = state.selectedDate.slice(0, 7);
    renderCalendar();
  }));
}

function localDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function renderDayEvents() {
  const selected = new Date(`${state.selectedDate}T12:00:00`);
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  $('.date-heading').textContent = `${selected.getMonth() + 1}月${selected.getDate()}日（${weekdays[selected.getDay()]}）の予定`;
  const events = state.events.filter(event => event.date === state.selectedDate).sort((a, b) => a.time.localeCompare(b.time));
  $('#dayEvents').innerHTML = events.map(event => `<article class="event-row ${event.type === 'family' ? 'family-event' : event.type === 'hospital' ? 'hospital-event' : ''}"><div class="event-time">${escapeHtml(event.time || '終日')}</div><div><h4>${escapeHtml(event.title)}</h4><p>${escapeHtml([event.owner ? `担当：${event.owner}` : '', event.note].filter(Boolean).join(' ／ '))}</p></div><button type="button" class="event-delete" data-delete-event="${event.id}" aria-label="${escapeHtml(event.title)}を削除">削除</button></article>`).join('') || '<p class="empty-events">この日の予定はありません</p>';
  $$('[data-delete-event]').forEach(button => button.addEventListener('click', () => {
    state.events = state.events.filter(event => event.id !== Number(button.dataset.deleteEvent));
    save(); renderCalendar(); toast('予定を削除しました');
  }));
}

function moveCalendarMonth(offset) {
  const [year, month] = state.calendarMonth.split('-').map(Number);
  const target = new Date(year, month - 1 + offset, 1);
  state.calendarMonth = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
  state.selectedDate = `${state.calendarMonth}-01`;
  renderCalendar();
}

function openSimple(type) {
  const fields = $('#simpleFields');
  if (type === 'shopping') {
    $('#simpleEyebrow').textContent='家族みんなで共有'; $('#simpleTitle').textContent='買い物を追加';
    fields.innerHTML='<label>買うもの<input id="fieldName" required placeholder="例：尿取りパッド"></label><label>数量・メモ<input id="fieldDetail" placeholder="例：夜用・1袋"></label><label>担当<input id="fieldOwner" placeholder="未定でも追加できます"></label>';
  } else if (type === 'event') {
    $('#simpleEyebrow').textContent='介護カレンダー'; $('#simpleTitle').textContent='予定を追加';
    fields.innerHTML='<label>種類<select id="fieldEventType"><option value="care">介護予定</option><option value="family">家族予定</option></select></label><label>予定<input id="fieldName" required placeholder="例：デイケア"></label><label>日時<input id="fieldDetail" type="datetime-local" required></label><label>担当<input id="fieldOwner" placeholder="例：姉"></label><label>メモ<input id="fieldMemo" placeholder="例：帰宅 16:00"></label>';
    $('#fieldDetail').value = `${state.selectedDate}T09:00`;
  } else {
    $('#simpleEyebrow').textContent='患者を支えるチーム'; $('#simpleTitle').textContent='家族を招待';
    fields.innerHTML='<label>名前<input id="fieldName" required placeholder="例：姉"></label><label>メールまたは電話番号<input id="fieldDetail" inputmode="email" placeholder="招待先を入力"></label>';
  }
  $('#simpleDialog').dataset.type=type; $('#simpleDialog').showModal();
}

$('#addShopping').addEventListener('click',()=>openSimple('shopping'));
$('#addEvent').addEventListener('click',()=>openSimple('event'));
$('#inviteButton').addEventListener('click',()=>openMemberEditor());
$('#inviteWide').addEventListener('click',()=>openMemberEditor());
$('#simpleSave').addEventListener('click', event => {
  event.preventDefault(); const name=$('#fieldName').value.trim(); if(!name){toast('内容を入力してください');return;}
  const type=$('#simpleDialog').dataset.type;
  if(type==='shopping'){state.shopping.unshift({id:Date.now(),name,detail:$('#fieldDetail').value||'メモなし',owner:$('#fieldOwner').value,done:false});save();renderShopping();toast('買い物リストに共有しました');}
  else if(type==='event'){
    const dateTime = $('#fieldDetail').value;
    if (!dateTime) { toast('日時を入力してください'); return; }
    const [date, time] = dateTime.split('T');
    state.events.push({id:Date.now(),type:$('#fieldEventType').value,title:name,date,time,owner:$('#fieldOwner').value.trim(),note:$('#fieldMemo').value.trim()});
    state.selectedDate=date; state.calendarMonth=date.slice(0,7); save(); renderCalendar(); toast('家族のカレンダーに共有しました');
  }
  else{toast(`${name}さんへ招待を作成しました`);}
  $('#simpleDialog').close();
});

function openRecorder(context='note') {
  $('#recordDialog').dataset.context=context; $('#transcript').value=''; $('#organizeButton').disabled=true; resetRecorder(); $('#recordDialog').showModal();
}
$('#shareRecord').addEventListener('click',()=>openRecorder('share')); $('#shoppingVoice').addEventListener('click',()=>openRecorder('shopping'));

function resetRecorder(){state.listening=false;state.seconds=0;clearInterval(state.timer);$('#timer').textContent='00:00';$('#wave').classList.remove('listening');$('#recordToggle').classList.remove('recording');$('#recordToggle').textContent='🎙️ 録音をはじめる';$('#recordTitle').textContent='話してください';}
function setTimer(){state.timer=setInterval(()=>{state.seconds++;const m=String(Math.floor(state.seconds/60)).padStart(2,'0'),s=String(state.seconds%60).padStart(2,'0');$('#timer').textContent=`${m}:${s}`},1000)}

function startRecognition(){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SpeechRecognition){$('#speechStatus').textContent='このブラウザは音声認識に未対応です。文字を直接入力できます。';$('#transcript').focus();toast('音声認識に対応するブラウザでお試しください');return;}
  const recognition=new SpeechRecognition(); recognition.lang='ja-JP';recognition.continuous=true;recognition.interimResults=true;state.recognition=recognition;
  let confirmed=$('#transcript').value;
  recognition.onresult=e=>{
    let interim='';
    for(let i=e.resultIndex;i<e.results.length;i++){
      const spokenText=applySpeechCommands(e.results[i][0].transcript).replace(/。/g,'');
      if(e.results[i].isFinal)confirmed+=spokenText;
      else interim+=spokenText;
    }
    $('#transcript').value=(confirmed+interim).replace(/。/g,'');
    $('#organizeButton').disabled=!$('#transcript').value.trim();
  };
  recognition.onerror=e=>{$('#speechStatus').textContent=e.error==='not-allowed'?'マイクの使用を許可してください':`音声認識エラー：${e.error}`;stopRecognition();};
  recognition.onend=()=>{if(state.listening){try{recognition.start()}catch{}}};
  recognition.start();state.listening=true;setTimer();$('#wave').classList.add('listening');$('#recordToggle').classList.add('recording');$('#recordToggle').textContent='■ 録音を終了';$('#recordTitle').textContent='聞いています…';$('#speechStatus').textContent='話した内容をリアルタイムで文字にしています';
}
function stopRecognition(){state.listening=false;state.recognition?.stop();clearInterval(state.timer);$('#wave').classList.remove('listening');$('#recordToggle').classList.remove('recording');$('#recordToggle').textContent='🎙️ 録音を再開';$('#recordTitle').textContent='文字起こしを確認';$('#speechStatus').textContent='誤変換があれば直接修正できます';$('#organizeButton').disabled=!$('#transcript').value.trim();}
$('#recordToggle').addEventListener('click',()=>state.listening?stopRecognition():startRecognition());
$('#transcript').addEventListener('input',()=>$('#organizeButton').disabled=!$('#transcript').value.trim());
$('#recordDialog').addEventListener('close',()=>{if(state.listening)stopRecognition();});
$('#organizeButton').addEventListener('click',async()=>{
  if(state.listening)stopRecognition(); const text=$('#transcript').value.trim();
  if($('#recordDialog').dataset.context==='shopping'){
    text.split(/[、,と\n]/).map(x=>x.trim()).filter(Boolean).forEach(name=>state.shopping.unshift({id:Date.now()+Math.random(),name,detail:'音声から追加',owner:'',done:false}));save();renderShopping();$('#recordDialog').close();navigate('shopping');toast('買い物リストに追加しました');return;
  }
  const button=$('#organizeButton'); button.disabled=true; button.textContent='AIが整理しています…'; $('#organizeStatus').textContent='内容を読み取り、項目ごとに整理しています';
  try {
    const response=await fetch('/api/organize',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({transcript:text})});
    const data=await response.json();
    if(!response.ok) throw new Error(data.error||'整理できませんでした');
    const result=data.result;
    $('#summaryDate').value=result.date||new Date().toISOString().slice(0,10);
    $('#summaryPlace').value=result.place||'';
    $('#summaryContent').value=result.content||text;
    $('#summaryNext').value=result.next||'';
    $('#summaryTodo').value=result.todo||'';
    $('#organizeDialog').dataset.category=result.category||'other';
    $('#organizedBy').textContent=data.mode==='ai'?'AIが整理しました':'端末内で整理しました';
    $('#recordDialog').close();$('#organizeDialog').showModal();
  } catch(error) {
    $('#organizeStatus').textContent=error.message; toast('整理に失敗しました。もう一度お試しください');
  } finally {
    button.textContent='AIで整理する'; button.disabled=!$('#transcript').value.trim();
  }
});
$('#saveSummary').addEventListener('click',event=>{
  event.preventDefault(); const now=new Date(); const content=$('#summaryContent').value.trim();
  state.timeline.unshift({icon:'🏥',title:currentRecorderName(),text:content,date:`${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日`,time:'たった今'});
  if($('#organizeDialog').dataset.category==='condition') state.motherUpdates.unshift({id:Date.now(),text:content,createdDay:localDateString(now),time:`${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`});
  const returnScreen = $('#recordDialog').dataset.context === 'share' ? 'share' : 'home';
  save();renderTimeline();renderMotherUpdates();$('#organizeDialog').close();navigate(returnScreen);toast($('#organizeDialog').dataset.category==='condition'?`${state.mother.firstName}さんの様子に追加しました`:'家族に共有しました');
});

function memberAvatar(member) {
  if (member.type === 'hospital') return '病院';
  if (member.type === 'care') return 'ケア';
  return member.role.includes('姉') ? '姉' : member.role.includes('弟') ? '弟' : member.name.trim().slice(0, 1) || '家';
}

function renderMembers() {
  const renderGroup = type => state.members.filter(member => member.type === type).map(member => `
    <article class="member">
      <span class="member-avatar ${type === 'care' ? 'care' : type === 'hospital' ? 'hospital' : ''}">${escapeHtml(memberAvatar(member))}</span>
      <div><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml([member.role, member.note].filter(Boolean).join('・'))}</small></div>
      <button type="button" class="member-edit" data-edit-member="${member.id}" aria-label="${escapeHtml(member.name)}を編集">編集</button>
    </article>`).join('') || '<p class="empty-members">まだ登録されていません</p>';
  $('#familyList').innerHTML = renderGroup('family');
  $('#hospitalList').innerHTML = renderGroup('hospital');
  $('#careList').innerHTML = renderGroup('care');
  $$('[data-edit-member]').forEach(button => button.addEventListener('click', () => openMemberEditor(Number(button.dataset.editMember))));
}

function renderMother() {
  $('#motherName').textContent = state.mother.name;
  $('#motherDetails').textContent = `${state.mother.age}歳　${state.mother.careLevel}　${state.mother.sinceDischarge}`;
  $('#motherDiagnosis').textContent = `${state.mother.diagnosis} ／ ${state.mother.living}`;
  $('#familyPatientPhoto').src = state.mother.photo;
  $('#familyPatientPhoto').alt = `${state.mother.name}さんの架空ペルソナ画像`;
}

$('#editMother').addEventListener('click', () => {
  $('#motherNameInput').value = state.mother.name;
  $('#motherAgeInput').value = state.mother.age;
  $('#motherCareLevelInput').value = state.mother.careLevel;
  $('#motherDialog').showModal();
  $('#motherNameInput').focus();
});
$('#closeMotherDialog').addEventListener('click', () => $('#motherDialog').close());
$('#motherForm').addEventListener('submit', event => {
  event.preventDefault();
  const name = $('#motherNameInput').value.trim();
  const age = Number($('#motherAgeInput').value);
  const careLevel = $('#motherCareLevelInput').value.trim();
  if (!name || !Number.isInteger(age) || age < 0 || age > 130 || !careLevel) return;
  Object.assign(state.mother, { name, firstName: name.replace(/^[^\s　]+[\s　]+/, ''), age, careLevel });
  save(); renderHome(); renderMother(); $('#motherDialog').close(); toast('患者情報を更新しました');
});

function openMemberEditor(id = null) {
  const member = state.members.find(item => item.id === id);
  $('#memberDialog').dataset.memberId = member ? String(member.id) : '';
  $('#memberDialogTitle').textContent = member ? 'メンバーを編集' : 'メンバーを追加';
  $('#memberType').value = member?.type || 'family';
  $('#memberName').value = member?.name || '';
  $('#memberRole').value = member?.role || '';
  $('#memberContact').value = member?.contact || '';
  $('#memberNote').value = member?.note || '';
  $('#memberDialog').showModal();
  $('#memberName').focus();
}

$('#closeMemberDialog').addEventListener('click', () => $('#memberDialog').close());
$('#memberForm').addEventListener('submit', event => {
  event.preventDefault();
  const id = Number($('#memberDialog').dataset.memberId);
  const values = {
    type: $('#memberType').value,
    name: $('#memberName').value.trim(),
    role: $('#memberRole').value.trim(),
    contact: $('#memberContact').value.trim(),
    note: $('#memberNote').value.trim()
  };
  if (!values.name || !values.role) return;
  const member = state.members.find(item => item.id === id);
  if (member) Object.assign(member, values);
  else state.members.push({ id: Date.now(), ...values });
  save(); renderMembers(); $('#memberDialog').close();
  toast(member ? 'メンバー情報を更新しました' : 'メンバーを追加しました');
});

$('#notifyButton').addEventListener('click',()=>toast('新しい通知はありません'));
$('#patientAvatarButton').addEventListener('click',()=>navigate('family'));
$('#prevMonth').addEventListener('click',()=>moveCalendarMonth(-1));
$('#nextMonth').addEventListener('click',()=>moveCalendarMonth(1));
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
renderAll();
