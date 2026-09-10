/**
 * OCR Evaluation Select Page JavaScript
 * Handles evaluation sheet search, autocomplete, date picker, and image management functionality
 */

// Setup viewport height CSS variable for dynamic height calculations
// This handles mobile browser viewport differences (address bar, etc.)
const root = document.documentElement;

if (window.visualViewport) {
    const updateViewportHeight = () => {
        const vh = window.visualViewport.height * 0.01;
        root.style.setProperty('--vvh', `${vh}px`);
    };

    updateViewportHeight();
    visualViewport.addEventListener('resize', updateViewportHeight);
}

$(function () {
    // Set Japanese locale for datepicker
    $.datetimepicker.setLocale('ja');
});


function ocrEvalLoadScriptOnce(src) {
    return new Promise(function (resolve, reject) {
        var existing = document.querySelector('script[data-pdfjs-src="' + src + '"]');
        if (existing && existing.dataset.loaded === 'true') {
            resolve();
            return;
        }
        if (existing && existing.dataset.loaded !== 'error') {
            existing.addEventListener('load', function () {
                resolve();
            }, { once: true });
            existing.addEventListener('error', function () {
                reject(new Error('load failed: ' + src));
            }, { once: true });
            return;
        }
        var s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.dataset.pdfjsSrc = src;
        s.onload = function () {
            s.dataset.loaded = 'true';
            resolve();
        };
        s.onerror = function () {
            s.dataset.loaded = 'error';
            reject(new Error('load failed: ' + src));
        };
        document.head.appendChild(s);
    });
}

function ocrEvalEnsurePdfJsLibLoaded() {
    return new Promise(function (resolve, reject) {
        if (typeof window.pdfjsLib !== 'undefined') {
            resolve(window.pdfjsLib);
            return;
        }
        var scriptCandidates = [
            '/rehainfo/js/pdf.min.js',
            '/js/pdf.min.js',
        ];
        var workerCandidates = [
            '/rehainfo/js/pdf.worker.min.js',
            '/js/pdf.worker.min.js',
        ];
        var idx = 0;
        var tryNext = function () {
            if (idx >= scriptCandidates.length) {
                reject(new Error('pdfjsLib could not be loaded'));
                return;
            }
            var scriptSrc = scriptCandidates[idx];
            var workerSrc = workerCandidates[idx];
            idx++;
            ocrEvalLoadScriptOnce(scriptSrc).then(function () {
                if (typeof window.pdfjsLib !== 'undefined') {
                    try {
                        if (window.pdfjsLib.GlobalWorkerOptions) {
                            window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
                        }
                    } catch (e) {
                        console.warn('pdfjs worker 設定に失敗しました:', e);
                    }
                    resolve(window.pdfjsLib);
                } else {
                    tryNext();
                }
            }).catch(function () {
                tryNext();
            });
        };
        tryNext();
    });
}

function ocrEvalConvertPdfFileToImages(file, scale, options) {
    scale = scale || 2;
    options = options || {};
    var maxPages = options.maxPages;
    return ocrEvalEnsurePdfJsLibLoaded().then(function (pdfjs) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function (e) {
                try {
                    var typedarray = new Uint8Array(e.target.result);
                    pdfjs.getDocument(typedarray).promise.then(function (pdf) {
                        if (maxPages != null && pdf.numPages > maxPages) {
                            reject({
                                code: 'PAGE_LIMIT_EXCEEDED',
                                numPages: pdf.numPages,
                                maxPages: maxPages
                            });
                            return;
                        }
                        if (pdf.numPages === 0) {
                            reject(new Error('empty pdf'));
                            return;
                        }

                        var pages = [];
                        var chain = Promise.resolve();
                        for (var pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                            (function (pn) {
                                chain = chain.then(function () {
                                    return pdf.getPage(pn).then(function (page) {
                                        var viewport = page.getViewport({ scale: scale });
                                        var canvas = document.createElement('canvas');
                                        var context = canvas.getContext('2d');
                                        canvas.height = viewport.height;
                                        canvas.width = viewport.width;
                                        return page.render({
                                            canvasContext: context,
                                            viewport: viewport
                                        }).promise.then(function () {
                                            pages.push({
                                                pageNumber: page.pageNumber,
                                                dataUrl: canvas.toDataURL('image/jpeg')
                                            });
                                        });
                                    });
                                });
                            })(pageNum);
                        }
                        chain.then(function () {
                            resolve(pages);
                        }).catch(reject);
                    }).catch(reject);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = function (err) {
                reject(err);
            };
            reader.readAsArrayBuffer(file);
        });
    });
}

