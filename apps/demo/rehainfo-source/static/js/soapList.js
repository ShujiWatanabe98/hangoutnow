"use strict";
{
    var treatmentDate = "";
    var treatmentTimes = "";

    var treatmentDateInputSelected = "";
    var treatmentDateSelected = "";
    var treatmentTimesSelected = "";
    var actualByRoleSelected = "";
    var soapSelected = null;
    var updateFieldSelected = null;
    var soapListDateData = null;
    var previousMonth = null;
    var nextMonth = null;
    var hcRoleCdSelected = "";
    var isHiddenButtonFunction = false;
    var edittingSoap = {};
    var allSoapDate = {};
    var copyFieldSelected = "";
    var messageError = {};
    var soapDirtyState = window.createSoapDirtyState({
        getEditingSoap: function () {
            return edittingSoap;
        },
        setEditingSoap: function (nextEditingSoap) {
            edittingSoap = nextEditingSoap;
        },
        getMessageError: function () {
            return messageError;
        },
        buildSnapshot: function (treatmentDate, treatmentTimes, actualByRole) {
            return convertDocumentToSoapItemForSave(treatmentDate, treatmentTimes, actualByRole);
        }
    });

    var getSectionFromElement = function (element) {
        if (element.id && (element.id.startsWith("treatmentStartTime-") || element.id.startsWith("treatmentEndTime-"))) {
            return "time";
        }
        if (element.name.startsWith("treatmentS-")) {
            return "s";
        }
        if (element.name.startsWith("treatmentO-")) {
            return "o";
        }
        if (element.name.startsWith("treatmentA-")) {
            return "a";
        }
        if (element.name.startsWith("treatmentP-")) {
            return "p";
        }
        return null;
    };

    // Add datepicker function similar to TreatmentPlan.js
    var add_datepicker = function (id) {
        $(function () {
            $(id).datetimepicker({
                datepicker: true,
                timepicker: false,
                format: "Y/m/d",
                scrollInput: false,
                maxDate: new Date(),
            });
        });
    };

    var saveSoapList = async function() {
        const body = Object.keys(edittingSoap).map(key => edittingSoap[key]);
        const response = await fetch(`/rehainfo/patient/${recId}/treatment-soap/save-list`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body),
            credentials: 'same-origin'
        });

        if (!response.ok) {
            throw new Error('Failed to save SOAP list');
        }

        edittingSoap = {};
        messageError = {};
        soapDirtyState.resetAll();
    };

    // Initialize when document is ready
    document.addEventListener("DOMContentLoaded", function () {
        // Get values from hidden fields
        treatmentDate = document.getElementById("treatmentDate")?.value || "";
        treatmentTimes = document.getElementById("treatmentTimes")?.value || "";

        // Initialize datepicker if date input exists
        const dateInput = document.getElementById("soapDateInput");
        if (dateInput) {
            add_datepicker("#soapDateInput");
        }

        dateInput.onchange = function () {
            if(dateInput.value !== "") {
                var nearestSoapDate = findNearestSoapDate(dateInput.value);
                // out focus dateInput
                dateInput.blur();
                if (nearestSoapDate) {
                    var soapTreatmentSelected = document.querySelectorAll(`div[id^="soap-${nearestSoapDate}"]`);
                    if (soapTreatmentSelected.length > 0) {
                        scrollToElement(soapTreatmentSelected[0].id);
                        return;
                    }
                }
                if (treatmentDateInputSelected !== dateInput.value) {
                    treatmentDateInputSelected = dateInput.value;
                    navigateToMonth(dateInput.value);
                }
            }
        };

        var manager = getRequiredAutoSaveManager();
        if (!manager) {
            return;
        }

        manager.init({
            checkDirtyFn: function() {
                return Object.keys(edittingSoap).length > 0 || Object.keys(messageError).length > 0;
            },
            saveFn: function(callback) {
                const messages = Object.keys(messageError).map(key => convertToMessageError(key, messageError[key]));
                if (messages.length > 0) {
                    showErrorMessageModal(messages.join("<br/>"));
                    callback(false);
                    return;
                }
                saveSoapList().then(function() {
                    callback(true);
                }).catch(function(error) {
                    console.error('SOAP auto-save failed:', error);
                    callback(false);
                });
            },
            modalId: '#autoSaveModal',
            excludeSelectors: [
                '#logoutBtn',
                '.no-auto-save'
            ]
        });
    });

    var normalizePreviousSoapForRender = function (data, field) {
        var normalized = Object.assign({}, data);
        var ensureSection = function (key, createEmpty) {
            if (!normalized[key] || normalized[key].length === 0) {
                normalized[key] = createEmpty();
            }
        };
        if (field === "all" || field === "s") {
            ensureSection("treatmentS", function () {
                return [{ freetext: "" }];
            });
        }
        if (field === "all" || field === "o") {
            ensureSection("treatmentO", function () {
                return [{
                    freeText: "",
                    evaluationDetail: [],
                    inTreatmentDetail: [],
                    outTreatmentDetail: [],
                    eventDetail: [],
                }];
            });
        }
        if (field === "all" || field === "a") {
            ensureSection("treatmentA", function () {
                return [{ freeText: "", problemList: [] }];
            });
        }
        if (field === "all" || field === "p") {
            ensureSection("treatmentP", function () {
                return [{
                    freeText: "",
                    evaluationList: [],
                    inTreatmentList: [],
                    outTreatmentList: [],
                }];
            });
        }
        return normalized;
    };

    // Load previous SOAP data for specific section
    function loadPreviousSoap(treatmentDate, treatmentTimes, field) {
        let url =
            "/rehainfo/patient/" +
            recId +
            "/treatment-soap/previous-soap?treatmentDate=" +
            encodeURIComponent(treatmentDate) +
            "&treatmentTimes=" +
            treatmentTimes;

        fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        })
            .then((response) => {
                if (response.ok) {
                    return response.json();
                }
                throw new Error("Failed to load previous SOAP data");
            })
            .then((data) => {
                var renderData = normalizePreviousSoapForRender(data, field);
                updateSoapSection(field, treatmentDate, treatmentTimes, renderData);
                if (messageError[treatmentDate + "-" + treatmentTimes] === undefined) {
                    soapDirtyState.markDirty(treatmentDate, treatmentTimes, hcRoleCd, soapDirtyState.getDirtySectionsForField(field));
                }
                // copy from previous success
                showSuccessMessageModal("前回のデータを複写しました。");
            })
            .catch((error) => {
                console.error("Error loading previous SOAP data:", error);
                // copy from previous error
                showErrorMessageModal("前回のデータの複写に失敗しました。");
            });
    }

    var onClickAddNewSoap = function () {
        var doShowAddNewSoap = function() {
            $("#addNewSoapModal").modal("show");

            $("#addNewSoapModal").on("shown.bs.modal", function () {
                // Only initialize if not already initialized
                if (!$("#addNewSoapDateInput").hasClass("xdsoft_datetimepicker")) {
                    add_datepicker("#addNewSoapDateInput");
                }
            });
        };

        executeWithAutoSave(doShowAddNewSoap);
    };

    var onClickUpdateSoap = function (
        treatmentDate,
        treatmentTimes,
        actualByRole,
        updateField
    ) {
        treatmentDateSelected = treatmentDate;
        treatmentTimesSelected = treatmentTimes;
        actualByRoleSelected = actualByRole;
        updateFieldSelected = updateField;
        let modalId = "updateSoapModal_1";
        $("#" + modalId).modal("show");
    };

    var onClickUpdateSoap_o = async function (
        treatmentDate,
        treatmentTimes,
        actualByRole
    ) {
        treatmentDateSelected = treatmentDate;
        treatmentTimesSelected = treatmentTimes;
        actualByRoleSelected = actualByRole;
        updateFieldSelected = "o";
        await getUpdateTreatmentSoapO();
        let modalId = "updateSoapModal_o";
        $("#" + modalId).modal("show");
    };

    var onClickCopySoap = function (treatmentDate, treatmentTimes, copyField) {
        treatmentDateSelected = treatmentDate;
        treatmentTimesSelected = treatmentTimes;
        copyFieldSelected = copyField;
        getLast5Soap();
        let modalId = "copySoapModal";
        $("#" + modalId).modal("show");
    };

    var onClickUpdateSoapAll = function (
        treatmentDate,
        treatmentTimes,
        actualByRole
    ) {
        treatmentDateSelected = treatmentDate;
        treatmentTimesSelected = treatmentTimes;
        actualByRoleSelected = actualByRole;
        updateFieldSelected = "all";

        let modalId = "updateSoapModal_all";
        $("#" + modalId).modal("show");
    };

    var scrollToTop = function () {
        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    };

    var scrollToElement = function (elementId) {
        var element = document.getElementById(elementId);
        var elementPosition = element.offsetTop;
        var offsetPosition = elementPosition - 200;
        
        window.scrollTo({
            top: offsetPosition,
            behavior: "smooth"
        });
    };

    // Export functions for global access
    window.loadPreviousSoap = loadPreviousSoap;

    // Loading state management functions
    var showSoapLoading = function() {
        document.getElementById("soap-loading-container").classList.remove("d-none");
        document.getElementById("soap-list-container-content").classList.add("d-none");
    };

    var hideSoapLoading = function() {
        document.getElementById("soap-loading-container").classList.add("d-none");
        document.getElementById("soap-list-container-content").classList.remove("d-none");
    };

    $(document).ready(function () {
        getTreatmentSoapList("", hcRoleCd);
        hcRoleCdSelected = hcRoleCd;
    });

    async function getTreatmentSoapList(treatmentDate, hcRoleCd) {
        try {
            showSoapLoading();
            
            const response = await fetch(
                "/rehainfo/patient/" +
                    recId +
                    "/treatment-soap/list?treatmentDate=" +
                    treatmentDate +
                    "&hcRoleCd=" +
                    hcRoleCd
            );
            
            if (treatmentDate !== "") {
                soapDateLabel.innerHTML =
                    treatmentDate.split("/")[0] + "/" + treatmentDate.split("/")[1];
            }
            const data = await response.json();
            var soapDateInput = document.getElementById("soapDateInput");
            soapDateInput.value = treatmentDate;
            allSoapDate = {};
            addTreatmentSoapList(data.treatmentSoapList);
            previousMonth = data.previousMonth;
            nextMonth = data.nextMonth;
            edittingSoap = {};
            messageError = {};
            
            if (previousMonth) {
                document.getElementById("previousMonthBtn").style.color = "#1B294E";
                document.getElementById("previousMonthBtn").style.cursor = "pointer";
            } else {
                document.getElementById("previousMonthBtn").style.color = "#E0E0E0";
                document.getElementById("previousMonthBtn").style.cursor = "not-allowed";
            }
            if (nextMonth) {
                document.getElementById("nextMonthBtn").style.color = "#1B294E";
                document.getElementById("nextMonthBtn").style.cursor = "pointer";
            } else {
                document.getElementById("nextMonthBtn").style.color = "#E0E0E0";
                document.getElementById("nextMonthBtn").style.cursor = "not-allowed";
            }
            validateAllTreatmentTime();
        } catch (error) {
            console.error("Error loading SOAP list:", error);
        } finally {
            hideSoapLoading();
            if (treatmentDate !== "") {
                var nearestSoapDate = findNearestSoapDate(treatmentDate);
                if (nearestSoapDate) {
                    var soapTreatmentSelected = document.querySelectorAll(`div[id^="soap-${nearestSoapDate}"]`);
                    if (soapTreatmentSelected.length > 0) {
                        scrollToElement(soapTreatmentSelected[0].id);
                    }
                }
            }
        }
    }

    var addTreatmentSoapList = function (soapList) {
        var soapDateLabel = document.getElementById("soapDateLabel");
        var soapDateList = document.getElementById("soapDateList");
        var soapDateInput = document.getElementById("soapDateInput");
        soapDateList.innerHTML = "";
        var soapDateListArray = {};
        var soapRightContainer = document.getElementById(
            "soap-right-container"
        );
        soapRightContainer.innerHTML = "";
        if (soapList.length > 0) {
            soapList.forEach((soap, index) => {
                if (index === 0 && soapDateInput.value === "") {
                    soapDateLabel.innerHTML = soap.treatmentDate.split("/")[0] + "/" + soap.treatmentDate.split("/")[1];
                    soapDateInput.value = soap.treatmentDate;
                }
                soapRightContainer.innerHTML += addTreatmentSoap(soap);
                soapDateListArray[
                    soap.treatmentDate.split("/")[1] +
                        "/" +
                        soap.treatmentDate.split("/")[2]
                ] = soap.treatmentDate;
                allSoapDate[soap.treatmentDate] = true;
            });
            // textAreaEvent();
            setTimeout(function() {
                textAreaEvent();
            }, 300);
            Object.keys(soapDateListArray).forEach((date, index) => {
                soapDateList.innerHTML += `<label class="gks-header-2 gks-not-break-line mt-2" style="cursor: pointer;" onclick="scrollToSoapDate('${soapDateListArray[date]}')">${date}</label>`;
            });
            document.getElementById("scrollToTopBtn").classList.remove("d-none");
        } else {
            soapRightContainer.innerHTML = "<div class='d-flex justify-content-center align-items-center' style='height: 106px;'>" +
            "<div class='text-center'>" + "<h5 class='text-muted'>SOAPのデータがありません。</h5>" + "</div>" + "</div>";
            document.getElementById("scrollToTopBtn").classList.add("d-none");
        }
    };

    var addTreatmentSoap = function (soap) {
        var html = `
			<div class="row" id="soap-${soap.treatmentDate}-${soap.treatmentTimes}">
				<div class="soap-header">
					<div class="soap-date-session">
						<div class="date-session-box">${soap.treatmentDate}　${
            soap.treatmentTimes
        }回目</div>
						${isHiddenButtonFunction ? "" : `<div class="ms-1" style="display: inline-flex; align-items: center; justify-content: center; padding: 5px; background-color: var(--border-color);"><button type="button" class="border rounded-circle" style="display: inline-flex; align-items: center; justify-content: center; padding: 6px; border-color: #dee2e6 !important;" onclick="onClickDeleteTreatmentSoap('${soap.treatmentDate}', ${soap.treatmentTimes})"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0.838257 3.25H13.1617M5.76765 6.375V9.5M8.23234 6.375V9.5M2.0706 3.25H11.9294L10.9558 12.1375C10.9225 12.4434 10.779 12.726 10.553 12.9313C10.327 13.1365 10.0343 13.25 9.73088 13.25H4.26911C3.96573 13.25 3.673 13.1365 3.44698 12.9313C3.22096 12.726 3.07753 12.4434 3.04416 12.1375L2.0706 3.25ZM4.13171 1.46688C4.23137 1.25248 4.38909 1.07125 4.58645 0.944319C4.78381 0.817391 5.01268 0.749997 5.24636 0.75H8.75363C8.98742 0.749879 9.21642 0.817216 9.4139 0.944152C9.61138 1.07109 9.76919 1.25238 9.8689 1.46688L10.697 3.25H3.30295L4.13171 1.46688Z" stroke="#494949" stroke-linecap="round" stroke-linejoin="round"></path></svg></button></div>`}
					</div>
					<div class="soap-bulk-operations">
                        <span class="bulk-operations-label">一括操作</span>
                    ${isHiddenButtonFunction || isPastDate(soap.treatmentDate) ? "" : `
						<button type="button" class="btn soap-bulk-btn" onclick="onClickUpdateSoapAll('${
                            soap.treatmentDate
                        }', ${soap.treatmentTimes}, '${
            soap.actualByRole
        }')">更新</button>
                        `}
						${isHiddenButtonFunction ? "" : `<button type="button" class="btn soap-bulk-btn" onclick="saveSoapItem('${
                            soap.treatmentDate
                        }', ${soap.treatmentTimes}, '${
            soap.actualByRole
        }')">保存</button>
                        `}
                        ${isHiddenButtonFunction ? "" : `
                        ${isPastDate(soap.treatmentDate) ? `
                            <button type="button" class="btn soap-bulk-btn"
											onclick="onClickCopySoap('${soap.treatmentDate}', ${soap.treatmentTimes}, 'all')">複写</button>
                            ` : `
						<button type="button" class="btn soap-bulk-btn" onclick="loadPreviousSoap('${
                            soap.treatmentDate
                        }', ${soap.treatmentTimes}, 'all')">前回複写
						</button>
                        `}
                        `}
                        ${isHiddenButtonFunction ? "" : `<button type="button" class="btn soap-bulk-btn" onclick="onClickCopyTextSoap('${soap.treatmentDate}', ${soap.treatmentTimes})">コピー
						</button>
                        `}
					</div>
				</div>
			</div>
			<div class="col bg-white p-3 scrollable-content">
				<div class="soap-header-container">
					<div class="soap-header-white">
						<div class="soap-time-section">
							<label class="soap-label">実施時間</label>
							<div class="time-inputs-container">
								<input class="input-time-box d-flex justify-content-center" id="treatmentStartTime-${soap.treatmentDate}-${soap.treatmentTimes}" value="${
                                    soap.treatmentStartTime === null ? "" : soap.treatmentStartTime
                                }" style="text-align: center; max-width: 120px;" ${isHiddenButtonFunction ? "readonly" : ""}/>
								<span class="time-separator">ー</span>
								<input class="input-time-box d-flex justify-content-center" id="treatmentEndTime-${soap.treatmentDate}-${soap.treatmentTimes}" value="${
                                    soap.treatmentEndTime === null ? "" : soap.treatmentEndTime
                                }" style="text-align: center; max-width: 120px;" ${isHiddenButtonFunction ? "readonly" : ""}/>
                                <div class="d-none" id="actualMinutes-${soap.treatmentDate}-${soap.treatmentTimes}">${
                                    soap.actualMinutes === null ? "" : soap.actualMinutes
                                }</div>
							</div>
						</div>
						<div class="soap-implementer-section">
							<label class="soap-label">実施者：</label>
							<span class="implementer-name">${soap.userName}</span>
						</div>
					</div>
                    <div class="soap-header-white" style="margin-top: 10px; padding-top:0; padding-bottom:0;">
                        <div class="error-message-text text-danger" id="treatmentTimeErrorMessage-${soap.treatmentDate}-${soap.treatmentTimes}">
                        </div>
                    </div>
				</div>

				<!-- SOAP Form -->
				<form id="soapForm" name="treatment-soap-form">
					<!-- S Section (Subjective) -->
					<div class="soap-section">
						<div class="soap-section-row">
							<div class="soap-section-label-col">
								<div class="soap-section-label">S</div>
							</div>
							<div class="soap-section-content-col" id="soapS-${soap.treatmentDate}-${
            soap.treatmentTimes
        }">
								${addTreatmentSoapS(soap)}
							</div>
							<div class="soap-section-buttons-col">
								<div class="soap-section-buttons">
                                    ${isHiddenButtonFunction ? "" : isPastDate(soap.treatmentDate) ? `
                                        <button type="button" class="btn soap-btn previous-btn"
                                            onclick="onClickCopySoap('${soap.treatmentDate}', ${soap.treatmentTimes}, 's')">複写</button>
                                    ` : `
									<button type="button" class="btn soap-btn previous-btn"
										onclick="onClickUpdateSoap('${soap.treatmentDate}', ${soap.treatmentTimes}, '${
            soap.actualByRole
        }', 's')">更新</button>
                                    `}
                                    ${isHiddenButtonFunction ? "" : `
									<button type="button" class="btn soap-btn previous-btn"
										onclick="loadPreviousSoap('${soap.treatmentDate}', ${
            soap.treatmentTimes
        }, 's')">前回</button>
                                    `}
								</div>
							</div>
						</div>
					</div>

					<!-- O Section (Objective) -->
					<div class="soap-section">
						<div class="soap-section-row">
							<div class="soap-section-label-col">
								<div class="soap-section-label">O</div>
							</div>
							<div class="soap-section-content-col" id="soapO-${soap.treatmentDate}-${
            soap.treatmentTimes
        }">
								${addTreatmentSoapO(soap)}
							</div>
							<div class="soap-section-buttons-col">
								<div class="soap-section-buttons">
                                    ${isHiddenButtonFunction ? "" : isPastDate(soap.treatmentDate) ? `
                                        <button type="button" class="btn soap-btn previous-btn"
                                            onclick="onClickCopySoap('${soap.treatmentDate}', ${soap.treatmentTimes}, 'o')">複写</button>
                                    ` : `
									<button type="button" class="btn soap-btn previous-btn"
										onclick="onClickUpdateSoap_o('${soap.treatmentDate}', ${
            soap.treatmentTimes
        }, '${soap.actualByRole}')">更新</button>
                                    `}
                                    ${isHiddenButtonFunction ? "" : `
									<button type="button" class="btn soap-btn previous-btn"
										onclick="loadPreviousSoap('${soap.treatmentDate}', ${
            soap.treatmentTimes
        }, 'o')">前回</button>
                                    `}
								</div>
							</div>
						</div>
					</div>

					<!-- A Section (Assessment) -->
					<div class="soap-section">
						<div class="soap-section-row">
							<div class="soap-section-label-col">
								<div class="soap-section-label">A</div>
							</div>
							<div class="soap-section-content-col" id="soapA-${soap.treatmentDate}-${
            soap.treatmentTimes
        }">
								${addTreatmentSoapA(soap)}
							</div>
							<div class="soap-section-buttons-col">
								<div class="soap-section-buttons">
                                    ${isHiddenButtonFunction ? "" : isPastDate(soap.treatmentDate) ? `
                                        <button type="button" class="btn soap-btn previous-btn"
                                            onclick="onClickCopySoap('${soap.treatmentDate}', ${soap.treatmentTimes}, 'a')">複写</button>
                                    ` : `
									<button type="button" class="btn soap-btn previous-btn"
										onclick="onClickUpdateSoap('${soap.treatmentDate}', ${soap.treatmentTimes}, '${
            soap.actualByRole
        }', 'a')">更新</button>
                                    `}
                                    ${isHiddenButtonFunction ? "" : `
									<button type="button" class="btn soap-btn previous-btn"
										onclick="loadPreviousSoap('${soap.treatmentDate}', ${
            soap.treatmentTimes
        }, 'a')">前回</button>
                                    `}
								</div>
							</div>
						</div>
					</div>

					<!-- P Section (Plan) -->
					<div class="soap-section">
						<div class="soap-section-row">
							<div class="soap-section-label-col">
								<div class="soap-section-label">P</div>
							</div>
							<div class="soap-section-content-col" id="soapP-${soap.treatmentDate}-${
            soap.treatmentTimes
        }">
								${addTreatmentSoapP(soap)}
							</div>
							<div class="soap-section-buttons-col">
								<div class="soap-section-buttons">
                                    ${isHiddenButtonFunction ? "" : isPastDate(soap.treatmentDate) ? `
                                        <button type="button" class="btn soap-btn previous-btn"
                                            onclick="onClickCopySoap('${soap.treatmentDate}', ${soap.treatmentTimes}, 'p')">複写</button>
                                    ` : `
									<button type="button" class="btn soap-btn previous-btn"
										onclick="onClickUpdateSoap('${soap.treatmentDate}', ${soap.treatmentTimes}, '${
            soap.actualByRole
        }', 'p')">更新</button>
                                    `}
                                    ${isHiddenButtonFunction ? "" : `
									<button type="button" class="btn soap-btn previous-btn"
										onclick="loadPreviousSoap('${soap.treatmentDate}', ${
            soap.treatmentTimes
        }, 'p')">前回</button>
                                    `}
								</div>
							</div>
						</div>
					</div>

					<!-- Hidden fields for form data -->
					<input type="hidden" id="recId" name="recId" th:value="${recId}" />
					<input type="hidden" id="treatmentDate" name="treatmentDate"
						th:value="${treatmentDate}" />
					<input type="hidden" id="treatmentTimes" name="treatmentTimes"
						th:value="${treatmentTimes}" />
				</form>
			</div>
		`;
        return html;
    };

    var addTreatmentSoapS = function (soap) {
        var html = "";
        (soap.treatmentS || []).forEach((s, index) => {
            if (index === 0 || s.freetext !== "") {
                html += `
				<textarea class="form-control soap-textarea" name="treatmentS-${soap.treatmentDate}-${soap.treatmentTimes}"
					${isHiddenButtonFunction ? "readonly" : ""}>${s.freetext}</textarea>
			`;
            }
        });
        return html;
    };

    var addTreatmentSoapO = function (soap) {
        console.log(soap, "soap")
        var html = ``;
        var htmlTreatmentEvaluation = ``;
        var htmlLeft = ``;
        var htmlRight = ``;
        var htmlEvent = ``;
        html += `${addTreatmentSoapOFreeText(soap)}`;

        soap?.treatmentO?.forEach((o, index) => {
            htmlTreatmentEvaluation = `<div class="soap-2-col-container">`;
            htmlLeft = `<div class="soap-col-left soap-textarea-scrollable">`;
            htmlRight = `<div class="soap-col-right soap-textarea-scrollable">`;
            htmlEvent = ``;
            htmlLeft += addTreatmentSoapOLeft(
                o,
                soap.treatmentDate,
                soap.treatmentTimes,
                index
            );
            htmlRight += addTreatmentSoapORight(
                o,
                soap.treatmentDate,
                soap.treatmentTimes,
                index
            );
            htmlEvent += addTreatmentSoapOEvent(
                o,
                soap.treatmentDate,
                soap.treatmentTimes,
                index
            );
            htmlTreatmentEvaluation += htmlLeft + `</div>`;
            htmlTreatmentEvaluation += htmlRight + `</div>`;
            htmlTreatmentEvaluation += `</div>`;
            htmlTreatmentEvaluation += htmlEvent;
            html += htmlTreatmentEvaluation;
        });
        return html;
    };

    var addTreatmentSoapORight = function (
        soapO,
        treatmentDate,
        treatmentTimes,
        index
    ) {
        var html = "";
        soapO?.inTreatmentDetail?.forEach((inTreatment, indexTreatment) => {
            if (inTreatment.treatmentPlanName !== "") {
                html += `
				<textarea class="form-control soap-textarea" id="${inTreatment.treatmentPlanId}" name="treatmentO-${treatmentDate}-${treatmentTimes}-inTreatment-${index}"
						${isHiddenButtonFunction ? "readonly" : ""}>${inTreatment.treatmentPlanName}</textarea>
				`;
            } else {
                html += `
				<textarea class="d-none" id="${inTreatment.treatmentPlanId}" name="treatmentO-${treatmentDate}-${treatmentTimes}-inTreatment-${index}"
						${isHiddenButtonFunction ? "readonly" : ""}>${inTreatment.treatmentPlanName}</textarea>
				`;
            }
            inTreatment?.treatmentItems?.forEach((item) => {
                if (item.value !== "") {
                    html += `
					<textarea class="form-control soap-textarea" id="${item.id}" name="treatmentO-${treatmentDate}-${treatmentTimes}-inTreatmentItem-${index}-${indexTreatment}"
						${isHiddenButtonFunction ? "readonly" : ""}>${item.value}</textarea>
				`;
                } else {
                    html += `
					<textarea class="d-none" id="${item.id}" name="treatmentO-${treatmentDate}-${treatmentTimes}-inTreatmentItem-${index}-${indexTreatment}"
						${isHiddenButtonFunction ? "readonly" : ""}>${item.value}</textarea>
				`;
                }
            });
        });
        soapO?.outTreatmentDetail?.forEach((outTreatment, indexTreatment) => {
            if (outTreatment.treatmentPlanName !== "") {
                html += `
				<textarea class="form-control soap-textarea" id="${outTreatment.treatmentPlanId}" name="treatmentO-${treatmentDate}-${treatmentTimes}-outTreatment-${index}"
					${isHiddenButtonFunction ? "readonly" : ""}>${outTreatment.treatmentPlanName}</textarea>
			`;
            } else {
                html += `
				<textarea class="d-none" id="${outTreatment.treatmentPlanId}" name="treatmentO-${treatmentDate}-${treatmentTimes}-outTreatment-${index}"
						${isHiddenButtonFunction ? "readonly" : ""}>${outTreatment.treatmentPlanName}</textarea>
				`;
            }
            outTreatment?.treatmentItems?.forEach((item) => {
                if (item.value !== "") {
                    html += `
					<textarea class="form-control soap-textarea" id="${item.id}" name="treatmentO-${treatmentDate}-${treatmentTimes}-outTreatmentItem-${index}-${indexTreatment}"
						${isHiddenButtonFunction ? "readonly" : ""}>${item.value}</textarea>
				`;
                } else {
                    html += `
					<textarea class="d-none" id="${item.id}" name="treatmentO-${treatmentDate}-${treatmentTimes}-outTreatmentItem-${index}-${indexTreatment}"
						${isHiddenButtonFunction ? "readonly" : ""}>${item.value}</textarea>
				`;
                }
            });
        });
        return html;
    };

    var addTreatmentSoapOLeft = function (
        soapO,
        treatmentDate,
        treatmentTimes,
        index
    ) {
        var html = "";
        soapO?.evaluationDetail?.forEach((evaluation) => {
            if (evaluation.text !== "") {
                html += `
				<textarea class="form-control soap-textarea" id="${evaluation.planId}" name="treatmentO-${treatmentDate}-${treatmentTimes}-evaluation-${index}"
					${isHiddenButtonFunction ? "readonly" : ""}>${evaluation.text}</textarea>
			`;
            } else {
                html += `
				<textarea class="d-none" id="${evaluation.planId}" name="treatmentO-${treatmentDate}-${treatmentTimes}-evaluation-${index}"
						${isHiddenButtonFunction ? "readonly" : ""}>${evaluation.text}</textarea>
				`;
            }
        });
        return html;
    };

    var addTreatmentSoapOEvent = function (
        soapO,
        treatmentDate,
        treatmentTimes,
        index
    ) {
        var html = ``;
        soapO?.eventDetail?.forEach((event) => {
            if (event.eventValue !== "") {
            html += `
                <textarea class="form-control soap-textarea" id="${event.eventId}" name="treatmentO-${treatmentDate}-${treatmentTimes}-event-${index}"
                    ${isHiddenButtonFunction ? "readonly" : ""}>${event.eventValue}</textarea>
                `;
            } else {
                html += `
                <textarea class="d-none" id="${event.eventId}" name="treatmentO-${treatmentDate}-${treatmentTimes}-event-${index}"
                    ${isHiddenButtonFunction ? "readonly" : ""}>${event.eventValue}</textarea>
                `;
            }
        });
        return html;
    };  

    var addTreatmentSoapOFreeText = function (soap) {
        var html = ``;
        soap?.treatmentO?.forEach((o, index) => {
            if (index === 0 || o.freeText !== "") {
                html += `
				<textarea class="form-control soap-textarea" name="treatmentO-${soap.treatmentDate}-${soap.treatmentTimes}-freeText-${index}"
					${isHiddenButtonFunction ? "readonly" : ""}>${o.freeText}</textarea>
			`;
            }
        });
        return html;
    };

    var addTreatmentSoapA = function (soap) {
        var html = `<div class="soap-2-col-container">`;
        var htmlLeft = `<div class="soap-col-left soap-textarea-scrollable">`;
        var htmlRight = `<div class="soap-col-right soap-textarea-scrollable">`;
        var htmlFreeText = ``;
        soap?.treatmentA?.forEach((o, i) => {
            var length = o?.problemList?.length;
            if (length > 0) {
                o?.problemList?.forEach((problem, index) => {
                    if (problem.value !== "") {
                        if (index + 1 <= Math.round(length / 2)) {
                            htmlLeft += `
							<textarea class="form-control soap-textarea" id="${problem.id}" name="treatmentA-${soap.treatmentDate}-${soap.treatmentTimes}-problem-${i}"
								${isHiddenButtonFunction ? "readonly" : ""}>${problem.value}</textarea>
						`;
                        } else {
                            htmlRight += `
							<textarea class="form-control soap-textarea" id="${problem.id}" name="treatmentA-${soap.treatmentDate}-${soap.treatmentTimes}-problem-${i}"
								${isHiddenButtonFunction ? "readonly" : ""}>${problem.value}</textarea>
						`;
                        }
                    } else {
                        htmlFreeText += `
						<textarea class="d-none" id="${problem.id}" name="treatmentA-${soap.treatmentDate}-${soap.treatmentTimes}-problem-${i}"
							${isHiddenButtonFunction ? "readonly" : ""}>${problem.value}</textarea>
					`;
                    }
                });
            }
            if (i === 0 || o.freeText !== "") {
                htmlFreeText += `
				<textarea class="form-control soap-textarea" name="treatmentA-${soap.treatmentDate}-${soap.treatmentTimes}-freeText-${i}"
					${isHiddenButtonFunction ? "readonly" : ""}>${o.freeText}</textarea>
			`;
            }
        });

        html += htmlLeft + `</div>`;
        html += htmlRight + `</div>`;
        html += `</div>`;
        html += htmlFreeText;
        return html;
    };

    var addTreatmentSoapP = function (soap) {
        var html = "";
        soap?.treatmentP?.forEach((p, i) => {
            p?.evaluationList?.forEach((evaluation) => {
                if (evaluation.text !== "") {
                    html += `
					<textarea class="form-control soap-textarea" id="${evaluation.planId}" name="treatmentP-${soap.treatmentDate}-${soap.treatmentTimes}-evaluation-${i}"
							${isHiddenButtonFunction ? "readonly" : ""}>${evaluation.text}</textarea>
					`;
                } else {
                    html += `
					<textarea class="d-none" id="${evaluation.planId}" name="treatmentP-${soap.treatmentDate}-${soap.treatmentTimes}-evaluation-${i}"
							${isHiddenButtonFunction ? "readonly" : ""}>${evaluation.text}</textarea>
				`;
                }
            });
            p?.inTreatmentList?.forEach((inTreatment) => {
                if (inTreatment.treatmentPlanName !== "") {
                    html += `
					<textarea class="form-control soap-textarea" id="${inTreatment.treatmentPlanId}" name="treatmentP-${soap.treatmentDate}-${soap.treatmentTimes}-inTreatment-${i}"
							${isHiddenButtonFunction ? "readonly" : ""}>${inTreatment.treatmentPlanName}</textarea>
				`;
                } else {
                    html += `
					<textarea class="d-none" id="${inTreatment.treatmentPlanId}" name="treatmentP-${soap.treatmentDate}-${soap.treatmentTimes}-inTreatment-${i}"
							${isHiddenButtonFunction ? "readonly" : ""}>${inTreatment.treatmentPlanName}</textarea>
				`;
                }
            });
            p?.outTreatmentList?.forEach((outTreatment) => {
                if (outTreatment.treatmentPlanName !== "") {
                    html += `
					<textarea class="form-control soap-textarea" id="${outTreatment.treatmentPlanId}" name="treatmentP-${soap.treatmentDate}-${soap.treatmentTimes}-outTreatment-${i}"
						${isHiddenButtonFunction ? "readonly" : ""}>${outTreatment.treatmentPlanName}</textarea>
				`;
                } else {
                    html += `
					<textarea class="d-none" id="${outTreatment.treatmentPlanId}" name="treatmentP-${soap.treatmentDate}-${soap.treatmentTimes}-outTreatment-${i}"
						${isHiddenButtonFunction ? "readonly" : ""}>${outTreatment.treatmentPlanName}</textarea>
				`;
                }
            });
        });

        soap?.treatmentP?.forEach((p, i) => {
            if (i === 0 || p.freeText !== "") {
                html += `
				<textarea class="form-control soap-textarea" name="treatmentP-${soap.treatmentDate}-${soap.treatmentTimes}-freeText-${i}"
					${isHiddenButtonFunction ? "readonly" : ""}>${p.freeText}</textarea>
			`;
            }
        });
        return html;
    };

    var updateLastestField = async function (
        treatmentDate,
        treatmentTimes,
        actualByRole,
        updateField,
        isAddBelow,
        isUpdateEvaluation,
        isUpdateTreatmentDetail
    ) {
        var body = {
            isUpdateTreatmentSoapS:
                updateField === "s" || updateField === "all",
            isUpdateTreatmentSoapO:
                updateField === "o" || updateField === "all",
            isUpdateTreatmentSoapA:
                updateField === "a" || updateField === "all",
            isUpdateTreatmentSoapP:
                updateField === "p" || updateField === "all",
            isAddBelow: isAddBelow,
            isUpdateEvaluation: isUpdateEvaluation,
            isUpdateTreatmentDetail: isUpdateTreatmentDetail,
            treatmentDate: treatmentDate,
            treatmentTimes: treatmentTimes,
            actualByRole: actualByRole,
        };

        let options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        };

        let url =
            "/rehainfo/patient/" +
            recId +
            "/treatment-soap/update-lastest-field";

        let response = await fetch(url, options);
        let data = await response.json();
        return data;
    };
    var updateSoap = async function (type) {
        try {
            var isUpdateEvaluation = false;
            var isUpdateTreatmentDetail = false;
            var updateSoapTypeCheckbox1 = document.getElementById("updateSoapTypeCheckbox1");
            var updateSoapTypeCheckbox2 = document.getElementById("updateSoapTypeCheckbox2");
            if (updateSoapTypeCheckbox1) {
                isUpdateEvaluation = updateSoapTypeCheckbox1.checked;
            } else {
                isUpdateEvaluation = true;
            }
            if (updateSoapTypeCheckbox2) {
                isUpdateTreatmentDetail = updateSoapTypeCheckbox2.checked;
            } else {
                isUpdateTreatmentDetail = true;
            }
            if (updateFieldSelected === "all") {
                isUpdateEvaluation = true;
                isUpdateTreatmentDetail = true;
            }
            let data = null;
            if (type === "overwrite") {
                data = await updateLastestField(
                    treatmentDateSelected,
                    treatmentTimesSelected,
                    actualByRoleSelected,
                    updateFieldSelected,
                    false,
                    isUpdateEvaluation,
                    isUpdateTreatmentDetail
                );
            } else if (type === "insert") {
                data = await updateLastestField(
                    treatmentDateSelected,
                    treatmentTimesSelected,
                    actualByRoleSelected,
                    updateFieldSelected,
                    true,
                    isUpdateEvaluation,
                    isUpdateTreatmentDetail
                );
            }
            updateSoapSection(
                updateFieldSelected,
                treatmentDateSelected,
                treatmentTimesSelected,
                data
            );
            soapDirtyState.clearAfterUpdate(
                treatmentDateSelected,
                treatmentTimesSelected,
                actualByRoleSelected,
                updateFieldSelected
            );
            // treatment date treatment times success
            showSuccessMessageModal(`${treatmentDateSelected} ${treatmentTimesSelected}回目 のSOAPを更新しました。`);
        } catch (error) {
            showErrorMessageModal("SOAPの更新に失敗しました。");
        }
    };

    var updateSoapSection = async function (
        updateFieldSelected,
        treatmentDateSelected,
        treatmentTimesSelected,
        data
    ) {
        data.treatmentDate = treatmentDateSelected;
        data.treatmentTimes = treatmentTimesSelected;
        var soapSectionRenderers = [
            { section: "s", elementPrefix: "soapS-", render: addTreatmentSoapS },
            { section: "o", elementPrefix: "soapO-", render: addTreatmentSoapO },
            { section: "a", elementPrefix: "soapA-", render: addTreatmentSoapA },
            { section: "p", elementPrefix: "soapP-", render: addTreatmentSoapP },
        ];
        soapSectionRenderers.forEach(function (item) {
            if (updateFieldSelected !== "all" && updateFieldSelected !== item.section) {
                return;
            }
            document.getElementById(
                item.elementPrefix + treatmentDateSelected + "-" + treatmentTimesSelected
            ).innerHTML = item.render(data);
        });
        // Re-attach event listeners and auto-resize for newly rendered textareas
        setTimeout(function() {
            textAreaEvent();
        }, 300);
    };

    var getUpdateTreatmentSoapO = async function () {
        var url =
            "/rehainfo/patient/" +
            recId +
            "/treatment-soap/get-update-treatment-soap-o?treatmentDate=" +
            treatmentDateSelected +
            "&treatmentTimes=" +
            treatmentTimesSelected;
        let response = await fetch(url);
        let data = await response.json();
        addUpdateItemTreatmentSoapO(data);
        return data;
    };

    var addUpdateItemTreatmentSoapO = function (treatmentSoapO) {
        var html = `
        `;
        var htmlEvaluation = addUpdateEvaluationItemSoapO(treatmentSoapO);
        var htmlTreatment = addUpdateTreatmentItemSoapO(treatmentSoapO);
        if (htmlEvaluation !== "" || htmlTreatment !== "") {
            html += `
            <div class="gks-normal-text-16">更新するデータ選んでください
            </div>
            <div class="mt-2">
            `;
            html += htmlEvaluation + htmlTreatment;
            html += `
            </div>`;
        } else {
            html += `
            <div class="gks-normal-text-16 text-center">最新データに更新します
							</div>
            `;
        }
        document.getElementById("updateSoapModal_o_body").innerHTML = html;
    };

    var addUpdateEvaluationItemSoapO = function (treatmentSoapO) {
        if (treatmentSoapO?.evaluationDetail?.length === 0) {
            return "";
        }
        var html = `
		<div class="d-flex align-items-start check-box-container">
			<input class="form-check-input radio-large" type="checkbox" name="updateSoapType"
				id="updateSoapTypeCheckbox1" value="0" />
			<label class="gks-normal-text-16" for="updateSoapTypeCheckbox1">
				評価
				<div class="d-block">
					<ul id="ul-evaluation">
		`;
        treatmentSoapO?.evaluationDetail?.forEach((evaluation) => {
            html += `
			<li>${evaluation.text.split("\n")[0]}</li>
		`;
        });
        html += `
					</ul>
				</div>
			</label>
		</div>`;
        return html;
    };

    var addUpdateTreatmentItemSoapO = function (treatmentSoapO) {
        if (
            treatmentSoapO?.inTreatmentDetail?.length === 0 &&
            treatmentSoapO?.outTreatmentDetail?.length === 0
        ) {
            return "";
        }
        var html = `
		<div class="d-flex align-items-start check-box-container">
			<input class="form-check-input radio-large" type="checkbox" name="updateSoapType"
				id="updateSoapTypeCheckbox2" value="0" />
			<label class="gks-normal-text-16" for="updateSoapTypeCheckbox2">
				治療
				<div class="d-block">
					<ul id="ul-treatment">
		`;
        treatmentSoapO?.inTreatmentDetail?.forEach((inTreatment) => {
            html += `
			<li>${inTreatment.treatmentPlanName}</li>
		`;
        });
        treatmentSoapO?.outTreatmentDetail?.forEach((outTreatment) => {
            html += `
			<li>${outTreatment.treatmentPlanName}</li>
		`;
        });
        html += `
					</ul>
				</div>
			</label>
		</div>
	`;
        return html;
    };

    var convertDocumentToSoapItemForSave = function (treatmentDate, treatmentTimes, actualByRole) {
        var treatmentStartTimeForSave = null;
        var treatmentEndTimeForSave = null;
        var treatmentStartTime = document.getElementById(`treatmentStartTime-${treatmentDate}-${treatmentTimes}`).value;
        var treatmentEndTime = document.getElementById(`treatmentEndTime-${treatmentDate}-${treatmentTimes}`).value;
        if (treatmentStartTime !== "" && treatmentEndTime !== "") {
            treatmentStartTimeForSave = convertTreatmentTimeToTimeForSave(treatmentDate, treatmentStartTime);
            treatmentEndTimeForSave = convertTreatmentTimeToTimeForSave(treatmentDate, treatmentEndTime);
        }
        var treatmentSoapSElements = document.querySelectorAll(
            `textarea[name^="treatmentS-${treatmentDate}-${treatmentTimes}"]`
        );
        var treatmentSoapOElements = document.querySelectorAll(
            `textarea[name^="treatmentO-${treatmentDate}-${treatmentTimes}"]`
        );
        var treatmentSoapAElements = document.querySelectorAll(
            `textarea[name^="treatmentA-${treatmentDate}-${treatmentTimes}"]`
        );
        var treatmentSoapPElements = document.querySelectorAll(
            `textarea[name^="treatmentP-${treatmentDate}-${treatmentTimes}"]`
        );
        var treatmentSoapS = [];
        treatmentSoapSElements.forEach((element) => {
            treatmentSoapS.push({
                freetext: element.value,
            });
        });
        var treatmentSoapO = convertDocumentToTreatmentSoapO(
            treatmentSoapOElements
        );
        var treatmentSoapA = convertDocumentToTreatmentSoapA(
            treatmentSoapAElements
        );
        var treatmentSoapP = convertDocumentToTreatmentSoapP(
            treatmentSoapPElements
        );

        var body = {
            treatmentDate: treatmentDate,
            treatmentTimes: treatmentTimes,
            treatmentStartTime: treatmentStartTimeForSave,
            treatmentEndTime: treatmentEndTimeForSave,
            actualByRole: actualByRole,
            treatmentS: treatmentSoapS,
            treatmentO: treatmentSoapO,
            treatmentA: treatmentSoapA,
            treatmentP: treatmentSoapP,
        };
        return body;
    }

    var saveSoapItem = async function (
        treatmentDate,
        treatmentTimes,
        actualByRole
    ) {
        try {
            if (messageValidateTreatmentTime(treatmentDate, treatmentTimes) !== "") {
                showErrorMessageModal(messageValidateTreatmentTime(treatmentDate, treatmentTimes));
                return;
            }
            var body = convertDocumentToSoapItemForSave(treatmentDate, treatmentTimes, actualByRole);

            var options = {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            };

            var url = "/rehainfo/patient/" + recId + "/treatment-soap/save";
            await fetch(url, options);
            // save soap treatment date treatment times success
            showSuccessMessageModal(`${treatmentDate} ${treatmentTimes}回目 のSOAPを保存しました。`);
            soapDirtyState.clearAllForCard(treatmentDate, treatmentTimes);
        } catch (error) {
            showErrorMessageModal("SOAPの保存に失敗しました。");
        }
    };

    var convertDocumentToTreatmentSoapO = function (documents) {
        var treatmentSoapO = [];
        var evaluationDetailList = [];
        var inTreatmentDetailList = [];
        var outTreatmentDetailList = [];
        var eventDetailList = [];
        var freeTextList = [];
        var index = null;
        var indexTreatment = null;
        documents.forEach((document) => {
            if (document.name.includes("evaluation-")) {
                index = document.name.split("-").at(-1);
                if (evaluationDetailList[index] === undefined) {
                    evaluationDetailList[index] = [];
                }
                evaluationDetailList[index].push({
                    planId: document.id,
                    text: document.value,
                });
            } else if (document.name.includes("inTreatment-")) {
                index = document.name.split("-").at(-1);
                if (inTreatmentDetailList[index] === undefined) {
                    inTreatmentDetailList[index] = [];
                }
                inTreatmentDetailList[index].push({
                    treatmentPlanId: document.id,
                    treatmentPlanName: document.value,
                });
            } else if (document.name.includes("inTreatmentItem-")) {
                index = document.name.split("-").at(-2);
                indexTreatment = document.name.split("-").at(-1);
                if (inTreatmentDetailList[index] === undefined) {
                    inTreatmentDetailList[index] = [];
                }
                if (
                    inTreatmentDetailList[index][indexTreatment] === undefined
                ) {
                    inTreatmentDetailList[index][indexTreatment] = {
                        treatmentItems: [],
                    };
                }
                if (
                    inTreatmentDetailList[index][indexTreatment]
                        .treatmentItems === undefined
                ) {
                    inTreatmentDetailList[index][
                        indexTreatment
                    ].treatmentItems = [];
                }
                inTreatmentDetailList[index][
                    indexTreatment
                ].treatmentItems.push({
                    id: document.id,
                    value: document.value,
                });
            } else if (document.name.includes("outTreatment-")) {
                index = document.name.split("-").at(-1);
                if (outTreatmentDetailList[index] === undefined) {
                    outTreatmentDetailList[index] = [];
                }
                outTreatmentDetailList[index].push({
                    treatmentPlanId: document.id,
                    treatmentPlanName: document.value,
                });
            } else if (document.name.includes("outTreatmentItem-")) {
                index = document.name.split("-").at(-2);
                indexTreatment = document.name.split("-").at(-1);
                if (outTreatmentDetailList[index] === undefined) {
                    outTreatmentDetailList[index] = [];
                }
                if (
                    outTreatmentDetailList[index][indexTreatment] === undefined
                ) {
                    outTreatmentDetailList[index][indexTreatment] = {
                        treatmentItems: [],
                    };
                }
                if (
                    outTreatmentDetailList[index][indexTreatment]
                        .treatmentItems === undefined
                ) {
                    outTreatmentDetailList[index][
                        indexTreatment
                    ].treatmentItems = [];
                }
                outTreatmentDetailList[index][
                    indexTreatment
                ].treatmentItems.push({
                    id: document.id,
                    value: document.value,
                });
            } else if (document.name.includes("event-")) {
                index = document.name.split("-").at(-1);
                if (eventDetailList[index] === undefined) {
                    eventDetailList[index] = [];
                }
                eventDetailList[index].push({
                    eventId: document.id,
                    eventValue: document.value,
                });
            } else if (document.name.includes("freeText-")) {
                freeTextList.push(document.value);
            }
        });

        const maxIndex = Math.max(
            evaluationDetailList.length,
            inTreatmentDetailList.length,
            outTreatmentDetailList.length,
            eventDetailList.length,
            freeTextList.length
        );

        for (let index = 0; index < maxIndex; index++) {
            var soapO = {
                evaluationDetail: [],
                inTreatmentDetail: [],
                outTreatmentDetail: [],
                eventDetail: [],
                freeText: "",
            };
            if (evaluationDetailList[index] !== undefined) {
                soapO.evaluationDetail = evaluationDetailList[index];
            }
            if (inTreatmentDetailList[index] !== undefined) {
                soapO.inTreatmentDetail = inTreatmentDetailList[index];
            }
            if (outTreatmentDetailList[index] !== undefined) {
                soapO.outTreatmentDetail = outTreatmentDetailList[index];
            }
            if (eventDetailList[index] !== undefined) {
                soapO.eventDetail = eventDetailList[index];
            }
            if (freeTextList[index] !== undefined) {
                soapO.freeText = freeTextList[index];
            } else {
                soapO.freeText = "";
            }
            treatmentSoapO.push(soapO);
        }

        return treatmentSoapO;
    };

    var convertDocumentToTreatmentSoapA = function (documents) {
        var treatmentSoapA = [];
        var problemList = [];
        var freeTextList = [];
        var index = null;
        documents.forEach((document) => {
            if (document.name.includes("problem-")) {
                index = document.name.split("-").at(-1);
                if (problemList[index] === undefined) {
                    problemList[index] = [];
                }
                problemList[index].push({
                    id: document.id,
                    value: document.value,
                });
            } else if (document.name.includes("freeText-")) {
                freeTextList.push(document.value);
            }
        });

        const maxIndex = Math.max(problemList.length, freeTextList.length);

        for (let index = 0; index < maxIndex; index++) {
            var soapA = {
                problemList: [],
                freeText: "",
            };
            if (problemList[index] !== undefined) {
                soapA.problemList = problemList[index];
            }
            if (freeTextList[index] !== undefined) {
                soapA.freeText = freeTextList[index];
            } else {
                soapA.freeText = "";
            }
            treatmentSoapA.push(soapA);
        }

        return treatmentSoapA;
    };

    var convertDocumentToTreatmentSoapP = function (documents) {
        var treatmentSoapP = [];
        var evaluationDetailList = [];
        var inTreatmentDetailList = [];
        var outTreatmentDetailList = [];
        var freeTextList = [];
        var index = null;
        documents.forEach((document) => {
            if (document.name.includes("freeText-")) {
                freeTextList.push(document.value);
            } else if (document.name.includes("evaluation-")) {
                index = document.name.split("-").at(-1);
                if (evaluationDetailList[index] === undefined) {
                    evaluationDetailList[index] = [];
                }
                evaluationDetailList[index].push({
                    planId: document.id,
                    text: document.value,
                });
            } else if (document.name.includes("inTreatment-")) {
                index = document.name.split("-").at(-1);
                if (inTreatmentDetailList[index] === undefined) {
                    inTreatmentDetailList[index] = [];
                }
                inTreatmentDetailList[index].push({
                    treatmentPlanId: document.id,
                    treatmentPlanName: document.value,
                });
            } else if (document.name.includes("outTreatment-")) {
                index = document.name.split("-").at(-1);
                if (outTreatmentDetailList[index] === undefined) {
                    outTreatmentDetailList[index] = [];
                }
                outTreatmentDetailList[index].push({
                    treatmentPlanId: document.id,
                    treatmentPlanName: document.value,
                });
            }
        });

        const maxIndex = Math.max(
            evaluationDetailList.length,
            inTreatmentDetailList.length,
            outTreatmentDetailList.length,
            freeTextList.length
        );

        for (let index = 0; index < maxIndex; index++) {
            var soapP = {
                evaluationList: [],
                inTreatmentList: [],
                outTreatmentList: [],
                freeText: "",
            };
            if (evaluationDetailList[index] !== undefined) {
                soapP.evaluationList = evaluationDetailList[index];
            }
            if (inTreatmentDetailList[index] !== undefined) {
                soapP.inTreatmentList = inTreatmentDetailList[index];
            }
            if (outTreatmentDetailList[index] !== undefined) {
                soapP.outTreatmentList = outTreatmentDetailList[index];
            }
            if (freeTextList[index] !== undefined) {
                soapP.freeText = freeTextList[index];
            } else {
                soapP.freeText = "";
            }
            treatmentSoapP.push(soapP);
        }

        return treatmentSoapP;
    };

    var addNewSoap = function () {
        var addNewSoapDateInput = document.getElementById(
            "addNewSoapDateInput"
        );
        var addNewSoapTypeRadio2 = document.getElementById(
            "addNewSoapTypeRadio2"
        );

        var requestDate = "";
        if (addNewSoapTypeRadio2.checked && addNewSoapDateInput.value !== "") {
            requestDate = addNewSoapDateInput.value;
        }

        var url =
            "/rehainfo/patient/" +
            recId +
            "/treatment-soap/add-new-soap?treatmentDate=" +
            requestDate;
        fetch(url, {
            method: "POST",
        }).then(async (response) => {
            if (response.ok) {
                await getTreatmentSoapList(requestDate, hcRoleCd);
                if (requestDate !== "") {
                    showSuccessMessageModal(`${requestDate} のSOAPを追加登録しました。`);
                } else {
                    showSuccessMessageModal(`${Object.keys(allSoapDate)[0]} のSOAPを追加登録しました。`);
                }
            }
        }).catch((error) => {
            showErrorMessageModal("SOAPの追加登録に失敗しました。");
        });
    };

    var isPastDate = function (date) {
        var today = new Date();
        var selectedDate = new Date(date);
        selectedDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        return selectedDate < today;
    };

    var getLast5Soap = async function () {
        var url = "/rehainfo/patient/" + recId + "/treatment-soap/get-last-5-soap";
        let response = await fetch(url);
        let data = await response.json();
        var copySoapSelect = document.getElementById("copySoapSelect");
        copySoapSelect.innerHTML = "";
        data.forEach((soap) => {
            var option = document.createElement("option");
            option.value = soap.treatmentDate + "-" + soap.treatmentTimes;
            option.text = soap.treatmentDate + " " + soap.treatmentTimes + "回目";
            copySoapSelect.appendChild(option);
        });
    };

    var copyPastSoap = async function () {
        try {
            var copySoapSelect = document.getElementById("copySoapSelect");
            var copySoapValue = copySoapSelect.value;
            var copySoapDate = copySoapValue.split("-")[0];
            var copySoapTimes = parseInt(copySoapValue.split("-")[1]);
            if (treatmentDateSelected === copySoapDate && treatmentTimesSelected === copySoapTimes) {
                showErrorMessageModal("複写先と同じ日時のSOAPは複写できません。");
                return;
            }
            var url = "/rehainfo/patient/" + recId + "/treatment-soap/copy-past-soap?fromTreatmentDate=" + treatmentDateSelected + "&fromTreatmentTimes=" + treatmentTimesSelected + "&toTreatmentDate=" + copySoapDate + "&toTreatmentTimes=" + copySoapTimes + "&copyField=" + copyFieldSelected;
            let response = await fetch(url, {
                method: "POST",
            });
            let data = await response.text();
            if (data !== null) {
                var resultDate = data.split("-")[0];
                var resultTimes = parseInt(data.split("-")[1]);
                await getTreatmentSoapList(resultDate, hcRoleCd);
                scrollToElement(`soap-${resultDate}-${resultTimes}`);
            }
            // copy success data fromTreatmentDate and fromTreatmentTimes to toTreatmentDate and toTreatmentTimes
            showSuccessMessageModal(`${treatmentDateSelected} ${treatmentTimesSelected}回目 のSOAPを${copySoapDate} ${copySoapTimes}回目 に複写しました。`);
        } catch (error) {
            showErrorMessageModal("SOAPの複写に失敗しました。");
        }
    };

    var navigateToMonth = function (targetMonth) {
        if (!targetMonth) {
            return;
        }

        var doNavigateToMonth = function() {
            getTreatmentSoapList(targetMonth, hcRoleCdSelected);
        };

        executeWithAutoSave(function() {
            doNavigateToMonth();
        });
    };

    var onClickPreviousMonth = function () {
        if (previousMonth) {
            navigateToMonth(previousMonth);
        }
    };

    var onClickNextMonth = function () {
        if (nextMonth) {
            navigateToMonth(nextMonth);
        }
    };

    // clipboard helpers: prefer document.execCommand('copy'); fallback to navigator.clipboard
    var copyTextViaExecCommand = function (text) {
        try {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.top = '0';
            ta.style.left = '0';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            var ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok !== false;
        } catch (e) {
            return false;
        }
    };

    var copyTextToClipboard = function (copyText, onSuccess, onError) {
        if (typeof onSuccess !== 'function') onSuccess = () => { };
        if (typeof onError !== 'function') onError = () => { };

        if (copyTextViaExecCommand(copyText)) {
            onSuccess();
            return;
        }
        if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(copyText).then(function () {
                onSuccess();
            }).catch(function () {
                onError();
            });
            return;
        }
        onError();
    };

    var onClickCopyTextSoap = function (treatmentDate, treatmentTimes) {
        var treatmentStartTime = document.getElementById("treatmentStartTime-" + treatmentDate + "-" + treatmentTimes);
        var treatmentEndTime = document.getElementById("treatmentEndTime-" + treatmentDate + "-" + treatmentTimes);
        var actualMinutes = document.getElementById("actualMinutes-" + treatmentDate + "-" + treatmentTimes);
        var copyText = `
