/**
 * @fileoverview Reflection and burn mechanics module
 * Handles deflationary tokenomics including reflections to holders, burns, and LP fees
 */

import { state } from './state.js';

/**
 * Get Decimal instance
 */
function getDecimal() {
    if (typeof window !== 'undefined' && window.Decimal) {
        return window.Decimal;
    }
    throw new Error('Decimal.js not loaded');
}

/**
 * Preset configurations for common tokenomics models
 */
const PRESETS = {
    safemoon: {
        name: 'SafeMoon Style',
        reflection: 5,
        burn: 0,
        lpFee: 5,
        description: '5% reflection to holders, 5% to liquidity pool'
    },
    rfi: {
        name: 'RFI (Reflect Finance)',
        reflection: 2,
        burn: 0,
        lpFee: 0,
        description: '2% reflection to all holders'
    },
    deflationary: {
        name: 'Deflationary',
        reflection: 2,
        burn: 3,
        lpFee: 0,
        description: '3% burn, 2% reflection'
    },
    'aggressive-burn': {
        name: 'Aggressive Burn',
        reflection: 0,
        burn: 5,
        lpFee: 0,
        description: '5% burn per transaction'
    },
    custom: {
        name: 'Custom',
        reflection: 0,
        burn: 0,
        lpFee: 0,
        description: 'Set your own percentages'
    },
    none: {
        name: 'None',
        reflection: 0,
        burn: 0,
        lpFee: 0,
        description: 'Disable all mechanics'
    }
};

/**
 * Apply a preset configuration to token(s)
 * @param {string} presetName - Name of the preset
 * @param {number|string} tokenId - Token ID or 'all'
 */
export function applyPreset(presetName, tokenId = 'all') {
    const preset = PRESETS[presetName];
    if (!preset) {
        console.error(`Unknown preset: ${presetName}`);
        return;
    }

    const Decimal = getDecimal();

    if (tokenId === 'all') {
        state.tokens.forEach(token => {
            token.reflectionPercent = new Decimal(preset.reflection);
            token.burnPercent = new Decimal(preset.burn);
            token.lpFeePercent = new Decimal(preset.lpFee);
        });
    } else {
        const token = state.tokens.find(t => t.id === parseInt(tokenId));
        if (token) {
            token.reflectionPercent = new Decimal(preset.reflection);
            token.burnPercent = new Decimal(preset.burn);
            token.lpFeePercent = new Decimal(preset.lpFee);
        }
    }

    updateMechanicsDisplay();
    console.log(`Applied ${preset.name} preset to ${tokenId === 'all' ? 'all tokens' : `token ${tokenId}`}`);
}

/**
 * Apply custom mechanics percentages to token(s)
 * @param {number} reflection - Reflection percentage
 * @param {number} burn - Burn percentage
 * @param {number} lpFee - LP fee percentage
 * @param {number|string} tokenId - Token ID or 'all'
 */
export function applyCustomMechanics(reflection, burn, lpFee, tokenId = 'all') {
    const Decimal = getDecimal();

    // Validate total doesn't exceed 100%
    const total = parseFloat(reflection) + parseFloat(burn) + parseFloat(lpFee);
    if (total > 100) {
        alert('Total percentages cannot exceed 100%');
        return false;
    }

    if (tokenId === 'all') {
        state.tokens.forEach(token => {
            token.reflectionPercent = new Decimal(reflection);
            token.burnPercent = new Decimal(burn);
            token.lpFeePercent = new Decimal(lpFee);
        });
    } else {
        const token = state.tokens.find(t => t.id === parseInt(tokenId));
        if (token) {
            token.reflectionPercent = new Decimal(reflection);
            token.burnPercent = new Decimal(burn);
            token.lpFeePercent = new Decimal(lpFee);
        }
    }

    updateMechanicsDisplay();
    return true;
}

/**
 * Process reflection/burn mechanics for a transaction
 * @param {Token} token - The token being traded
 * @param {Decimal} tokenAmount - Amount of tokens in the transaction
 * @param {Object} wallets - Map of wallet IDs to wallet objects
 * @returns {Object} Amounts deducted for each mechanism
 */
export function processTransactionMechanics(token, tokenAmount, wallets = {}) {
    const Decimal = getDecimal();

    // Calculate amounts for each mechanism
    const reflectionAmount = tokenAmount.times(token.reflectionPercent).dividedBy(100);
    const burnAmount = tokenAmount.times(token.burnPercent).dividedBy(100);
    const lpFeeAmount = tokenAmount.times(token.lpFeePercent).dividedBy(100);

    // Apply burn - reduce total supply
    if (burnAmount.gt(0)) {
        token.totalSupply = token.totalSupply.minus(burnAmount);
        token.totalBurned = token.totalBurned.plus(burnAmount);
    }

    // Apply reflection - distribute to all holders
    if (reflectionAmount.gt(0)) {
        distributeReflection(token, reflectionAmount, wallets);
        token.totalReflected = token.totalReflected.plus(reflectionAmount);
    }

    // Apply LP fee - add to liquidity pool
    if (lpFeeAmount.gt(0)) {
        // Add to both reserves proportionally to maintain price
        if (!token.tokenReserve.isZero() && !token.pairReserve.isZero()) {
            const lpTokenAmount = lpFeeAmount.dividedBy(2);
            const currentPrice = token.pairReserve.dividedBy(token.tokenReserve);
            const lpPairAmount = lpTokenAmount.times(currentPrice);

            token.tokenReserve = token.tokenReserve.plus(lpTokenAmount);
            token.pairReserve = token.pairReserve.plus(lpPairAmount);
            token.k = token.tokenReserve.times(token.pairReserve);
        }
        token.lpFeesCollected = token.lpFeesCollected.plus(lpFeeAmount);
    }

    updateMechanicsDisplay();

    return {
        reflection: reflectionAmount,
        burn: burnAmount,
        lpFee: lpFeeAmount,
        total: reflectionAmount.plus(burnAmount).plus(lpFeeAmount)
    };
}

