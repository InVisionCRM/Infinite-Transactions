/**
 * @fileoverview Main application entry point
 */

import { initializePage, elements } from './modules/ui.js';
import { initializeSettings } from './modules/settings.js';
import { startMetricsUpdate } from './modules/metrics.js';
import { processBuy, addPls, addPlsToAll, resetTransactions } from './modules/transactions.js';
import { state, initializeStateValues } from './modules/state.js';
import { validatePositiveNumber, validateWalletId } from './utils/validators.js';
import { initializeCapitalDashboard } from './modules/capitalDashboard.js';
import { initializeCascadePreset } from './modules/cascadePreset.js';

/**
 * Verify Decimal.js is loaded and configured
 * @returns {boolean} Whether Decimal.js is ready
 */
function verifyDecimalJs() {
    if (!window.Decimal) {
        console.error('Decimal.js not found in global scope');
        return false;
    }
    
    try {
        // Test Decimal functionality
        const test = new window.Decimal(1);
        test.plus(1);
        console.log('Decimal.js verified working');
        return true;
    } catch (error) {
        console.error('Decimal.js verification failed:', error);
        return false;
    }
}

/**
 * Initialize the application
 */
function initializeApp() {
    console.log('Initializing application...');

    try {
        // Verify Decimal.js is loaded
        if (!verifyDecimalJs()) {
            alert('Failed to load Decimal.js library. Please refresh the page.');
            return;
        }

        // Initialize state with Decimal values
        initializeStateValues();

        // Initialize state first
        if (!window.state) {
            window.state = state;
        }

        // Initialize UI components
        initializePage();

        // Initialize settings
        initializeSettings();

        // Initialize capital dashboard
        initializeCapitalDashboard();

        // Initialize cascade preset
        initializeCascadePreset();

        // Start metrics updates
        startMetricsUpdate();

        // Bind event handlers
        bindEventHandlers();

        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Error initializing application:', error);
        alert('Failed to initialize application: ' + error.message);
    }
}

/**
 * Bind event handlers for main application controls
 */
function bindEventHandlers() {
    // Buy button handler
    if (elements.buyButton) {
        elements.buyButton.addEventListener('click', handleBuy);
    }

    // Add funds button handler
    if (elements.addFundsButton) {
        elements.addFundsButton.addEventListener('click', handleAddFunds);
    }

    // Add all funds button handler
    if (elements.addAllFundsButton) {
        elements.addAllFundsButton.addEventListener('click', handleAddAllFunds);
    }

    // Pause button handler
    if (elements.pauseButton) {
        elements.pauseButton.addEventListener('click', handlePause);
    }

    // Reset button handler
    if (elements.resetButton) {
        elements.resetButton.addEventListener('click', handleReset);
    }
}

/**
 * Handle buy button click
 * @returns {Promise<void>}
 */
async function handleBuy() {
    const Decimal = window.Decimal;
    const amount = new Decimal(elements.buyAmount?.value || 0);
    const amountValidation = validatePositiveNumber(amount);
    if (!amountValidation.isValid) {
        alert(amountValidation.message);
        return;
    }

    const selectedWallet = elements.selectWallet?.value;
    const walletValidation = validateWalletId(selectedWallet);
    if (!walletValidation.isValid) {
        alert('Please select a wallet');
        return;
    }

    if (state.tokens.length === 0) {
        alert('No tokens available');
        return;
    }

    const selectedTokenId = parseInt(elements.selectPlsToken?.value);
    const selectedToken = state.tokens.find(t => t.id === selectedTokenId);
    
    if (!selectedToken) {
        alert('Please select a valid token to start the transaction');
        return;
    }

    // Process the buy transaction
    const result = await processBuy({
        amount,
        walletId: selectedWallet,
        tokenId: selectedTokenId,
        isInitialBuy: true
    });

    if (!result.success) {
        alert(result.error);
        return;
    }

    // Clear input on success
    if (elements.buyAmount) {
        elements.buyAmount.value = '';
    }
}

/**
 * Handle add funds button click
 */
function handleAddFunds() {
    const Decimal = window.Decimal;
    const amount = new Decimal(elements.addPlsAmount?.value || 0);
    const amountValidation = validatePositiveNumber(amount);
    if (!amountValidation.isValid) {
        alert(amountValidation.message);
        return;
    }

    const selectedTokenId = parseInt(elements.selectPlsToken?.value);
    if (!selectedTokenId) {
        alert('Please select a token to add PLS to');
        return;
    }

    // Add PLS to selected token
    const result = addPls({
        tokenId: selectedTokenId,
        amount
    });

    if (!result.success) {
        alert(result.error);
        return;
    }

    // Clear input on success
    if (elements.addPlsAmount) {
        elements.addPlsAmount.value = '';
    }
}

/**
 * Handle add all funds button click
 */
function handleAddAllFunds() {
    const Decimal = window.Decimal;
    const amount = new Decimal(elements.addPlsAmount?.value || 0);
    const amountValidation = validatePositiveNumber(amount);
    if (!amountValidation.isValid) {
        alert(amountValidation.message);
        return;
    }

    // Add PLS to all tokens
    const result = addPlsToAll(amount);

    if (!result.success) {
        alert(result.error);
        return;
    }

    // Clear input on success
    if (elements.addPlsAmount) {
        elements.addPlsAmount.value = '';
    }
}

/**
 * Handle pause button click
 */
function handlePause() {
    state.isPaused = !state.isPaused;
    
    if (elements.pauseButton) {
        elements.pauseButton.textContent = state.isPaused ? 'Resume' : 'Pause';
        elements.pauseButton.classList.toggle('paused', state.isPaused);
    }
}

/**
 * Handle reset button click
 */
function handleReset() {
    // Pause trading if not already paused
    if (!state.isPaused) {
        handlePause();
    }
    
    // Reset transactions and update UI
    resetTransactions();
}

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);

// Handle errors globally
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    alert('An error occurred. Please check the console for details.');
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    alert('An async error occurred. Please check the console for details.');
}); 