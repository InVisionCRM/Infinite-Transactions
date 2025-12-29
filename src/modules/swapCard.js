/**
 * @fileoverview DEX-style swap card component
 */

import { state } from './state.js';
import { getWalletById } from './wallet.js';
import { processBuy, processSell } from './transactions.js';
import { updateWalletBalanceDisplay } from './ui.js';
import { findBestPath } from './routing.js';

// Swap state
let swapState = {
    payToken: 'USD',
    receiveToken: null,
    payAmount: null,
    receiveAmount: null,
    slippage: 0.5,
    showingPaySelector: false,
    showingReceiveSelector: false,
    rateInverted: false
};

/**
 * Initialize swap card
 */
export function initializeSwapCard() {
    bindSwapEventListeners();
    updateSwapWalletDropdown();
    updateSwapBalances();

    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Bind event listeners for swap card
 */
function bindSwapEventListeners() {
    // Wallet selector
    const walletSelect = document.getElementById('swapWalletSelect');
    if (walletSelect) {
        walletSelect.addEventListener('change', handleWalletChange);
    }

    // Token selectors
    const payTokenBtn = document.getElementById('payTokenBtn');
    if (payTokenBtn) {
        payTokenBtn.addEventListener('click', () => showTokenSelector('pay'));
    }

    const receiveTokenBtn = document.getElementById('receiveTokenBtn');
    if (receiveTokenBtn) {
        receiveTokenBtn.addEventListener('click', () => showTokenSelector('receive'));
    }

    // Amount inputs
    const payAmountInput = document.getElementById('payAmountInput');
    if (payAmountInput) {
        payAmountInput.addEventListener('input', handlePayAmountChange);
    }

    // MAX button
    const payMaxBtn = document.getElementById('payMaxBtn');
    if (payMaxBtn) {
        payMaxBtn.addEventListener('click', handleMaxClick);
    }

    // Swap direction toggle
    const swapDirectionBtn = document.getElementById('swapDirectionBtn');
    if (swapDirectionBtn) {
        swapDirectionBtn.addEventListener('click', handleSwapDirection);
    }

    // Details toggle
    const detailsToggle = document.getElementById('swapDetailsToggle');
    if (detailsToggle) {
        detailsToggle.addEventListener('click', toggleSwapDetails);
    }

    // Swap action button
    const swapActionBtn = document.getElementById('swapActionBtn');
    if (swapActionBtn) {
        swapActionBtn.addEventListener('click', handleSwapAction);
    }

    // Refresh button
    const refreshBtn = document.getElementById('swapRefreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            calculateSwapOutput();
        });
    }

    // Rate toggle
    const rateToggle = document.getElementById('swapRateToggle');
    if (rateToggle) {
        rateToggle.addEventListener('click', toggleRate);
    }

    // Add 1M PLS button
    const add1mPlsBtn = document.getElementById('add1mPlsBtn');
    if (add1mPlsBtn) {
        add1mPlsBtn.addEventListener('click', handleAdd1mPls);
    }

    // Swap settings button
    const swapSettingsBtn = document.getElementById('swapSettingsBtn');
    if (swapSettingsBtn) {
        swapSettingsBtn.addEventListener('click', openSwapSettings);
    }

    // Close swap settings button
    const closeSwapSettingsBtn = document.getElementById('closeSwapSettingsBtn');
    if (closeSwapSettingsBtn) {
        closeSwapSettingsBtn.addEventListener('click', closeSwapSettings);
    }

    // Close swap settings by clicking backdrop
    const swapSettingsBackdrop = document.getElementById('swapSettingsBackdrop');
    if (swapSettingsBackdrop) {
        swapSettingsBackdrop.addEventListener('click', (e) => {
            if (e.target === swapSettingsBackdrop) {
                closeSwapSettings();
            }
        });
    }

    // Gas warning modal buttons
    initializeGasWarningModal();
}

/**
 * Initialize gas warning modal
 */
function initializeGasWarningModal() {
    const keepGasBtn = document.getElementById('keepGasBtn');
    const disableGasBtn = document.getElementById('disableGasBtn');

    if (keepGasBtn) {
        keepGasBtn.addEventListener('click', () => {
            hideGasWarningModal();
        });
    }

    if (disableGasBtn) {
        disableGasBtn.addEventListener('click', async () => {
            // Disable gas in settings
            const requireGasCheckbox = document.getElementById('requireGas');
            if (requireGasCheckbox) {
                requireGasCheckbox.checked = false;
                // Trigger change event to update state
                requireGasCheckbox.dispatchEvent(new Event('change'));
            }
            state.requireGas = false;
            hideGasWarningModal();
            alert('Gas requirements disabled. Transactions will no longer require PLS for gas.');
        });
    }
}

/**
 * Show gas warning modal
 */
