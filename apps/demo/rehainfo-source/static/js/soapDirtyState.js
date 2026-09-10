"use strict";

(function (window) {
    window.createSoapDirtyState = function (options) {
        var dirtySoapSections = {};

        var getSoapDirtyKey = function (treatmentDate, treatmentTimes) {
            return treatmentDate + "-" + treatmentTimes;
        };

        var ensureDirtySoapSections = function (key) {
            if (dirtySoapSections[key] === undefined) {
                dirtySoapSections[key] = {};
            }
            return dirtySoapSections[key];
        };

        var hasDirtySoapSections = function (key) {
            return dirtySoapSections[key] !== undefined && Object.keys(dirtySoapSections[key]).length > 0;
        };

        return {
            resetAll: function () {
                dirtySoapSections = {};
            },
            getDirtySectionsForField: function (field) {
                if (field === "all") {
                    return ["time", "s", "o", "a", "p"];
                }
                return [field];
            },
            markDirty: function (treatmentDate, treatmentTimes, actualByRole, sections) {
                var key = getSoapDirtyKey(treatmentDate, treatmentTimes);
                var dirtySections = ensureDirtySoapSections(key);
                sections.forEach(function (section) {
                    dirtySections[section] = true;
                });
                if (options.getMessageError()[key] === undefined) {
                    var editingSoap = options.getEditingSoap();
                    editingSoap[key] = options.buildSnapshot(treatmentDate, treatmentTimes, actualByRole);
                    options.setEditingSoap(editingSoap);
                }
            },
            clearAfterUpdate: function (treatmentDate, treatmentTimes, actualByRole, field) {
                var key = getSoapDirtyKey(treatmentDate, treatmentTimes);
                var editingSoap = options.getEditingSoap();
                if (field === "all") {
                    delete dirtySoapSections[key];
                    delete editingSoap[key];
                    options.setEditingSoap(editingSoap);
                    return;
                }
                if (dirtySoapSections[key] !== undefined) {
                    delete dirtySoapSections[key][field];
                    if (Object.keys(dirtySoapSections[key]).length === 0) {
                        delete dirtySoapSections[key];
                    }
                }
                if (hasDirtySoapSections(key)) {
                    editingSoap[key] = options.buildSnapshot(treatmentDate, treatmentTimes, actualByRole);
                } else {
                    delete editingSoap[key];
                }
                options.setEditingSoap(editingSoap);
            },
            clearAllForCard: function (treatmentDate, treatmentTimes) {
                var key = getSoapDirtyKey(treatmentDate, treatmentTimes);
                delete dirtySoapSections[key];
                var editingSoap = options.getEditingSoap();
                delete editingSoap[key];
                options.setEditingSoap(editingSoap);
                delete options.getMessageError()[key];
            }
        };
    };
})(window);
