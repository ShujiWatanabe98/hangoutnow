(function(){
  'use strict';

  var patients=[
    {id:'DEMO260901',name:'佐藤 和子',kana:'サトウ カズコ',gender:'女性',birth:'1948/04/12',age:'78',rehabClass:'脳血管（Ⅰ）',startDate:'2026/08/15',entryExit:'入院',ward:'回復期3階A',institution:'公開デモ病院',assigned:true},
    {id:'DEMO260902',name:'鈴木 正一',kana:'スズキ ショウイチ',gender:'男性',birth:'1951/09/03',age:'75',rehabClass:'運動器（Ⅰ）',startDate:'2026/08/20',entryExit:'入院',ward:'回復期2階B',institution:'公開デモ病院',assigned:true},
    {id:'DEMO260903',name:'高橋 幸子',kana:'タカハシ サチコ',gender:'女性',birth:'1955/02/28',age:'71',rehabClass:'脳血管（Ⅰ）',startDate:'2026/08/18',entryExit:'入院',ward:'整形外科4階',institution:'公開デモ病院',assigned:true},
    {id:'DEMO260904',name:'田中 博',kana:'タナカ ヒロシ',gender:'男性',birth:'1958/06/17',age:'68',rehabClass:'脳血管（Ⅰ）',startDate:'2019/05/10',entryExit:'入院',ward:'神経内科5階',institution:'公開デモ病院',assigned:true},
    {id:'DEMO260905',name:'伊藤 洋子',kana:'イトウ ヨウコ',gender:'女性',birth:'1962/11/09',age:'63',rehabClass:'運動器（Ⅰ）',startDate:'2026/08/24',entryExit:'入院',ward:'回復期2階A',institution:'公開デモ病院',assigned:true},
    {id:'DEMO260906',name:'渡辺 清',kana:'ワタナベ キヨシ',gender:'男性',birth:'1966/03/21',age:'60',rehabClass:'心大血管（Ⅰ）',startDate:'2026/08/28',entryExit:'入院',ward:'循環器6階',institution:'公開デモ病院',assigned:true},
    {id:'DEMO260907',name:'山本 恵子',kana:'ヤマモト ケイコ',gender:'女性',birth:'1970/08/14',age:'56',rehabClass:'呼吸器（Ⅰ）',startDate:'2026/08/31',entryExit:'入院',ward:'呼吸器5階',institution:'公開デモ病院',assigned:true},
    {id:'DEMO260908',name:'中村 隆',kana:'ナカムラ タカシ',gender:'男性',birth:'1974/12/05',age:'51',rehabClass:'脳血管（Ⅰ）',startDate:'2026/07/20',entryExit:'入院',ward:'回復期3階B',institution:'公開デモ病院',assigned:false},
    {id:'DEMO260909',name:'小林 久美子',kana:'コバヤシ クミコ',gender:'女性',birth:'1978/05/26',age:'48',rehabClass:'廃用症候群（Ⅰ）',startDate:'2026/07/28',entryExit:'退院',ward:'外科4階',institution:'公開デモ病院',assigned:false},
    {id:'DEMO260910',name:'加藤 一郎',kana:'カトウ イチロウ',gender:'男性',birth:'1983/10/18',age:'42',rehabClass:'運動器（Ⅰ）',startDate:'2026/06/12',entryExit:'入院',ward:'回復期2階B',institution:'公開デモ病院',assigned:true}
  ];

  var rows=document.getElementById('patientListRows');
  var empty=document.getElementById('patientListEmpty');
  var notice=document.getElementById('patientListNotice');
  var nameInput=document.getElementById('condition_patientName');
  var idInput=document.getElementById('condition_patientId');
  var assignedOnly=document.getElementById('radio_api');
  var additionalSelect=document.getElementById('select_additional');
  var additionalRow=document.getElementById('additionalCondition');
  var additionalLabel=document.getElementById('additionalConditionLabel');
  var additionalInput=document.getElementById('additionalConditionValue');
  var detailModal=new bootstrap.Modal(document.getElementById('patientDetailModal'));

  function escapeHtml(value){return String(value).replace(/[&<>"']/g,function(character){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];});}
  function normalized(value){return String(value||'').trim().toLocaleUpperCase('ja-JP');}
  function matches(patient){
    if(assignedOnly.checked&&!patient.assigned)return false;
    if(nameInput.value&&!normalized(patient.kana).includes(normalized(nameInput.value)))return false;
    if(idInput.value&&!normalized(patient.id).includes(normalized(idInput.value)))return false;
    if(additionalSelect.value&&additionalInput.value&&!normalized(patient[additionalSelect.value]).includes(normalized(additionalInput.value)))return false;
    return true;
  }
  function render(){
    var visible=patients.filter(matches);
    rows.innerHTML=visible.map(function(patient){return '<tr data-patient-id="'+escapeHtml(patient.id)+'"><td class="patient-id">'+escapeHtml(patient.id)+'</td><td><span class="patient-name">'+escapeHtml(patient.name)+'</span><span class="patient-kana">'+escapeHtml(patient.kana)+'</span></td><td>'+escapeHtml(patient.gender)+'</td><td>'+escapeHtml(patient.birth)+'</td><td>'+escapeHtml(patient.age)+'歳</td><td>'+escapeHtml(patient.rehabClass)+'</td><td>'+escapeHtml(patient.startDate)+'</td><td>'+escapeHtml(patient.entryExit)+'</td><td>'+escapeHtml(patient.ward)+'</td><td><button type="button" class="btn btn-sm patient-row-action" data-detail="'+escapeHtml(patient.id)+'">選択</button></td></tr>';}).join('');
    empty.hidden=visible.length!==0;
    notice.textContent=visible.length+'件を表示しています。';
  }
  function showPatient(patient){
    document.getElementById('patientDetailTitle').textContent=patient.name+' さん';
    document.getElementById('patientDetailBody').innerHTML='<dl class="patient-detail-grid"><dt>患者ID</dt><dd>'+escapeHtml(patient.id)+'</dd><dt>氏名（カナ）</dt><dd>'+escapeHtml(patient.kana)+'</dd><dt>入外区分</dt><dd>'+escapeHtml(patient.entryExit)+'</dd><dt>病棟名</dt><dd>'+escapeHtml(patient.ward)+'</dd><dt>リハビリ区分</dt><dd>'+escapeHtml(patient.rehabClass)+'</dd></dl><p class="text-secondary mt-3 mb-0">公開デモの架空患者です。実在の患者情報ではありません。</p>';
    detailModal.show();
  }

  [nameInput,idInput,additionalInput].forEach(function(input){input.addEventListener('input',render);});
  assignedOnly.addEventListener('change',render);
  additionalSelect.addEventListener('change',function(){
    additionalRow.hidden=!additionalSelect.value;
    additionalInput.value='';
    additionalLabel.textContent=additionalSelect.options[additionalSelect.selectedIndex].text;
    render();
    if(additionalSelect.value)additionalInput.focus();
  });
  rows.addEventListener('click',function(event){
    var target=event.target.closest('[data-detail],tr[data-patient-id]');
    if(!target)return;
    var id=target.getAttribute('data-detail')||target.getAttribute('data-patient-id');
    var patient=patients.find(function(item){return item.id===id;});
    if(patient)showPatient(patient);
  });
  document.querySelectorAll('[data-demo-action]').forEach(function(button){button.addEventListener('click',function(event){event.preventDefault();notice.textContent=button.getAttribute('data-demo-action')+'は公開デモでは患者情報を送信せず、画面確認のみ利用できます。';});});
  render();
})();
