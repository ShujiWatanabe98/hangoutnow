const API = '/api/admin/coachgo/reports';
const categoryLabels = {FLOOD:'冠水',ACCIDENT:'事故',ROADWORK:'工事',POLICE:'取り締まり',OBJECT:'落下物',BROKEN_DOWN:'故障車',CONGESTION:'渋滞',ROAD_DAMAGE:'路面損傷',HAIL:'雹',HEAVY_RAIN:'激しい雨',STRONG_WIND:'強風',HEAVY_SNOW:'豪雪・凍結',LOW_VISIBILITY:'視界不良',ANIMAL:'動物',WRONG_WAY:'逆走車',SIGN_ISSUE:'標識注意'};
const statusLabels = {ACTIVE:'公開中',HIDDEN:'非表示',DELETED:'削除済み',EXPIRED:'期限切れ'};
const loginForm = document.querySelector('#admin-login');
const tokenInput = document.querySelector('#admin-token');
const adminIdInput = document.querySelector('#admin-id');
const dashboard = document.querySelector('#dashboard');
const errorMessage = document.querySelector('#error-message');
const filter = document.querySelector('#status-filter');
const rows = document.querySelector('#report-rows');
const summary = document.querySelector('#summary');
const emptyMessage = document.querySelector('#empty-message');
const refreshed = document.querySelector('#last-refreshed');

function headers(){return {'content-type':'application/json','x-admin-token':tokenInput.value,'x-admin-id':adminIdInput.value.trim()}}
function showError(message){errorMessage.textContent=message;errorMessage.hidden=false}
function clearError(){errorMessage.hidden=true;errorMessage.textContent=''}
function formatDate(value){return new Intl.DateTimeFormat('ja-JP',{dateStyle:'short',timeStyle:'short'}).format(new Date(value))}
function textCell(value){const cell=document.createElement('td');cell.textContent=value;return cell}
function actionButton(label,className,handler){const button=document.createElement('button');button.type='button';button.textContent=label;if(className)button.className=className;button.addEventListener('click',handler);return button}

async function updateReport(report,status,label){
  const note=window.prompt(`${label}の理由を入力してください（管理履歴に保存されます）`);
  if(note===null||!note.trim())return;
  if(!window.confirm(`${categoryLabels[report.category]??report.category}の投稿を「${label}」にしますか？`))return;
  clearError();
  const response=await fetch(`${API}/${encodeURIComponent(report.id)}`,{method:'PATCH',headers:headers(),body:JSON.stringify({status,note:note.trim()})});
  if(!response.ok){showError('投稿状態を更新できませんでした。認証と通信状態をご確認ください。');return}
  await loadReports();
}

function renderRows(reports){
  rows.replaceChildren();
  emptyMessage.hidden=reports.length!==0;
  for(const report of reports){
    const row=document.createElement('tr');
    row.append(textCell(categoryLabels[report.category]??report.category));
    const statusCell=document.createElement('td');const badge=document.createElement('span');badge.className=`status ${report.status}`;badge.textContent=statusLabels[report.status]??report.status;statusCell.append(badge);row.append(statusCell);
    row.append(textCell(formatDate(report.createdAt)),textCell(formatDate(report.expiresAt)));
    const location=document.createElement('td');const link=document.createElement('a');link.href=`https://www.google.com/maps?q=${encodeURIComponent(`${report.latitude},${report.longitude}`)}`;link.target='_blank';link.rel='noreferrer';link.textContent=`${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`;location.append(link);row.append(location);
    row.append(textCell(report.moderatedAt?`${formatDate(report.moderatedAt)} / ${report.moderatedBy??'管理者'}\n${report.moderationNote??''}`:'—'));
    const actions=document.createElement('td');actions.className='actions';
    if(report.status!=='HIDDEN'&&report.status!=='DELETED')actions.append(actionButton('非表示','secondary',()=>void updateReport(report,'HIDDEN','非表示')));
    if(report.status!=='ACTIVE')actions.append(actionButton('公開へ戻す','',()=>void updateReport(report,'ACTIVE','公開へ戻す')));
    if(report.status!=='DELETED')actions.append(actionButton('削除','danger',()=>void updateReport(report,'DELETED','削除')));
    row.append(actions);rows.append(row);
  }
}

function renderSummary(data){
  summary.replaceChildren();
  for(const status of ['ACTIVE','HIDDEN','DELETED','EXPIRED']){const card=document.createElement('div');card.className='metric';const label=document.createElement('small');label.textContent=statusLabels[status];const value=document.createElement('strong');value.textContent=String(data[status]??0);card.append(label,value);summary.append(card)}
}

async function loadReports(){
  clearError();
  const query=filter.value?`?status=${encodeURIComponent(filter.value)}`:'';
  const response=await fetch(`${API}${query}`,{headers:headers(),cache:'no-store'});
  if(!response.ok){dashboard.hidden=true;showError(response.status===403?'管理トークンが正しくありません。':'投稿データを取得できませんでした。');return}
  const data=await response.json();renderSummary(data.summary);renderRows(data.reports);dashboard.hidden=false;refreshed.textContent=`最終更新：${new Date().toLocaleString('ja-JP')}（最大500件）`;
}

loginForm.addEventListener('submit',event=>{event.preventDefault();void loadReports()});
filter.addEventListener('change',()=>void loadReports());
document.querySelector('#refresh').addEventListener('click',()=>void loadReports());