function ocrEvalDataUrlToJpegFile(dataUrl, filename) {
    var arr = dataUrl.split(',');
    var mimeMatch = arr[0].match(/:(.*?);/);
    var mime = (mimeMatch && mimeMatch[1]) || 'image/jpeg';
    var bstr = atob(arr[1]);
    var n = bstr.length;
    var u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

function ocrEvalIsPdfFile(file) {
    if (!file) {
        return false;
    }
    var t = file.type || '';
    if (t === 'application/pdf') {
        return true;
    }
    return /\.pdf$/i.test(file.name || '');
}

/**
 * Initialize datepicker for evaluation date input
 */
var initDatePicker = function () {
    $('#evaluation-date').datetimepicker({
        datepicker: true,
        timepicker: false,
        format: 'Y/m/d',
        scrollInput: false,
        onChangeDateTime: function (dp, $input) {
            // Clear error message when date is selected
            const errorElement = document.getElementById('evaluation-date-error');
            if (errorElement) {
                errorElement.style.display = 'none';
                errorElement.textContent = '';
            }
        }
    });
};

/**
 * Initialize Evaluation Sheet Search Functionality
 */
var initEvaluationSheetSearch = function () {
    const searchInput = document.getElementById('evaluation-sheet-search');
    const clearBtn = document.getElementById('clear-search');
    const dropdown = document.getElementById('autocomplete-dropdown');

    if (!searchInput || !clearBtn || !dropdown) {
        return;
    }

    const items = dropdown.querySelectorAll('.autocomplete-item');

    // Show dropdown on focus
    searchInput.addEventListener('focus', function () {
        filterItems(this.value);
        dropdown.classList.add('show');
    });

    // Show dropdown on click (in case it was closed but input still focused)
    searchInput.addEventListener('click', function () {
        if (!dropdown.classList.contains('show')) {
            filterItems(this.value);
            dropdown.classList.add('show');
        }
    });

    // Filter items on input
    searchInput.addEventListener('input', function () {
        const value = this.value;
        filterItems(value);

        // Show/hide clear button
        if (value) {
            clearBtn.style.display = 'flex';
        } else {
            clearBtn.style.display = 'none';
        }
    });

    // Clear button functionality
    clearBtn.addEventListener('click', function () {
        searchInput.value = '';
        searchInput.dataset.sheetId = '';
        searchInput.dataset.ocrPreset = '';
        clearBtn.style.display = 'none';
        filterItems('');
    });

    // Item selection
    items.forEach(item => {
        item.addEventListener('click', function () {
            searchInput.value = this.getAttribute('data-value');
            searchInput.dataset.sheetId = this.getAttribute('data-id');
            var preset = this.getAttribute('data-ocr-preset');
            searchInput.dataset.ocrPreset = (preset && preset !== 'null') ? preset : '';
            dropdown.classList.remove('show');
            clearBtn.style.display = 'flex';

            // Clear error message when valid selection is made
            const errorElement = document.getElementById('evaluation-sheet-error');
            if (errorElement) {
                errorElement.style.display = 'none';
                errorElement.textContent = '';
            }
        });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function (e) {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });

    /**
     * Filter autocomplete items based on search term
     */
    function filterItems(searchTerm) {
        const term = searchTerm.toLowerCase();
        let hasVisibleItems = false;

        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            if (text.includes(term) || term === '') {
                item.style.display = 'block';
                hasVisibleItems = true;
            } else {
                item.style.display = 'none';
            }
        });

        if (hasVisibleItems) {
            dropdown.classList.add('show');
        } else {
            dropdown.classList.remove('show');
        }
    }

    // Hide clear button initially if input is empty
    if (!searchInput.value) {
        clearBtn.style.display = 'none';
    }
};

/**
 * Image Manager - Handles all image management functionality
 */
