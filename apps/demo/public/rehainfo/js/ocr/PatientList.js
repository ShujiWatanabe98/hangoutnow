let allPatients = [];
let filteredPatients = [];
let displayedPatients = [];
let currentPage = 1;
let pageSize = 10;
let currentSortColumn = null;
let currentSortDirection = 'asc';
let currentGenderFilter = null;
let searchDebounceTimer = null;

function toggleClearButton(inputId) {
    const input = document.getElementById(inputId);
    const wrapper = document.getElementById(inputId + 'Wrapper') || input.closest('.input-wrapper');
    if (input && wrapper) {
        if (input.value.length > 0) {
            wrapper.classList.add('has-value');
        } else {
            wrapper.classList.remove('has-value');
        }
    }
}

function clearInput(inputId, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const input = document.getElementById(inputId);
    if (input) {
        input.value = '';
        input.focus();
        
        const wrapper = document.getElementById(inputId + 'Wrapper') || input.closest('.input-wrapper');
        if (wrapper) {
            wrapper.classList.add('is-focused');
            wrapper.classList.remove('has-value');
        }
        
        toggleClearButton(inputId);
        filterPatients('');
    }
}

function handleInputFocus(inputId) {
    const input = document.getElementById(inputId);
    const wrapper = document.getElementById(inputId + 'Wrapper') || input.closest('.input-wrapper');
    if (input && wrapper) {
        wrapper.classList.add('is-focused');
        toggleClearButton(inputId);
    }
}

function handleInputBlur(inputId, event) {
    const input = document.getElementById(inputId);
    const wrapper = document.getElementById(inputId + 'Wrapper') || input.closest('.input-wrapper');
    if (wrapper) {
        const clearButton = wrapper.querySelector('.input-clear-btn');
        if (event && event.relatedTarget === clearButton) {
            return;
        }
        setTimeout(function() {
            if (document.activeElement !== input && document.activeElement !== clearButton) {
                wrapper.classList.remove('is-focused');
            }
        }, 150);
    }
}

function navigateToPatient(recId) {
    if (recId) {
        showLoadingSpinner();
        window.location.href = '/rehainfo/patient/' + recId + '/top';
    }
}

function navigateToScan(recId) {
    if (recId) {
        showLoadingSpinner();
        window.location.href = '/rehainfo/ocr/patient/' + recId + '/evaluation-select';
    }
}

function navigateToOcrList(recId) {
    if (recId) {
        showLoadingSpinner();
        window.location.href = '/rehainfo/ocr/patient/' + recId + '/list';
    }
}

function navigateToPrescriptionRead(recId) {
    if (recId) {
        showLoadingSpinner();
        window.location.href = '/rehainfo/prescriptions/patient/' + recId + '/read'
            + prescriptionPatientAddFlowQuery();
    }
}

function navigateToPrescriptionList(recId) {
    if (recId) {
        showLoadingSpinner();
        window.location.href = '/rehainfo/prescriptions/patient/' + recId + '/list'
            + prescriptionPatientAddFlowQuery();
    }
}

function prescriptionPatientAddFlowQuery() {
    return window.prescriptionPatientAddFlow === true
        || window.prescriptionPatientAddFlow === 'true'
        ? '?flow=patient-add' : '';
}

function importPrescriptionFromEmr(recId, button) {
    if (!recId || !button || button.disabled) {
        return;
    }

    const originalContent = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> 取得中';

    fetch('/rehainfo/api/prescriptions/emr/import?recId=' + encodeURIComponent(recId), {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Accept': 'application/json'
        }
    })
    .then(response => response.json().then(data => ({ ok: response.ok, data: data })))
    .then(result => {
        if (!result.ok || !result.data.success) {
            throw new Error(result.data.errorMessage || '電カルから処方箋データを取得できませんでした');
        }

        button.innerHTML = '<i class="bi bi-check-circle"></i> 取得済み';
        showNotice(result.data.message || '電カルから処方箋データを取得しました', 'success');
        window.setTimeout(function() {
            navigateToPrescriptionList(recId);
        }, 700);
    })
    .catch(error => {
        button.disabled = false;
        button.innerHTML = originalContent;
        showNotice(error.message, 'error');
    });
}

