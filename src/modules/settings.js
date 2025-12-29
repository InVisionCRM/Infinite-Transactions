/**
 * @fileoverview Settings management module for handling application configuration
 */

import { state } from './state.js';
import { validateRange, validatePercentage, validateGas, validateTimeInterval } from '../utils/validators.js';
import { elements } from './ui.js';

/**
 * Get the Decimal instance, throwing an error if it's not available
 * @returns {typeof Decimal} The Decimal constructor
 */
function getDecimal() {
    if (!window.Decimal) {
        throw new Error('Decimal.js not loaded');
    }
    return window.Decimal;
}

/**
 * @typedef {Object} Settings
 * @property {number} globalFontSize - Global font size in pixels
 * @property {number} defaultOppositeTokenPercentage - Default percentage for opposite token
 * @property {number} defaultGasPercentage - Default percentage for gas
 * @property {Decimal} minGlobalGas - Minimum gas cost
 * @property {Decimal} maxGlobalGas - Maximum gas cost
 * @property {Decimal} minTimeInterval - Minimum time interval
 * @property {Decimal} maxTimeInterval - Maximum time interval
 */

/**
 * @typedef {Object} SettingsValidationResult
 * @property {boolean} isValid - Whether the settings are valid
 * @property {string} [error] - Error message if validation failed
 * @property {string} [field] - Field that failed validation
 */

/**
 * Initialize settings panel and bind event listeners
 */
export function initializeSettings() {
    bindSettingsEvents();
    loadInitialSettings();
    updateSettingsDisplay();
}

/**
 * Bind event listeners to settings controls
 */
function bindSettingsEvents() {
    const wplsPriceInput = document.getElementById('wplsPrice');
    if (wplsPriceInput) {
        wplsPriceInput.addEventListener('input', handleWplsPriceChange);
    }

    if (elements.globalFontSize) {
        elements.globalFontSize.addEventListener('input', handleFontSizeChange);
    }

    if (elements.defaultOppositeTokenPercentage) {
        elements.defaultOppositeTokenPercentage.addEventListener('input', handleOppositeTokenPercentageChange);
    }

    if (elements.defaultGasPercentage) {
        elements.defaultGasPercentage.addEventListener('input', handleGasPercentageChange);
    }

    if (elements.minGlobalGas) {
        elements.minGlobalGas.addEventListener('input', handleMinGasChange);
    }

    if (elements.maxGlobalGas) {
        elements.maxGlobalGas.addEventListener('input', handleMaxGasChange);
    }

    if (elements.minTimeInterval) {
        elements.minTimeInterval.addEventListener('input', handleMinTimeIntervalChange);
    }

    if (elements.maxTimeInterval) {
        elements.maxTimeInterval.addEventListener('input', handleMaxTimeIntervalChange);
    }

    // Routing settings
    const maxRoutingHops = document.getElementById('maxRoutingHops');
    if (maxRoutingHops) {
        maxRoutingHops.addEventListener('input', handleMaxHopsChange);
    }

    const requireRoutingConfirmation = document.getElementById('requireRoutingConfirmation');
    if (requireRoutingConfirmation) {
        requireRoutingConfirmation.addEventListener('change', handleRoutingConfirmationChange);
    }

    // Gas requirement toggle
    const requireGas = document.getElementById('requireGas');
    if (requireGas) {
        requireGas.addEventListener('change', handleRequireGasChange);
    }

    // Slippage toggle
    const applySlippage = document.getElementById('applySlippage');
    if (applySlippage) {
        applySlippage.addEventListener('change', handleApplySlippageChange);
    }

    // Bind preset button events using event delegation
    bindPresetButtonEvents();
}

/**
 * Bind event listeners for preset buttons using event delegation
 */
function bindPresetButtonEvents() {
    const settingsPanel = document.getElementById('settingsPanel');
    if (settingsPanel) {
        settingsPanel.addEventListener('click', (e) => {
            if (e.target.classList.contains('preset-btn')) {
                handlePresetButtonClick(e);
            }
        });
    }
}