var ImageManager = {
    // Configuration
    images: [],
    currentIndex: -1,
    /** @type {Set<number>} indices selected for multi-delete */
    selectedIndices: new Set(),
    showMultiSelectionOrder: false,
    multiSelectMode: false,
    suppressThumbnailClick: false,
    thumbnailLongPressMs: 500,
    maxImages: 20,
    maxFileSize: 10485760, // 10MB
    zoomLevel: 1.0,
    minZoom: 1.0,
    maxZoom: 4.0,
    zoomStep: 0.3,

    // Pan state
    isPanning: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,

    /**
     * Initialize image manager
     */
    init: function () {
        this.selectedIndices.clear();
        this.setupFileInputHandlers();
        this.setupImagePanHandlers();
        this.updateUI();
    },


    syncSelectionWithCurrent: function () {
        this.selectedIndices.clear();
        this.showMultiSelectionOrder = false;
        this.multiSelectMode = false;
        if (this.currentIndex >= 0 && this.currentIndex < this.images.length) {
            this.selectedIndices.add(this.currentIndex);
        }
    },

    getSelectionOrderMap: function () {
        const orderMap = new Map();
        const orderedIndices = Array.from(this.selectedIndices).sort((a, b) => a - b);
        orderedIndices.forEach(function (selectedIndex, order) {
            orderMap.set(selectedIndex, order + 1);
        });
        return orderMap;
    },

    /**
     * Setup file input change handlers
     */
    setupFileInputHandlers: function () {
        const libraryInput = document.getElementById('file-input-library');
        const cameraInput = document.getElementById('file-input-camera');

        if (libraryInput) {
            libraryInput.addEventListener('change', (e) => {
                this.handleLibraryFileInputChange(e.target.files);
                e.target.value = ''; // Reset input
            });
        }

        if (cameraInput) {
            cameraInput.addEventListener('change', (e) => {
                this.handleFileSelect(e.target.files);
                e.target.value = ''; // Reset input
            });
        }
    },

    /**
     * Setup image pan/drag handlers
     */
    setupImagePanHandlers: function () {
        const displayArea = document.getElementById('image-display-area');
        if (!displayArea) return;

        displayArea.addEventListener('mousedown', (e) => {
            if (this.zoomLevel > this.minZoom) {
                this.isPanning = true;
                this.startX = e.pageX - displayArea.offsetLeft;
                this.startY = e.pageY - displayArea.offsetTop;
                this.scrollLeft = displayArea.scrollLeft;
                this.scrollTop = displayArea.scrollTop;
                e.preventDefault();
            }
        });

        displayArea.addEventListener('mousemove', (e) => {
            if (!this.isPanning) return;
            e.preventDefault();
            const x = e.pageX - displayArea.offsetLeft;
            const y = e.pageY - displayArea.offsetTop;
            const walkX = (x - this.startX) * 2;
            const walkY = (y - this.startY) * 2;
            displayArea.scrollLeft = this.scrollLeft - walkX;
            displayArea.scrollTop = this.scrollTop - walkY;
        });

        displayArea.addEventListener('mouseup', () => {
            this.isPanning = false;
        });

        displayArea.addEventListener('mouseleave', () => {
            this.isPanning = false;
        });

        // Touch support
        displayArea.addEventListener('touchstart', (e) => {
            if (this.zoomLevel > this.minZoom && e.touches.length === 1) {
                this.isPanning = true;
                this.startX = e.touches[0].pageX - displayArea.offsetLeft;
                this.startY = e.touches[0].pageY - displayArea.offsetTop;
                this.scrollLeft = displayArea.scrollLeft;
                this.scrollTop = displayArea.scrollTop;
            }
        });

        displayArea.addEventListener('touchmove', (e) => {
            if (!this.isPanning || e.touches.length !== 1) return;
            const x = e.touches[0].pageX - displayArea.offsetLeft;
            const y = e.touches[0].pageY - displayArea.offsetTop;
            const walkX = (x - this.startX) * 2;
            const walkY = (y - this.startY) * 2;
            displayArea.scrollLeft = this.scrollLeft - walkX;
            displayArea.scrollTop = this.scrollTop - walkY;
        });

        displayArea.addEventListener('touchend', () => {
            this.isPanning = false;
        });
    },

    /**
     * Show add image dialog
     */
    showAddDialog: function () {
        const modal = new bootstrap.Modal(document.getElementById('imageSourceModal'));
        modal.show();
    },

    /**
     * Select image from library
     */
    selectFromLibrary: function () {
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('imageSourceModal'));
        if (modal) modal.hide();

        // Trigger file input
        document.getElementById('file-input-library').click();
    },

    /**
     * Select image from camera
     */
    selectFromCamera: function () {
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('imageSourceModal'));
        if (modal) modal.hide();

        // Trigger camera input
        document.getElementById('file-input-camera').click();
    },


    handleLibraryFileInputChange: function (files) {
        if (!files || files.length === 0) {
            return;
        }
        const list = Array.from(files);
        const pdfs = list.filter(ocrEvalIsPdfFile);
        const imagesOnly = list.filter(function (f) {
            return !ocrEvalIsPdfFile(f);
        });

        if (pdfs.length > 1) {
            showErrorMessageModal('PDFは1ファイルのみ選択できます。');
            return;
        }
        if (pdfs.length === 1 && imagesOnly.length > 0) {
            showErrorMessageModal('PDFと画像を同時に選択することはできません。');
            return;
        }
        if (pdfs.length === 1) {
            this.handlePdfSelect(pdfs[0]);
            return;
        }
        this.handleFileSelect(files);
    },

 
    
    handlePdfSelect: function (file) {
        const remainingSlots = this.maxImages - this.images.length;
        if (remainingSlots <= 0) {
            showErrorMessageModal('最大' + this.maxImages + '枚まで登録できます');
            return;
        }
        if (file.size > this.maxFileSize) {
            showErrorMessageModal('ファイルサイズは10MB以下にしてください\n(' + file.name + ')');
            return;
        }

        const self = this;
        const baseName = (file.name || 'document').replace(/\.pdf$/i, '');

        showLoadingSpinner();
        ocrEvalConvertPdfFileToImages(file, 2, { maxPages: remainingSlots })
            .then(function (pages) {
                if (!pages || pages.length === 0) {
                    throw new Error('empty pdf');
                }

                const tasks = pages.map(function (page) {
                    return new Promise(function (resolve, reject) {
                        const jpegName = baseName + '_p' + page.pageNumber + '.jpg';
                        const jpegFile = ocrEvalDataUrlToJpegFile(page.dataUrl, jpegName);
                        self.createThumbnail(jpegFile, page.dataUrl, function (thumbnailUrl) {
                            resolve({
                                id: self.generateUniqueId(),
                                file: jpegFile,
                                dataUrl: page.dataUrl,
                                thumbnailUrl: thumbnailUrl,
                                name: jpegName
                            });
                        }, function () {
                            reject(new Error('thumbnail failed: ' + jpegName));
                        });
                    });
                });
                return Promise.all(tasks);
            })
            .then(function (imageDataList) {
                if (!imageDataList || imageDataList.length === 0) {
                    return;
                }
                const firstAddedIndex = self.images.length;
                imageDataList.forEach(function (data) {
                    self.images.push(data);
                });
                self.currentIndex = firstAddedIndex;

                const errorElement = document.getElementById('images-error');
                if (errorElement) {
                    errorElement.style.display = 'none';
                    errorElement.textContent = '';
                }
                self.syncSelectionWithCurrent();
                self.updateUI();
            })
            .catch(function (err) {
                console.error('PDF を画像に変換中にエラーが発生しました:', err);
                if (err && err.code === 'PAGE_LIMIT_EXCEEDED') {
                    showErrorMessageModal(
                        'PDFは' + err.numPages + 'ページあります。あと' + remainingSlots + '枚まで追加できます（最大' +
                        self.maxImages + '枚）。'
                    );
                    return;
                }
                const msg = err && err.message ? String(err.message) : '';
                if (msg.indexOf('pdfjsLib') >= 0 || msg.indexOf('could not be loaded') >= 0 || msg.indexOf('load failed') >= 0) {
                    alert('PDF 変換ライブラリの読み込みに失敗しました。ネットワーク接続または /rehainfo/js/pdf.min.js の配置を確認してください。');
                } else if (msg.indexOf('empty pdf') >= 0) {
                    alert('PDF からページを読み取れませんでした。');
                } else {
                    alert('PDF を画像に変換できませんでした。PDF ファイルを確認してください。');
                }
            })
            .finally(function () {
                hideLoadingSpinner();
            });
    },

  
    handleFileSelect: function (files) {
        if (!files || files.length === 0) return;

        const remainingSlots = this.maxImages - this.images.length;
        if (remainingSlots <= 0) {
            showErrorMessageModal('最大20枚まで登録できます');
            return;
        }

        if (files.length > remainingSlots) {
            showErrorMessageModal('最大20枚まで登録できます');
            return;
        }

        const filesToProcess = Array.from(files).slice(0, remainingSlots);
        const batchStartIndex = this.images.length;
        const pendingSlots = new Array(filesToProcess.length);
        let processedCount = 0;
        let hasNewImage = false;
        const shouldShowLoadingOverlay = filesToProcess.length > 1;

        if (shouldShowLoadingOverlay) {
            showLoadingSpinner();
        }

        const finalizeBatch = () => {
            if (processedCount !== filesToProcess.length) {
                return;
            }
            for (let i = 0; i < pendingSlots.length; i++) {
                if (pendingSlots[i]) {
                    this.images.push(pendingSlots[i]);
                    hasNewImage = true;
                }
            }
            if (hasNewImage) {
                this.currentIndex = batchStartIndex;
                if (batchStartIndex === 0) {
                    const errorElement = document.getElementById('images-error');
                    if (errorElement) {
                        errorElement.style.display = 'none';
                        errorElement.textContent = '';
                    }
                }
            }
            this.syncSelectionWithCurrent();
            this.updateUI();
            if (shouldShowLoadingOverlay) {
                hideLoadingSpinner();
            }
        };

        filesToProcess.forEach((file, index) => {
            if (!this.validateImageFile(file)) {
                processedCount++;
                finalizeBatch();
                return;
            }

            this.readFileAsDataURL(file, (dataUrl) => {
                this.createThumbnail(file, dataUrl, (thumbnailUrl) => {
                    pendingSlots[index] = {
                        id: this.generateUniqueId(),
                        file: file,
                        dataUrl: dataUrl,
                        thumbnailUrl: thumbnailUrl,
                        name: file.name
                    };
                    processedCount++;
                    finalizeBatch();
                }, () => {
                    processedCount++;
                    finalizeBatch();
                });
            }, () => {
                processedCount++;
                finalizeBatch();
            });
        });
    },

    /**
     * Validate image file
     */
    validateImageFile: function (file) {
        // Check if it's an image
        if (!file.type.startsWith('image/')) {
            alert('画像ファイルを選択してください');
            return false;
        }

        // Check file size
        if (file.size > this.maxFileSize) {
            alert('ファイルサイズは10MB以下にしてください\n(' + file.name + ')');
            return false;
        }

        return true;
    },

    /**
     * Read file as data URL
     */
    readFileAsDataURL: function (file, callback, errorCallback) {
        const reader = new FileReader();
        reader.onload = function (e) {
            callback(e.target.result);
        };
        reader.onerror = function () {
            alert('ファイルの読み込みに失敗しました');
            if (typeof errorCallback === 'function') {
                errorCallback();
            }
        };
        reader.readAsDataURL(file);
    },

    /**
     * Create thumbnail from file
     */
    createThumbnail: function (file, dataUrl, callback, errorCallback) {
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Thumbnail size
            const maxWidth = 112;
            const maxHeight = 144;

            let width = img.width;
            let height = img.height;

            // Calculate scaling
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = width * ratio;
            height = height * ratio;

            canvas.width = width;
            canvas.height = height;

            ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = function () {
            if (typeof errorCallback === 'function') {
                errorCallback();
            }
        };
        img.src = dataUrl;
    },

    /**
     * Generate unique ID
     */
    generateUniqueId: function () {
        return 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    /**
     * Update UI
     */
    updateUI: function () {
        this.updateImageCounter();
        this.updateThumbnailGallery();
        this.updatePreviewDisplay();
    },

    /**
     * Update image counter
     */
    updateImageCounter: function () {
        const counter = document.getElementById('image-counter');
        if (counter) {
            counter.textContent = this.images.length + '/' + this.maxImages;
        }
    },

    /**
     * Update thumbnail gallery
     */
    updateThumbnailGallery: function () {
        const gallery = document.getElementById('thumbnail-gallery');
        if (!gallery) return;

        gallery.innerHTML = '';
        const orderMap = this.getSelectionOrderMap();
        const shouldShowSelectionOrder = this.showMultiSelectionOrder && this.selectedIndices.size > 1;

        this.images.forEach((image, index) => {
            const thumbnail = document.createElement('div');
            let cardClass = 'thumbnail-card';
            if (this.selectedIndices.has(index)) {
                cardClass += ' selected';
            }
            if (index === this.currentIndex) {
                cardClass += ' active';
            }
            thumbnail.className = cardClass;
            thumbnail.dataset.index = index;
            thumbnail.onclick = (e) => this.onThumbnailClick(index, e);
            this.setupThumbnailTouchHandlers(thumbnail, index);

            const img = document.createElement('img');
            img.src = image.thumbnailUrl;
            img.alt = image.name;

            thumbnail.appendChild(img);
            if (shouldShowSelectionOrder && this.selectedIndices.has(index)) {
                const selectionBadge = document.createElement('span');
                selectionBadge.className = 'thumbnail-selection-order';
                selectionBadge.textContent = String(orderMap.get(index) || '');
                thumbnail.appendChild(selectionBadge);
            }
            gallery.appendChild(thumbnail);
        });
    },

    /**
     * Update preview display
     */
    updatePreviewDisplay: function () {
        const emptyState = document.getElementById('empty-state');
        const displayArea = document.getElementById('image-display-area');
        const previewImage = document.getElementById('preview-image');
        const footer = document.getElementById('footer-dark-section');
        const deleteBtn = document.getElementById('delete-image-btn');
        const imageCounter = document.getElementById('image-counter');
        const addImageBtn = document.getElementById('add-image-btn');

        // Hide add button when max images reached
        if (addImageBtn) {
            if (this.images.length >= this.maxImages) {
                addImageBtn.classList.add('d-none');
            } else {
                addImageBtn.classList.remove('d-none');
            }
        }

        if (this.images.length === 0) {
            // Show empty state, hide image display, footer, delete button, and counter
            if (emptyState) emptyState.style.display = 'flex';
            if (displayArea) displayArea.style.display = 'none';
            if (footer) footer.classList.add('d-none');
            if (deleteBtn) deleteBtn.classList.add('d-none');
            if (imageCounter) imageCounter.classList.add('d-none');
        } else {
            // Show image, footer, delete button, and counter, hide empty state
            if (emptyState) emptyState.style.display = 'none';
            if (displayArea) displayArea.style.display = 'flex';
            if (footer) footer.classList.remove('d-none');
            if (deleteBtn) deleteBtn.classList.remove('d-none');
            if (imageCounter) imageCounter.classList.remove('d-none');

            if (previewImage && this.currentIndex >= 0 && this.currentIndex < this.images.length) {
                previewImage.src = this.images[this.currentIndex].dataUrl;
                this.resetZoom();
            }
        }
    },

    /**
     * Select image by index
     */
    selectImage: function (index) {
        if (index >= 0 && index < this.images.length) {
            this.selectedIndices.clear();
            this.showMultiSelectionOrder = false;
            this.multiSelectMode = false;
            this.selectedIndices.add(index);
            this.currentIndex = index;
            this.updateUI();
        }
    },

    toggleMultiSelect: function (index) {
        this.showMultiSelectionOrder = true;
        this.multiSelectMode = true;
        if (this.selectedIndices.has(index)) {
            this.selectedIndices.delete(index);
            if (this.selectedIndices.size === 0) {
                if (this.images.length > 0) {
                    this.selectedIndices.add(0);
                    this.currentIndex = 0;
                } else {
                    this.currentIndex = -1;
                }
                this.multiSelectMode = false;
                this.showMultiSelectionOrder = false;
            } else {
                this.currentIndex = Math.max.apply(null, Array.from(this.selectedIndices));
            }
        } else {
            this.selectedIndices.add(index);
            this.currentIndex = index;
        }
        this.updateUI();
    },

    setupThumbnailTouchHandlers: function (thumbnail, index) {
        const self = this;
        let longPressTimer = null;

        const clearLongPressTimer = function () {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        };

        thumbnail.addEventListener('touchstart', function (e) {
            if (e.touches.length !== 1) {
                return;
            }
            clearLongPressTimer();
            longPressTimer = setTimeout(function () {
                longPressTimer = null;
                self.suppressThumbnailClick = true;
                self.toggleMultiSelect(index);
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            }, self.thumbnailLongPressMs);
        }, { passive: true });

        thumbnail.addEventListener('touchmove', clearLongPressTimer, { passive: true });
        thumbnail.addEventListener('touchend', clearLongPressTimer, { passive: true });
        thumbnail.addEventListener('touchcancel', clearLongPressTimer, { passive: true });
    },

    onThumbnailClick: function (index, event) {
        if (index < 0 || index >= this.images.length) {
            return;
        }

        if (this.suppressThumbnailClick) {
            this.suppressThumbnailClick = false;
            if (event) {
                event.preventDefault();
            }
            return;
        }

        if (event && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            this.toggleMultiSelect(index);
            return;
        }

        if (this.multiSelectMode) {
            this.toggleMultiSelect(index);
            return;
        }

        this.selectImage(index);
    },

   
    getIndicesToDelete: function () {
        let indices = Array.from(this.selectedIndices).filter(
            (i) => i >= 0 && i < this.images.length
        );
        if (indices.length === 0 && this.currentIndex >= 0 && this.currentIndex < this.images.length) {
            indices = [this.currentIndex];
        }
        return indices.sort((a, b) => a - b);
    },

   
    confirmDelete: function () {
        if (this.images.length === 0) {
            return;
        }

        const toDelete = this.getIndicesToDelete();
        if (toDelete.length === 0) {
            return;
        }

        let message =
            toDelete.length === 1
                ? 'この画像を削除してもよろしいですか？'
                : '選択した' + toDelete.length + '枚の画像を削除してもよろしいですか？';
        showConfirmMessageModal(message, 'ImageManager.deleteSelectedImages()');
    },

    /**
     * Delete current image
     */
    deleteSelectedImages: function () {
        closeConfirmMessageModal();

        const indices = this.getIndicesToDelete();
        if (indices.length === 0) {
            return;
        }

        const minDeleted = Math.min.apply(null, indices);
        const sortedDesc = indices.slice().sort((a, b) => b - a);
        sortedDesc.forEach((i) => {
            this.images.splice(i, 1);
        });

        this.selectedIndices.clear();
        if (this.images.length === 0) {
            this.currentIndex = -1;
        } else {
            this.currentIndex = Math.min(minDeleted, this.images.length - 1);
            this.selectedIndices.add(this.currentIndex);
        }

        this.updateUI();
    },

    /**
     * Zoom in
     */
    zoomIn: function () {
        if (this.zoomLevel < this.maxZoom) {
            this.zoomLevel = Math.min(this.zoomLevel + this.zoomStep, this.maxZoom);
            this.applyZoom();
        }
    },

    /**
     * Zoom out
     */
    zoomOut: function () {
        if (this.zoomLevel > this.minZoom) {
            this.zoomLevel = Math.max(this.zoomLevel - this.zoomStep, this.minZoom);
            this.applyZoom();
        }
    },

    /**
     * Apply zoom to preview image
     */
    applyZoom: function () {
        const previewImage = document.getElementById('preview-image');
        if (!previewImage) return;

        if (this.zoomLevel > this.minZoom) {
            previewImage.style.transform = 'scale(' + this.zoomLevel + ')';
            previewImage.classList.add('zoomed');
        } else {
            previewImage.style.transform = '';
            previewImage.classList.remove('zoomed');
        }

        // Update button states
        const zoomInBtn = document.getElementById('zoom-in-btn');
        const zoomOutBtn = document.getElementById('zoom-out-btn');

        if (zoomInBtn) {
            zoomInBtn.disabled = this.zoomLevel >= this.maxZoom;
        }
        if (zoomOutBtn) {
            zoomOutBtn.disabled = this.zoomLevel <= this.minZoom;
        }
    },

    /**
     * Reset zoom
     */
    resetZoom: function () {
        this.zoomLevel = this.minZoom;
        this.applyZoom();
    }
};

