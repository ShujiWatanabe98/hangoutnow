"use strict";

(function(window, document) {
    var selectedPatient = null;

    function padDatePart(value) {
        return String(value).padStart(2, "0");
    }

    function toLocalDateString(date) {
        return date.getFullYear() + "-" + padDatePart(date.getMonth() + 1)
            + "-" + padDatePart(date.getDate());
    }

    function normalizeDateString(value) {
        if (!value) {
            return "";
        }
        return String(value).replace(/\//g, "-").substring(0, 10);
    }

    function findPatient(recId) {
        var sources = [window.patientListAllRows, window.patientListMPAllRowsUnfiltered];
        for (var sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
            var rows = sources[sourceIndex];
            if (!Array.isArray(rows)) {
                continue;
            }
            for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
                if (rows[rowIndex] && rows[rowIndex].recId === recId) {
                    return rows[rowIndex];
                }
            }
        }
        return null;
    }

    function getModalInstance() {
        var modalElement = document.getElementById("patientDischargeModal");
        if (!modalElement || !window.bootstrap || !window.bootstrap.Modal) {
            return null;
        }
        if (window.bootstrap.Modal.getOrCreateInstance) {
            return window.bootstrap.Modal.getOrCreateInstance(modalElement);
        }
        return new window.bootstrap.Modal(modalElement);
    }

    function setError(message) {
        var errorElement = document.getElementById("patientDischargeError");
        if (!errorElement) {
            return;
        }
        errorElement.textContent = message || "";
        errorElement.hidden = !message;
    }

    function setSubmitting(isSubmitting) {
        var submitButton = document.getElementById("patientDischargeSubmit");
        if (submitButton) {
            submitButton.disabled = isSubmitting;
            submitButton.textContent = isSubmitting ? "退院処理中…" : "退院する";
        }
    }

    function validateDate() {
        var input = document.getElementById("patientDischargeDate");
        if (!input || !input.value) {
            setError("退院日を入力してください。");
            return false;
        }
        var admissionDate = selectedPatient
            ? normalizeDateString(selectedPatient.hospitalizationStartDate) : "";
        if (!admissionDate) {
            setError("入院日が入力されていないため退院できません。");
            return false;
        }
        if (normalizeDateString(input.value) < admissionDate) {
            setError("退院日は入院日以降の日付を入力してください。");
            return false;
        }
        return true;
    }

    function submitDischarge() {
        if (!selectedPatient || !validateDate()) {
            return;
        }

        var input = document.getElementById("patientDischargeDate");
        var dischargeDate = normalizeDateString(input.value);
        setSubmitting(true);
        setError("");

        fetch("/rehainfo/patientInfoRest/" + encodeURIComponent(selectedPatient.recId)
                + "/discharge", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ dischargeDate: dischargeDate })
        }).then(function(response) {
            return response.json().catch(function() {
                return {};
            }).then(function(body) {
                if (!response.ok || !body.success) {
                    throw new Error(body.message || "退院処理に失敗しました。");
                }
                return body;
            });
        }).then(function() {
            window.sessionStorage.setItem("patientDischargeNotice",
                selectedPatient.patientName + "さんを" + dischargeDate + "付で退院にしました。");
            window.location.reload();
        }).catch(function(error) {
            setSubmitting(false);
            setError(error.message || "退院処理に失敗しました。");
        });
    }

    window.showPatientDischargeDialog = function(event, recId) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        selectedPatient = findPatient(recId);
        if (!selectedPatient) {
            return;
        }

        var patientName = document.getElementById("patientDischargePatientName");
        var patientId = document.getElementById("patientDischargePatientId");
        var admissionDate = document.getElementById("patientDischargeAdmissionDate");
        var input = document.getElementById("patientDischargeDate");
        var normalizedAdmissionDate = normalizeDateString(selectedPatient.hospitalizationStartDate);

        patientName.textContent = selectedPatient.patientName || "";
        patientId.textContent = "患者ID：" + (selectedPatient.patientId || "");
        admissionDate.textContent = normalizedAdmissionDate || "未設定";
        input.min = normalizedAdmissionDate;
        input.removeAttribute("max");
        input.value = normalizeDateString(selectedPatient.hospitalizationEndDate)
            || toLocalDateString(new Date());

        setSubmitting(false);
        setError("");
        var modal = getModalInstance();
        if (modal) {
            modal.show();
        }
    };

    document.addEventListener("DOMContentLoaded", function() {
        var submitButton = document.getElementById("patientDischargeSubmit");
        if (submitButton) {
            submitButton.addEventListener("click", submitDischarge);
        }

        var notice = window.sessionStorage.getItem("patientDischargeNotice");
        var noticeElement = document.getElementById("patientDischargeNotice");
        if (notice && noticeElement) {
            noticeElement.textContent = notice;
            noticeElement.hidden = false;
            window.sessionStorage.removeItem("patientDischargeNotice");
        }
    });
})(window, document);