function loadAllPatients(responsibleOnly = true) {
    showLoadingSpinner();
    
    const url = `/rehainfo/api/ocr/patients?responsibleOnly=${responsibleOnly}`;
    
    fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
            'Accept': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('認証情報が無効です。再度ログインしてください。');
            }
            throw new Error('患者一覧の取得に失敗しました');
        }
        return response.json();
    })
    .then(data => {
        hideLoadingSpinner();
        if (data.success && data.patients) {
            allPatients = data.patients;
            applyFilters();
        } else {
            console.error('患者一覧の取得に失敗しました:', data.message || 'Unknown error');
            allPatients = [];
            filteredPatients = [];
            displayedPatients = [];
            renderTable();
            renderPagination();
            showError('患者一覧の取得に失敗しました: ' + (data.message || 'Unknown error'));
        }
    })
    .catch(error => {
        hideLoadingSpinner();
        console.error('Error loading patients:', error);
        allPatients = [];
        filteredPatients = [];
        displayedPatients = [];
        renderTable();
        renderPagination();
        showError('患者一覧の取得に失敗しました: ' + error.message);
    });
}

function showError(message) {
    showNotice(message, 'error');
}

function showNotice(message, type) {
    const errorDiv = document.createElement('div');
    const success = type === 'success';
    errorDiv.className = success ? 'alert alert-success' : 'alert alert-danger';
    errorDiv.setAttribute('role', 'status');
    errorDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; padding: 12px 20px; background-color: '
        + (success ? '#dcfce7' : '#f8d7da') + '; color: ' + (success ? '#166534' : '#721c24')
        + '; border: 1px solid ' + (success ? '#86efac' : '#f5c6cb') + '; border-radius: 4px; max-width: 440px;';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

function filterPatients(searchKeyword) {
    const searchLower = (searchKeyword || '').toLowerCase().trim();
    
    filteredPatients = allPatients.filter(patient => {
        let matchesSearch = true;
        let matchesGender = true;
        
        if (searchLower) {
            const patientId = (patient.patientId || '').toLowerCase();
            const patientName = (patient.patientName || '').toLowerCase();
            matchesSearch = patientId.includes(searchLower) || patientName.includes(searchLower);
        }
        
        if (currentGenderFilter) {
            const genderFilter = currentGenderFilter === 'M' ? '男性' : '女性';
            matchesGender = patient.gender === genderFilter;
        }
        
        return matchesSearch && matchesGender;
    });
    
    currentPage = 1;
    paginatePatients();
}

function applyFilters() {
    const searchInput = document.getElementById('searchInput');
    const searchKeyword = searchInput ? searchInput.value : '';
    filterPatients(searchKeyword);
}

function paginatePatients() {
    const totalItems = filteredPatients.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = totalPages;
    }
    
    if (currentPage < 1) {
        currentPage = 1;
    }
    
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    
    displayedPatients = filteredPatients.slice(startIndex, endIndex);
    
    renderTable();
    renderPagination();
}