/**
 * Handle preset button clicks
 * @param {Event} e - Click event
 */
function handlePresetButtonClick(e) {
    const button = e.target;
    const value = button.dataset.value;
    const target = button.dataset.target;
    const minValue = button.dataset.min;
    const maxValue = button.dataset.max;

    if (target === 'gas') {
        // Handle dual-input gas presets
        if (elements.minGlobalGas && minValue) {
            elements.minGlobalGas.value = minValue;
            handleMinGasChange({ target: elements.minGlobalGas });
        }
        if (elements.maxGlobalGas && maxValue) {
            elements.maxGlobalGas.value = maxValue;
            handleMaxGasChange({ target: elements.maxGlobalGas });
        }
    } else if (target === 'time') {
        // Handle dual-input time presets
        if (elements.minTimeInterval && minValue) {
            elements.minTimeInterval.value = minValue;
            handleMinTimeIntervalChange({ target: elements.minTimeInterval });
        }
        if (elements.maxTimeInterval && maxValue) {
            elements.maxTimeInterval.value = maxValue;
            handleMaxTimeIntervalChange({ target: elements.maxTimeInterval });
        }
    } else if (value !== undefined) {
        // Handle single-input presets
        const inputId = button.closest('.wpls-price-control, .reflections-settings, .routing-settings, .ui-settings, .stress-test-panel').querySelector('input[type="number"]');
        if (inputId) {
            inputId.value = value;
            inputId.dispatchEvent(new Event('input'));
        }
    }
}

/**
 * Load initial settings values
 */
function loadInitialSettings() {
    // WPLS Price - set to $1.00
    const wplsPriceInput = document.getElementById('wplsPrice');
    if (wplsPriceInput) {
        wplsPriceInput.value = '1.00';
        handleWplsPriceChange({ target: wplsPriceInput });
    }

    if (elements.globalFontSize) {
        elements.globalFontSize.value = '16';
        handleFontSizeChange({ target: elements.globalFontSize });
    }

    if (elements.defaultOppositeTokenPercentage) {
        elements.defaultOppositeTokenPercentage.value = '50';
    }

    if (elements.defaultGasPercentage) {
        elements.defaultGasPercentage.value = '10';
    }

    if (elements.minGlobalGas && state.minGlobalGas) {
        elements.minGlobalGas.value = state.minGlobalGas.toString();
    }

    if (elements.maxGlobalGas && state.maxGlobalGas) {
        elements.maxGlobalGas.value = state.maxGlobalGas.toString();
    }

    if (elements.minTimeInterval && state.minTimeInterval) {
        elements.minTimeInterval.value = state.minTimeInterval.toString();
    }

    if (elements.maxTimeInterval && state.maxTimeInterval) {
        elements.maxTimeInterval.value = state.maxTimeInterval.toString();
    }

    // Max routing hops
    const maxRoutingHops = document.getElementById('maxRoutingHops');
    if (maxRoutingHops) {
        maxRoutingHops.value = '3';
    }
}

/**
 * Update settings display values
 */
function updateSettingsDisplay() {
    if (elements.fontSizeValue) {
        elements.fontSizeValue.textContent = `${elements.globalFontSize?.value || 16}px`;
    }

    // Update gas display values
    const minGasValue = document.getElementById('minGasValue');
    if (minGasValue && state.minGlobalGas) {
        minGasValue.textContent = formatGasValue(state.minGlobalGas.toNumber());
    }

    const maxGasValue = document.getElementById('maxGasValue');
    if (maxGasValue && state.maxGlobalGas) {
        maxGasValue.textContent = formatGasValue(state.maxGlobalGas.toNumber());
    }

    if (elements.minTimeValue && state.minTimeInterval) {
        elements.minTimeValue.textContent = `${state.minTimeInterval.toFixed(2)}s`;
    }

    if (elements.maxTimeValue && state.maxTimeInterval) {
        elements.maxTimeValue.textContent = `${state.maxTimeInterval.toFixed(2)}s`;
    }
}