/**
 * Handle back to patient list
 */
var handleOnclickBack = () => {
    showLoadingSpinner();
    window.location.href = window.ocrMode === 'prescription'
        ? '/rehainfo/prescriptions/patients'
        : '/rehainfo/ocr/patients';
}

// =============================================================================
// OCR Evaluation Validation and Submission
// =============================================================================

/**
 * Error messages for validation
 */
var ERROR_MESSAGES = {
    EVALUATION_SHEET_REQUIRED: '評価シートを選択してください',
    EVALUATION_DATE_REQUIRED: '日付を入力してください',
    IMAGES_REQUIRED: '少なくとも1枚の画像をアップロードしてください'
};

/**
 * Validate evaluation sheet selection
 * @returns {string|null} Error message or null if valid
 */
var validateEvaluationSheet = function () {
    const input = document.getElementById('evaluation-sheet-search');
    const value = input ? input.value.trim() : '';

    if (!value) {
        return ERROR_MESSAGES.EVALUATION_SHEET_REQUIRED;
    }

    // Check if the value is in the dropdown list
    const dropdown = document.getElementById('autocomplete-dropdown');
    if (dropdown) {
        const items = dropdown.querySelectorAll('.autocomplete-item');
        let isValidOption = false;

        items.forEach(function (item) {
            const itemValue = item.getAttribute('data-value');
            if (itemValue === value) {
                isValidOption = true;
            }
        });

        if (!isValidOption) {
            return ERROR_MESSAGES.EVALUATION_SHEET_REQUIRED;
        }
    }

    return null;
};