function renderTable() {
    const tbody = document.querySelector('.patient-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (displayedPatients.length === 0) {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = 5;
        emptyCell.className = 'empty-state';
        emptyCell.style.textAlign = 'center';
        emptyCell.style.padding = '60px 20px';
        emptyCell.innerHTML = '<i class="bi bi-inbox" style="font-size: 48px; margin-bottom: 16px; color: #CCCCCC; display: block;"></i><p style="font-family: \'Hiragino Kaku Gothic Pro\', \'Noto Sans JP\', sans-serif; font-size: 16px; font-weight: 300; margin: 0; color: #999999;">患者が見つかりませんでした</p>';
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
        return;
    }
    
    displayedPatients.forEach(patient => {
        const row = document.createElement('tr');
        const ageText = patient.age != null ? patient.age + '歳' : '';
        const recId = escapeHtml(patient.recId || '');
        const prescriptionMode = window.prescriptionMode === true || window.prescriptionMode === 'true';
        const actions = prescriptionMode ? `
                    <button type="button" class="btn-action btn-emr-link" onclick="event.stopPropagation(); importPrescriptionFromEmr('${recId}', this)" aria-label="電カルから処方箋を取得">
                        <i class="bi bi-cloud-arrow-down"></i>
                        電カル連携
                    </button>
                    <button type="button" class="btn-action" onclick="navigateToPrescriptionRead('${recId}')">
                        <i class="bi bi-prescription2"></i>
                        処方箋読込
                    </button>
                    <button type="button" class="btn-action" onclick="navigateToPrescriptionList('${recId}')">
                        <i class="bi bi-file-earmark-medical"></i>
                        保存済み処方箋
                    </button>` : `
                    <button type="button" class="btn-action" onclick="navigateToScan('${recId}')">
                        <i class="bi bi-camera"></i>
                        スキャン
                    </button>
                    <button type="button" class="btn-action" onclick="navigateToOcrList('${recId}')">
                        <i class="bi bi-file-earmark-text"></i>
                        OCR一覧
                    </button>`;
        row.innerHTML = `
            <td>${escapeHtml(patient.patientId || '')}</td>
            <td>${escapeHtml(patient.patientName || '')}</td>
            <td>${escapeHtml(patient.gender || '')}</td>
            <td>${escapeHtml(ageText)}</td>
            <td>
                <div class="action-buttons">
                    ${actions}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    updateSortUI();
}

function renderPagination() {
    const paginationSection = document.querySelector('.pagination-section');
    if (!paginationSection) return;
    
    const totalItems = filteredPatients.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    
    if (totalPages <= 0) {
        paginationSection.innerHTML = '';
        return;
    }
    
    let paginationHTML = `
        <button type="button" 
                class="btn-pagination"
                ${currentPage === 1 ? 'disabled' : ''}
                onclick="goToPage(${currentPage - 1})">
            <i class="bi bi-chevron-left"></i>
            前へ
        </button>
    `;
    
    const pageNumbers = [];
    if (totalPages > 0) {
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
                pageNumbers.push(i);
            }
        }
    }
    
    let prevPage = 0;
    pageNumbers.forEach(page => {
        if (page - prevPage > 1) {
            paginationHTML += '<span class="btn-pagination" style="cursor: default; border: none; background: transparent;">...</span>';
        }
        paginationHTML += `
            <button type="button"
                    class="btn-pagination ${page === currentPage ? 'active' : ''}"
                    ${page === currentPage ? 'disabled' : ''}
                    onclick="goToPage(${page})"
                    ${page === currentPage ? '' : ''}>
                ${page}
            </button>
        `;
        prevPage = page;
    });
    
    paginationHTML += `
        <button type="button" 
                class="btn-pagination"
                ${currentPage === totalPages ? 'disabled' : ''}
                onclick="goToPage(${currentPage + 1})">
            次へ
            <i class="bi bi-chevron-right"></i>
        </button>
        
        <span class="pagination-info">
            ${(currentPage - 1) * pageSize + 1} - ${Math.min(currentPage * pageSize, totalItems)} / ${totalItems} 件
        </span>
    `;
    
    paginationSection.innerHTML = paginationHTML;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateSortUI() {
    const table = document.querySelector('.patient-table');
    if (!table) return;
    
    table.querySelectorAll('th').forEach(h => {
        h.classList.remove('sort-asc', 'sort-desc');
    });
    
    if (currentSortColumn) {
        const th = table.querySelector(`th[onclick*="${currentSortColumn}"]`);
        if (th && currentSortDirection) {
            th.classList.add(currentSortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    }
}

function sortTable(column, updateDirection = true) {
    if (updateDirection) {
        if (currentSortColumn === column) {
            if (currentSortDirection === 'asc') {
                currentSortDirection = 'desc';
            } else if (currentSortDirection === 'desc') {
                currentSortColumn = null;
                currentSortDirection = null;
                applyFilters();
                return;
            }
        } else {
            currentSortColumn = column;
            currentSortDirection = 'asc';
        }
    }
    
    if (!currentSortColumn) {
        applyFilters();
        return;
    }
    
    filteredPatients.sort((a, b) => {
        let aValue, bValue;
        
        switch(column) {
            case 'patientId':
                aValue = (a.patientId || '').toLowerCase();
                bValue = (b.patientId || '').toLowerCase();
                break;
            case 'patientName':
                aValue = (a.patientName || '').toLowerCase();
                bValue = (b.patientName || '').toLowerCase();
                break;
            case 'gender':
                aValue = (a.gender || '').toLowerCase();
                bValue = (b.gender || '').toLowerCase();
                break;
            case 'age':
                aValue = a.age != null ? a.age : 0;
                bValue = b.age != null ? b.age : 0;
                break;
            default:
                return 0;
        }
        
        if (column === 'age') {
            return currentSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        } else {
            if (aValue < bValue) return currentSortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return currentSortDirection === 'asc' ? 1 : -1;
            return 0;
        }
    });
    
    paginatePatients();
}

function goToPage(page) {
    if (page && page > 0) {
        const totalPages = Math.ceil(filteredPatients.length / pageSize);
        if (page > totalPages) {
            page = totalPages;
        }
        if (page < 1) {
            page = 1;
        }
        currentPage = page;
        paginatePatients();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function showLoadingSpinner() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }
}

function hideLoadingSpinner() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                filterPatients(searchInput.value);
            }
        });
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                filterPatients(e.target.value);
            }, 300);
        });
        
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(searchDebounceTimer);
                filterPatients(e.target.value);
            }
        });
    }

    const responsibleOnlyToggle = document.getElementById('responsibleOnlyToggle');
    const toggleSwitch = document.getElementById('toggleSwitch');
    
    if (responsibleOnlyToggle && toggleSwitch) {
        function updateToggleSwitch() {
            if (responsibleOnlyToggle.checked) {
                toggleSwitch.classList.add('active');
            } else {
                toggleSwitch.classList.remove('active');
            }
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        const responsibleOnlyParam = urlParams.get('responsibleOnly');
        if (responsibleOnlyParam !== null) {
            responsibleOnlyToggle.checked = responsibleOnlyParam === 'true';
        } else {
            const initialResponsibleOnlyValue = (typeof window.initialResponsibleOnly !== 'undefined') ? window.initialResponsibleOnly : true;
            responsibleOnlyToggle.checked = initialResponsibleOnlyValue;
        }
        updateToggleSwitch();
        
        responsibleOnlyToggle.addEventListener('change', function() {
            updateToggleSwitch();
            loadAllPatients(responsibleOnlyToggle.checked);
        });
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const genderParam = urlParams.get('gender');
    if (genderParam) {
        currentGenderFilter = genderParam;
    }
    
    const searchParam = urlParams.get('search');
    if (searchParam && searchInput) {
        searchInput.value = searchParam;
        toggleClearButton('searchInput');
    }
    
    const initialPatientsData = (typeof window.initialPatientsData !== 'undefined') ? window.initialPatientsData : null;
    const hasInitialDataRaw = (typeof window.hasInitialData !== 'undefined') ? window.hasInitialData : false;
    const hasInitialData = hasInitialDataRaw === true || hasInitialDataRaw === 'true' || hasInitialDataRaw === 1;
    
    if (hasInitialData && Array.isArray(initialPatientsData) && initialPatientsData.length > 0) {
        allPatients = initialPatientsData;
        applyFilters();
        return;
    }
    
    const initialResponsibleOnly = responsibleOnlyToggle ? responsibleOnlyToggle.checked : true;
    loadAllPatients(initialResponsibleOnly);
});
