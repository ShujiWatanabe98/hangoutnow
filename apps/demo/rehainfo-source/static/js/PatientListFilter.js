// フィルタテーブルの共通変数　設定要！
var gTabldID = 'patientListTable';  // テーブルのエリアのIDを設定
var gTfStartRow = 0;
var gTfColList  = [];             // ボタンが配置されている列番号
var gTfListSave = {};             // フィルタリストの保存状態

// オンロードでテーブル初期設定
function initialFilter() {
    tFilterInit();
    tFilterClick(8);
    tFilterGo();
}

function tFilterInit(){
    // テーブルの初期設定
    var wTABLE  = document.getElementById(gTabldID);
    var wTR     = wTABLE.rows;
    var wAddBtn = '';

    // テーブル内をフィルタボタンを付ける
    for(var i=0; i < wTR.length; i++){
        var wTD     = wTABLE.rows[i].cells;  
        for(var j=0; j < wTD.length; j++){

        // 「cmanFilterBtn」の定義があるセルを対象とする
        if(wTD[j].className.indexOf('cmanFilterBtn') !== -1){
            // フィルタ対象はボタンの次の行から
            gTfStartRow = i + 1;

            // ボタンを追加（画像はsvgを使用）
            wAddBtn  = '<div class="tfArea">';
            wAddBtn += '<svg x="0px" y="0px" viewBox="0 0 512 512" style="width: 16px; height: 16px; opacity: 1;" class="tfImg" id="tsBtn_'+j+'" onclick="tFilterCloseOpen('+j+', event)"><g id="filterSVGIcon"><path class="st0" d="M477.388,0H12.324v111.948l172.193,133.734V512l142.964-86.375V245.683l172.194-133.724V0H477.388z M455.101,90.129L282.906,223.853v176.623l-53.814,32.516V223.853L56.899,90.129V44.575h398.202V90.129z" style="fill: #0b5ed7;"></path></g></path></svg>';
            wAddBtn += '<div class="tfList" id="tfList_'+j+'" style="display:none" onclick="event.stopPropagation()">';
            wAddBtn += tFilterCreate(j, wTD[j].innerHTML);
            wAddBtn += '</div>';
            wAddBtn += '</div>';
            wTD[j].innerHTML = wTD[j].innerHTML + wAddBtn;
            // Tag filter list with its header title for later mapping
            var _list = document.getElementById('tfList_' + j);
            if (_list) {
                try {
                    var titleText = (wTD[j].innerText || '').toString();
                    _list.setAttribute('data-header-title', trim(titleText));
                } catch(e){}
            }

            // フィルタボタンになる列を保存
            gTfColList.push(j);
        }
    }

        // ボタンを付けたら以降の行は無視する
        if(wAddBtn != ''){
            gSortBtnRow = i;
            break;
        }
    }
}

