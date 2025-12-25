/**
 * @fileoverview Transaction processing module for handling all trading operations
 */

import { state, calculateGas, getRandomDelay, addToTotalGasUsed, addToTotalProcessed, incrementTransactionCount } from './state.js';
import { validatePositiveNumber, validateWalletId, validateTokenId } from '../utils/validators.js';
import { addTransactionToHistory, updateMetricsDisplay } from './ui.js';
import { findBestPath, executeRoute, getRoutePreview } from './routing.js';

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
 * @typedef {Object} TransactionResult
 * @property {boolean} success - Whether the transaction was successful
 * @property {string} [error] - Error message if transaction failed
 * @property {Decimal} [gasUsed] - Amount of gas used in the transaction
 * @property {Decimal} [amount] - Amount processed in the transaction
 */

/**
 * Process a buy transaction
 * @param {Object} params - Transaction parameters
 * @param {Decimal} params.amount - Amount to buy
 * @param {string} params.walletId - Wallet identifier
 * @param {number} params.tokenId - Token to buy
 * @param {boolean} [params.isInitialBuy=true] - Whether this is the initial buy
 * @returns {Promise<TransactionResult>} Transaction result
 */
export async function processBuy({ amount, walletId, tokenId, isInitialBuy = true }) {
    // Validate inputs
    const amountValidation = validatePositiveNumber(amount);
    if (!amountValidation.isValid) {
        return { success: false, error: amountValidation.message };
    }

    const walletValidation = validateWalletId(walletId);
    if (!walletValidation.isValid) {
        return { success: false, error: walletValidation.message };
    }

    const tokenValidation = validateTokenId(tokenId, state.maxTokens);
    if (!tokenValidation.isValid) {
        return { success: false, error: tokenValidation.message };
    }

    // Check if trading is paused
    if (state.isPaused) {
        return { success: false, error: 'Trading is paused' };
    }

    try {
        const Decimal = getDecimal();
        const token = state.tokens.find(t => t.id === tokenId);
        if (!token) {
            return { success: false, error: 'Token not found' };
        }

        // Calculate gas for this transaction (if required)
        const gasUsed = state.requireGas ? calculateGas(amount) : new Decimal(0);

        // === AMM + ROUTING INTEGRATION ===

        let tokensReceived = null;
        let priceImpact = null;
        let routeInfo = null;

        // Check if token has liquidity (AMM is active)
        if (!token.pairReserve.isZero() && !token.tokenReserve.isZero()) {
            // Check if we need routing (token not directly paired with USD/WPLS)
            const needsRouting = token.pairType === 'TOKEN';

            if (needsRouting) {
                // Find best route
                const route = findBestPath(token, amount);

                if (!route) {
                    return { success: false, error: 'No liquidity path available to this token' };
                }

                // Check if confirmation is required
                if (state.requireRoutingConfirmation && route.hops.length > 1) {
                    const confirmed = await confirmRoute(route, amount, token);
                    if (!confirmed) {
                        return { success: false, error: 'Route confirmation cancelled' };
                    }
                }

                // Execute the route
                const routeResult = executeRoute(route, amount, walletId);

                if (!routeResult.success) {
                    return { success: false, error: routeResult.error };
                }

                tokensReceived = routeResult.finalAmount;
                priceImpact = routeResult.totalPriceImpact;
                routeInfo = {
                    hops: routeResult.hops,
                    pathDescription: routeResult.pathDescription
                };

                console.log('Routed Buy executed:', {
                    tokenId: token.id,
                    usdAmount: amount.toString(),
                    route: routeResult.pathDescription,
                    hops: routeResult.hops.length,
                    tokensReceived: tokensReceived.toString(),
                    priceImpact: priceImpact.toFixed(2) + '%'
                });
            } else {
                // Direct swap (USD or WPLS pair)
                let pairAssetAmount;

                if (token.pairType === 'USD') {
                    pairAssetAmount = amount;
                } else if (token.pairType === 'WPLS') {
                    // USD amount / PLS price = PLS amount needed
                    pairAssetAmount = amount.dividedBy(state.plsPrice);
                }

                // Execute AMM buy
                const buyResult = token.executeBuy(pairAssetAmount);

                if (!buyResult.success) {
                    return { success: false, error: buyResult.error };
                }

                tokensReceived = buyResult.tokensReceived;
                priceImpact = buyResult.priceImpact;

                console.log('Direct Buy executed:', {
                    tokenId: token.id,
                    usdAmount: amount.toString(),
                    pairAssetAmount: pairAssetAmount.toString(),
                    tokensReceived: tokensReceived.toString(),
                    priceImpact: priceImpact.toFixed(2) + '%'
                });
            }
        } else {
            // Legacy mode: No liquidity, just track amount processed
            console.log('No liquidity in pool - tracking amount only (no actual buy)');
        }

        // Check if we have enough PLS for gas (only if gas is required)
        if (state.requireGas && token.plsBalance.lt(gasUsed)) {
            // Revert the trade if we can't pay gas
            if (tokensReceived) {
                token.pairReserve = token.pairReserve.minus(pairAssetAmount);
                token.tokenReserve = token.tokenReserve.plus(tokensReceived);
                token.k = token.tokenReserve.times(token.pairReserve);
            }
            return { success: false, error: 'Insufficient PLS for gas' };
        }

        // Deduct gas from PLS balance (only if gas is required)
        if (state.requireGas) {
            token.plsBalance = token.plsBalance.minus(gasUsed);
        }

        // Update token's processed amount (USD tracking)
        token.amountProcessed = token.amountProcessed.plus(amount);

        // Update global state
        if (state.requireGas) {
            addToTotalGasUsed(gasUsed);
        }
        addToTotalProcessed(amount);
        incrementTransactionCount();

        // Update displays
        token.updateDisplay();
        token.triggerGlowEffect();

        // Add transaction to history with AMM data and routing info
        addTransactionToHistory(walletId, amount, token.id, gasUsed, token.plsBalance, tokensReceived, priceImpact, routeInfo);

        // Update all prices after trade (important for price chains)
        const { updateAllTokenPrices } = await import('./state.js');
        updateAllTokenPrices();

        // Process next transaction if needed
        if (shouldContinueChain(token, amount)) {
            await processNextTransaction(token, amount, walletId);
        }

        return {
            success: true,
            gasUsed,
            amount,
            tokensReceived: tokensReceived,
            priceImpact: priceImpact
        };

    } catch (error) {
        console.error('Transaction processing error:', error);
        return {
            success: false,
            error: 'Transaction processing failed: ' + error.message
        };
    }
}