/**
 * Handle WPLS price change
 * @param {Event} e - Input event
 */
function handleWplsPriceChange(e) {
    const Decimal = getDecimal();
    const price = parseFloat(e.target.value);

    // Validate input
    if (isNaN(price) || price <= 0) {
        return;
    }

    state.plsPrice = new Decimal(price.toString());

    const wplsPriceValue = document.getElementById('wplsPriceValue');
    if (wplsPriceValue) {
        // Format price based on magnitude
        if (price >= 0.01) {
            wplsPriceValue.textContent = `$${price.toFixed(2)}`;
        } else if (price >= 0.0001) {
            wplsPriceValue.textContent = `$${price.toFixed(4)}`;
        } else {
            wplsPriceValue.textContent = `$${price.toFixed(6)}`;
        }
    }

    // Update PLS price display in metrics
    const plsPriceDisplay = document.getElementById('plsPrice');
    if (plsPriceDisplay) {
        if (price >= 0.01) {
            plsPriceDisplay.textContent = price.toFixed(2);
        } else if (price >= 0.0001) {
            plsPriceDisplay.textContent = price.toFixed(4);
        } else {
            plsPriceDisplay.textContent = price.toFixed(6);
        }
    }

    // Update all token displays that depend on WPLS price
    state.tokens.forEach(token => {
        token.updateLiquidityDisplay();
    });
}

/**
 * Handle font size change
 * @param {Event} e - Input event
 */
function handleFontSizeChange(e) {
    const size = e.target.value;
    document.documentElement.style.fontSize = `${size}px`;
    if (elements.fontSizeValue) {
        elements.fontSizeValue.textContent = `${size}px`;
    }
}

/**
 * Handle opposite token percentage change
 * @param {Event} e - Change event
 */
function handleOppositeTokenPercentageChange(e) {
    const percentage = parseInt(e.target.value);
    const validation = validatePercentage(percentage);
    if (!validation.isValid) {
        alert(validation.message);
        e.target.value = '50';
        return;
    }

    // Update display value
    const oppositeTokenPercentageValue = document.getElementById('oppositeTokenPercentageValue');
    if (oppositeTokenPercentageValue) {
        oppositeTokenPercentageValue.textContent = `${percentage}%`;
    }
}

/**
 * Handle gas percentage change
 * @param {Event} e - Change event
 */
function handleGasPercentageChange(e) {
    const percentage = parseInt(e.target.value);
    const validation = validatePercentage(percentage);
    if (!validation.isValid) {
        alert(validation.message);
        e.target.value = '10';
        return;
    }

    // Update display value
    const gasPercentageValue = document.getElementById('gasPercentageValue');
    if (gasPercentageValue) {
        gasPercentageValue.textContent = `${percentage}%`;
    }
}

/**
 * Format gas value for display
 * @param {number} value - Gas value
 * @returns {string} Formatted string
 */
function formatGasValue(value) {
    if (value >= 1) {
        return value.toFixed(2);
    } else if (value >= 0.001) {
        return value.toFixed(4);
    } else {
        return value.toFixed(6);
    }
}

/**
 * Handle minimum gas change
 * @param {Event} e - Input event
 */
function handleMinGasChange(e) {
    const Decimal = getDecimal();
    let newMin = new Decimal(e.target.value);

    // Basic validation - just ensure it's a positive number
    if (newMin.lte(0)) {
        alert('Gas cost must be greater than 0');
        e.target.value = state.minGlobalGas.toString();
        return;
    }

    // Update display value
    const minGasValue = document.getElementById('minGasValue');
    if (minGasValue) {
        minGasValue.textContent = formatGasValue(newMin.toNumber());
    }

    state.minGlobalGas = newMin;
}

