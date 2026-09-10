"use strict";
/**
 * AutoSaveManager.js
 * 
 * 
 * Usage:
 *   AutoSaveManager.init({
 *       checkDirtyFn: function() { return hasNewData(); },
 *       saveFn: function(callback) { autoSave(callback); },
 *       modalId: '#autoSaveModal',
 *       excludeSelectors: ['.no-auto-save', '#logoutBtn']
 *   });
 */

var AutoSaveManager = window.AutoSaveManager || (function() {
    
    var config = {
        checkDirtyFn: null,      // Function: returns true if there's unsaved data
        saveFn: null,            // Function(callback): performs save, calls callback on complete
        modalId: '#autoSaveModal',
        excludeSelectors: [],    // Array: selectors to exclude from interception
        pendingUrl: null,        // Stores URL to navigate after modal action
        pendingForm: null,       // Stores form element for submission after modal action
        pendingCallback: null,   // Stores callback action after modal action
        isDiscarding: false      // Flag to bypass beforeunload check when discarding
    };
    
    var initialized = false;

    function resetTransientState(resetDiscarding) {
        config.pendingUrl = null;
        config.pendingForm = null;
        config.pendingCallback = null;

        if (resetDiscarding) {
            config.isDiscarding = false;
        }
    }

    /**
     * Initialize AutoSaveManager
     * @param {Object} options - Configuration options
     */
    function init(options) {
        if (initialized) {
            console.warn('AutoSaveManager already initialized; reconfiguring existing instance');
            config = Object.assign({}, config, options);
            resetTransientState(true);
            setupModalButtons();
            return;
        }
        
        // Merge options
        config = Object.assign({}, config, options);
        
        if (!config.checkDirtyFn || !config.saveFn) {
            console.error('AutoSaveManager: checkDirtyFn and saveFn are required');
            return;
        }
        
        // Setup History API (from BackCancel.js)
        setupHistoryInterception();
        
        // Setup Link Click Interception
        setupLinkInterception();
        
        // Setup Button Click Interception (for MP navigation buttons)
        setupButtonInterception();
        
        // Setup Form Submission Interception
        setupFormInterception();
        
        // Setup BeforeUnload Interception
        setupBeforeUnloadInterception();
        
        // Setup Modal Buttons
        setupModalButtons();
        
        initialized = true;
        console.log('AutoSaveManager initialized');
    }
    
    /**
     * Setup History API to intercept browser back button
     */
    function setupHistoryInterception() {
        // Push initial state
        history.pushState({ autoSave: true }, null, null);
        
        window.addEventListener('popstate', function(event) {
            // Skip if URL contains hash (anchor navigation)
            if (location.href.indexOf('#') > 0) {
                return;
            }

            // If user already chose Discard and we're still on the same page
            // (history.go(-2) didn't reach a different page, e.g. after page reload),
            // keep going back instead of showing modal again
            if (config.isDiscarding) {
                history.back();
                return;
            }

            // Check for dirty data
            if (isDirty()) {
                // Re-push state to prevent navigation
                history.pushState({ autoSave: true }, null, null);
                
                // Store that we want to go back
                config.pendingUrl = 'BROWSER_BACK';
                
                // Show modal
                showModal();
            } else {
                // No dirty data, allow navigation
                history.back();
            }
        });
    }
    
    /**
     * Setup click interception for all links
     */
    /**
     * Setup click interception for all links (Use Capture Phase to run before others)
     */
    function setupLinkInterception() {
        document.addEventListener('click', function(event) {
            var target = event.target.closest('a[href]');
            
            if (!target) return;
            
            // Check if this link should be excluded
            for (var i = 0; i < config.excludeSelectors.length; i++) {
                if (target.matches(config.excludeSelectors[i])) {
                    return; // Allow normal navigation
                }
            }
            
            // Skip if link is external or has target="_blank"
            var href = target.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('javascript:') ||
                target.getAttribute('target') === '_blank') {
                return;
            }
            
            // Check for dirty data
            if (isDirty()) {
                event.preventDefault();
                event.stopPropagation(); // Stop other handlers from executing
                clearPendingNavigation();
                config.pendingUrl = href;
                showModal();
            }
            // If no dirty data, allow normal navigation
        }, true); // Use Capture Phase
    }
    
    /**
     * Setup button interception for navigation buttons with data-url attribute
     * This handles MP navigation buttons that use onclick instead of links/forms
     */
    function setupButtonInterception() {
        document.addEventListener('click', function(event) {
            // Check if clicked element is a button with data-url attribute
            var button = event.target.closest('button[data-url]');
            
            if (!button) return;
            
            // Check if this button should be excluded
            for (var i = 0; i < config.excludeSelectors.length; i++) {
                if (button.matches(config.excludeSelectors[i])) {
                    return; // Allow normal navigation
                }
            }
            
            var url = button.getAttribute('data-url');
            if (!url || url.startsWith('#') || url.startsWith('javascript:')) {
                return; // Skip invalid URLs
            }
            
            // Check for dirty data
            if (isDirty()) {
                event.preventDefault();
                event.stopPropagation(); // Stop onclick handler from executing
                clearPendingNavigation();
                config.pendingUrl = url;
                showModal();
            }
            // If no dirty data, allow normal onclick to proceed
        }, true); // Use Capture Phase to run before onclick
    }

    /**
     * Setup form submission interception
     * Intercepts form submissions to show custom modal instead of browser dialog
     */
    function setupFormInterception() {
        document.addEventListener('submit', function(event) {
            var form = event.target;
            if (!form || form.tagName !== 'FORM') return;
            
            // Check if this form should be excluded
            for (var i = 0; i < config.excludeSelectors.length; i++) {
                if (form.matches(config.excludeSelectors[i])) {
                    return; // Allow normal form submission
                }
            }
            
            // Get form action URL
            var action = form.getAttribute('action');
            if (!action || action.startsWith('#') || action.startsWith('javascript:')) {
                return; // Skip invalid actions
            }
            
            // Check for dirty data
            if (isDirty()) {
                event.preventDefault();
                event.stopPropagation();

                // Store form and action for later submission
                clearPendingNavigation();
                config.pendingForm = form;
                config.pendingUrl = action;
                
                showModal();
            }
            // If no dirty data, allow normal form submission
        }, true); // Use Capture Phase
    }

    /**
     * Setup beforeunload interception for robust protection (Refresh/Close Tab)
     */
    function setupBeforeUnloadInterception() {
        window.addEventListener('beforeunload', function(event) {
            if (isDirty()) {
                // Determine if we should show standard browser dialog
                // Note: Custom modal cannot block tab close, so we rely on standard dialog here.
                // However, for internal navigation intercepted by click/popstate, we use custom modal.
                
                // If pendingUrl is set, we are already handling it via custom modal.
                // If isDiscarding is true, user explicitly chose to discard, so bypass default dialog.
                if (config.pendingUrl || config.isDiscarding) {
                     return;
                }

                // For external navigation or close/refresh: trigger browser dialog
                // Note: Modern browsers (Chrome, Firefox, Edge) use preventDefault() to trigger the dialog.
                event.preventDefault();
                return '';
            }
        });
    }
    
    function clearPendingNavigation() {
        resetTransientState(false);
    }

    /**
     * Setup modal button event handlers
     */
    function setupModalButtons() {
        var modal = document.querySelector(config.modalId);
        if (!modal) {
            console.warn('AutoSaveManager: Modal not found:', config.modalId);
            return;
        }

        if (modal.dataset.autoSaveButtonsBound === 'true') {
            return;
        }

        // Save and Navigate button
        var saveBtn = modal.querySelector('[data-action="save-navigate"]');
        if (saveBtn) {
            saveBtn.addEventListener('click', function() {
                // Show loading indicator
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 保存中...';

                // Wait for modal to fully hide before proceeding to prevent backdrop overlap
                $(modal).one('hidden.bs.modal', function() {
                    // Delay to let Bootstrap fully remove backdrop DOM before opening next modal
                    setTimeout(function () {
                        config.saveFn(function (result) {
                            saveBtn.disabled = false;
                            saveBtn.innerHTML = 'はい';

                            var success = result;
                            if (typeof result === 'object' && result !== null) {
                                success = result.success;
                            }

                            if (success) {
                                if (typeof result === 'object' && result !== null && typeof result.submit === 'function') {
                                    result.submit();
                                    return;
                                }
                                navigateToPending();
                            } else {
                                // Save failed, show error
                                alert('保存に失敗しました。');
                            }
                        });
                    }, 150);
                });
                hideModal();
            });
        }
        
        // Navigate without saving button
        var discardBtn = modal.querySelector('[data-action="discard-navigate"]');
        if (discardBtn) {
            discardBtn.addEventListener('click', function() {
                config.isDiscarding = true; // Signal beforeunload to let this pass
                // Wait for modal to fully hide before proceeding to prevent backdrop overlap
                $(modal).one('hidden.bs.modal', function() {
                    // Delay to let Bootstrap fully remove backdrop DOM before opening next modal
                    setTimeout(navigateToPending, 150);
                });
                hideModal();
            });
        }
        
        // Cancel button (stay on page)
        var cancelBtn = modal.querySelector('[data-action="cancel"]');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                hideModal();
                clearPendingNavigation();
            });
        }

        modal.dataset.autoSaveButtonsBound = 'true';
    }
    
    /**
     * Show the auto-save confirmation modal
     */
    function shouldTagAutoSaveBackdrop(modal) {
        return !!modal && modal.id === 'autoSaveModal' && modal.classList.contains('z-index-1070');
    }

    function tagAutoSaveBackdrop() {
        var backdrops = document.querySelectorAll('.modal-backdrop');
        if (!backdrops.length) {
            return;
        }

        backdrops.forEach(function(backdrop) {
            backdrop.classList.remove('z-index-1069');
        });

        backdrops[backdrops.length - 1].classList.add('z-index-1069');
    }

    function showModal() {
        // Hide any open offcanvas to prevent focus trap conflict with modal
        var openOffcanvas = document.querySelector('.offcanvas.show');
        if (openOffcanvas && typeof bootstrap !== 'undefined' && bootstrap.Offcanvas) {
            var bsOffcanvas = bootstrap.Offcanvas.getInstance(openOffcanvas);
            if (bsOffcanvas) bsOffcanvas.hide();
        }

        var modal = document.querySelector(config.modalId);
        if (modal) {
            if (shouldTagAutoSaveBackdrop(modal)) {
                modal.addEventListener('shown.bs.modal', tagAutoSaveBackdrop, { once: true });
            }

            // Using Bootstrap 5 Modal API
            if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                var bsModal = bootstrap.Modal.getOrCreateInstance(modal);
                bsModal.show();
            } else {
                // Fallback: jQuery modal
                $(config.modalId).modal('show');
            }
        }
    }
    
    /**
     * Hide the modal
     */
    function hideModal() {
        var modal = document.querySelector(config.modalId);
        if (modal) {
            if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                var bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) bsModal.hide();
            } else {
                $(config.modalId).modal('hide');
            }
        }
    }
    
    /**
     * Navigate to the pending URL or submit pending form
     */
    function navigateToPending() {
        if (config.pendingCallback) {
            // Execute pending callback and return early.
            // Keep isDiscarding = true — downstream navigation in callback chain
            // needs it to bypass beforeunload (user already chose Discard).
            var callback = config.pendingCallback;
            clearPendingNavigation();
            callback();
            return;
        }

        if (config.pendingForm) {
            // Submit the pending form
            var form = config.pendingForm;
            clearPendingNavigation();
            form.submit();
            return;
        }

        if (config.pendingUrl === 'BROWSER_BACK') {
            clearPendingNavigation();
            // Go back in browser history
            history.go(-2); // -2 because we pushed a state
            return;
        }

        if (config.pendingUrl) {
            var url = config.pendingUrl;
            clearPendingNavigation();
            window.location.href = url;
        }
    }
    
    /**
     * Check if there's dirty data (public method)
     */
    function isDirty() {
        return config.checkDirtyFn ? config.checkDirtyFn() : false;
    }
    
    /**
     * Force save (public method)
     */
    function save(callback) {
        if (config.saveFn) {
            config.saveFn(callback);
        }
    }

    function getConfigSnapshot() {
        if (!initialized || !config.checkDirtyFn || !config.saveFn) {
            return null;
        }

        return {
            checkDirtyFn: config.checkDirtyFn,
            saveFn: config.saveFn,
            modalId: config.modalId,
            excludeSelectors: Array.isArray(config.excludeSelectors) ? config.excludeSelectors.slice() : []
        };
    }

    function restoreConfig(snapshot) {
        if (!snapshot || !snapshot.checkDirtyFn || !snapshot.saveFn) {
            return;
        }

        config = Object.assign({}, config, snapshot);
        resetTransientState(true);
        setupModalButtons();
    }

    /**
     * Handle manual navigation request (e.g. from location.href changes)
     * @param {string} url - URL to navigate to
     */
    function handleNavigation(url, callback) {
        if (isDirty()) {
            clearPendingNavigation();
            if (callback) {
                config.pendingCallback = callback;
            } else {
                config.pendingUrl = url;
            }
            showModal();
        } else {
            if (callback) {
                callback();
            } else {
                window.location.href = url;
            }
        }
    }

    // Public API
    return {
        init: init,
        isDirty: isDirty,
        save: save,
        getConfigSnapshot: getConfigSnapshot,
        restoreConfig: restoreConfig,
        handleNavigation: handleNavigation
    };
    
})();
