// メッセージ表示処理などの共通処理をここに置いてください
// エラーメッセージ表示処理
// 表示対象項目はcommon.html の commonMessageModal中に記載
// 使用する場合は<div th:replace="common :: commonMessageModal"></div>を対象画面のヘッダの下に配置
var commonTreatmentPatientId;
var commonTreatmentStartTime;
var commonTreatmentImplementBackEnable;
var enablePageTransitionPermission = true;
var childWindow = undefined;
var sidebarState = "collapsed";

// 画面遷移の許可処理
let checkPageTransitionPermission = function(){
	if (!enablePageTransitionPermission) {
		return true;
	}
	enablePageTransitionPermission = false;
	return false;
}

var getAutoSaveManager = function() {
	var manager = window['AutoSaveManager'];
	if (manager && typeof manager.isDirty === 'function' && typeof manager.handleNavigation === 'function') {
		return manager;
	}
	return null;
}

var getRequiredAutoSaveManager = function() {
	var manager = getAutoSaveManager();
	if (!manager) {
		console.warn('AutoSaveManager is not available. Auto-save is disabled.');
	}
	return manager;
}

var executeWithAutoSave = function(callback) {
	var manager = getAutoSaveManager();
	if (manager) {
		manager.handleNavigation(null, callback);
		return;
	}
	callback();
}

var navigateWithAutoSave = function(url) {
	var manager = getAutoSaveManager();
	if (manager) {
		manager.handleNavigation(url);
		return;
	}
	window.location.href = url;
}

var getDirtyAutoSaveManager = function() {
	var manager = getAutoSaveManager();
	if (manager && manager.isDirty()) {
		return manager;
	}
	return null;
}

let showErrorMessageModal = function(message){
	document.getElementById("errorModalMessage").innerHTML = message;
	$("#errorMessageModal").modal('show');
}

let showSuccessMessageModal = function(message){
	document.getElementById("successModalMessage").innerHTML = message;
	$("#successMessageModal").modal('show');
}

// 確認メッセージ表示処理
// 使用方法はエラーメッセージと同じ
let showConfirmMessageModal = function (message, onclickAttr) {
	document.getElementById("confirmMessageText").innerText = message;
	document.getElementById("confirmOkButton").setAttribute('onclick', onclickAttr);
	document.getElementById("confirmCancelButton").setAttribute('onclick', 'closeConfirmMessageModal()');
	$("#confirmMessageModal").modal('show');
}

let closeConfirmMessageModal = function () {
	$("#confirmMessageModal").modal('hide');
}

var showDecisionMessageModal = function (message, onYesCallback, yesText = 'はい', noText = 'キャンセル') {
	const modalId = "decision";
	document.getElementById(`${modalId}MessageText`).innerHTML = message;
	document.getElementById(`${modalId}YesButton`).setAttribute('onclick', onYesCallback);
	document.getElementById(`${modalId}NoButton`).setAttribute('onclick', 'closeDecisionMessageModal()');
	document.getElementById(`${modalId}YesButton`).innerText = yesText;
	document.getElementById(`${modalId}NoButton`).innerText = noText;

	$(`#${modalId}MessageModal`).modal('show');
}

var closeDecisionMessageModal = function () {
	$("#decisionMessageModal").modal('hide');
}

// Fitbit modal
let showFitbitConfirm = function(){
	$("#fitbitConfirmMessageModal").modal({backdrop: 'static', keyboard: false});
	$("#fitbitConfirmMessageModal").modal('show');
}

let closeFitbitConfirm = function(){
	$("#fitbitConfirmMessageModal").modal('hide');
}

let backTreatmentImplement = function(){
	if(!commonTreatmentImplementBackEnable){
		return;
	}

	// Check auto-save before navigating back
	executeWithAutoSave(function() {
		processTreatmentImplement(commonTreatmentPatientId, commonTreatmentStartTime, true);
	});
}

let onClickTreatmentImplementBackButton = function(){
	if(!commonTreatmentImplementBackEnable){
		return;
	}
	let onclickAttr = "backTreatmentImplement();"
	let message = '入力内容が保存されていません。戻りますか？';
	showConfirmMessageModal(message, onclickAttr);
}

// Helper function to format number with leading zeros
let formatWithLeadingZeros = (num, digits = 2) => {
	return ('0'.repeat(digits) + num).slice(-digits);
};

// Helper function to format hours: leading zeros for small numbers, full digits for large numbers
let formatHours = (hours) => {
	return hours < 10 ? ('0' + hours) : hours.toString();
};