/**
 * Handle maximum gas change
 * @param {Event} e - Input event
 */
function handleMaxGasChange(e) {
    const Decimal = getDecimal();
    let newMax = new Decimal(e.target.value);

    // Basic validation - just ensure it's a positive number
    if (newMax.lte(0)) {
        alert('Gas cost must be greater than 0');
        e.target.value = state.maxGlobalGas.toString();
        return;
    }

    // Update display value
    const maxGasValue = document.getElementById('maxGasValue');
    if (maxGasValue) {
        maxGasValue.textContent = formatGasValue(newMax.toNumber());
    }

    state.maxGlobalGas = newMax;
}

/**
 * Handle minimum time interval change
 * @param {Event} e - Input event
 */
function handleMinTimeIntervalChange(e) {
    const Decimal = getDecimal();
    let newMin = new Decimal(e.target.value);

    // Basic validation - just ensure it's a positive number
    if (newMin.lte(0)) {
        alert('Time interval must be greater than 0');
        e.target.value = state.minTimeInterval.toString();
        return;
    }

    state.minTimeInterval = newMin;
    if (elements.minTimeValue) {
        elements.minTimeValue.textContent = `${newMin.toFixed(2)}s`;
    }

    // Reset wallet intervals when time settings change
    state.walletIntervals.clear();
}

/**
 * Handle maximum time interval change
 * @param {Event} e - Input event
 */
function handleMaxTimeIntervalChange(e) {
    const Decimal = getDecimal();
    let newMax = new Decimal(e.target.value);

    // Basic validation - just ensure it's a positive number
    if (newMax.lte(0)) {
        alert('Time interval must be greater than 0');
        e.target.value = state.maxTimeInterval.toString();
        return;
    }

    state.maxTimeInterval = newMax;
    if (elements.maxTimeValue) {
        elements.maxTimeValue.textContent = `${newMax.toFixed(2)}s`;
    }

    // Reset wallet intervals when time settings change
    state.walletIntervals.clear();
}

/**
 * Handle max routing hops change
 * @param {Event} e - Input event
 */
function handleMaxHopsChange(e) {
    const hops = parseInt(e.target.value);
    state.maxRoutingHops = hops;

    const maxHopsValue = document.getElementById('maxHopsValue');
    if (maxHopsValue) {
        maxHopsValue.textContent = hops.toString();
    }
}

/**
 * Handle routing confirmation toggle change
 * @param {Event} e - Change event
 */
function handleRoutingConfirmationChange(e) {
    state.requireRoutingConfirmation = e.target.checked;
}

/**
 * Handle gas requirement toggle change
 * @param {Event} e - Change event
 */
function handleRequireGasChange(e) {
    state.requireGas = e.target.checked;

    // Toggle visibility of gas range controls
    const gasRangeContainer = document.getElementById('gasRangeContainer');
    if (gasRangeContainer) {
        gasRangeContainer.style.display = e.target.checked ? 'block' : 'none';
    }
}

/**
 * Handle slippage toggle change
 * @param {Event} e - Change event
 */
function handleApplySlippageChange(e) {
    state.applySlippage = e.target.checked;
    console.log(`Slippage calculation ${e.target.checked ? 'enabled' : 'disabled'}`);
}

/**
 * Get current settings
 * @returns {Settings} Current settings values
 */
export function getCurrentSettings() {
    return {
        globalFontSize: parseInt(elements.globalFontSize?.value || '16'),
        defaultOppositeTokenPercentage: parseInt(elements.defaultOppositeTokenPercentage?.value || '50'),
        defaultGasPercentage: parseInt(elements.defaultGasPercentage?.value || '10'),
        minGlobalGas: state.minGlobalGas,
        maxGlobalGas: state.maxGlobalGas,
        minTimeInterval: state.minTimeInterval,
        maxTimeInterval: state.maxTimeInterval
    };
}