/**
 * Distribute reflection tokens to all holders proportionally
 * @param {Token} token - The token being reflected
 * @param {Decimal} reflectionAmount - Total amount to distribute
 * @param {Object} wallets - Map of wallet IDs to wallet objects
 */
function distributeReflection(token, reflectionAmount, wallets) {
    const Decimal = getDecimal();

    // Calculate total tokens held by all wallets
    let totalHeld = new Decimal(0);
    const holders = [];

    for (const wallet of Object.values(wallets)) {
        const holding = wallet.tokenBalances[token.id] || new Decimal(0);
        if (holding.gt(0)) {
            totalHeld = totalHeld.plus(holding);
            holders.push({ wallet, holding });
        }
    }

    // Distribute proportionally to holders
    if (totalHeld.gt(0)) {
        for (const { wallet, holding } of holders) {
            const proportion = holding.dividedBy(totalHeld);
            const reflectionShare = reflectionAmount.times(proportion);

            if (!wallet.tokenBalances[token.id]) {
                wallet.tokenBalances[token.id] = new Decimal(0);
            }
            wallet.tokenBalances[token.id] = wallet.tokenBalances[token.id].plus(reflectionShare);
        }
    }
}

/**
 * Update the mechanics stats display
 */
export function updateMechanicsDisplay() {
    const Decimal = getDecimal();

    let totalBurned = new Decimal(0);
    let totalReflected = new Decimal(0);
    let lpFeesCollected = new Decimal(0);

    state.tokens.forEach(token => {
        totalBurned = totalBurned.plus(token.totalBurned);
        totalReflected = totalReflected.plus(token.totalReflected);
        lpFeesCollected = lpFeesCollected.plus(token.lpFeesCollected);
    });

    const totalBurnedDisplay = document.getElementById('totalBurnedDisplay');
    const totalReflectedDisplay = document.getElementById('totalReflectedDisplay');
    const lpFeesDisplay = document.getElementById('lpFeesDisplay');

    if (totalBurnedDisplay) {
        totalBurnedDisplay.textContent = formatNumber(totalBurned, 2);
    }
    if (totalReflectedDisplay) {
        totalReflectedDisplay.textContent = formatNumber(totalReflected, 2);
    }
    if (lpFeesDisplay) {
        lpFeesDisplay.textContent = formatNumber(lpFeesCollected, 2);
    }
}

/**
 * Format number for display
 * @param {Decimal} value - Value to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted number
 */
function formatNumber(value, decimals = 2) {
    if (!value || value.isZero()) return '0';
    return value.toFixed(decimals).replace(/\.?0+$/, '');
}

/**
 * Initialize the reflection/burn mechanics UI
 */
export function initializeReflectionBurnUI() {
    // Preset buttons
    const presetButtons = document.querySelectorAll('.preset-buttons .preset-btn[data-preset]');
    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            const config = PRESETS[preset];

            if (!config) {
                console.error(`Unknown preset: ${preset}`);
                return;
            }

            if (preset === 'custom') {
                // Show custom config panel
                const mechanicsConfig = document.getElementById('mechanicsConfig');
                if (mechanicsConfig) {
                    mechanicsConfig.classList.remove('hidden');
                }
            } else {
                // Hide custom config panel
                const mechanicsConfig = document.getElementById('mechanicsConfig');
                if (mechanicsConfig) {
                    mechanicsConfig.classList.add('hidden');
                }

                // Apply preset to all tokens (or selected token)
                const tokenSelect = document.getElementById('mechanicsTokenSelect');
                const tokenId = tokenSelect ? tokenSelect.value : 'all';
                applyPreset(preset, tokenId);

                if (preset !== 'none') {
                    alert(`Applied ${config.name}: ${config.description}`);
                }
            }
        });
    });

    // Apply mechanics button
    const applyBtn = document.getElementById('applyMechanicsBtn');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            const reflectionInput = document.getElementById('reflectionPercent');
            const burnInput = document.getElementById('burnPercent');
            const lpFeeInput = document.getElementById('lpFeePercent');
            const tokenSelect = document.getElementById('mechanicsTokenSelect');

            const reflection = reflectionInput ? parseFloat(reflectionInput.value) || 0 : 0;
            const burn = burnInput ? parseFloat(burnInput.value) || 0 : 0;
            const lpFee = lpFeeInput ? parseFloat(lpFeeInput.value) || 0 : 0;
            const tokenId = tokenSelect ? tokenSelect.value : 'all';

            if (applyCustomMechanics(reflection, burn, lpFee, tokenId)) {
                alert(`Applied custom mechanics:\nReflection: ${reflection}%\nBurn: ${burn}%\nLP Fee: ${lpFee}%`);
            }
        });
    }

    // Populate token select dropdown
    updateTokenSelectOptions();
}

/**
 * Update the token select dropdown with current tokens
 */
export function updateTokenSelectOptions() {
    const select = document.getElementById('mechanicsTokenSelect');
    if (!select) return;

    // Keep 'All Tokens' option and add individual tokens
    const currentValue = select.value;
    select.innerHTML = '<option value="all">All Tokens</option>';

    state.tokens.forEach(token => {
        const option = document.createElement('option');
        option.value = token.id;
        option.textContent = token.name || `Token ${token.id}`;
        select.appendChild(option);
    });

    // Restore selection if it still exists
    if ([...select.options].some(opt => opt.value === currentValue)) {
        select.value = currentValue;
    }
}

// Export presets for external use
export { PRESETS };
