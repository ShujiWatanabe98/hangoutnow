"user strict"
{

	let recId = "";
	var selectionRecId = "";
	var selectionRehabStartTime = "";
	const PAGINATION_LENGTH_MENU = [10, 25, 50, 100];
	const PAGINATION_PAGE_LENGTH = 50;
	// 患者情報テーブルを作成・表示する
	var addPatientListTable = async function (target, columns, tableData, hcRoleCd) {

		let table = document.createElement('table');
		table.className = "table table-hover dataTable px-0";
		table.id = "patientListTable";

		let thead = document.createElement('thead');
		thead.className = "table-light";
		table.appendChild(thead);

		let headTr = document.createElement('tr');
		thead.appendChild(headTr);

		let columnMap = new Map(Object.entries(columns));
		let titles = Array.from(columnMap.keys());

		// Expose full dataset and header->field mapping for filters
		try {
			window.patientListAllRows = Array.isArray(tableData) ? tableData.slice() : [];
			var headerToField = {};
			for (let i = 0; i < titles.length; i++) {
				headerToField[titles[i]] = columnMap.get(titles[i]);
			}
			window.patientListHeaderToField = headerToField;
		} catch (e) {
			console.error('Failed to expose dataset/mapping for patient list filtering.', e);
		}

		// Create a copy of the original titles array
		let headerNames = [...titles];
		if (headerNames && headerNames.length >= 3) {
			// add empty header for treatment/ SOAP
			headerNames.splice(3, 0, "");
		}
		// add empty header for action button next
		headerNames.push("");

		// Map of header name => class
		const sortClass = "sorting";
		const headerClassMap = {
			"入外区分": sortClass + " cmanFilterBtn"
		};
		for (let i = 0; i < headerNames.length; i++) {
			let index = i;
			let th = document.createElement('th');
			th.scope = "col";
			const headerName = trim(headerNames[i]);
			if (headerName) { // add sorting for specific columns
				// Determine class from map, default to "sorting"
				th.className = headerClassMap[headerName] || sortClass;
			}
			th.innerText = headerName;
			headTr.appendChild(th);
		}
		target.appendChild(table);

		// Initialize DataTables with data (let DataTables render rows)
		const roleCd = hcRoleCd;
		const dtColumns = [];
		for (let i = 0; i < headerNames.length; i++) {
			const index = i; // Capture index for callbacks
			const headerName = headerNames[index];
			// Column for treatment/SOAP action buttons
			if (index === 3) {
				dtColumns.push({
					data: null,
					orderable: false,
					className: 'no-click',
					render: treatmentSOAPColumnValueRender(roleCd),
				});
				continue; // Skip the rest of the loop for this column
			}

			// 2. Last value for Column with no header
			if (!headerName) {
				dtColumns.push({
					data: null,
					orderable: false,
					render: rightIconRender
				});
				continue;
			}
			// Column with header
			let renderFunction = defaultColumnValueRender; // Default render: show data or placeholder
			// Custom render for "病棟名" column (ward name)
			if (headerName === "病棟名") {
				renderFunction = wardNameColumnValueRender
			}

			// Add the column definition
			dtColumns.push({
				data: columnMap.get(headerName),
				orderable: true,
				render: renderFunction
			});
		}

		const dt = $('#patientListTable').DataTable({
			dom: "<'row'<'col-sm-6'f><'col-sm-6'l>>rt<'row'<'col-sm-6'i><'col-sm-6'p>>",
			responsive: true, // re-draw table when user resize viewport
			autoWidth: false,
			lengthMenu: PAGINATION_LENGTH_MENU,
			data: tableData,
			deferRender: true,
			lengthChange: true,
			searching: false,
			info: false,
			paging: true,
			pageLength: PAGINATION_PAGE_LENGTH,
			retrieve: true,
			language: {
				emptyTable: "患者が見つかりません。",
				paginate: {
					next: "次へ",
					previous: "前へ"
				},
				lengthMenu:"_MENU_ 件／ページ",
			},
			columns: dtColumns,
			createdRow: function (rowEl, rowData) {
				rowEl.style.cursor = 'pointer';
				rowEl.style.backgroundColor = (rowData.patientActive == "F") ? 'gray' : 'white';
				rowEl.onclick = function (event) {
					if (event.target && event.target.classList.contains('no-click')) {
						return;
					}
					onPatientClick(event, rowData.groupId, rowData.recId, rowData.fitbitId);
				};
			},
			// initComplete: function () { 
			// 	initialFilter();
			// 	wardNameTooltips(); // Fix: was not running on initial draw
			// }
		});
		window.patientListDT = dt;
		// Helper to apply filtered rows to DataTable
		window.patientListApplyFilteredRows = applyFilteredRowsToPatientList(dt);
		initialFilter();
		wardNameTooltips(); // Fix: was not running on initial draw
		dt.on('draw', wardNameTooltips);
		// ブラウザバックで来た場合、選択内容をクリア
		if (window.performance.navigation.type == 2) {
			$('#select_additional').val('');
		}
	}

	var onPatientClick = function(event, groupId, recId, fitbitId){

		if (event.target && event.target.classList.contains('no-click')) {
			return;
		}
		//show loading spinner
		showLoadingSpinner();
		var form = document.forms["record-form"];
		form.action = 'patient/' + recId + '/top'
		form.method = 'POST';

		var fitbitElem = document.getElementById("patientFitbit");
		fitbitElem.value = fitbitId;

		var fitbitElem2 = document.getElementById("patientDisplayDiv");
		fitbitElem2.value = "0";

		var fitbitElem3 = document.getElementById("patientGroupId");
		fitbitElem3.value = groupId;
		form.submit();
	}

	function showLoadingSpinner() {
		const overlay = document.getElementById('loadingOverlay');
		if (overlay) {
			overlay.style.display = 'flex';
		}
	}

	// Function to hide loading spinner (optional, for error handling)
	function hideLoadingSpinner() {
		const overlay = document.getElementById('loadingOverlay');
		if (overlay) {
			overlay.style.display = 'none';
		}
	}

	// Hide spinner if page becomes visible again (back button scenario)
	document.addEventListener('visibilitychange', function() {
		if (document.visibilityState === 'visible') {
			hideLoadingSpinner();
		}
	});
	// 「さらに表示」のリンク押下時の動作
	var onClickShowMorePatientList = function(){
		let form = document.forms['show_more_patint_list_form'];

		// 氏名のカナ情報を保持する
		let nameKana = document.createElement('input');
		nameKana.name = "patientNameKana";
		nameKana.type = "hidden";
		nameKana.value = document.getElementById('condition_patientName').value;
		form.appendChild(nameKana);

		// 患者IDの情報を保持する
		let inputPatientId = document.createElement('input');
		inputPatientId.name = "patientId";
		inputPatientId.type = "hidden";
		inputPatientId.value = document.getElementById('condition_patientId').value;
		form.appendChild(inputPatientId);

		// 追加の検索条件が設定されている場合、設定値を保持する
		if(document.getElementById('patientListAdditionalSearchForm') != undefined) {
			let additional = document.createElement('input');
			additional.name = "additional";
			additional.type = "hidden";
			additional.value = document.getElementById('patientListAdditionalSearchForm').value;
			form.appendChild(additional);

			let columnInput = document.createElement('input');
            columnInput.type = "hidden";
            columnInput.name = "columnName";
            columnInput.value = document.getElementById('patientListAdditionalColumnName').value;
			form.appendChild(columnInput);
		}

		// トグルボタンの情報を保持する
		let toggleApi = document.getElementById('radio_api');
        let apiTypeValue = toggleApi.checked;

        let apiType = document.createElement('input');
        apiType.name = "apiType";
        apiType.type = "hidden";
        apiType.value = apiTypeValue;
        form.appendChild(apiType);

        form.submit();
    }

	var createTreatmentImplementButton = function(rec, rehabStartTime, hcRoleCd, treatmentTimes) {
		if (hcRoleCd == 'PhysicalTherapist' || hcRoleCd == 'OccupationalTherapist' || hcRoleCd == 'SpeechTherapist') {
			let button = document.createElement('button');
			button.className = 'button-square no-click';
			let divRole = document.createElement('div');
			let divBtnText = document.createElement('div');
			divBtnText.className = 'btn-text no-click';
			divBtnText.innerText = treatmentTimes + '回目';
			divRole.className = 'role no-click';
			switch (hcRoleCd) {
				case 'PhysicalTherapist':
					divRole.innerText = 'PT';
					break;
				case 'OccupationalTherapist':
					divRole.innerText = 'OT';
					break;
				case 'SpeechTherapist':
					divRole.innerText = 'ST';
					break;
			}
			button.appendChild(divRole);
			button.appendChild(divBtnText);
			button.setAttribute('onclick', `showDialogTreatmentConfirm('${rec}', ${rehabStartTime})`);
			return button;
		}
	}

	var createSOAPButton = function(recId) {
		let button = document.createElement('button');
		button.className = 'button-square no-click';
		let icon = document.createElement('i');
		icon.className = 'bi bi-pencil-square no-click d-flex';
		icon.style = 'font-size: 30px; height: 30px; width: 30px; color: #1b294e;';
		button.appendChild(icon);
		let divBtnText = document.createElement('div');
		divBtnText.className = 'btn-text no-click';
		divBtnText.innerText = 'SOAP';
		button.appendChild(divBtnText);
		button.setAttribute('onclick', `onClickSOAPButton('${recId}')`);
		return button;
	}

	var onClickSOAPButton = function(recId) {
		console.log("onClickSoapButton")
		showLoadingSpinner();
		location.href = `/rehainfo/patient/${recId}/treatment-soap/soap-list?fromScreen=patientList`;
	}

	var onClickAICameraButton = function(recId) {
		console.log("onClickAICameraButton")
		showLoadingSpinner();
		window.open(`/rehainfo/patient/${recId}/ai_camera`, 'AIカメラ', 'width=1400, height=850');
	}

	var onClickAISummaryButton = function(recId) {
		console.log("onClickAISummaryButton")
		showLoadingSpinner();
		location.href = `/rehainfo/patient/${recId}/hospitalization/ai_summary`;
	}

	var defaultColumnValueRender = (data) => {
		return data ? data : '○○○○';
	};

	var rightIconRender = () => {
		return '<i class="bi bi-chevron-right"></i>';
	};

	var treatmentSOAPColumnValueRender = (roleCd) => {
		return  (_, __, row) => {
			let implementBtn = '';
			if (roleCd === 'PhysicalTherapist' || roleCd === 'OccupationalTherapist' || roleCd === 'SpeechTherapist') {
				const roleLabel = roleCd === 'PhysicalTherapist' ? 'PT'
					: roleCd === 'OccupationalTherapist' ? 'OT'
						: 'ST';
				const times = row.treatmentTimes != null ? row.treatmentTimes : '';
				implementBtn =
					'<button class="button-square no-click" onclick="showDialogTreatmentConfirm(\'' + row.recId + '\',' + row.rehabStartTime + ')">' +
					'<div class="role no-click">' + roleLabel + '</div>' +
					'<div class="btn-text no-click">' + times + '回目</div>' +
					'</button>';
			}
			const soapBtn =
				'<button class="button-square no-click" onclick="onClickSOAPButton(\'' + row.recId + '\')">' +
				'<i class="bi bi-pencil-square no-click d-flex" style="font-size: 30px; height: 30px; width: 30px; color: #1b294e;"></i>' +
				'<div class="btn-text no-click">SOAP</div>' +
				'</button>';
			const dischargeBtn = row.entryExit === '入院'
				? '<button type="button" class="button-square patient-discharge-button no-click" '
					+ 'onclick="showPatientDischargeDialog(event, this.dataset.recId)" data-rec-id="'
					+ escapePatientListAttribute(row.recId) + '" aria-label="退院">'
					+ '<i class="bi bi-box-arrow-right no-click"></i>'
					+ '<div class="btn-text no-click">退院</div></button>'
				: '';
			const aiCameraBtn =
				'<button class="button-square no-click" onclick="onClickAICameraButton(\'' + row.recId + '\')">' +
				'<i class="bi bi-camera-fill no-click d-flex" style="font-size: 30px; height: 30px; width: 30px; color: #1b294e;"></i>' +
				'<div class="btn-text no-click">AIカメラ</div>' +
				'</button>';
			const aiSummaryBtn =
				'<button class="button-square no-click" onclick="onClickAISummaryButton(\'' + row.recId + '\')">' +
				'<i class="bi bi-file-text-fill no-click d-flex" style="font-size: 30px; height: 30px; width: 30px; color: #1b294e;"></i>' +
				'<div class="btn-text no-click">AIサマリ</div>' +
				'</button>';
			return '<div class="no-click d-flex justify-content-center align-items-center" style="gap: 5px;">'
				+ implementBtn + soapBtn + dischargeBtn + '</div>';
		};	
	}

	var escapePatientListAttribute = function(value) {
		return String(value == null ? '' : value)
			.replace(/&/g, '&amp;')
			.replace(/"/g, '&quot;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	};

	var wardNameColumnValueRender = (data) => {
		const txt = data ? data.toString() : '○○○○';
		if (txt.length > 4) {
			const shortTxt = txt.slice(0, 4) + "...";
			return '<span class="table-tooltip" data-tooltip-content="' + txt + '">' + shortTxt + '</span>';
		}
		return txt;
	};

	// Function to apply filtered rows to DataTable
	var applyFilteredRowsToPatientList = (dt) => {
		return (rows) => {
			try {
				const data = Array.isArray(rows) ? rows : [];
				dt.clear();
				dt.rows.add(data);
				// Reset to first page to avoid empty view if current page exceeds new total
				dt.page('first').draw(false);
			} catch (e) {
				console.error('Failed to apply filtered rows to patient list.', e);
			}
		}
	}

	// Bootstrap tooltips for table cells
	var wardNameTooltips = () => {
		document.querySelectorAll(".table-tooltip").forEach((tooltipElement) => {
			const tooltipContent = tooltipElement.getAttribute("data-tooltip-content");
			if (!tooltipContent) return; // Skip if no content

			new bootstrap.Tooltip(tooltipElement, {
				title: tooltipContent,
				html: true,
				customClass: "tooltip-custom",
			});
		});
	};

}