/**
 * Check if the transaction chain should continue
 * @param {Object} token - Current token
 * @param {Decimal} amount - Current transaction amount
 * @returns {boolean} Whether to continue the chain
 */
function shouldContinueChain(token, amount) {
    return token.selectedOppositeToken && 
           token.oppositeTokenPercentage.gt(0) &&
           !state.isPaused;
}

/**
 * Process the next transaction in the chain
 * @param {Object} currentToken - Current token
 * @param {Decimal} currentAmount - Current transaction amount
 * @param {string} walletId - Wallet identifier
 * @returns {Promise<void>}
 */
async function processNextTransaction(currentToken, currentAmount, walletId) {
    const nextToken = state.tokens.find(t => t.id === currentToken.selectedOppositeToken);
    if (!nextToken) return;

    // Calculate amounts for next transaction
    const plsAmount = currentAmount.times(currentToken.plsPercentage).dividedBy(100);
    const nextAmount = currentAmount.times(currentToken.oppositeTokenPercentage).dividedBy(100);

    // Add PLS to next token's balance
    nextToken.plsBalance = nextToken.plsBalance.plus(plsAmount);
    nextToken.updateDisplay();

    // Continue the chain if there's a next token and we have an amount
    if (nextToken && nextAmount.gt(0)) {
        const delay = getRandomDelay(walletId);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        await processBuy({
            amount: nextAmount,
            walletId,
            tokenId: nextToken.id,
            isInitialBuy: false
        });
    }
}

/**
 * Confirm a route with the user
 * @param {Object} route - Route to confirm
 * @param {Decimal} amountIn - USD amount
 * @param {Object} targetToken - Target token
 * @returns {Promise<boolean>} Whether user confirmed
 */