export function showGasWarningModal() {
    const modal = document.getElementById('gasWarningModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

/**
 * Hide gas warning modal
 */
function hideGasWarningModal() {
    const modal = document.getElementById('gasWarningModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Open swap settings panel
 */
function openSwapSettings() {
    const backdrop = document.getElementById('swapSettingsBackdrop');
    if (backdrop) {
        backdrop.classList.remove('hidden');
    }
}

/**
 * Close swap settings panel
 */
function closeSwapSettings() {
    const backdrop = document.getElementById('swapSettingsBackdrop');
    if (backdrop) {
        backdrop.classList.add('hidden');
    }
}

/**
 * Handle Add 1M PLS button click
 */
async function handleAdd1mPls() {
    const Decimal = window.Decimal;
    const wallet = getWalletById(state.currentWalletId);

    if (!wallet) {
        alert('No wallet selected');
        return;
    }

    // Add 1,000,000 PLS to wallet
    wallet.addPLS(new Decimal(1000000));

    // Update displays
    updateSwapBalances();
    await updateWalletBalanceDisplay();

    // Close settings panel
    closeSwapSettings();

    // Show confirmation
    console.log(`Added 1,000,000 PLS to ${wallet.name}`);
}

/**
 * Update swap wallet dropdown
 */
export function updateSwapWalletDropdown() {
    const select = document.getElementById('swapWalletSelect');
    if (!select) return;

    select.innerHTML = '';

    if (state.wallets && state.wallets.length > 0) {
        state.wallets.forEach(wallet => {
            const option = document.createElement('option');
            option.value = wallet.id;
            option.textContent = wallet.name;
            select.appendChild(option);
        });

        // Add "+ Add Wallet" option
        const addOption = document.createElement('option');
        addOption.value = 'add_wallet';
        addOption.textContent = '+ Add Wallet';
        addOption.style.fontWeight = 'bold';
        addOption.style.color = '#22c55e';
        select.appendChild(addOption);

        select.value = state.currentWalletId || state.wallets[0].id;
    }
}

/**
 * Handle wallet change
 */
async function handleWalletChange(e) {
    if (e.target.value === 'add_wallet') {
        // Trigger add wallet modal from ui.js
        const { showAddWalletModal } = await import('./ui.js');
        showAddWalletModal();

        // Reset to current wallet
        e.target.value = state.currentWalletId;
    } else {
        state.currentWalletId = parseInt(e.target.value);
        updateSwapBalances();
        await updateWalletBalanceDisplay();
    }
}

/**
 * Update balance displays in swap card
 */
function updateSwapBalances() {
    const wallet = getWalletById(state.currentWalletId);
    if (!wallet) return;

    const Decimal = window.Decimal;

    // Update pay balance
    const payBalanceEl = document.getElementById('payBalance');
    if (payBalanceEl) {
        if (swapState.payToken === 'USD') {
            payBalanceEl.textContent = `$${wallet.usdBalance.toFixed(2)}`;
        } else if (swapState.payToken === 'WPLS') {
            payBalanceEl.textContent = wallet.plsBalance.toFixed(6);
        } else {
            // Token balance
            const balance = wallet.getTokenBalance(swapState.payToken);
            payBalanceEl.textContent = balance.toFixed(2);
        }
    }

    // Update receive balance
    const receiveBalanceEl = document.getElementById('receiveBalance');
    if (receiveBalanceEl && swapState.receiveToken) {
        if (swapState.receiveToken === 'USD') {
            receiveBalanceEl.textContent = `$${wallet.usdBalance.toFixed(2)}`;
        } else if (swapState.receiveToken === 'WPLS') {
            receiveBalanceEl.textContent = wallet.plsBalance.toFixed(6);
        } else {
            const balance = wallet.getTokenBalance(swapState.receiveToken);
            receiveBalanceEl.textContent = balance.toFixed(2);
        }
    } else if (receiveBalanceEl) {
        receiveBalanceEl.textContent = '0.00';
    }
}

/**
 * Show token selector modal
 */
function showTokenSelector(type) {
    // Remove existing modal if any
    const existingModal = document.querySelector('.token-selector-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'token-selector-modal';

    const content = document.createElement('div');
    content.className = 'token-selector-content';

    const header = document.createElement('div');
    header.className = 'token-selector-header';
    header.innerHTML = `
        <h3 class="token-selector-title">Select a token</h3>
        <button class="close-selector-btn">×</button>
    `;

    const searchInput = document.createElement('input');
    searchInput.className = 'token-search-input';
    searchInput.placeholder = 'Search by name...';

    const tokenList = document.createElement('div');
    tokenList.className = 'token-list';

    // Add USD option
    if (type === 'pay' || type === 'receive') {
        const usdItem = createTokenListItem('USD', 'USD', '', type);
        tokenList.appendChild(usdItem);
    }

    // Add WPLS option
    if (type === 'pay' || type === 'receive') {
        const wplsItem = createTokenListItem('WPLS', 'WPLS', '', type);
        tokenList.appendChild(wplsItem);
    }

    // Add all tokens
    state.tokens.forEach(token => {
        const item = createTokenListItem(token.id, token.name, '', type);
        tokenList.appendChild(item);
    });

    // Search functionality
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const items = tokenList.querySelectorAll('.token-list-item');
        items.forEach(item => {
            const name = item.dataset.tokenName.toLowerCase();
            if (name.includes(searchTerm)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    });

    // Close button
    header.querySelector('.close-selector-btn').addEventListener('click', () => {
        modal.remove();
    });

    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    content.appendChild(header);
    content.appendChild(searchInput);
    content.appendChild(tokenList);
    modal.appendChild(content);
    document.body.appendChild(modal);
}

/**
 * Create token list item
 */
function createTokenListItem(tokenId, name, icon, type) {
    const wallet = getWalletById(state.currentWalletId);

    const item = document.createElement('div');
    item.className = 'token-list-item';
    item.dataset.tokenId = tokenId;
    item.dataset.tokenName = name;

    let balance = '0.00';
    if (wallet) {
        if (tokenId === 'USD') {
            balance = `$${wallet.usdBalance.toFixed(2)}`;
        } else if (tokenId === 'WPLS') {
            balance = wallet.plsBalance.toFixed(6);
        } else {
            balance = wallet.getTokenBalance(tokenId).toFixed(2);
        }
    }

    item.innerHTML = `
        <span class="token-list-icon">${icon}</span>
        <div class="token-list-info">
            <div class="token-list-name">${name}</div>
            <div class="token-list-balance">Balance: ${balance}</div>
        </div>
    `;

    item.addEventListener('click', () => {
        selectToken(tokenId, name, icon, type);
        document.querySelector('.token-selector-modal').remove();
    });

    return item;
}

/**
 * Select a token
 */
function selectToken(tokenId, name, icon, type) {
    if (type === 'pay') {
        swapState.payToken = tokenId;
        const btn = document.getElementById('payTokenBtn');
        if (btn) {
            btn.querySelector('.token-icon').textContent = icon;
            btn.querySelector('.token-symbol').textContent = name;
        }
    } else if (type === 'receive') {
        swapState.receiveToken = tokenId;
        const btn = document.getElementById('receiveTokenBtn');
        if (btn) {
            btn.querySelector('.token-icon').textContent = icon;
            btn.querySelector('.token-symbol').textContent = name;
        }
    }

    updateSwapBalances();
    calculateSwapOutput();
    updateSwapButton();
}

/**
 * Handle pay amount change
 */
function handlePayAmountChange(e) {
    const value = e.target.value;
    swapState.payAmount = value ? parseFloat(value) : null;

    // Update USD value
    calculatePayUsdValue();

    // Calculate receive amount
    calculateSwapOutput();

    // Update button
    updateSwapButton();
}

/**
 * Calculate USD value for pay amount
 */
function calculatePayUsdValue() {
    const usdEl = document.getElementById('payUsdValue');
    if (!usdEl || !swapState.payAmount) {
        if (usdEl) usdEl.textContent = '0.00';
        return;
    }

    const Decimal = window.Decimal;
    let usdValue = new Decimal(0);

    if (swapState.payToken === 'USD') {
        usdValue = new Decimal(swapState.payAmount);
    } else if (swapState.payToken === 'WPLS') {
        usdValue = new Decimal(swapState.payAmount).times(state.plsPrice);
    } else {
        // Token
        const token = state.tokens.find(t => t.id === swapState.payToken);
        if (token) {
            const tokenPrice = token.calculateTokenPrice();
            usdValue = new Decimal(swapState.payAmount).times(tokenPrice);
        }
    }

    usdEl.textContent = usdValue.toFixed(2);
}

/**
 * Calculate swap output
 */
function calculateSwapOutput() {
    if (!swapState.payAmount || !swapState.payToken || !swapState.receiveToken) {
        clearSwapOutput();
        return;
    }

    const Decimal = window.Decimal;
    const payAmount = new Decimal(swapState.payAmount);

    // Buying a token with USD
    if (swapState.payToken === 'USD' && typeof swapState.receiveToken === 'number') {
        calculateTokenBuy(payAmount, 'USD');
    }
    // Buying a token with WPLS
    else if (swapState.payToken === 'WPLS' && typeof swapState.receiveToken === 'number') {
        calculateTokenBuy(payAmount, 'WPLS');
    }
    // Selling a token for USD
    else if (typeof swapState.payToken === 'number' && swapState.receiveToken === 'USD') {
        calculateTokenSell(payAmount, 'USD');
    }
    // Selling a token for WPLS
    else if (typeof swapState.payToken === 'number' && swapState.receiveToken === 'WPLS') {
        calculateTokenSell(payAmount, 'WPLS');
    }
    // Direct swaps
    else {
        // For simplicity, convert through USD
        calculateIndirectSwap(payAmount);
    }

    updateRateDisplay();
}

/**
 * Calculate token buy
 * @param {Decimal} payAmount - Amount being paid
 * @param {string} payAsset - Asset being paid with ('USD' or 'WPLS')
 */
function calculateTokenBuy(payAmount, payAsset) {
    const token = state.tokens.find(t => t.id === swapState.receiveToken);
    if (!token || token.pairReserve.isZero() || token.tokenReserve.isZero()) {
        clearSwapOutput();
        return;
    }

    const Decimal = window.Decimal;

    // Convert pay amount to pair asset
    let pairAssetAmount;
    let usdValue;

    if (payAsset === 'USD') {
        usdValue = payAmount;
        if (token.pairType === 'USD') {
            pairAssetAmount = payAmount;
        } else if (token.pairType === 'WPLS') {
            pairAssetAmount = payAmount.dividedBy(state.plsPrice);
        } else {
            // TOKEN pair - use routing
            const route = findBestPath(token, payAmount);
            if (!route) {
                clearSwapOutput();
                return;
            }

            // Update receive amount from routing
            const receiveInput = document.getElementById('receiveAmountInput');
            if (receiveInput) {
                receiveInput.value = route.totalAmountOut.toFixed(2);
            }

            swapState.receiveAmount = route.totalAmountOut.toNumber();

            // Calculate price impact from route
            const priceImpact = route.totalPriceImpact;
            updateSwapDetails(route.totalAmountOut, priceImpact, usdValue);

            // Update USD value for receive
            const receiveUsdEl = document.getElementById('receiveUsdValue');
            if (receiveUsdEl) {
                const tokenUSDPrice = token.calculateTokenPriceUSD(new Set());
                const receiveUsdValue = route.totalAmountOut.times(tokenUSDPrice);
                receiveUsdEl.textContent = receiveUsdValue.toFixed(2);
            }

            updateSwapButton();
            return;
        }
    } else if (payAsset === 'WPLS') {
        usdValue = payAmount.times(state.plsPrice);
        if (token.pairType === 'USD') {
            // Need to convert WPLS to USD
            pairAssetAmount = payAmount.times(state.plsPrice);
        } else if (token.pairType === 'WPLS') {
            pairAssetAmount = payAmount;
        } else {
            // TOKEN pair - use routing (convert WPLS to USD value first)
            const usdAmount = payAmount.times(state.plsPrice);
            const route = findBestPath(token, usdAmount);
            if (!route) {
                clearSwapOutput();
                return;
            }

            // Update receive amount from routing
            const receiveInput = document.getElementById('receiveAmountInput');
            if (receiveInput) {
                receiveInput.value = route.totalAmountOut.toFixed(2);
            }

            swapState.receiveAmount = route.totalAmountOut.toNumber();

            // Calculate price impact from route
            const priceImpact = route.totalPriceImpact;
            updateSwapDetails(route.totalAmountOut, priceImpact, usdValue);

            // Update USD value for receive
            const receiveUsdEl = document.getElementById('receiveUsdValue');
            if (receiveUsdEl) {
                const tokenUSDPrice = token.calculateTokenPriceUSD(new Set());
                const receiveUsdValue = route.totalAmountOut.times(tokenUSDPrice);
                receiveUsdEl.textContent = receiveUsdValue.toFixed(2);
            }

            updateSwapButton();
            return;
        }
    }

    // Calculate output
    let tokensOut;
    if (state.applySlippage) {
        tokensOut = token.calculateSwapOutput(pairAssetAmount, token.pairReserve, token.tokenReserve);
    } else {
        const price = token.pairReserve.dividedBy(token.tokenReserve);
        tokensOut = pairAssetAmount.dividedBy(price);
    }

    // Update receive amount
    const receiveInput = document.getElementById('receiveAmountInput');
    if (receiveInput) {
        receiveInput.value = tokensOut.toFixed(2);
    }

    swapState.receiveAmount = tokensOut.toNumber();

    // Calculate price impact
    const priceImpact = calculatePriceImpact(pairAssetAmount, tokensOut, token);
    updateSwapDetails(tokensOut, priceImpact, usdValue);

    // Update USD value for receive
    const receiveUsdEl = document.getElementById('receiveUsdValue');
    if (receiveUsdEl) {
        receiveUsdEl.textContent = usdValue.toFixed(2);
    }
}

/**
 * Calculate token sell
 * @param {Decimal} tokenAmount - Amount of tokens being sold
 * @param {string} receiveAsset - Asset to receive ('USD' or 'WPLS')
 */
function calculateTokenSell(tokenAmount, receiveAsset) {
    const token = state.tokens.find(t => t.id === swapState.payToken);
    if (!token || token.pairReserve.isZero() || token.tokenReserve.isZero()) {
        clearSwapOutput();
        return;
    }

    const Decimal = window.Decimal;

    // Calculate output in pair asset
    let pairOut;
    if (state.applySlippage) {
        pairOut = token.calculateSwapOutput(tokenAmount, token.tokenReserve, token.pairReserve);
    } else {
        const price = token.pairReserve.dividedBy(token.tokenReserve);
        pairOut = tokenAmount.times(price);
    }

    // Convert to requested asset
    let receiveAmount;
    let usdValue;

    if (receiveAsset === 'USD') {
        if (token.pairType === 'USD') {
            receiveAmount = pairOut;
        } else if (token.pairType === 'WPLS') {
            receiveAmount = pairOut.times(state.plsPrice);
        } else {
            // TOKEN pair - need to convert pairOut through the pair chain
            // Get the paired token
            const pairedToken = state.tokens.find(t => t.id === token.pairedTokenId);
            if (!pairedToken) {
                clearSwapOutput();
                return;
            }

            // Calculate USD value of the paired token amount
            const pairedTokenUSDPrice = pairedToken.calculateTokenPriceUSD(new Set());
            receiveAmount = pairOut.times(pairedTokenUSDPrice);
        }
        usdValue = receiveAmount;
    } else if (receiveAsset === 'WPLS') {
        if (token.pairType === 'USD') {
            // Convert USD to WPLS
            receiveAmount = pairOut.dividedBy(state.plsPrice);
        } else if (token.pairType === 'WPLS') {
            receiveAmount = pairOut;
        } else {
            // TOKEN pair - need to convert pairOut through the pair chain
            // Get the paired token
            const pairedToken = state.tokens.find(t => t.id === token.pairedTokenId);
            if (!pairedToken) {
                clearSwapOutput();
                return;
            }

            // Calculate USD value of the paired token amount, then convert to WPLS
            const pairedTokenUSDPrice = pairedToken.calculateTokenPriceUSD(new Set());
            const usdAmount = pairOut.times(pairedTokenUSDPrice);
            receiveAmount = usdAmount.dividedBy(state.plsPrice);
        }
        usdValue = receiveAmount.times(state.plsPrice);
    }

    // Update receive amount
    const receiveInput = document.getElementById('receiveAmountInput');
    if (receiveInput) {
        receiveInput.value = receiveAmount.toFixed(receiveAsset === 'WPLS' ? 6 : 2);
    }

    swapState.receiveAmount = receiveAmount.toNumber();

    // Calculate price impact
    const priceImpact = calculatePriceImpact(tokenAmount, pairOut, token);
    updateSwapDetails(receiveAmount, priceImpact, usdValue);

    // Update USD value for receive
    const receiveUsdEl = document.getElementById('receiveUsdValue');
    if (receiveUsdEl) {
        receiveUsdEl.textContent = usdValue.toFixed(2);
    }
}

/**
 * Calculate token-to-token swap
 */
function calculateIndirectSwap(amount) {
    const Decimal = window.Decimal;

    // Both must be tokens for this function
    if (typeof swapState.payToken !== 'number' || typeof swapState.receiveToken !== 'number') {
        clearSwapOutput();
        return;
    }

    const payToken = state.tokens.find(t => t.id === swapState.payToken);
    const receiveToken = state.tokens.find(t => t.id === swapState.receiveToken);

    if (!payToken || !receiveToken) {
        clearSwapOutput();
        return;
    }

    // Check if tokens are directly paired
    const directlyPaired = (
        (payToken.pairType === 'TOKEN' && payToken.pairedTokenId === receiveToken.id) ||
        (receiveToken.pairType === 'TOKEN' && receiveToken.pairedTokenId === payToken.id)
    );

    if (directlyPaired) {
        // Direct swap between paired tokens
        calculateDirectTokenSwap(amount, payToken, receiveToken);
    } else {
        // Need to route through USD or WPLS
        calculateRoutedTokenSwap(amount, payToken, receiveToken);
    }
}

/**
 * Calculate direct token-to-token swap for paired tokens
 */
function calculateDirectTokenSwap(tokenAmount, payToken, receiveToken) {
    const Decimal = window.Decimal;

    // Determine which token has the pair
    let poolToken, outputToken, isPayTokenPool;

    if (payToken.pairType === 'TOKEN' && payToken.pairedTokenId === receiveToken.id) {
        // Pay token is paired with receive token
        poolToken = payToken;
        outputToken = receiveToken;
        isPayTokenPool = true;
    } else if (receiveToken.pairType === 'TOKEN' && receiveToken.pairedTokenId === payToken.id) {
        // Receive token is paired with pay token
        poolToken = receiveToken;
        outputToken = payToken;
        isPayTokenPool = false;
    } else {
        clearSwapOutput();
        return;
    }

    // Check liquidity
    if (poolToken.pairReserve.isZero() || poolToken.tokenReserve.isZero()) {
        clearSwapOutput();
        return;
    }

    let outputAmount;
    if (isPayTokenPool) {
        // Swapping tokenAmount of payToken (which is the pool token) for pairToken (receiveToken)
        // We're selling the pool token for its pair
        if (state.applySlippage) {
            outputAmount = poolToken.calculateSwapOutput(tokenAmount, poolToken.tokenReserve, poolToken.pairReserve);
        } else {
            const price = poolToken.pairReserve.dividedBy(poolToken.tokenReserve);
            outputAmount = tokenAmount.times(price);
        }
    } else {
        // Swapping tokenAmount of payToken for poolToken (receiveToken)
        // We're buying the pool token with its pair
        if (state.applySlippage) {
            outputAmount = poolToken.calculateSwapOutput(tokenAmount, poolToken.pairReserve, poolToken.tokenReserve);
        } else {
            const price = poolToken.tokenReserve.dividedBy(poolToken.pairReserve);
            outputAmount = tokenAmount.times(price);
        }
    }

    // Update receive amount
    const receiveInput = document.getElementById('receiveAmountInput');
    if (receiveInput) {
        receiveInput.value = outputAmount.toFixed(2);
    }

    swapState.receiveAmount = outputAmount.toNumber();

    // Calculate USD values for display
    const payTokenPrice = payToken.calculateTokenPriceUSD();
    const receiveTokenPrice = receiveToken.calculateTokenPriceUSD();
    const payUsdValue = tokenAmount.times(payTokenPrice);
    const receiveUsdValue = outputAmount.times(receiveTokenPrice);

    // Calculate price impact
    const priceImpact = isPayTokenPool
        ? calculatePriceImpact(tokenAmount, outputAmount, poolToken)
        : calculatePriceImpact(tokenAmount, outputAmount, poolToken);

    updateSwapDetails(outputAmount, priceImpact, receiveUsdValue);

    // Update USD value for receive
    const receiveUsdEl = document.getElementById('receiveUsdValue');
    if (receiveUsdEl) {
        receiveUsdEl.textContent = receiveUsdValue.toFixed(2);
    }
}

/**
 * Calculate routed token-to-token swap (through USD/WPLS)
 */
function calculateRoutedTokenSwap(tokenAmount, payToken, receiveToken) {
    const Decimal = window.Decimal;

    // First convert pay token to USD
    if (payToken.pairReserve.isZero() || payToken.tokenReserve.isZero()) {
        clearSwapOutput();
        return;
    }

    let usdAmount;
    if (payToken.pairType === 'USD') {
        // Calculate USD from selling tokens
        let pairOut;
        if (state.applySlippage) {
            pairOut = payToken.calculateSwapOutput(tokenAmount, payToken.tokenReserve, payToken.pairReserve);
        } else {
            const price = payToken.pairReserve.dividedBy(payToken.tokenReserve);
            pairOut = tokenAmount.times(price);
        }
        usdAmount = pairOut;
    } else if (payToken.pairType === 'WPLS') {
        // Calculate WPLS from selling tokens, then convert to USD
        let wplsOut;
        if (state.applySlippage) {
            wplsOut = payToken.calculateSwapOutput(tokenAmount, payToken.tokenReserve, payToken.pairReserve);
        } else {
            const price = payToken.pairReserve.dividedBy(payToken.tokenReserve);
            wplsOut = tokenAmount.times(price);
        }
        usdAmount = wplsOut.times(state.plsPrice);
    } else {
        // Can't route
        clearSwapOutput();
        return;
    }

    // Now convert USD to receive token
    if (receiveToken.pairReserve.isZero() || receiveToken.tokenReserve.isZero()) {
        clearSwapOutput();
        return;
    }

    let pairAssetAmount;
    if (receiveToken.pairType === 'USD') {
        pairAssetAmount = usdAmount;
    } else if (receiveToken.pairType === 'WPLS') {
        pairAssetAmount = usdAmount.dividedBy(state.plsPrice);
    } else {
        // Can't route
        clearSwapOutput();
        return;
    }

    let tokensOut;
    if (state.applySlippage) {
        tokensOut = receiveToken.calculateSwapOutput(pairAssetAmount, receiveToken.pairReserve, receiveToken.tokenReserve);
    } else {
        const price = receiveToken.pairReserve.dividedBy(receiveToken.tokenReserve);
        tokensOut = pairAssetAmount.dividedBy(price);
    }

    // Update receive amount
    const receiveInput = document.getElementById('receiveAmountInput');
    if (receiveInput) {
        receiveInput.value = tokensOut.toFixed(2);
    }

    swapState.receiveAmount = tokensOut.toNumber();

    // Calculate price impact (simplified for routed swaps)
    const priceImpact = new Decimal(0);
    updateSwapDetails(tokensOut, priceImpact, usdAmount);

    // Update USD value for receive
    const receiveUsdEl = document.getElementById('receiveUsdValue');
    if (receiveUsdEl) {
        const receiveUsdValue = tokensOut.times(receiveToken.calculateTokenPriceUSD());
        receiveUsdEl.textContent = receiveUsdValue.toFixed(2);
    }
}

/**
 * Calculate price impact
 */
function calculatePriceImpact(amountIn, amountOut, token) {
    const Decimal = window.Decimal;

    if (!state.applySlippage) return new Decimal(0);

    const spotPrice = token.pairReserve.dividedBy(token.tokenReserve);
    const executionPrice = amountIn.dividedBy(amountOut);
    const impact = executionPrice.minus(spotPrice).dividedBy(spotPrice).times(100).abs();

    return impact;
}

/**
 * Update swap details
 */
async function updateSwapDetails(amountOut, priceImpact, usdValue) {
    const Decimal = window.Decimal;

    // Minimum received (with slippage)
    const slippageMultiplier = new Decimal(1).minus(new Decimal(swapState.slippage).dividedBy(100));
    const minReceived = amountOut.times(slippageMultiplier);

    const minReceivedEl = document.getElementById('minimumReceived');
    if (minReceivedEl) {
        const token = state.tokens.find(t => t.id === swapState.receiveToken);
        const symbol = token ? token.name : swapState.receiveToken;
        minReceivedEl.textContent = `${minReceived.toFixed(2)} ${symbol}`;
    }

    // Price impact
    const priceImpactEl = document.getElementById('priceImpactValue');
    if (priceImpactEl) {
        priceImpactEl.textContent = `${priceImpact.toFixed(2)}%`;

        // Color based on impact
        priceImpactEl.classList.remove('low', 'medium', 'high');
        if (priceImpact.lt(1)) {
            priceImpactEl.classList.add('low');
        } else if (priceImpact.lt(3)) {
            priceImpactEl.classList.add('medium');
        } else {
            priceImpactEl.classList.add('high');
        }
    }

    // Network fee
    const networkFeeEl = document.getElementById('networkFeeValue');
    if (networkFeeEl && state.requireGas) {
        const { calculateGas } = await import('./state.js');
        const gasUsed = calculateGas(usdValue);
        const gasCost = gasUsed.times(state.plsPrice);
        networkFeeEl.textContent = `~$${gasCost.toFixed(4)}`;
    } else if (networkFeeEl) {
        networkFeeEl.textContent = '~$0.00';
    }
}

/**
 * Clear swap output
 */
function clearSwapOutput() {
    const receiveInput = document.getElementById('receiveAmountInput');
    if (receiveInput) {
        receiveInput.value = '';
    }
    swapState.receiveAmount = null;

    const receiveUsdEl = document.getElementById('receiveUsdValue');
    if (receiveUsdEl) {
        receiveUsdEl.textContent = '0.00';
    }

    // Clear details
    const minReceivedEl = document.getElementById('minimumReceived');
    if (minReceivedEl) minReceivedEl.textContent = '0.00';

    const priceImpactEl = document.getElementById('priceImpactValue');
    if (priceImpactEl) {
        priceImpactEl.textContent = '0.00%';
        priceImpactEl.classList.remove('low', 'medium', 'high');
    }
}

/**
 * Handle MAX button click
 */
function handleMaxClick() {
    const wallet = getWalletById(state.currentWalletId);
    if (!wallet) return;

    const payInput = document.getElementById('payAmountInput');
    if (!payInput) return;

    let maxAmount;
    if (swapState.payToken === 'USD') {
        maxAmount = wallet.usdBalance.toNumber();
    } else if (swapState.payToken === 'WPLS') {
        maxAmount = wallet.plsBalance.toNumber();
    } else {
        maxAmount = wallet.getTokenBalance(swapState.payToken).toNumber();
    }

    payInput.value = maxAmount.toFixed(6);
    handlePayAmountChange({ target: payInput });
}

/**
 * Handle swap direction toggle
 */
function handleSwapDirection() {
    // Swap pay and receive
    const tempToken = swapState.payToken;
    const tempAmount = swapState.payAmount;

    swapState.payToken = swapState.receiveToken;
    swapState.receiveToken = tempToken;

    // Update UI
    const payTokenBtn = document.getElementById('payTokenBtn');
    const receiveTokenBtn = document.getElementById('receiveTokenBtn');

    if (payTokenBtn && receiveTokenBtn) {
        const payIcon = payTokenBtn.querySelector('.token-icon').textContent;
        const paySymbol = payTokenBtn.querySelector('.token-symbol').textContent;
        const receiveIcon = receiveTokenBtn.querySelector('.token-icon').textContent;
        const receiveSymbol = receiveTokenBtn.querySelector('.token-symbol').textContent;

        payTokenBtn.querySelector('.token-icon').textContent = receiveIcon;
        payTokenBtn.querySelector('.token-symbol').textContent = receiveSymbol;
        receiveTokenBtn.querySelector('.token-icon').textContent = payIcon;
        receiveTokenBtn.querySelector('.token-symbol').textContent = paySymbol;
    }

    // Swap amounts
    const payInput = document.getElementById('payAmountInput');
    const receiveInput = document.getElementById('receiveAmountInput');

    if (payInput && receiveInput && swapState.receiveAmount) {
        payInput.value = swapState.receiveAmount;
        swapState.payAmount = swapState.receiveAmount;
    }

    updateSwapBalances();
    calculateSwapOutput();
    updateSwapButton();
}

/**
 * Toggle swap details
 */
function toggleSwapDetails() {
    const content = document.getElementById('swapDetailsContent');
    const arrow = document.getElementById('swapDetailsArrow');
    const summary = document.getElementById('swapDetailsSummary');

    if (content.style.display === 'none') {
        content.style.display = 'block';
        arrow.classList.add('expanded');
        summary.textContent = 'Hide details';
    } else {
        content.style.display = 'none';
        arrow.classList.remove('expanded');
        summary.textContent = 'Show details';
    }
}

/**
 * Update rate display
 */
function updateRateDisplay() {
    const rateDisplay = document.getElementById('swapRateDisplay');
    const rateText = document.getElementById('swapRateText');

    if (!swapState.payToken || !swapState.receiveToken || !swapState.payAmount || !swapState.receiveAmount) {
        if (rateDisplay) rateDisplay.style.display = 'none';
        return;
    }

    if (rateDisplay) rateDisplay.style.display = 'flex';

    const Decimal = window.Decimal;
    const payToken = state.tokens.find(t => t.id === swapState.payToken);
    const receiveToken = state.tokens.find(t => t.id === swapState.receiveToken);

    const paySymbol = payToken ? payToken.name : swapState.payToken;
    const receiveSymbol = receiveToken ? receiveToken.name : swapState.receiveToken;

    if (swapState.rateInverted) {
        const rate = new Decimal(swapState.payAmount).dividedBy(swapState.receiveAmount);
        rateText.textContent = `1 ${receiveSymbol} = ${rate.toFixed(6)} ${paySymbol}`;
    } else {
        const rate = new Decimal(swapState.receiveAmount).dividedBy(swapState.payAmount);
        rateText.textContent = `1 ${paySymbol} = ${rate.toFixed(6)} ${receiveSymbol}`;
    }
}

/**
 * Toggle rate display
 */
function toggleRate() {
    swapState.rateInverted = !swapState.rateInverted;
    updateRateDisplay();
}

/**
 * Update swap button
 */
function updateSwapButton() {
    const btn = document.getElementById('swapActionBtn');
    if (!btn) return;

    // Determine if this is a buy or sell
    const isSell = typeof swapState.payToken === 'number' && swapState.receiveToken === 'USD';

    if (isSell) {
        btn.classList.add('sell');
    } else {
        btn.classList.remove('sell');
    }

    // Check if we can execute
    if (!swapState.payAmount || swapState.payAmount <= 0) {
        btn.disabled = true;
        btn.textContent = 'Enter an amount';
    } else if (!swapState.receiveToken) {
        btn.disabled = true;
        btn.textContent = 'Select a token';
    } else if (!swapState.receiveAmount) {
        btn.disabled = true;
        btn.textContent = 'Insufficient liquidity';
    } else {
        btn.disabled = false;
        btn.textContent = isSell ? 'Sell' : 'Buy';
    }
}

/**
 * Handle swap action
 */
async function handleSwapAction() {
    if (!swapState.payAmount || !swapState.receiveToken) return;

    const Decimal = window.Decimal;
    const { getWalletById } = await import('./wallet.js');
    const wallet = getWalletById(state.currentWalletId);

    if (!wallet) {
        alert('No wallet selected');
        return;
    }

    let result = { success: false, error: 'Unknown error' };

    // Determine swap type
    const isPayToken = typeof swapState.payToken === 'number';
    const isReceiveToken = typeof swapState.receiveToken === 'number';

    if (isPayToken && (swapState.receiveToken === 'USD' || swapState.receiveToken === 'WPLS')) {
        // Selling tokens for USD/WPLS
        result = await processSell({
            tokenAmount: new Decimal(swapState.payAmount),
            walletId: state.currentWalletId.toString(),
            tokenId: swapState.payToken
        });
    } else if ((swapState.payToken === 'USD' || swapState.payToken === 'WPLS') && isReceiveToken) {
        // Buying tokens with USD/WPLS
        result = await processBuy({
            amount: new Decimal(swapState.payAmount),
            walletId: state.currentWalletId.toString(),
            tokenId: swapState.receiveToken,
            isInitialBuy: true
        });
    } else if (isPayToken && isReceiveToken) {
        // Token-to-token swap
        const payToken = state.tokens.find(t => t.id === swapState.payToken);
        const receiveToken = state.tokens.find(t => t.id === swapState.receiveToken);

        if (!payToken || !receiveToken) {
            alert('Invalid tokens selected');
            return;
        }

        // Check if we have enough tokens to pay
        const payBalance = wallet.getTokenBalance(swapState.payToken);
        const payAmount = new Decimal(swapState.payAmount);

        if (payBalance.lt(payAmount)) {
            alert(`Insufficient ${payToken.name} balance`);
            return;
        }

        // Deduct pay tokens
        wallet.addTokenBalance(swapState.payToken, payAmount.negated());

        // Add receive tokens
        const receiveAmount = new Decimal(swapState.receiveAmount);
        wallet.addTokenBalance(swapState.receiveToken, receiveAmount);

        // Update token reserves based on which token has the pair
        const directlyPaired = (
            (payToken.pairType === 'TOKEN' && payToken.pairedTokenId === receiveToken.id) ||
            (receiveToken.pairType === 'TOKEN' && receiveToken.pairedTokenId === payToken.id)
        );

        if (directlyPaired) {
            if (payToken.pairType === 'TOKEN' && payToken.pairedTokenId === receiveToken.id) {
                // Pay token has the pool
                payToken.tokenReserve = payToken.tokenReserve.plus(payAmount);
                payToken.pairReserve = payToken.pairReserve.minus(receiveAmount);
                payToken.k = payToken.tokenReserve.times(payToken.pairReserve);
                // Invalidate price cache cascade
                payToken.invalidatePriceCascade();
            } else {
                // Receive token has the pool
                receiveToken.pairReserve = receiveToken.pairReserve.plus(payAmount);
                receiveToken.tokenReserve = receiveToken.tokenReserve.minus(receiveAmount);
                receiveToken.k = receiveToken.tokenReserve.times(receiveToken.pairReserve);
                // Invalidate price cache cascade
                receiveToken.invalidatePriceCascade();
            }
        }

        // Update all token prices
        const { updateAllTokenPrices } = await import('./state.js');
        updateAllTokenPrices();

        // Update displays
        payToken.updateDisplay();
        payToken.updateLiquidityDisplay();
        receiveToken.updateDisplay();
        receiveToken.updateLiquidityDisplay();

        result = { success: true };
    }

    if (!result.success) {
        alert(result.error);
        return;
    }

    // Clear inputs
    const payInput = document.getElementById('payAmountInput');
    if (payInput) {
        payInput.value = '';
    }

    swapState.payAmount = null;
    swapState.receiveAmount = null;

    // Update displays
    updateSwapBalances();
    await updateWalletBalanceDisplay();
    clearSwapOutput();
    updateSwapButton();

    // Log success
    console.log(`Swap successful! Transaction completed.`);
}

// Export functions
export {
    updateSwapWalletDropdown as updateSwapWallet,
    updateSwapBalances
};