let getDOMDataAttr = function(element, name) {
	if (!element || !name || !element.getAttribute) {
		return '';
	}
	return element.getAttribute('data-' + name) || '';
};

let setDOMDataAttr = function(element, name, value) {
	if (!element || !name || !element.setAttribute) {
		return;
	}
	element.setAttribute('data-' + name, value || '');
};

let startHeaderTreatmentImplementTime = function(treatmentPatientIdStr, treatmentStartTimeStr, treatmentImplementBackEnable){
	commonTreatmentPatientId = treatmentPatientIdStr;
	commonTreatmentStartTime = treatmentStartTimeStr;
	commonTreatmentImplementBackEnable = treatmentImplementBackEnable;
	// In case implement without count up mode
	if (!treatmentStartTimeStr){
		return;
	}
	// javascript用 に yyyyMMddhhmmss → yyyy/MM/dd hh:mm:ss に変換
	let yearStr = treatmentStartTimeStr.substring(0, 4);
	let monthStr = treatmentStartTimeStr.substring(4, 6);
	let dateStr = treatmentStartTimeStr.substring(6, 8);
	let hourStr = treatmentStartTimeStr.substring(8, 10);
	let minStr = treatmentStartTimeStr.substring(10, 12);
	let secStr = treatmentStartTimeStr.substring(12, 14);

	let treatmentStartTime = yearStr + "/" + monthStr + "/"
		+ dateStr + " " + hourStr + ":" + minStr + ":" + secStr;
	// 現在時刻と開始時刻の差分から経過時間を算出
	function updateHeaderTreatmentImplementTime(startTime){
		let thrapyStartDate = new Date(startTime);
		let nowDate = new Date();

		// 経過時間（ミリ秒）
		let elapsedMSec = nowDate.getTime() - thrapyStartDate.getTime();
		let elapsedSec = Math.floor(elapsedMSec / 1000);
		let elapsedMin = Math.floor(elapsedSec / 60);
		let elapsedHour = Math.floor(elapsedMin / 60);

		// Build time string using append method (HH:mm:ss format only)
		let timeParts = [];

		// Add hours if > 0 (leading zeros for 1-9, full digits for 10+)
		if (elapsedHour > 0) {
			timeParts.push(formatHours(elapsedHour));
		}

		// Always add minutes and seconds
		timeParts.push(formatWithLeadingZeros(elapsedMin % 60));
		timeParts.push(formatWithLeadingZeros(elapsedSec % 60));

		let implementTime = timeParts.join(':');

		$("#treatmentImplementHeaderText").text(implementTime);
	}
	updateHeaderTreatmentImplementTime(treatmentStartTime);

	// 0.5秒毎に実行
	setInterval(updateHeaderTreatmentImplementTime, 500, treatmentStartTime);

}

// 画面が編集中かの問い合わせ処理を実施
let startCheckViewEditing = function(recIdParam, transitionHistoryData){

	function checkViewEditing(recId, viewName){
		let url = '/rehainfo-main/patient/' + recId + '/checkTransitionHistory';
		console.log('画面編集状態の問い合わせ実行');
		$.ajax({
			type: 'POST',
			url: url,
			timeout: 60000,
			data: {'viewName': viewName}
		}).done(function(data) {
			let otherUserEditingMessage = document.getElementById('otherUserEditingMessage');
			if(data){
				otherUserEditingMessage.innerText = '他のユーザー（' + data + '）が編集中です';
			}else{
				otherUserEditingMessage.innerText = '';
			}
		}).fail(function() {
			console.log('画面編集状態の問い合わせに失敗');
		});
	}

	checkViewEditing(recIdParam, transitionHistoryData.viewName);
	// プロパティで指定した時間間隔（ミリ秒）で実行
	let intervalTime = transitionHistoryData.requestInterval * 1000;
	setInterval(checkViewEditing, intervalTime, recIdParam, transitionHistoryData.viewName);

}

let onClickFitbitLinkageButton = function(fitbitAuth, fitbitErrorMessage){
	// Check auto-save before opening Fitbit dialog
	executeWithAutoSave(function() {
		onClickFitbitLinkageButtonInternal(fitbitAuth, fitbitErrorMessage);
	});
}

