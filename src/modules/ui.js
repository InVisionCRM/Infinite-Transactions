/**
 * @fileoverview UI management module for handling DOM operations and updates
 */

import { state } from './state.js';
import { Token } from './token.js';
import { formatNumberWithSubscript, formatNumber, formatCurrency } from '../utils/formatters.js';

/**
 * @typedef {Object} DOMElements
 * @property {HTMLElement} settingsToggle
 * @property {HTMLElement} settingsPanel
 * @property {HTMLElement} leftContainer
 * @property {HTMLElement} addTokenBtn
 * @property {HTMLInputElement} buyAmount
 * @property {HTMLButtonElement} buyButton
 * @property {HTMLInputElement} addPlsAmount
 * @property {HTMLButtonElement} addFundsButton
 * @property {HTMLTableElement} transactionTable
 * @property {HTMLElement} transactionCount
 * @property {HTMLElement} totalProcessed
 * @property {HTMLElement} timeElapsed
 * @property {HTMLElement} transactionsPerMinute
 * @property {HTMLElement} plsPrice
 * @property {HTMLInputElement} globalFontSize
 * @property {HTMLElement} fontSizeValue
 * @property {HTMLInputElement} defaultOppositeTokenPercentage
 * @property {HTMLInputElement} defaultGasPercentage
 * @property {HTMLSelectElement} selectPlsToken
 * @property {HTMLSelectElement} selectWallet
 * @property {HTMLInputElement} minGlobalGas
 * @property {HTMLInputElement} maxGlobalGas
 * @property {HTMLButtonElement} addAllFundsButton
 * @property {HTMLInputElement} minTimeInterval
 * @property {HTMLInputElement} maxTimeInterval
 * @property {HTMLElement} minTimeValue
 * @property {HTMLElement} maxTimeValue
 * @property {HTMLElement} totalGasUsed
 * @property {HTMLButtonElement} pauseButton
 * @property {HTMLButtonElement} resetButton
 */

/**
 * Cache of DOM elements
 * @type {DOMElements}
 */
export const elements = {
    settingsToggle: document.getElementById('settingsToggle'),
    settingsPanel: document.getElementById('settingsPanel'),
    leftContainer: document.getElementById('leftContainer'),
    addTokenBtn: document.getElementById('addToken'),
    buyAmount: document.getElementById('buyAmount'),
    buyButton: document.getElementById('buyButton'),
    addPlsAmount: document.getElementById('addPlsAmount'),
    addFundsButton: document.getElementById('addFundsButton'),
    transactionTable: document.getElementById('transactionTable').querySelector('tbody'),
    transactionCount: document.getElementById('transactionCount'),
    totalProcessed: document.getElementById('totalProcessed'),
    timeElapsed: document.getElementById('timeElapsed'),
    transactionsPerMinute: document.getElementById('transactionsPerMinute'),
    plsPrice: document.getElementById('plsPrice'),
    globalFontSize: document.getElementById('globalFontSize'),
    fontSizeValue: document.getElementById('fontSizeValue'),
    defaultOppositeTokenPercentage: document.getElementById('defaultOppositeTokenPercentage'),
    defaultGasPercentage: document.getElementById('defaultGasPercentage'),
    selectPlsToken: document.getElementById('selectPlsToken'),
    selectWallet: document.getElementById('selectWallet'),
    minGlobalGas: document.getElementById('minGlobalGas'),
    maxGlobalGas: document.getElementById('maxGlobalGas'),
    addAllFundsButton: document.getElementById('addAllFundsButton'),
    minTimeInterval: document.getElementById('minTimeInterval'),
    maxTimeInterval: document.getElementById('maxTimeInterval'),
    minTimeValue: document.getElementById('minTimeValue'),
    maxTimeValue: document.getElementById('maxTimeValue'),
    totalGasUsed: document.getElementById('totalGasUsed'),
    pauseButton: document.getElementById('pauseButton'),
    resetButton: document.getElementById('resetButton')
};