async function confirmRoute(route, amountIn, targetToken) {
    const { formatNumber, formatCurrency } = await import('../utils/formatters.js');

    let message = `🔀 Multi-Hop Routing Required\n\n`;
    message += `To buy ${targetToken.name}, your trade will route through ${route.hops.length} ${route.hops.length === 1 ? 'swap' : 'swaps'}:\n\n`;

    // Show each hop with amounts
    message += `Route: ${route.pathDescription}\n\n`;
    message += `Intermediate amounts:\n`;

    route.hops.forEach((hop, index) => {
        const amountInStr = formatCurrency(hop.amountIn, '$', 0);
        const amountOutStr = formatNumber(hop.amountOut, 0);
        const tokenName = hop.token.name;

        if (index === 0) {
            message += `1. ${amountInStr} → ${amountOutStr} ${tokenName}\n`;
        } else {
            const prevTokenName = route.hops[index - 1].token ? route.hops[index - 1].token.name : 'tokens';
            message += `${index + 1}. ${formatNumber(hop.amountIn, 0)} ${prevTokenName} → ${amountOutStr} ${tokenName}\n`;
        }
    });

    message += `\nFinal: You receive ${formatNumber(route.totalAmountOut, 0)} ${targetToken.name}\n`;
    message += `Total Price Impact: ${route.totalPriceImpact.toFixed(2)}%\n\n`;
    message += `Proceed with this route?`;

    return confirm(message);
}

/**
 * Add PLS to a token
 * @param {Object} params - Parameters for adding PLS
 * @param {number} params.tokenId - Token to add PLS to
 * @param {Decimal} params.amount - Amount of PLS to add
 * @returns {TransactionResult} Transaction result
 */
export function addPls({ tokenId, amount }) {
    const amountValidation = validatePositiveNumber(amount);
    if (!amountValidation.isValid) {
        return { success: false, error: amountValidation.message };
    }

    const tokenValidation = validateTokenId(tokenId, state.maxTokens);
    if (!tokenValidation.isValid) {
        return { success: false, error: tokenValidation.message };
    }

    const token = state.tokens.find(t => t.id === tokenId);
    if (!token) {
        return { success: false, error: 'Token not found' };
    }

    // Calculate gas for adding PLS (if required)
    const Decimal = getDecimal();
    const gasUsed = state.requireGas ? calculateGas(amount) : new Decimal(0);
    if (state.requireGas) {
        addToTotalGasUsed(gasUsed);
    }

    // Add PLS to token balance
    token.plsBalance = token.plsBalance.plus(amount);
    token.updateDisplay();

    return {
        success: true,
        gasUsed,
        amount
    };
}

/**
 * Add PLS to all tokens
 * @param {Decimal} totalAmount - Total amount of PLS to distribute
 * @returns {TransactionResult} Transaction result
 */
export function addPlsToAll(totalAmount) {
    const amountValidation = validatePositiveNumber(totalAmount);
    if (!amountValidation.isValid) {
        return { success: false, error: amountValidation.message };
    }

    if (state.tokens.length === 0) {
        return { success: false, error: 'No tokens available' };
    }

    // Calculate amount per token
    const amountPerToken = totalAmount.dividedBy(state.tokens.length);

    // Calculate total gas for all tokens (if required)
    const Decimal = getDecimal();
    const gasPerToken = state.requireGas ? calculateGas(amountPerToken) : new Decimal(0);
    const totalGas = gasPerToken.times(state.tokens.length);

    // Update total gas used
    if (state.requireGas) {
        addToTotalGasUsed(totalGas);
    }

    // Add PLS to each token
    state.tokens.forEach(token => {
        token.plsBalance = token.plsBalance.plus(amountPerToken);
        token.updateDisplay();
    });

    return {
        success: true,
        gasUsed: totalGas,
        amount: totalAmount
    };
}

/**
 * Reset all transactions
 * This clears transaction history and resets counters
 */
export function resetTransactions() {
    const Decimal = getDecimal();
    state.currentTxNumber = 0;
    state.transactionCount = 0;
    state.totalProcessed = new Decimal(0);
    state.totalGasUsed = new Decimal(0);
    state.startTime = Date.now();
    state.walletIntervals.clear();
    state.activeTransactions.clear();

    // Update UI
    updateMetricsDisplay({
        elapsedSeconds: 0,
        transactionsPerMinute: 0,
        plsPrice: state.plsPrice,
        totalGasUsed: state.totalGasUsed,
        transactionCount: state.transactionCount,
        totalProcessed: state.totalProcessed
    });
} 