function onClickFitbitLinkageButtonInternal(fitbitAuth, fitbitErrorMessage) {
		showLoadingSpinner()
        // Fitbit連携のためのURIが空の場合、エラーメッセージ表示
        if (!fitbitAuth){
			showErrorMessageModal(fitbitErrorMessage);
			hideLoadingSpinner();
            return;
        } else {
			// Fitbitログイン画面表示
			window.open(fitbitAuth + ',' + '_fitbit', 'Fitbit連携', 'width=1400, height=850');
			// 親画面ロック
			// screenLock();
			showFitbitConfirm();
			hideLoadingSpinner();
			// 子画面が閉じられたときのイベント登録
			window.addEventListener('message', function(event) {
				// 子画面が閉じられたときの処理
				if (event.origin !== window.origin) return; // オリジンのチェック
				// 子画面からのパラメータ取得
				var jsonData = event.data;
				if (!jsonData['recId'] || !jsonData['planId'] ||
					!jsonData['targetDate'] ||  !jsonData['hcRoleCd']) {
				} else {
					document.getElementById("recId").value = jsonData['recId'];
					document.getElementById("planId").value = jsonData['planId'];
					document.getElementById("targetDate").value = jsonData['targetDate'];
					document.getElementById("hcRoleCd").value = jsonData['hcRoleCd'];
					// 評価入力画面への遷移
					var url = "../../patient/" + jsonData['recId'] + "/evaluation_input";
					let form = document.getElementById("fitbit-form");
					form.method = "POST";
					form.action = url;
					form.submit();
				}
				// 親画面ロック解除
				// screenUnLock();
				closeFitbitConfirm();
    		});
		}
}

function screenLock(){
	var element = document.createElement('div');
	element.id = "screenLock";
	element.style.height = '100%';
	element.style.left = '0px';
	element.style.position = 'fixed';
	element.style.top = '0px';
	element.style.width = '100%';
	element.style.zIndex = '9999';
	element.style.opacity = '0.5';
	element.style.backgroundColor = '#999999'

	innerHtml = `
        <div class="d-flex justify-content-center align-items-center h-100">
            <div class="spinner-border text-primary" role="status">
                <span class="sr-only"></span>
            </div>
        </div>
	`;
	element.innerHTML = innerHtml;
	var objBody = document.getElementsByTagName("main").item(0);
	objBody.appendChild(element);
}

function screenUnLock(){
	var screenLock = document.getElementById("screenLock");
	screenLock.parentNode.removeChild(screenLock);
}

document.addEventListener("DOMContentLoaded", function () {
	const requestURI = window.location.pathname;
	const isAdminPage =
		requestURI.startsWith('/rehainfo-main/adminEvaluationPreset') ||
		requestURI.startsWith('/rehainfo-main/adminTreatmentPreset') ||
		requestURI.startsWith('/rehainfo-main/adminImportData') ||
		requestURI.startsWith('/rehainfo-main/patientInfoExport') ||
		requestURI.startsWith('/rehainfo-main/evaluationCustomizationTop') ||
		requestURI.startsWith('/rehainfo-main/adminDataTransfer') ||
		requestURI.startsWith('/rehainfo-main/assignmentStaff');

	const navbar = document.getElementById("gksCommonNavBar");
	const dropdown = document.getElementById("gksCommonDropdownHeader");
	const userDropdown = document.getElementById("userDropdown");
	const gksCommonDropdownHeaderIcon = document.getElementById("gksCommonDropdownHeaderIcon");
	const speechMemoButton = document.getElementById("speechMemoButton");
	const speechInputButton = document.getElementById("speechInputButton");
	const patientRegister = document.getElementById("patientRegister");
	const patientListButton = document.getElementById("patientListButton");
	if (isAdminPage) {
		navbar?.classList?.add("gks-admin-main-background-color");
		dropdown?.classList?.add("gks-admin-main-background-color");

		userDropdown?.classList?.add("gks-admin-user-profile-btn");

		gksCommonDropdownHeaderIcon?.classList?.add("gks-admin-main-color");

		speechMemoButton?.classList?.add("gks-admin-modify-header-btn");
		speechInputButton?.classList?.add("gks-admin-modify-header-btn");
		patientRegister?.classList?.add("gks-admin-modify-header-btn");
		patientListButton?.classList?.add("gks-admin-modify-header-btn");

	} else {
		navbar?.classList?.remove("gks-admin-main-background-color");
		dropdown?.classList?.remove("gks-admin-main-background-color");

		userDropdown?.classList?.remove("gks-admin-user-profile-btn");

		gksCommonDropdownHeaderIcon?.classList?.remove("gks-admin-main-color");

		speechMemoButton?.classList?.remove("gks-admin-modify-header-btn");
		speechInputButton?.classList?.remove("gks-admin-modify-header-btn");
		patientRegister?.classList?.remove("gks-admin-modify-header-btn");
		patientListButton?.classList?.remove("gks-admin-modify-header-btn");

	}
});