/**
 * Validate settings values
 * @param {Settings} settings - Settings to validate
 * @returns {SettingsValidationResult} Validation result
 */
export function validateSettings(settings) {
    // Validate font size
    const fontSizeValidation = validateRange(settings.globalFontSize, 12, 96);
    if (!fontSizeValidation.isValid) {
        return {
            isValid: false,
            error: fontSizeValidation.message,
            field: 'globalFontSize'
        };
    }

    // Validate percentages
    const oppositeTokenValidation = validatePercentage(settings.defaultOppositeTokenPercentage);
    if (!oppositeTokenValidation.isValid) {
        return {
            isValid: false,
            error: oppositeTokenValidation.message,
            field: 'defaultOppositeTokenPercentage'
        };
    }

    const gasPercentageValidation = validatePercentage(settings.defaultGasPercentage);
    if (!gasPercentageValidation.isValid) {
        return {
            isValid: false,
            error: gasPercentageValidation.message,
            field: 'defaultGasPercentage'
        };
    }

    // Basic validation for gas limits - just ensure they're positive
    const Decimal = getDecimal();
    if (settings.minGlobalGas.lte(0) || settings.maxGlobalGas.lte(0)) {
        return {
            isValid: false,
            error: 'Gas costs must be greater than 0',
            field: 'globalGas'
        };
    }

    // Basic validation for time intervals - just ensure they're positive
    if (settings.minTimeInterval.lte(0) || settings.maxTimeInterval.lte(0)) {
        return {
            isValid: false,
            error: 'Time intervals must be greater than 0',
            field: 'timeInterval'
        };
    }

    return { isValid: true };
}

/**
 * Apply settings values
 * @param {Settings} settings - Settings to apply
 * @returns {boolean} Whether settings were applied successfully
 */
export function applySettings(settings) {
    const validation = validateSettings(settings);
    if (!validation.isValid) {
        alert(`Invalid settings: ${validation.error}`);
        return false;
    }

    // Apply font size
    document.documentElement.style.fontSize = `${settings.globalFontSize}px`;
    if (elements.globalFontSize) {
        elements.globalFontSize.value = settings.globalFontSize.toString();
    }
    if (elements.fontSizeValue) {
        elements.fontSizeValue.textContent = `${settings.globalFontSize}px`;
    }

    // Apply percentages
    if (elements.defaultOppositeTokenPercentage) {
        elements.defaultOppositeTokenPercentage.value = settings.defaultOppositeTokenPercentage.toString();
    }
    if (elements.defaultGasPercentage) {
        elements.defaultGasPercentage.value = settings.defaultGasPercentage.toString();
    }

    // Apply gas limits
    state.minGlobalGas = settings.minGlobalGas;
    state.maxGlobalGas = settings.maxGlobalGas;
    if (elements.minGlobalGas) {
        elements.minGlobalGas.value = settings.minGlobalGas.toString();
    }
    if (elements.maxGlobalGas) {
        elements.maxGlobalGas.value = settings.maxGlobalGas.toString();
    }

    // Apply time intervals
    state.minTimeInterval = settings.minTimeInterval;
    state.maxTimeInterval = settings.maxTimeInterval;
    if (elements.minTimeInterval) {
        elements.minTimeInterval.value = settings.minTimeInterval.toString();
    }
    if (elements.maxTimeInterval) {
        elements.maxTimeInterval.value = settings.maxTimeInterval.toString();
    }
    if (elements.minTimeValue) {
        elements.minTimeValue.textContent = `${settings.minTimeInterval.toFixed(2)}s`;
    }
    if (elements.maxTimeValue) {
        elements.maxTimeValue.textContent = `${settings.maxTimeInterval.toFixed(2)}s`;
    }

    // Reset wallet intervals when settings change
    state.walletIntervals.clear();

    return true;
} 