/**
 * Initialize the page layout and components
 */
export function initializePage() {
    console.log('Initializing page...');
    
    // Verify critical elements exist
    if (!elements.leftContainer) {
        console.error('Left container not found!');
        return;
    }
    
    if (!elements.addTokenBtn) {
        console.error('Add token button not found!');
        return;
    }
    
    try {
        bindAddTokenButton();
        initializeSettingsPanel();
        populateWalletDropdown();
        updatePlsTokenOptions();
        initializeTimeIntervalDisplays();
        addFirstToken();
        
        console.log('Page initialization complete');
    } catch (error) {
        console.error('Error during page initialization:', error);
    }
}

/**
 * Bind the Add Token button event listener
 */
function bindAddTokenButton() {
    console.log('Binding Add Token button...');
    const addTokenBtn = document.getElementById('addToken');
    if (!addTokenBtn) {
        console.error('Add Token button not found during binding');
        return;
    }
    
    try {
        // Remove any existing listeners
        const newBtn = addTokenBtn.cloneNode(true);
        addTokenBtn.parentNode.replaceChild(newBtn, addTokenBtn);
        
        // Add new listener
        newBtn.addEventListener('click', (event) => {
            console.log('Add Token button clicked');
            handleAddToken(event);
        });
        
        console.log('Add Token button bound successfully');
    } catch (error) {
        console.error('Error binding Add Token button:', error);
    }
}

/**
 * Clear the token container and re-add the Add Token button
 */
function clearTokenContainer() {
    if (elements.leftContainer) {
        elements.leftContainer.innerHTML = '';
        
        const addTokenBtn = document.createElement('button');
        addTokenBtn.id = 'addToken';
        addTokenBtn.className = 'add-token-btn';
        addTokenBtn.textContent = 'Add Token';
        elements.leftContainer.appendChild(addTokenBtn);
        
        // Rebind the event listener to the new button
        bindAddTokenButton();
    }
}

/**
 * Initialize the settings panel functionality
 */
export function initializeSettingsPanel() {
    if (elements.settingsToggle && elements.settingsPanel) {
        elements.settingsToggle.addEventListener('click', () => {
            elements.settingsPanel.classList.toggle('hidden');
            console.log('Settings panel toggled');
        });
    }
}

/**
 * Populate the wallet dropdown with options
 */
export function populateWalletDropdown() {
    const walletSelect = elements.selectWallet;
    if (!walletSelect) {
        console.error('Wallet select element not found');
        return;
    }

    walletSelect.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select Wallet';
    walletSelect.appendChild(defaultOption);

    // Add wallet options (1-20)
    for (let i = 1; i <= 20; i++) {
        const option = document.createElement('option');
        option.value = `wallet ${i}`;
        option.textContent = `Wallet ${i}`;
        walletSelect.appendChild(option);
    }
}

/**
 * Update the PLS token selection dropdown
 */
export function updatePlsTokenOptions() {
    const select = elements.selectPlsToken;
    if (!select) return;

    select.innerHTML = '';
    
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select Token';
    select.appendChild(defaultOption);

    state.tokens.forEach(token => {
        const option = document.createElement('option');
        option.value = token.id;
        option.textContent = token.name;
        select.appendChild(option);
    });
}

/**
 * Initialize time interval displays
 */
export function initializeTimeIntervalDisplays() {
    if (elements.minTimeValue && state.minTimeInterval) {
        const minVal = typeof state.minTimeInterval === 'number'
            ? state.minTimeInterval
            : state.minTimeInterval.toNumber();
        elements.minTimeValue.textContent = `${minVal.toFixed(2)}s`;
    }
    if (elements.maxTimeValue && state.maxTimeInterval) {
        const maxVal = typeof state.maxTimeInterval === 'number'
            ? state.maxTimeInterval
            : state.maxTimeInterval.toNumber();
        elements.maxTimeValue.textContent = `${maxVal.toFixed(2)}s`;
    }
}