var appendOrReplaceInput = function (form, type, name, value) {
	const existingInput = form.querySelector(`input[name="${name}"]`);
	if (existingInput) {
		existingInput.remove();
	}

	let hiddenInput = document.createElement('input');
	hiddenInput.type = type;
	hiddenInput.name = name;
	hiddenInput.value = value;

	form.appendChild(hiddenInput);
}

const formatDateWithFormat = (date, format = 'yyyyMMddHHmmss') => {
	format = format.replace(/yyyy/g, date.getFullYear());
	format = format.replace(/MM/g, ('0' + (date.getMonth() + 1)).slice(-2));
	format = format.replace(/dd/g, ('0' + date.getDate()).slice(-2));
	format = format.replace(/HH/g, ('0' + date.getHours()).slice(-2));
	format = format.replace(/mm/g, ('0' + date.getMinutes()).slice(-2));
	format = format.replace(/ss/g, ('0' + date.getSeconds()).slice(-2));
	format = format.replace(/SSS/g, ('00' + date.getMilliseconds()).slice(-3));
	return format;
};

// Shared function to call the permission check API
const fetchImplementPermission = async (recId) => {
	let url = `/rehainfo-main/patient/${recId}/treatmentimplement/check-permission`;
	if (window.tabKey) {
		url = url + `?tabKey=${window.tabKey}`
	}
	return await $.ajax({
		url: url,
		type: 'GET',
	});
};

// Show appropriate error message based on user info
const showPermissionErrorMessage = ({ userId, implementUserId, implementUserName }) => {
	if (!userId || !implementUserId) return;

	const isSameUser = userId === implementUserId;
	const msg = isSameUser
		? "既に実施タブが開かれています。<br/>実施タブを閉じてから再度お試しください。"
		: `${implementUserName}が実施タブを使用中です。<br/>そのため実施タブに遷移できません。`;

	showErrorMessageModal(msg);
};

// Function to check permission and handle error display
const checkImplementPermission = async (recId) => {
	try {
		await fetchImplementPermission(recId);
		return true;
	} catch (error) {
		if (error?.status === 403 && error.responseJSON) {
			showPermissionErrorMessage(error.responseJSON);
		}
		return false;
	}
};

// Function to get permission data without displaying errors
const getImplementPermission = async (recId) => {
	try {
		return await fetchImplementPermission(recId);
	} catch (error) {
		if (error?.status === 403) {
			return error.responseJSON;
		}
		return false;
	}
};

var handlePatientTreatmentImplement = function (recId, rehabStartTime, countUpMode) {
	countUpMode = !!countUpMode;
	// リハビリテーション開始日が未入力または未来日の場合、開始不可
	if (rehabStartTime == null) {
		alert("リハビリテーション開始日が未入力です。\nリハビリテーション開始日を入力してください。");
		return;
	}
	if (Date.now() < rehabStartTime) {
		alert("リハビリテーション開始日を迎えていません。\nリハビリテーション開始日を修正してください。");
		return;
	}

	$.ajax({
		type: 'POST',
		url: '/rehainfo-main/patient/' + recId + '/top_rest/checkPatientId',
		timeout: 60000
	}).done(function (data) {
		if (data != "" && data != recId) {
			$("#treatmentConfirmaition").modal('hide');
			showErrorMessageModal('他の患者で実施中です。<br/>開始したい場合は終了ボタンを押下して終了してください。');
			return;
		}
		treatmentImplement(recId, countUpMode);
	}).fail(function () {
		alert('セッションタイムアウトが発生しました。再度ログインから実行してください。');
	});
}


/**
 * Common function to handle treatment implementation navigation
 * after permission check.
 * 
 * @param {string|number} recId - Patient record ID
 * @param {string|null} treatmentStartTime - Treatment start time in 'yyyyMMddHHmmss' format; if null, use current time
 * @param {boolean} countUpMode - Flag to indicate count-up mode, triggers permission check and URL param
 */
var processTreatmentImplement =  async function (recId, treatmentStartTime, countUpMode) {
  countUpMode = !!countUpMode;

  // Check permission if countUpMode is enabled or treatmentStartTime is provided
  if (countUpMode) {
    const hasPermission = await checkImplementPermission(recId, treatmentStartTime);
    if (!hasPermission) {
			// If in countUpMode, hide confirmation modal on permission denied
			$("#treatmentConfirmaition").modal('hide');
      return;
    }
  }

  // Construct URL with required query parameters
  let href = `/rehainfo-main/patient/${recId}/treatmentimplement?treatmentStartTime=${treatmentStartTime}`;
  if (countUpMode) {
    href += `&countUpMode=${countUpMode}`;
  }

	if (window.tabKey) {
		href += `&tabKey=${window.tabKey}`;
	}

  // Navigate to the constructed URL
  window.location.href = href;
};