/**
 * Validate evaluation date
 * @returns {string|null} Error message or null if valid
 */
var validateEvaluationDate = function () {
    const input = document.getElementById('evaluation-date');
    const value = input ? input.value.trim() : '';

    if (!value) {
        return ERROR_MESSAGES.EVALUATION_DATE_REQUIRED;
    }
    return null;
};

/**
 * Validate images uploaded
 * @returns {string|null} Error message or null if valid
 */
var validateImages = function () {
    if (!ImageManager.images || ImageManager.images.length === 0) {
        return ERROR_MESSAGES.IMAGES_REQUIRED;
    }
    return null;
};

/**
 * Master validation function
 * @returns {Object} Validation result with isValid flag and errors object
 */
var validateForm = function () {
    const errors = {
        evaluationSheet: window.ocrMode === 'prescription' ? null : validateEvaluationSheet(),
        evaluationDate: validateEvaluationDate(),
        images: validateImages()
    };

    return {
        isValid: !errors.evaluationSheet && !errors.evaluationDate && !errors.images,
        errors: errors
    };
};

/**
 * Clear all validation errors
 */
var clearAllErrors = function () {
    const errorFields = ['evaluation-sheet-error', 'evaluation-date-error', 'images-error'];
    errorFields.forEach(function (fieldId) {
        const element = document.getElementById(fieldId);
        if (element) {
            element.style.display = 'none';
            element.textContent = '';
        }
    });
};