/**
 * Add a transaction to the history table
 * @param {string} walletId - Wallet identifier
 * @param {Decimal} amountBought - Amount of tokens bought
 * @param {number} tokenBought - Token ID that was bought
 * @param {Decimal} gasUsed - Amount of gas used
 * @param {Decimal} plsRemaining - Remaining PLS balance
 * @param {Decimal|null} tokensReceived - Tokens received from AMM (null if no liquidity)
 * @param {Decimal|null} priceImpact - Price impact percentage (null if no liquidity)
 */
export function addTransactionToHistory(walletId, amountBought, tokenBought, gasUsed, plsRemaining, tokensReceived = null, priceImpact = null, routeInfo = null) {
    const row = document.createElement('tr');

    state.currentTxNumber++;
    const txNumber = state.currentTxNumber.toString().padStart(3, '0');

    // Get token name
    const token = state.tokens.find(t => t.id === tokenBought);
    const tokenName = token ? token.name : `Token ${tokenBought}`;

    // Format tokens received with route info
    let tokensReceivedText = tokensReceived
        ? formatNumberWithSubscript(tokensReceived.toString())
        : 'No liquidity';

    // Add route info if available
    if (routeInfo && routeInfo.hops && routeInfo.hops.length > 1) {
        tokensReceivedText += `<br><span class="route-info" title="${routeInfo.pathDescription}">🔀 ${routeInfo.hops.length} hops</span>`;
    }

    // Format price impact with color coding
    let priceImpactText = 'N/A';
    let priceImpactClass = '';
    if (priceImpact !== null) {
        const impactNum = priceImpact.toNumber();
        priceImpactText = `${impactNum.toFixed(2)}%`;

        // Color code based on impact severity
        if (Math.abs(impactNum) < 1) {
            priceImpactClass = 'price-impact-positive'; // Green for low impact
        } else if (Math.abs(impactNum) < 5) {
            priceImpactClass = 'price-impact-negative'; // Red for medium impact
        } else {
            priceImpactClass = 'price-impact-high'; // Bold red for high impact
        }
    }

    const cells = [
        txNumber,
        walletId,
        '$' + formatNumberWithSubscript(amountBought.toString()),
        tokenName,
        tokensReceivedText,
        priceImpactText,
        `$${gasUsed.toFixed(8)}`,
        plsRemaining.toFixed(8)
    ];

    cells.forEach((content, index) => {
        const td = document.createElement('td');
        td.innerHTML = content;

        if (index === 2) { // Amount bought column
            adjustFontSize(td, amountBought.toString());
        }

        // Apply price impact color class
        if (index === 5 && priceImpactClass) {
            td.className = priceImpactClass;
        }

        row.appendChild(td);
    });

    // Add route details row if routing was used
    if (routeInfo && routeInfo.hops && routeInfo.hops.length > 1) {
        const detailRow = document.createElement('tr');
        detailRow.className = 'route-detail-row';

        const detailCell = document.createElement('td');
        detailCell.colSpan = 8;

        let detailHTML = `<div class="route-details">`;
        detailHTML += `<strong>Route:</strong> ${routeInfo.pathDescription}<br>`;
        detailHTML += `<strong>Intermediate amounts:</strong><br>`;

        routeInfo.hops.forEach((hop, index) => {
            const amountInStr = index === 0
                ? formatCurrency(hop.amountIn, '$', 0)
                : formatNumber(hop.amountIn, 0);
            const amountOutStr = formatNumber(hop.amountOut, 0);

            // Get token name
            const hopToken = state.tokens.find(t => t.id === hop.tokenId);
            const hopTokenName = hopToken ? hopToken.name : `Token ${hop.tokenId}`;

            detailHTML += `&nbsp;&nbsp;${index + 1}. ${amountInStr} → ${amountOutStr} ${hopTokenName}<br>`;
        });

        detailHTML += `</div>`;
        detailCell.innerHTML = detailHTML;
        detailRow.appendChild(detailCell);

        if (elements.transactionTable) {
            elements.transactionTable.insertBefore(row, elements.transactionTable.firstChild);
            elements.transactionTable.insertBefore(detailRow, elements.transactionTable.firstChild);
        }
    } else {
        if (elements.transactionTable) {
            elements.transactionTable.insertBefore(row, elements.transactionTable.firstChild);
        }
    }
}

