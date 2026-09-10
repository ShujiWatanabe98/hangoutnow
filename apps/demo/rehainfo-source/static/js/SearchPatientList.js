"use strict";
{
    var searchableColumn = [
        {value: "", label: "追加条件選択"},
        {value: "serviceName", label: "医療機関名"},
        {value: "patientName", label: "患者氏名（漢字）"},
        {value: "gender", label: "性別"},
        {value: "birth", label: "生年月日"},
        {value: "age", label: "年齢"},
        {value: "rehabilitationClass", label: "リハビリテーション区分"},
        {value: "startDate", label: "起算日"},
    ];

    var additionalLiId = "li_additional";

    var addSearcher = function(targetId, patientNameKana, patientId, additional, columnName){
        let target = document.getElementById(targetId);
        let select = document.createElement('select');
        select.className = "form-select";
        select.id = "select_additional";
        select.setAttribute('onchange', "selectPref(this, \"\");");

        for (let i = 0; i < searchableColumn.length; i++){
            let option = document.createElement('option');
            option.value = searchableColumn[i].value;
            option.innerText = searchableColumn[i].label;
            select.appendChild(option);
        }

        target.appendChild(select);

        // 検索後の表示時
        if (patientNameKana){
            let kanaInput = document.getElementById('condition_patientName');
            kanaInput.value = patientNameKana;
        }
        if (patientId){
            let idInput = document.getElementById('condition_patientId');
            idInput.value = patientId;
        }
        if (columnName){
            for (let i = 0; i < searchableColumn.length; i++){
                if (searchableColumn[i].label == columnName){
                    select.value = searchableColumn[i].value;
                    break;
                }
            }
            selectPref(select, additional);
        }

    }

    var selectPref = function(obj, searchedValue){
        let conditionList = document.getElementById('search_condition_list');
        let additionalElement = document.getElementById(additionalLiId);
        if (additionalElement) {
            additionalElement.remove();
        }

        let value;
        let label;

        for (let i = 0; i < searchableColumn.length; i++){
            if (searchableColumn[i].value == obj.value){
                value = searchableColumn[i].value;
                label = searchableColumn[i].label;
                break;
            }
        }

        // 追加条件あり
        if (value != ""){
            let li = document.createElement('li');
            li.className = "list-group-item border-0";
            li.id = additionalLiId;
            conditionList.appendChild(li);

            let rowDiv = document.createElement('div');
            rowDiv.className = "row";
            li.appendChild(rowDiv);

            let labelDiv = document.createElement('div');
            labelDiv.className = "col-2";
            labelDiv.id = "label_additional";
            labelDiv.innerText = label;
            rowDiv.appendChild(labelDiv);

            let inputDiv = document.createElement('div');
            inputDiv.className = "col-6";
            rowDiv.appendChild(inputDiv);

            let input = document.createElement('input');
            input.type = "text";
            input.className = "form-control";
            input.name = "additional";
            input.id = "patientListAdditionalSearchForm";
            input.value = searchedValue;
            input.setAttribute('onchange', "onChangeInput();")
            inputDiv.appendChild(input);

            let columnInput = document.createElement('input');
            columnInput.type = "hidden";
            columnInput.name = "columnName";
            columnInput.id = "patientListAdditionalColumnName";
            columnInput.value = label;
            inputDiv.appendChild(columnInput);
        }
    }

    var onChangeInput = function(){
        let form = document.getElementById('list-form');
        form.action = "patients";
        form.method = "POST";

        let toggleApi = document.getElementById('radio_api');
        let apiTypeValue = toggleApi.checked;

        let apiType = document.createElement('input');
        apiType.name = "apiType";
        apiType.type = "hidden";
        apiType.value = apiTypeValue;
        form.appendChild(apiType);

        form.submit();
    }

    // 選択されているトグルボタンの値を取得
    var getRadioValue = function(){
        let radioElements = document.getElementsByName('patient_list_api_type');
        let value;
        for (let i = 0; i < radioElements.length; i++){
            if (radioElements[i].checked){
                value = radioElements[i].value;
            }
        }
        return value;
    }

    // 画面遷移時トグルボタンの選択状態を反映
    var switchToggle = function(apiType){
        let toggleApi = document.getElementById('radio_api');

        toggleApi.checked = apiType;
    }
}