/**
 * Show error for specific field
 * @param {string} fieldId - Field ID without '-error' suffix
 * @param {string} message - Error message to display
 */
var showFieldError = function (fieldId, message) {
    const errorElement = document.getElementById(fieldId + '-error');
    if (errorElement && message) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
};

/**
 * Display all validation errors
 * @param {Object} errors - Object containing error messages for each field
 */
var displayValidationErrors = function (errors) {
    clearAllErrors();

    if (errors.evaluationSheet) {
        showFieldError('evaluation-sheet', errors.evaluationSheet);
    }
    if (errors.evaluationDate) {
        showFieldError('evaluation-date', errors.evaluationDate);
    }
    if (errors.images) {
        showFieldError('images', errors.images);
    }

    // Focus first invalid field
    if (errors.evaluationSheet) {
        document.getElementById('evaluation-sheet-search')?.focus();
    } else if (errors.evaluationDate) {
        document.getElementById('evaluation-date')?.focus();
    }
};

/**
 * Upload all images in parallel using Promise.all
 * @param {string} recId - Patient record ID
 * @returns {Promise<Array<string>>} Array of uploaded image IDs
 */
var uploadAllImages = async function (recId) {
    // Create array of upload promises
    const uploadPromises = ImageManager.images.map(async function (image) {
        const formData = new FormData();
        formData.append('file', image.file);
        formData.append('recId', recId);

        const response = await fetch('/rehainfo/api/ocr/evaluation/upload-image', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || '画像のアップロードに失敗しました');
        }

        const result = await response.json();
        return result.imageId;
    });

    // Upload all images in parallel
    const imageIds = await Promise.all(uploadPromises);
    return imageIds;
};