// Wrapper function to start treatment implementation
var treatmentImplement = async function(recId, countUpMode) {
  await processTreatmentImplement(recId, formatDateWithFormat(new Date(), 'yyyyMMddHHmmss'), countUpMode);
};

var showDialogTreatmentConfirm = async function(recId, rehabStartTime){
	// Check auto-save BEFORE showing PT confirmation to prevent dialog stacking
	var manager = getDirtyAutoSaveManager();
	if (manager) {
		var pendingPTAction = function() {
			hideLoadingSpinner();
			showPTConfirmationInternal(recId, rehabStartTime);
		};
		manager.handleNavigation(null, pendingPTAction);
		return;
	}

	showPTConfirmationInternal(recId, rehabStartTime);
}

/**
 * Internal PT confirmation logic (extracted to allow auto-save wrapping)
 * Original logic from showDialogTreatmentConfirm
 */
async function showPTConfirmationInternal(recId, rehabStartTime) {
	// keep recId and rehabStartTime for patient click select
	selectionRecId = recId;
	selectionRehabStartTime = rehabStartTime;
	let res = await getImplementPermission(recId);

	// implement doctor back to record
	if (res && res.userId == res.implementUserId) {
			handlePatientTreatmentImplement(recId, rehabStartTime, true)
			return;
	}
	$("#treatmentConfirmaition").modal('show');
}

var navigateToTreatmentRecord = function (recId, role) {
	executeWithAutoSave(function() {
		navigateToTreatmentRecordInternal(recId, role);
	});
}

function navigateToTreatmentRecordInternal(recId, role) {
	showLoadingSpinner();
	let form = document.createElement('form');
	form.action = '/rehainfo-main/patient/' + recId + '/treatment_record';
	form.method = 'POST';
	form.style.display = 'none';

	const treatmentDate = formatDateWithFormat(new Date(), 'yyyy-MM-dd'); 

	if (treatmentDate) {
		appendOrReplaceInput(form, 'hidden', 'treatmentDate', treatmentDate);
	}
	if (role) {
		appendOrReplaceInput(form, 'hidden', 'hcRoleCd', role);
	}

	document.body.appendChild(form);
	form.submit();
}

var showLoadingSpinner = () => {
	const overlay = document.getElementById('loadingOverlay');
	if (overlay) {
		overlay.style.display = 'flex';
	}
}

// Function to hide loading spinner (optional, for error handling)
var hideLoadingSpinner = () => {
	const overlay = document.getElementById('loadingOverlay');
	if (overlay) {
		overlay.style.display = 'none';
	}
}

// 治療実施／治療記録の画面では、JS/DOMの読み込みが終わるまで操作をブロックする。
// 初期表示はCSS（html.block-until-loaded #loadingOverlay）で行い、読み込み完了で解除する。
// ※ headで実行されるため、bodyのローディングが描画される前にクラスを付与できる。
(function blockUntilLoadedForTreatmentScreens() {
	const path = window.location.pathname || '';
	const isTreatmentScreen = /\/treatmentimplement(\/end)?\/?$/.test(path)
		|| /\/treatment_record\/?$/.test(path);
	if (!isTreatmentScreen) {
		return;
	}
	document.documentElement.classList.add('block-until-loaded');
	window.addEventListener('load', function () {
		hideLoadingSpinner();
		document.documentElement.classList.remove('block-until-loaded');
	});
})();

// Function to open a new window and navigate to the specified URL
var goToSmartRehab = function() {
	const url = window.location.href;
	const urlMatch = url.match(/(?:\/rehainfo-main)?\/ocr\/patient\/([^\/]+)/);
	if (!urlMatch || urlMatch.length < 2) {
		window.open('/rehainfo-main/patients', '_blank');
		return;
	}
	
	const recId = urlMatch[1];
	if (!recId) {
		showErrorMessageModal('患者情報が見つかりません');
		return;
	}
	window.open('/rehainfo-main/patient/' + recId + '/top', '_blank');
}

// Hide spinner if page becomes visible again (back button scenario)
document.addEventListener('visibilitychange', function() {
	if (document.visibilityState === 'visible') {
		hideLoadingSpinner();
	}
});

// bfcache（ブラウザバック）で復元された場合、表示したままのローディングを解除する
window.addEventListener('pageshow', function(event) {
	if (event.persisted) {
		hideLoadingSpinner();
	}
});