/**
 * Adjust font size based on number of decimal places
 * @param {HTMLElement} element - Element to adjust
 * @param {string} numberStr - Number string to base size on
 */
export function adjustFontSize(element, numberStr) {
    const decimalPlaces = numberStr.split('.')[1]?.length || 0;
    const baseSize = 14;
    const maxSize = 24;
    const fontSize = Math.min(baseSize + decimalPlaces * 0.2, maxSize);
    element.style.fontSize = `${fontSize}px`;
}

/**
 * Update the pause button state
 * @param {boolean} isPaused - Current pause state
 */
export function updatePauseButton(isPaused) {
    if (elements.pauseButton) {
        elements.pauseButton.textContent = isPaused ? 'Resume' : 'Pause';
        elements.pauseButton.classList.toggle('paused', isPaused);
    }
}

/**
 * Clear the transaction history
 */
export function clearTransactionHistory() {
    if (elements.transactionTable) {
        elements.transactionTable.innerHTML = '';
    }
}

/**
 * Handle adding a new token
 * @param {Event} event - Click event
 */
export function handleAddToken(event) {
    console.log('Handling add token...');
    event.preventDefault();
    
    try {
        if (!state.tokens) {
            state.tokens = [];
        }

        if (state.tokens.length >= state.maxTokens) {
            alert(`Maximum number of tokens (${state.maxTokens}) reached!`);
            return;
        }
        
        const newTokenId = state.tokens.length + 1;
        console.log('Creating new token with ID:', newTokenId);
        
        const newToken = new Token({ id: newTokenId });
        state.tokens.push(newToken);
        
        const leftContainer = document.getElementById('leftContainer');
        if (!leftContainer) {
            throw new Error('Left container not found during token addition');
        }
        
        const addTokenBtn = leftContainer.querySelector('#addToken');
        if (!addTokenBtn) {
            throw new Error('Add Token button not found during token addition');
        }
        
        leftContainer.insertBefore(newToken.element, addTokenBtn);
        
        // Update token selection options
        updatePlsTokenOptions();
        state.tokens.forEach(token => token.updateOppositeTokenOptions());
        
        console.log('New token added successfully:', newTokenId);
    } catch (error) {
        console.error('Error adding new token:', error);
        alert('Failed to add token: ' + error.message);
    }
}

/**
 * Add the first token on page initialization
 */
export function addFirstToken() {
    if (state.tokens.length === 0) {
        handleAddToken(new Event('click'));
    }
}

/**
 * Update all UI metrics
 * @param {Object} metrics - Current metrics values
 */
export function updateMetricsDisplay(metrics) {
    if (elements.timeElapsed) {
        elements.timeElapsed.textContent = metrics.elapsedSeconds;
    }
    if (elements.transactionsPerMinute) {
        elements.transactionsPerMinute.textContent = metrics.transactionsPerMinute.toFixed(2);
    }
    if (elements.plsPrice) {
        elements.plsPrice.textContent = metrics.plsPrice.toFixed(6);
    }
    if (elements.totalGasUsed) {
        elements.totalGasUsed.textContent = metrics.totalGasUsed.toFixed(6);
    }
    if (elements.transactionCount) {
        elements.transactionCount.textContent = metrics.transactionCount;
    }
    if (elements.totalProcessed) {
        elements.totalProcessed.textContent = metrics.totalProcessed.toFixed(2);
    }
} 