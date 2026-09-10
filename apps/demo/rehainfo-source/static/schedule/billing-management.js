(function(){
	'use strict';
	var API='/rehainfo/billing-management/api', state=null;
	document.addEventListener('DOMContentLoaded',function(){
		var now=new Date(), date=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
		document.getElementById('billingDate').value=date;
		document.getElementById('billingDate').addEventListener('change',load);
		document.getElementById('billingRows').addEventListener('click',function(event){var button=event.target.closest('[data-save]');if(button)save(button);});
		load();
	});
	function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
	function number(value){return Number(value||0).toLocaleString('ja-JP');}
	function input(id,period,value,disabled){return '<label class="target-field">目標 <input type="number" min="0" max="99999999" step="1" value="'+Number(value||0)+'" data-target="'+period+'" data-id="'+esc(id)+'" aria-label="'+esc(id)+' '+period+'目標算定点数" '+(disabled?'disabled':'')+' /> 点</label>';}
	function period(id,period,scheduled,confirmed,target,disabled,resultMode,resultUnits,workedDays){var base=resultMode?confirmed:scheduled,rate=Number(target)>0?Math.min(100,Math.round(Number(base||0)*100/Number(target))):0;return '<div class="period-cell"><div class="point-row"><span>予定</span><b>'+number(scheduled)+'点</b></div><div class="point-row confirmed-row"><span>'+(resultMode?'8月実績':'確定')+'</span><b>'+number(confirmed)+'点</b></div>'+(resultMode?'<small class="imported-result">確定 '+number(resultUnits)+'単位・'+number(workedDays)+'勤務日</small>':'')+input(id,period,target,disabled)+'<div class="progress"><i style="width:'+rate+'%"></i></div><small class="progress-label">'+(resultMode?'実績':'予定')+' / 目標 '+rate+'%</small></div>';}
	function card(title,range,scheduled,confirmed){return '<article class="summary-card"><h2>'+esc(title)+'</h2><strong>'+number(scheduled)+'点</strong><span>予定算定点数</span><span>確定 '+number(confirmed)+'点</span><span>'+esc(range)+'</span></article>';}
	async function load(){
		message('');var date=document.getElementById('billingDate').value;
		try{var response=await fetch(API+'?date='+encodeURIComponent(date)),data=await response.json();if(!response.ok||!data.success)throw new Error(data.message||'算定情報を取得できません。');state=data;render(data);}catch(error){message(error.message,true);}
	}
	function render(data){
		var totals=data.totals;
		renderHospitalPerformance(data.hospitalPerformance||{});
		document.getElementById('periodSummary').innerHTML=card('日 合計',data.date,totals.dailyScheduledPoints,totals.dailyConfirmedPoints)+card('週 合計',data.weekStart+' ～ '+data.weekEnd,totals.weeklyScheduledPoints,totals.weeklyConfirmedPoints)+card('月 合計',data.targetMonth,totals.monthlyScheduledPoints,totals.monthlyConfirmedPoints);
		document.getElementById('periodLabel').textContent='対象日 '+data.date+' ／ 週 '+data.weekStart+'〜'+data.weekEnd+' ／ 月 '+data.targetMonth+'（'+data.therapists.length+'名）';
		document.getElementById('billingRows').innerHTML=data.therapists.map(function(row){return '<tr data-row="'+esc(row.therapistId)+'"><td>'+esc(row.therapistId)+'</td><td class="therapist-name"><strong>('+esc(row.therapistRole)+') '+esc(row.therapistName)+'</strong><small>目標対象月 '+esc(data.targetMonth)+'</small></td><td>'+period(row.therapistId,'daily',row.dailyScheduledPoints,row.dailyConfirmedPoints,row.dailyTargetPoints,!data.canEdit,false,0,0)+'</td><td>'+period(row.therapistId,'weekly',row.weeklyScheduledPoints,row.weeklyConfirmedPoints,row.weeklyTargetPoints,!data.canEdit,false,0,0)+'</td><td>'+period(row.therapistId,'monthly',row.monthlyScheduledPoints,row.monthlyConfirmedPoints,row.monthlyTargetPoints,!data.canEdit,!!row.monthlyResultImported,row.monthlyResultUnits,row.monthlyWorkedDays)+'</td><td><button class="save-target" data-save="'+esc(row.therapistId)+'" '+(!data.canEdit?'disabled':'')+'>目標を保存</button></td></tr>';}).join('');
	}
	function renderHospitalPerformance(p){
		var difference=Number(p.pointDifference||0),roleRows=(p.roleBreakdown||[]).map(function(row){return '<tr><td><strong>'+esc(row.role)+'</strong></td><td>'+number(row.therapistCount)+'名</td><td>'+number(row.targetUnits)+'単位</td><td>'+number(row.resultUnits)+'単位</td><td>'+number(row.targetPoints)+'点</td><td>'+number(row.resultPoints)+'点</td><td><strong>'+Number(row.achievementRate||0).toFixed(1)+'%</strong></td><td>'+Number(row.averageUnitsPerWorkedDay||0).toFixed(1)+'単位</td></tr>';}).join('');
		document.getElementById('hospitalPerformance').innerHTML='<div class="hospital-performance-header"><div><h2>'+esc(p.hospitalName||'病院全体')+'　'+esc(p.label||'8月実績')+'</h2><p>全'+number(p.therapistCount)+'名・稼働'+number(p.operatingDays)+'日で設定した院内算定目標と確定結果</p></div><span class="demo-badge">検証用データ</span></div><div class="hospital-kpis">'+kpi('月目標算定',number(p.targetPoints)+'点','目標 '+number(p.targetUnits)+'単位')+kpi('8月確定実績',number(p.resultPoints)+'点','実績 '+number(p.resultUnits)+'単位')+kpi('算定達成率',Number(p.achievementRate||0).toFixed(1)+'%','単位達成率 '+Number(p.unitAchievementRate||0).toFixed(1)+'%','achievement')+kpi('目標との差',signed(difference)+'点','目標に対する差','performance-gap '+(difference>=0?'positive':'negative'))+kpi('療法士平均',Number(p.averageUnitsPerTherapist||0).toFixed(1)+'単位','月間・1人あたり')+kpi('勤務日平均',Number(p.averageUnitsPerWorkedDay||0).toFixed(1)+'単位','療法士1勤務日あたり')+'</div><div class="role-performance"><table><thead><tr><th>職種</th><th>人数</th><th>目標単位</th><th>実績単位</th><th>目標算定</th><th>確定実績</th><th>達成率</th><th>1勤務日平均</th></tr></thead><tbody>'+roleRows+'</tbody></table></div><p class="billing-note">'+esc(p.dataNotice||'')+'</p>';
	}
	function kpi(label,value,sub,classes){return '<div class="hospital-kpi '+(classes||'')+'"><span>'+label+'</span><strong>'+value+'</strong><small>'+sub+'</small></div>';}
	function signed(value){return (value>0?'+':'')+number(value);}
	async function save(button){
		var id=button.dataset.save,row=document.querySelector('tr[data-row="'+selector(id)+'"]'),values={};
		row.querySelectorAll('[data-target]').forEach(function(input){values[input.dataset.target]=Number(input.value);});
		if(!['daily','weekly','monthly'].every(function(k){return Number.isInteger(values[k])&&values[k]>=0&&values[k]<=99999999;})){message('目標算定点数は0～99,999,999点の整数で入力してください。',true);return;}
		button.disabled=true;
		try{var response=await fetch(API+'/targets',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({therapistId:id,targetMonth:state.targetMonth,dailyTargetPoints:values.daily,weeklyTargetPoints:values.weekly,monthlyTargetPoints:values.monthly})}),data=await response.json();if(!response.ok||!data.success)throw new Error(data.message||'保存できませんでした。');await load();message(id+' の日・週・月の目標算定点数を保存しました。');}catch(error){message(error.message,true);}finally{button.disabled=false;}
	}
	function selector(value){return String(value).replace(/([ #;?%&,.+*~\':"!^$[\]()=>|\/@])/g,'\\$1');}
	function message(text,error){var box=document.getElementById('billingMessage');box.textContent=text;box.className='billing-message'+(text?' show':'')+(error?' error':'');}
})();
