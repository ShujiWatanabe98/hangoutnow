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
const hazardMapElement = document.querySelector('#hazard-map');
const hazardMapMessage = document.querySelector('#hazard-map-message');
const hazardMapCount = document.querySelector('#hazard-map-count');
let hazardMap = null;
let latestMapReports = [];

function headers(){return {'content-type':'application/json','x-admin-token':tokenInput.value,'x-admin-id':adminIdInput.value.trim()}}
function showError(message){errorMessage.textContent=message;errorMessage.hidden=false}
function clearError(){errorMessage.hidden=true;errorMessage.textContent=''}
function formatDate(value){return new Intl.DateTimeFormat('ja-JP',{dateStyle:'short',timeStyle:'short'}).format(new Date(value))}
function textCell(value){const cell=document.createElement('td');cell.textContent=value;return cell}
function actionButton(label,className,handler){const button=document.createElement('button');button.type='button';button.textContent=label;if(className)button.className=className;button.addEventListener('click',handler);return button}

function validCoordinate(report){
  return Number.isFinite(report.latitude)&&Number.isFinite(report.longitude)&&report.latitude>=-90&&report.latitude<=90&&report.longitude>=-180&&report.longitude<=180;
}

function reportFeatures(reports){
  return {type:'FeatureCollection',features:reports.filter(validCoordinate).map(report=>({type:'Feature',geometry:{type:'Point',coordinates:[report.longitude,report.latitude]},properties:{id:report.id,category:report.category,status:report.status,createdAt:report.createdAt}}))};
}

function popupContent(properties){
  const content=document.createElement('div');content.className='hazard-popup';
  const title=document.createElement('strong');title.textContent=categoryLabels[properties.category]??properties.category;
  const status=document.createElement('span');status.textContent=`状態：${statusLabels[properties.status]??properties.status}`;
  const created=document.createElement('span');created.textContent=`登録：${formatDate(properties.createdAt)}`;
  content.append(title,status,created);return content;
}

function updateMapViewport(reports){
  if(!hazardMap||reports.length===0)return;
  if(reports.length===1){hazardMap.jumpTo({center:[reports[0].longitude,reports[0].latitude],zoom:13});return}
  const bounds=new globalThis.mapboxgl.LngLatBounds();
  for(const report of reports)bounds.extend([report.longitude,report.latitude]);
  hazardMap.fitBounds(bounds,{padding:48,maxZoom:13,duration:0});
}

function updateMapSource(){
  if(!hazardMap||!hazardMap.isStyleLoaded())return;
  const source=hazardMap.getSource('coachgo-database-hazards');
  if(!source)return;
  const validReports=latestMapReports.filter(validCoordinate);
  source.setData(reportFeatures(validReports));
  updateMapViewport(validReports);
  hazardMap.resize();
}

function initializeHazardMap(){
  const mapbox=globalThis.mapboxgl;
  const accessToken=globalThis.COACHGO_CONFIG?.mapboxAccessToken;
  if(!mapbox||typeof accessToken!=='string'||!accessToken.startsWith('pk.')){
    hazardMapElement.hidden=true;
    hazardMapMessage.textContent='地図設定を利用できないため、危険地帯は下の一覧で確認できます。';
    return;
  }
  mapbox.accessToken=accessToken;
  hazardMap=new mapbox.Map({container:hazardMapElement,style:'mapbox://styles/mapbox/streets-v12',center:[138.2529,36.2048],zoom:4.2,attributionControl:true});
  hazardMap.addControl(new mapbox.NavigationControl({showCompass:false}),'top-right');
  hazardMap.on('load',()=>{
    hazardMap.addSource('coachgo-database-hazards',{type:'geojson',data:reportFeatures([])});
    hazardMap.addLayer({id:'coachgo-database-hazards',type:'circle',source:'coachgo-database-hazards',paint:{'circle-radius':['interpolate',['linear'],['zoom'],4,5,12,9],'circle-color':['match',['get','status'],'ACTIVE','#07966f','HIDDEN','#d99b11','DELETED','#c94840','EXPIRED','#758287','#087f71'],'circle-stroke-color':'#ffffff','circle-stroke-width':2,'circle-opacity':0.9}});
    hazardMap.on('mouseenter','coachgo-database-hazards',()=>{hazardMap.getCanvas().style.cursor='pointer'});
    hazardMap.on('mouseleave','coachgo-database-hazards',()=>{hazardMap.getCanvas().style.cursor=''});
    hazardMap.on('click','coachgo-database-hazards',event=>{
      const feature=event.features?.[0];if(!feature)return;
      new mapbox.Popup({offset:12}).setLngLat(feature.geometry.coordinates).setDOMContent(popupContent(feature.properties)).addTo(hazardMap);
    });
    hazardMapMessage.textContent='';
    updateMapSource();
  });
  hazardMap.on('error',()=>{hazardMapMessage.textContent='地図タイルを読み込めませんでした。危険地帯は下の一覧でも確認できます。'});
}

function renderHazardMap(reports){
  latestMapReports=reports;
  const validReports=reports.filter(validCoordinate);
  hazardMapCount.textContent=`${validReports.length}件`;
  if(!hazardMap)initializeHazardMap();else updateMapSource();
}

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
  const data=await response.json();renderSummary(data.summary);renderRows(data.reports);dashboard.hidden=false;renderHazardMap(data.reports);refreshed.textContent=`最終更新：${new Date().toLocaleString('ja-JP')}（最大500件）`;
}

loginForm.addEventListener('submit',event=>{event.preventDefault();void loadReports()});
filter.addEventListener('change',()=>void loadReports());
document.querySelector('#refresh').addEventListener('click',()=>void loadReports());