/**
 * Register OCR evaluation summary
 * @param {Array<string>} imageIds - Array of uploaded image IDs
 * @param {string} recId - Patient record ID
 * @returns {Promise<Object>} Registration response
 */
var registerEvaluation = async function (imageIds, recId) {
    const searchInput = document.getElementById('evaluation-sheet-search');
    const evaluationSheetId = searchInput && searchInput.dataset ? searchInput.dataset.sheetId || '' : '';
    const evaluationDate = document.getElementById('evaluation-date').value;

    const requestData = {
        recId: recId,
        evaluationId: evaluationSheetId,
        evaluationDate: evaluationDate,
        imageIds: imageIds
    };
    const ocrPreset = searchInput && searchInput.dataset ? (searchInput.dataset.ocrPreset || '').trim() : '';
    if (ocrPreset) {
        requestData.ocrPresetValue = ocrPreset;
    }

    const registerUrl = window.ocrMode === 'prescription'
        ? '/rehainfo/api/prescriptions/register'
        : '/rehainfo/api/ocr/evaluation/register';
    const response = await fetch(registerUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.errorMessage || '登録に失敗しました');
    }

    const result = await response.json();
    return result;
};

/**
 * Handle form submission
 */
var handleSubmit = async function () {
    // Get submit button
    const submitBtn = document.getElementById('ocr-submit-btn');

    // Prevent multiple submissions
    if (submitBtn && submitBtn.disabled) {
        return;
    }

    // Clear previous errors
    clearAllErrors();

    // Validate form
    const validation = validateForm();
    if (!validation.isValid) {
        displayValidationErrors(validation.errors);
        return;
    }

    // Disable submit button to prevent multiple submissions
    if (submitBtn) {
        submitBtn.disabled = true;
    }

    try {
        // Show loading spinner
        showLoadingSpinner();

        // Get patient record ID from hidden input or data attribute
        const recId = document.getElementById('patient-rec-id')?.value ||
            document.body.dataset.recId ||
            window.patientRecId;

        if (!recId) {
            throw new Error('患者情報が見つかりません');
        }

        // Upload all images in parallel
        console.log('Uploading ' + ImageManager.images.length + ' images...');
        const imageIds = await uploadAllImages(recId);
        console.log('Images uploaded:', imageIds);

        // Register evaluation
        console.log('Registering evaluation...');
        const response = await registerEvaluation(imageIds, recId);
        console.log('Evaluation registered:', response);

        // Redirect to the saved result list for the active workflow.
        window.location.href = window.ocrMode === 'prescription'
            ? '/rehainfo/prescriptions/patient/' + recId + '/list'
            : '/rehainfo/ocr/patient/' + recId + '/list';

    } catch (error) {
        // Hide loading spinner
        hideLoadingSpinner();

        // Re-enable submit button
        if (submitBtn) {
            submitBtn.disabled = false;
        }

        // Show error message
        alert('エラーが発生しました: ' + error.message);
        console.error('Submit error:', error);
    }
};

/**
 * Initialize all functionality when DOM is ready
 */
$(document).ready(function () {
    // Initialize datepicker
    initDatePicker();

    // Initialize evaluation sheet search
    initEvaluationSheetSearch();

    // Initialize image manager
    ImageManager.init();
});