■治療実績
治療日：${treatmentDate} (${treatmentStartTime.value}-${treatmentEndTime.value})
治療実施時間：${actualMinutes.innerText}分 (1単位)
`;
        var treatmentSoapSElements = document.querySelectorAll(
            `textarea[name^="treatmentS-${treatmentDate}-${treatmentTimes}"]`
        );
        var treatmentSoapOElements = document.querySelectorAll(
            `textarea[name^="treatmentO-${treatmentDate}-${treatmentTimes}"]`
        );
        var treatmentSoapAElements = document.querySelectorAll(
            `textarea[name^="treatmentA-${treatmentDate}-${treatmentTimes}"]`
        );
        var treatmentSoapPElements = document.querySelectorAll(
            `textarea[name^="treatmentP-${treatmentDate}-${treatmentTimes}"]`
        );

        var copyTextS = '';
        treatmentSoapSElements.forEach((element) => {
            if (element.value !== null && element.value !== "") {
                copyTextS += element.value + "\n";
            }
        });
        var copyTextO = '';
        treatmentSoapOElements.forEach((element) => {
            if (element.value !== null && element.value !== "") {
                copyTextO += element.value + "\n";
            }
        });
        var copyTextA = '';
        treatmentSoapAElements.forEach((element) => {
            if (element.value !== null && element.value !== "") {
                copyTextA += element.value + "\n";
            }
        });
        var copyTextP = '';
        treatmentSoapPElements.forEach((element) => {
            if (element.value !== null && element.value !== "") {
                copyTextP += element.value + "\n";
            }
        });

        if (copyTextS !== '') {
            copyText += `\n■S\n${copyTextS}`;
        }
        if (copyTextO !== '') {
            copyText += `\n■O\n${copyTextO}`;
        }
        if (copyTextA !== '') {
            copyText += `\n■A\n${copyTextA}`;
        }
        if (copyTextP !== '') {
            copyText += `\n■P\n${copyTextP}`;
        }
        copyTextToClipboard(copyText,
            () => showSuccessMessageModal(`${treatmentDate} ${treatmentTimes}回目 のSOAPをコピーしました。`),
            () =>showErrorMessageModal("コピーに失敗しました。")
        );
    };

    var onClickRoleButton = function(role) {
        var doSwitchRole = function() {
            var btnRolePhysicalTherapist = document.getElementById("btn-role-PhysicalTherapist");
            var btnRoleOccupationalTherapist = document.getElementById("btn-role-OccupationalTherapist");
            var btnRoleSpeechTherapist = document.getElementById("btn-role-SpeechTherapist");
            btnRolePhysicalTherapist.classList.remove("active");
            btnRoleOccupationalTherapist.classList.remove("active");
            btnRoleSpeechTherapist.classList.remove("active");
            document.getElementById("btn-role-" + role).classList.add("active");
            hcRoleCdSelected = role;

            if (role !== hcRoleCd) {
                document.getElementById("btn-add-new-soap").classList.add("d-none");
                isHiddenButtonFunction = true;
            } else {
                document.getElementById("btn-add-new-soap").classList.remove("d-none");
                isHiddenButtonFunction = false;
            }
            getTreatmentSoapList(treatmentDateInputSelected, hcRoleCdSelected);
        };

        executeWithAutoSave(doSwitchRole);
    }

    var backButton = function () {
        const urlParams = new URLSearchParams(window.location.search);
        const fromScreen = urlParams.get('fromScreen');
        let targetUrl;
        if (fromScreen === 'patientList') {
            targetUrl = "/rehainfo/patients";
        } else if (fromScreen === 'treatmentrecord') {
            targetUrl = "/rehainfo/patient/" + recId + "/treatment_record";
        } else {
            targetUrl = "/rehainfo/patient/" + recId + "/top";
        }

        navigateWithAutoSave(targetUrl);
    };

    var textAreaEvent = function () {
        var allTextArea = document.querySelectorAll('textarea');
        allTextArea.forEach((textarea) => {
            textarea.addEventListener('change', function () {
                var treatmentDate = textarea.name.split("-")[1];
                var treatmentTimes = textarea.name.split("-")[2];
                var section = getSectionFromElement(textarea);
                if (section !== null) {
                    soapDirtyState.markDirty(treatmentDate, treatmentTimes, hcRoleCd, [section]);
                }
            });
            // Auto-resize for browsers not support field-sizing (Chrome version < 123)
            if (!CSS.supports || !CSS.supports('field-sizing', 'content')) {
                textarea.rows = 1;
                autoResize(textarea);
                textarea.addEventListener('input', function () {
                    autoResize(textarea);
                });
            }
        });
    }

    var convertToMessageError = function (key, message) {
        const keySplit = key.split("-");
        const treatmentDate = keySplit[0];
        const treatmentTimes = keySplit[1];

        return `${treatmentDate} ${treatmentTimes}回目 のSOAP${message}`;
    }

    var findNearestSoapDate = function (treatmentDate) {
        var soapDateLabel = document.getElementById("soapDateLabel");
        if (Object.keys(allSoapDate).length === 0 || !treatmentDate.includes(soapDateLabel.innerText)) {
            return null;
        }
        if (allSoapDate[treatmentDate]) {
            return treatmentDate;
        }
        var date = parseInt(treatmentDate.split("/")[2]);
        var nearestSoapDate = null;
        for (var soapDate in allSoapDate) {
            var soapDateDate = parseInt(soapDate.split("/")[2]);
            if (soapDateDate < date) {
                nearestSoapDate = soapDate;
                break;
            }
        }
        if (nearestSoapDate === null && Object.keys(allSoapDate).length > 0) {
            nearestSoapDate = Object.keys(allSoapDate).at(-1);
        }
        return nearestSoapDate;
    }

    var scrollToSoapDate = function (treatmentDate) {
        var nearestSoapDate = findNearestSoapDate(treatmentDate);
        if (nearestSoapDate !== null) {
            var soapTreatmentSelected = document.querySelectorAll(`div[id^="soap-${nearestSoapDate}"]`);
            if (soapTreatmentSelected.length > 0) {
                scrollToElement(soapTreatmentSelected[0].id);
            }
        }
    }

    var messageTreatmentTimeError = {
        "startTime": "開始時間を入力してください。",
        "endTime": "終了時間を入力してください。",
        "startTimeBeforeEndTime": "開始時間は終了時間より前にしてください。",
        "startTimeAndEndTimeAfter23_59": "開始時間と終了時間は23:59より前にしてください。",
        "startTimeAndEndTimeFormat": "開始時間と終了時間はhh:mmの形式で入力してください。",
    }

    var messageValidateTreatmentTime = function (treatmentDate, treatmentTimes) {
        var treatmentStartTime = document.getElementById("treatmentStartTime-" + treatmentDate + "-" + treatmentTimes);
        var treatmentEndTime = document.getElementById("treatmentEndTime-" + treatmentDate + "-" + treatmentTimes);
        if (treatmentStartTime.value === "" && treatmentEndTime.value === "") {
            return "";
        }
        // check is hh:mm format and treatmentStartTime is before treatmentEndTime and time is < 23:59
        if (!/^\d{2}:\d{2}$/.test(treatmentStartTime.value) || !/^\d{2}:\d{2}$/.test(treatmentEndTime.value)) {
            return messageTreatmentTimeError.startTimeAndEndTimeFormat;
        }
        if (treatmentStartTime.value === "" && treatmentEndTime.value !== "") {
            return messageTreatmentTimeError.startTime;
        }
        if (treatmentStartTime.value !== "" && treatmentEndTime.value === "") {
            return messageTreatmentTimeError.endTime;
        }
        var treatmentStartTimeValue = treatmentStartTime.value.split(":");
        var treatmentEndTimeValue = treatmentEndTime.value.split(":");
        if (treatmentStartTimeValue[0] > 23 || treatmentStartTimeValue[1] > 59 || treatmentEndTimeValue[0] > 23 || treatmentEndTimeValue[1] > 59) {
            return messageTreatmentTimeError.startTimeAndEndTimeAfter23_59;
        }
        if ((treatmentStartTimeValue[0] == treatmentEndTimeValue[0] && treatmentStartTimeValue[1] > treatmentEndTimeValue[1]) ||
            (treatmentStartTimeValue[0] > treatmentEndTimeValue[0])) {
            return messageTreatmentTimeError.startTimeBeforeEndTime;
        }
        return "";
    }

    var validateAllTreatmentTime = function () {
        var allTreatmentStartTime = document.querySelectorAll('input[id^="treatmentStartTime-"]');
        var allTreatmentEndTime = document.querySelectorAll('input[id^="treatmentEndTime-"]');
        for (var i = 0; i < allTreatmentStartTime.length; i++) {
            allTreatmentStartTime[i].addEventListener('input', function () {
                var treatmentDate = this.id.split("-")[1];
                var treatmentTimes = this.id.split("-")[2];
                var errorMessage = messageValidateTreatmentTime(treatmentDate, treatmentTimes);
                var errorMessageElement = document.getElementById("treatmentTimeErrorMessage-" + treatmentDate + "-" + treatmentTimes);
                errorMessageElement.innerText = errorMessage;
                if (errorMessage !== "") {
                    messageError[treatmentDate + "-" + treatmentTimes] = errorMessage;
                } else if (messageError[treatmentDate + "-" + treatmentTimes] !== undefined) {
                    delete messageError[treatmentDate + "-" + treatmentTimes];
                }
            });
            allTreatmentEndTime[i].addEventListener('input', function () {
                var treatmentDate = this.id.split("-")[1];
                var treatmentTimes = this.id.split("-")[2];
                var errorMessage = messageValidateTreatmentTime(treatmentDate, treatmentTimes);
                var errorMessageElement = document.getElementById("treatmentTimeErrorMessage-" + treatmentDate + "-" + treatmentTimes);
                errorMessageElement.innerText = errorMessage;
                if (errorMessage !== "") {
                    messageError[treatmentDate + "-" + treatmentTimes] = errorMessage;
                } else if (messageError[treatmentDate + "-" + treatmentTimes] !== undefined) {
                    delete messageError[treatmentDate + "-" + treatmentTimes];
                }
            });

            allTreatmentStartTime[i].addEventListener('change', function () {
                var treatmentDate = this.id.split("-")[1];
                var treatmentTimes = this.id.split("-")[2];
                soapDirtyState.markDirty(treatmentDate, treatmentTimes, hcRoleCd, ["time"]);
            });

            allTreatmentEndTime[i].addEventListener('change', function () {
                var treatmentDate = this.id.split("-")[1];
                var treatmentTimes = this.id.split("-")[2];
                soapDirtyState.markDirty(treatmentDate, treatmentTimes, hcRoleCd, ["time"]);
            });
        }
    }

    var convertTreatmentTimeToTimeForSave = function (treatmentDate, treatmentTime) {
        return treatmentDate.replaceAll("/", "") + treatmentTime.replaceAll(":", "") + "00";
    }

    // Delete Treatment SOAP function
    var onClickDeleteTreatmentSoap = function (treatmentDate, treatmentTimes) {
        let message = `<span style="font-size: 1.2rem">` + treatmentDate + 'の' + treatmentTimes + '回目のデータを全て削除します。'+ `</span>`;
        let attr = `deleteTreatmentSoap('${treatmentDate}', ${treatmentTimes})`;
        showDecisionMessageModal(message, attr, 'はい', 'いいえ');
    }

    var deleteTreatmentSoap = function (treatmentDate, treatmentTimes) {
        let url = "/rehainfo/patient/" + recId + "/delete-treatment-soap";

        fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                treatmentDate: treatmentDate,
                treatmentTimes: treatmentTimes
            })
        })
            .then(response => {
                if (response.ok) {
                    // Clear local dirty state before reload to avoid native beforeunload prompt
                    edittingSoap = {};
                    messageError = {};
                    // Reload the page after successful deletion
                    window.location.reload();
                } else {
                    showErrorMessageModal("削除に失敗しました。");
                }
            })
            .catch(error => {
                console.error("Error deleting SOAP:", error);
                showErrorMessageModal("削除中にエラーが発生しました。");
            });
    }

    var autoResize = function(textarea) {
        textarea.style.overflow = 'hidden';
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    };
}
