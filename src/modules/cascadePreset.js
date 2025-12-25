/**
 * @fileoverview Cascade preset module for auto-configuring 50/50 liquidity chains
 */

import { state } from './state.js';

/**
 * Get the Decimal instance
 * @returns {typeof Decimal} The Decimal constructor
 */
function getDecimal() {
    if (!window.Decimal) {
        throw new Error('Decimal.js not loaded');
    }
    return window.Decimal;
}

/**
 * Initialize cascade preset functionality
 */
export function initializeCascadePreset() {
    const cascadeBtn = document.getElementById('cascadeSetupBtn');

    if (cascadeBtn) {
        cascadeBtn.addEventListener('click', handleCascadeSetup);
    }
}

/**
 * Handle cascade setup button click
 */
function handleCascadeSetup() {
    const Decimal = getDecimal();
    const usdAmountInput = document.getElementById('cascadeUsdAmount');
    const usdAmount = new Decimal(usdAmountInput?.value || 100);

    if (usdAmount.lte(0)) {
        alert('USD amount must be greater than 0');
        return;
    }

    if (state.tokens.length < 2) {
        alert('Need at least 2 tokens to create a cascade. Please add more tokens first.');
        return;
    }

    // Confirm action
    const confirmation = confirm(
        `This will configure ${state.tokens.length} tokens in a cascade pattern:\n\n` +
        `Each token starts with:\n` +
        `• 1,000,000 token supply\n` +
        `• 1,000,000 WPLS balance\n\n` +
        `Cascade setup:\n` +
        `• Token 1: 500,000 tokens (50%) paired with $${usdAmount.toFixed(2)} USD\n` +
        `• Token 2: 500,000 tokens paired with remaining 500,000 Token 1\n` +
        `• Token 3: 500,000 tokens paired with remaining 500,000 Token 2\n` +
        `• And so on...\n\n` +
        `Continue?`
    );

    if (!confirmation) return;

    setupCascade(usdAmount);
}

/**
 * Setup cascade liquidity pattern
 * @param {Decimal} usdAmount - USD amount for first token
 */
function setupCascade(usdAmount) {
    const Decimal = getDecimal();

    if (state.tokens.length === 0) return;

    // Token 1: Pair 50% with USD
    const token1 = state.tokens[0];
    const token1Supply = token1.totalSupply;
    const token1HalfSupply = token1Supply.dividedBy(2);

    // Configure Token 1
    token1.pairType = 'USD';
    token1.pairedTokenId = null;

    // Add liquidity: 50% of supply with USD
    const success1 = token1.addLiquidity(token1HalfSupply.toString(), usdAmount.toString());

    if (!success1) {
        alert('Failed to add liquidity to Token 1. Please check supply and try again.');
        return;
    }

    console.log(`✓ Token 1: Added ${token1HalfSupply.toString()} tokens with $${usdAmount.toString()} USD`);

    // Setup cascade for remaining tokens
    for (let i = 1; i < state.tokens.length; i++) {
        const currentToken = state.tokens[i];
        const previousToken = state.tokens[i - 1];

        // Get available supply from previous token (should be ~50%)
        const previousAvailable = previousToken.getAvailableSupply();

        if (previousAvailable.isZero()) {
            console.warn(`${previousToken.name} has no available supply for ${currentToken.name}`);
            continue;
        }

        // Configure current token to pair with previous token
        currentToken.pairType = 'TOKEN';
        currentToken.pairedTokenId = previousToken.id;

        // Use 50% of current token's supply
        const currentTokenHalfSupply = currentToken.totalSupply.dividedBy(2);

        // Pair with 100% of previous token's available supply (which is ~50% of its total)
        const pairAmount = previousAvailable;

        // Add liquidity
        const success = currentToken.addLiquidity(
            currentTokenHalfSupply.toString(),
            pairAmount.toString()
        );

        if (success) {
            console.log(`✓ ${currentToken.name}: Added ${currentTokenHalfSupply.toString()} tokens with ${pairAmount.toString()} ${previousToken.name}`);
        } else {
            console.warn(`✗ Failed to add liquidity to ${currentToken.name}`);
        }

        // Update displays
        previousToken.updateDisplay();
        currentToken.updateDisplay();
    }

    // Final update all displays
    state.tokens.forEach(token => {
        token.updateDisplay();
        token.updateLiquidityDisplay();
    });

    // Show success message
    alert(
        `✓ Cascade setup complete!\n\n` +
        `${state.tokens.length} tokens configured:\n` +
        `• Each with 1,000,000 total supply\n` +
        `• Each with 1,000,000 WPLS balance\n` +
        `• 500,000 tokens (50%) added to liquidity pools\n\n` +
        `Check the Capital Dashboard to see the leverage effect!`
    );
}

/**
 * Get cascade configuration summary
 * @returns {string} Summary of current cascade configuration
 */
export function getCascadeSummary() {
    if (state.tokens.length === 0) {
        return 'No tokens configured';
    }

    let summary = 'Cascade Configuration:\n\n';

    state.tokens.forEach((token, index) => {
        const depth = token.liquidityDepth;
        let pairInfo;
        if (token.pairType === 'USD') {
            pairInfo = 'USD (Direct)';
        } else if (token.pairType === 'WPLS') {
            pairInfo = 'WPLS';
        } else if (token.pairType === 'TOKEN' && token.pairedTokenId) {
            const pairedToken = state.tokens.find(t => t.id === token.pairedTokenId);
            pairInfo = pairedToken ? pairedToken.name : `Token ${token.pairedTokenId}`;
        } else {
            pairInfo = 'None';
        }

        summary += `${token.name}: Paired with ${pairInfo} (Depth: ${depth})\n`;
    });

    return summary;
}