function tFilterCreate(argCol, headerTitle){
    // 指定列のフィルタリスト作成
    var wTABLE    = document.getElementById(gTabldID);
    var wTR       = wTABLE.rows;
    var wItem     = [];              // クリックされた列の値
    var wNotNum   = 0;               // 1 : 数字でない
    var wItemSave = {};              // フィルタに設定した値がキー
    var rcList    = '';              // 返すフィルタリスト

    // クリックされた列の値を取得する（JSON優先）
    (function buildItemsFromJson(){
        try {
            var listEl = document.getElementById('tfList_' + argCol);
            var headerText = headerTitle;
            if (listEl && listEl.getAttribute) {
                var tagged = listEl.getAttribute('data-header-title');
                if (tagged) headerText = tagged;
            }
            headerText = trim(headerText || '');
            var fieldName = window.patientListHeaderToField ? window.patientListHeaderToField[headerText] : null;
            if (fieldName && Array.isArray(window.patientListAllRows)) {
                for (var k = 0; k < window.patientListAllRows.length; k++) {
                    var rec = window.patientListAllRows[k] || {};
                    var val = rec[fieldName];
                    if (val == null) {
                        wItem.push('');
                        wNotNum = 1;
                        continue;
                    }
                    val = val.toString();
                    wItem.push(val);
                    if(!val.match(/^[-]?[0-9,\.]+$/)){
                        wNotNum = 1;
                    }
                }
                return; // built from JSON
            }
        } catch(e) {
            // fall back below
        }
    })();

    // 列の値でソートを実行
    if(wNotNum == 0) {
        // 数値で昇順
        wItem.sort(sortNumA);
    }else{
        // 文字で昇順
        wItem.sort(sortStrA);
    }

    // 「すべて」のチェックボックス作成
    var wItemId = 'tfData_ALL_' + argCol;

    var isAllChecked = (headerTitle !== "入外区分");

    rcList += '<div class="tfMeisai">';
    rcList += '<input type="checkbox" id="' + wItemId + '" ' + (isAllChecked ? 'checked' : '') + ' onclick="tFilterAllSet(' + argCol + ')" />';
    rcList += '<label for="' + wItemId + '">(すべて)</label>';
    rcList += '</div>';

    // 列の値でフィルタのチェックボックスを作成する
    // チェックボックスはformで囲む
    rcList += '<form name="tfForm_' + argCol + '">';

    switch(headerTitle) {
        case "入外区分":
                // チェックボックスの作成
                wItemId = 'tfData_' + argCol + '_r1';
                rcList += '<div class="tfMeisai">';
                rcList += '<input type="checkbox" id="'+wItemId+'" value="外来" checked onclick="tFilterClick('+argCol+')" />';
                rcList += '<label for="'+wItemId+'">'+ '外来' +'</label>';
                rcList += '</div>';

                wItemId = 'tfData_' + argCol + '_r2';
                rcList += '<div class="tfMeisai">';
                rcList += '<input type="checkbox" id="'+wItemId+'" value="入院" checked onclick="tFilterClick('+argCol+')" />';
                rcList += '<label for="'+wItemId+'">'+ '入院' +'</label>';
                rcList += '</div>';

                wItemId = 'tfData_' + argCol + '_r3';
                rcList += '<div class="tfMeisai">';
                rcList += '<input type="checkbox" id="'+wItemId+'" value="退院" onclick="tFilterClick('+argCol+')" />';
                rcList += '<label for="'+wItemId+'">'+ '退院' +'</label>';
                rcList += '</div>';

                wItemId = 'tfData_' + argCol + '_r4';
                rcList += '<div class="tfMeisai">';
                rcList += '<input type="checkbox" id="'+wItemId+'" value="終了" onclick="tFilterClick('+argCol+')" />';
                rcList += '<label for="'+wItemId+'">'+ '終了' +'</label>';
                rcList += '</div>';

            break;
        default:
            // unique values
            var uniq = [];
            for(var i=0; i < wItem.length; i++){
                var wVal = trim(wItem[i]);
                if(wVal in wItemSave){
                }else{
                    wItemSave[wVal]='1';
                    uniq.push(wVal);
                }
            }
            // sort
            if(wNotNum == 0) {
                uniq.sort(sortNumA);
            }else{
                uniq.sort(sortStrA);
            }
            // build checkboxes
            for(var i=0; i < uniq.length; i++){
                var val = uniq[i];
                wItemId = 'tfData_'+argCol+'_r'+i;
                rcList += '<div class="tfMeisai">';
                rcList += '<input type="checkbox" id="'+wItemId+'" value="'+val+'" checked onclick="tFilterClick('+argCol+')" />';
                rcList += '<label for="'+wItemId+'">'+( val=='' ? '(空白)' : val )+'</label>';
                rcList += '</div>';
            }
            break;
    }

    rcList += '</form>';

    // 「OK」「Cancel」ボタンの作成
    rcList += '<div class="tfBtnArea d-flex">';
    rcList += '<input type="button" class="btn btn-ok" value="OK" onclick="tFilterGo()" />';
    rcList += '<input type="button" class="btn btn-cancel" value="キャンセル" onclick="tFilterCancel(' + argCol + ')" />';
    rcList += '</div>';

    // 作成したhtmlを返す
    return rcList;
}

function tFilterClick(argCol){
    // フィルタリストのチェックボックスクリック
    // 「すべて」のチェックボックスと整合性を合わせる
    var wForm   = document.forms['tfForm_' +argCol];
    var wCntOn  = 0;
    var wCntOff = 0;
    var wAll    = document.getElementById('tfData_ALL_'+argCol);   // 「すべて」のチェックボックス

    // 各チェックボックスの状態を集計する
    for (var i = 0; i < wForm?.elements?.length; i++){
        if(wForm.elements[i].type == 'checkbox'){
            if (wForm.elements[i].checked) {
                wCntOn++;
            } else { 
                wCntOff++;
            }
        }
    }

    // 各チェックボックス集計で「すべて」を整備する
    if((wCntOn == 0)||(wCntOff == 0)){
        // 「すべて」をチェックする
        if (wAll) {
            wAll.checked = true;
        }
        // 各フィルタのチェックする
        tFilterAllSet(argCol);
    } else {
        // 「すべて」をチェックを外す
        if (wAll) {
            wAll.checked = false;
        }
    }
}

function tFilterCancel(argCol){
    //  キャンセルボタン押下
    tFilterSave(argCol, 'load');    // フィルタ条件の復元
    tFilterCloseOpen('');           // フィルタリストを閉じる
}

