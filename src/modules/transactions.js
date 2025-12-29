/**
 * @fileoverview Transaction processing module for handling all trading operations
 */

import { state, calculateGas, getRandomDelay, addToTotalGasUsed, addToTotalProcessed, incrementTransactionCount } from './state.js';
import { validatePositiveNumber, validateWalletId, validateTokenId } from '../utils/validators.js';
import { addTransactionToHistory, updateMetricsDisplay } from './ui.js';
import { findBestPath, executeRoute, getRoutePreview } from './routing.js';
import { getWalletById } from './wallet.js';
import { processTransactionMechanics } from './reflectionBurn.js';

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

        // Get wallet
        const wallet = getWalletById(parseInt(walletId));
        if (!wallet) {
            return { success: false, error: 'Wallet not found' };
        }

        // Check if wallet has enough USD
        if (wallet.usdBalance.lt(amount)) {
            return { success: false, error: `Insufficient USD balance. Have: $${wallet.usdBalance.toFixed(2)}, Need: $${amount.toFixed(2)}` };
        }

        // Calculate gas for this transaction (if required)
        const gasUsed = state.requireGas ? calculateGas(amount) : new Decimal(0);

        // Check if wallet has enough PLS for gas
        if (state.requireGas && wallet.plsBalance.lt(gasUsed)) {
            // Show gas warning modal
            const { showGasWarningModal } = await import('./swapCard.js');
            showGasWarningModal();
            return { success: false, error: `Insufficient PLS for gas. Have: ${wallet.plsBalance.toFixed(8)} PLS, Need: ${gasUsed.toFixed(8)} PLS` };
        }

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

        // Execute wallet transfers for successful buy
        wallet.subtractUSD(amount);
        if (state.requireGas) {
            wallet.subtractPLS(gasUsed);
        }
        if (tokensReceived) {
            wallet.addTokenBalance(tokenId, tokensReceived);

            // Apply reflection/burn mechanics if configured
            const mechanicsResult = processTransactionMechanics(token, tokensReceived, state.wallets);
            if (mechanicsResult && mechanicsResult.total.gt(0)) {
                // Deduct the mechanics fees from the user's received amount
                const netTokensReceived = tokensReceived.minus(mechanicsResult.total);
                wallet.setTokenBalance(tokenId, wallet.getTokenBalance(tokenId).minus(mechanicsResult.total));
                tokensReceived = netTokensReceived;
            }
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
        addTransactionToHistory(walletId, amount, token.id, gasUsed, wallet.plsBalance, tokensReceived, priceImpact, routeInfo);

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
 * Process a sell transaction
 * @param {Object} params - Transaction parameters
 * @param {Decimal} params.tokenAmount - Amount of tokens to sell
 * @param {string} params.walletId - Wallet identifier
 * @param {number} params.tokenId - Token to sell
 * @returns {Promise<TransactionResult>} Transaction result
 */
export async function processSell({ tokenAmount, walletId, tokenId }) {
    // Validate inputs
    const amountValidation = validatePositiveNumber(tokenAmount);
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

        // Get wallet
        const wallet = getWalletById(parseInt(walletId));
        if (!wallet) {
            return { success: false, error: 'Wallet not found' };
        }

        // Check if wallet has enough tokens
        const walletTokenBalance = wallet.getTokenBalance(tokenId);
        if (walletTokenBalance.lt(tokenAmount)) {
            return { success: false, error: `Insufficient token balance. Have: ${walletTokenBalance.toFixed(2)}, Need: ${tokenAmount.toFixed(2)}` };
        }

        // Check if token has liquidity
        if (token.pairReserve.isZero() || token.tokenReserve.isZero()) {
            return { success: false, error: 'No liquidity in pool to sell to' };
        }

        // Execute AMM sell
        const sellResult = token.executeSell(tokenAmount);

        if (!sellResult.success) {
            return { success: false, error: sellResult.error };
        }

        const pairReceived = sellResult.pairReceived;
        const priceImpact = sellResult.priceImpact;

        // Calculate USD value received
        let usdReceived;
        if (token.pairType === 'USD') {
            usdReceived = pairReceived;
        } else if (token.pairType === 'WPLS') {
            usdReceived = pairReceived.times(state.plsPrice);
        } else {
            // TOKEN pair - get paired token's USD price
            const pairedToken = state.tokens.find(t => t.id === token.pairedTokenId);
            if (pairedToken) {
                const pairedTokenUSDPrice = pairedToken.calculateTokenPriceUSD(new Set());
                usdReceived = pairReceived.times(pairedTokenUSDPrice);
            } else {
                usdReceived = new Decimal(0);
            }
        }

        // Calculate gas for this transaction (if required)
        const gasUsed = state.requireGas ? calculateGas(usdReceived) : new Decimal(0);

        // Check if wallet has enough PLS for gas
        if (state.requireGas && wallet.plsBalance.lt(gasUsed)) {
            // Revert the sell
            token.tokenReserve = token.tokenReserve.minus(tokenAmount);
            token.pairReserve = token.pairReserve.plus(pairReceived);
            token.k = token.tokenReserve.times(token.pairReserve);
            // Show gas warning modal
            const { showGasWarningModal } = await import('./swapCard.js');
            showGasWarningModal();
            return { success: false, error: `Insufficient PLS for gas. Have: ${wallet.plsBalance.toFixed(8)} PLS, Need: ${gasUsed.toFixed(8)} PLS` };
        }

        // Apply reflection/burn mechanics before processing the sell
        const mechanicsResult = processTransactionMechanics(token, tokenAmount, state.wallets);
        if (mechanicsResult && mechanicsResult.total.gt(0)) {
            console.log('Mechanics applied on sell:', {
                reflection: mechanicsResult.reflection.toString(),
                burn: mechanicsResult.burn.toString(),
                lpFee: mechanicsResult.lpFee.toString()
            });
        }

        // Execute wallet transfers for successful sell
        wallet.subtractTokenBalance(tokenId, tokenAmount);
        if (state.requireGas) {
            wallet.subtractPLS(gasUsed);
        }

        // Add received pair asset to wallet
        if (token.pairType === 'USD') {
            wallet.addUSD(pairReceived);
        } else if (token.pairType === 'WPLS') {
            wallet.addPLS(pairReceived);
        } else {
            // TOKEN pair - add received tokens to wallet
            wallet.addTokenBalance(token.pairedTokenId, pairReceived);
        }

        // Update token's processed amount (USD tracking)
        token.amountProcessed = token.amountProcessed.plus(usdReceived);

        // Update global state
        if (state.requireGas) {
            addToTotalGasUsed(gasUsed);
        }
        addToTotalProcessed(usdReceived);
        incrementTransactionCount();

        // Update displays
        token.updateDisplay();
        token.triggerGlowEffect();

        // Add transaction to history (negative amount for sell)
        addTransactionToHistory(walletId, usdReceived.negated(), token.id, gasUsed, wallet.plsBalance, tokenAmount.negated(), priceImpact, null);

        // Update all prices after trade
        const { updateAllTokenPrices } = await import('./state.js');
        updateAllTokenPrices();

        console.log('Sell executed:', {
            tokenId: token.id,
            tokensSold: tokenAmount.toString(),
            pairReceived: pairReceived.toString(),
            usdValue: usdReceived.toString(),
            priceImpact: priceImpact.toFixed(2) + '%'
        });

        return {
            success: true,
            gasUsed,
            amount: usdReceived,
            pairReceived: pairReceived,
            priceImpact: priceImpact
        };

    } catch (error) {
        console.error('Sell transaction processing error:', error);
        return {
            success: false,
            error: 'Sell transaction failed: ' + error.message
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
    const shouldContinue = token.selectedOppositeToken &&
           token.oppositeTokenPercentage.gt(0) &&
           !state.isPaused;

    console.log('shouldContinueChain check:', {
        tokenId: token.id,
        tokenName: token.name,
        selectedOppositeToken: token.selectedOppositeToken,
        oppositeTokenPercentage: token.oppositeTokenPercentage.toString(),
        isPaused: state.isPaused,
        shouldContinue
    });

    return shouldContinue;
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
    if (!nextToken) {
        console.log('No next token found for ID:', currentToken.selectedOppositeToken);
        return;
    }

    // Calculate amounts for next transaction
    const plsAmount = currentAmount.times(currentToken.plsPercentage).dividedBy(100);
    const nextAmount = currentAmount.times(currentToken.oppositeTokenPercentage).dividedBy(100);

    console.log('Processing next transaction:', {
        currentToken: currentToken.name,
        nextToken: nextToken.name,
        currentAmount: currentAmount.toString(),
        plsPercentage: currentToken.plsPercentage.toString(),
        oppositeTokenPercentage: currentToken.oppositeTokenPercentage.toString(),
        plsAmount: plsAmount.toString(),
        nextAmount: nextAmount.toString()
    });

    // Add PLS to wallet for next transaction
    const { getWalletById } = await import('./wallet.js');
    const wallet = getWalletById(parseInt(walletId));
    if (wallet && plsAmount.gt(0)) {
        wallet.addPLS(plsAmount);
        console.log(`Added ${plsAmount.toString()} PLS to wallet ${walletId}`);
    }

    // Continue the chain if there's a next token and we have an amount
    if (nextToken && nextAmount.gt(0)) {
        const delay = getRandomDelay(walletId);
        console.log(`Waiting ${delay}ms before next transaction...`);
        await new Promise(resolve => setTimeout(resolve, delay));

        console.log(`Executing buy of ${nextToken.name} with ${nextAmount.toString()} USD`);
        await processBuy({
            amount: nextAmount,
            walletId,
            tokenId: nextToken.id,
            isInitialBuy: false
        });
    } else {
        console.log('Chain stopped:', { hasNextToken: !!nextToken, nextAmount: nextAmount.toString() });
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

    let message = `Multi-Hop Routing Required\n\n`;
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
 * Add PLS to current wallet
 * @param {Object} params - Parameters for adding PLS
 * @param {Decimal} params.amount - Amount of PLS to add
 * @returns {TransactionResult} Transaction result
 */
export function addPls({ amount }) {
    const amountValidation = validatePositiveNumber(amount);
    if (!amountValidation.isValid) {
        return { success: false, error: amountValidation.message };
    }

    // Get current wallet
    const wallet = getWalletById(state.currentWalletId);
    if (!wallet) {
        return { success: false, error: 'No wallet selected' };
    }

    // Add PLS to wallet balance
    wallet.addPLS(amount);

    return {
        success: true,
        amount
    };
}

/**
 * Add PLS to all wallets
 * @param {Decimal} totalAmount - Total amount of PLS to distribute
 * @returns {TransactionResult} Transaction result
 */
export function addPlsToAll(totalAmount) {
    const amountValidation = validatePositiveNumber(totalAmount);
    if (!amountValidation.isValid) {
        return { success: false, error: amountValidation.message };
    }

    if (state.wallets.length === 0) {
        return { success: false, error: 'No wallets available' };
    }

    // Calculate amount per wallet
    const amountPerWallet = totalAmount.dividedBy(state.wallets.length);

    // Add PLS to each wallet
    state.wallets.forEach(wallet => {
        wallet.addPLS(amountPerWallet);
    });

    return {
        success: true,
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