function tFilterGo(){
    // Update filter icon state
    for(var wColList = 0; wColList < gTfColList.length; wColList++){
        var wCol       = gTfColList[wColList];
        var wAll       = document.getElementById('tfData_ALL_'+wCol);     // 「すべて」のチェックボックス
        var wFilterBtn =  document.getElementById('tsBtn_'+wCol);
        if(wAll && wAll.checked) {
            document.getElementById('filterSVGIcon').innerHTML = '<path class="st0" d="M477.388,0H12.324v111.948l172.193,133.734V512l142.964-86.375V245.683l172.194-133.724V0H477.388z M455.101,90.129L282.906,223.853v176.623l-53.814,32.516V223.853L56.899,90.129V44.575h398.202V90.129z" style="fill: #0b5ed7;"></path>';
            if (wFilterBtn) wFilterBtn.style.backgroundColor = '';
        } else {
            document.getElementById('filterSVGIcon').innerHTML = '<polygon class="st0" points="4.263,0 4.263,85.338 202.063,238.938 202.063,512 309.937,443.726 309.937,238.938 507.737,85.338 507.737,0 \t" style="fill: #0b5ed7;"></polygon>';
            if (wFilterBtn) wFilterBtn.style.backgroundColor = '';
        }
    }
    // JSON-side filtering
    try {
        var filters = [];
        for (var idx = 0; idx < gTfColList.length; idx++) {
            var col = gTfColList[idx];
            var allCheck = document.getElementById('tfData_ALL_' + col);
            if (allCheck && allCheck.checked) continue;
            var form = document.forms['tfForm_' + col];
            if (!form) continue;
            var allowed = {};
            for (var i = 0; i < form.elements.length; i++) {
                var e = form.elements[i];
                if (e.type === 'checkbox' && e.checked) {
                    allowed[e.value] = 1;
                }
            }
            var listEl = document.getElementById('tfList_' + col);
            var headerName = listEl && listEl.getAttribute ? listEl.getAttribute('data-header-title') : null;
            headerName = trim(headerName || '');
            var fieldName = window.patientListHeaderToField ? window.patientListHeaderToField[headerName] : null;
            if (fieldName) {
                filters.push({ field: fieldName, allowed: allowed });
            }
        }
        var baseRows = Array.isArray(window.patientListAllRows) ? window.patientListAllRows : [];
        var filteredRows = baseRows.filter(function(rec){
            for (var f = 0; f < filters.length; f++) {
                var rule = filters[f];
                var v = rec ? rec[rule.field] : null;
                var cellText = (v == null ? '' : v.toString()).replace(/^[ 　\r\n]+|[ 　\r\n]+$/g, '');
                if (!rule.allowed[cellText]) return false;
            }
            return true;
        });
        if (typeof window.patientListApplyFilteredRows === 'function') {
            window.patientListApplyFilteredRows(filteredRows);
        }
    } catch(e) {
        if (window.patientListDT && typeof window.patientListDT.draw === 'function') {
            window.patientListDT.draw();
        }
    }
    tFilterCloseOpen('');
}

function tFilterSave(argCol, argFunc){
    // フィルタリストの保存または復元
    // 「すべて」のチェックボックス値を保存
    var wAllCheck = document.getElementById('tfData_ALL_'+argCol);
    if(argFunc == 'save'){
        gTfListSave[wAllCheck.id] = wAllCheck.checked;
    }else{
        wAllCheck.checked = gTfListSave[wAllCheck.id];
    }

    // 各チェックボックス値を保存
    var wForm    = document.forms['tfForm_'+argCol];
    for (var i = 0; i < wForm.elements.length; i++){
        if(wForm.elements[i].type == 'checkbox') {
            if(argFunc == 'save'){
                gTfListSave[wForm.elements[i].id] = wForm.elements[i].checked;
            }else{
                wForm.elements[i].checked = gTfListSave[wForm.elements[i].id];
            }
        }
    }
}

function tFilterCloseOpen(argCol, e) {
    //  フィルタを閉じて開く
    // フィルタリストを一旦すべて閉じる
    for(var i=0; i < gTfColList.length; i++) {
        document.getElementById("tfList_"+gTfColList[i]).style.display = 'none';
    }

    // 指定された列のフィルタリストを開く
    if(argCol != ''){
        document.getElementById("tfList_"+argCol).style.display = '';

        // --- フィルタ条件の保存（キャンセル時に復元するため） -----
        tFilterSave(argCol, 'save');

    }

    if (e) e.stopPropagation();
}

function tFilterAllSet(argCol){
    // 「すべて」のチェック状態に合わせて、各チェックをON/OFF
    var wChecked = false;
    var wForm    = document.forms['tfForm_'+argCol];

    if(document.getElementById('tfData_ALL_'+argCol)?.checked){
        wChecked = true;
    }

    for (var i = 0; i < wForm?.elements?.length; i++){
        if(wForm.elements[i].type == 'checkbox'){
            wForm.elements[i].checked = wChecked;
        }
    }
}

function sortNumA(a, b) {
    //  数字のソート関数（昇順）
    a = parseInt(a.replace(/,/g, ''));
    b = parseInt(b.replace(/,/g, ''));

    return a - b;
}

function sortStrA(a, b){
    // 文字のソート関数（昇順）
    a = a.toString().toLowerCase();  // 英大文字小文字を区別しない
    b = b.toString().toLowerCase();

    if     (a < b){ return -1; }
    else if(a > b){ return  1; }
    return 0;
}

function trim(argStr){
    //  trim
    var rcStr = argStr;
    rcStr	= rcStr.replace(/^[ 　\r\n]+/g, '');
    rcStr	= rcStr.replace(/[ 　\r\n]+$/g, '');
    return rcStr;
}