/**
 * @fileoverview Metrics and statistics tracking module
 */

import { state, updateAllTokenPrices } from './state.js';
import { updateMetricsDisplay } from './ui.js';
import { updateCapitalDashboard } from './capitalDashboard.js';

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
 * @typedef {Object} MetricsSnapshot
 * @property {number} elapsedSeconds - Total seconds elapsed
 * @property {number} transactionsPerMinute - Current transactions per minute
 * @property {Decimal} plsPrice - Current PLS price
 * @property {Decimal} totalGasUsed - Total gas used
 * @property {number} transactionCount - Total transactions processed
 * @property {Decimal} totalProcessed - Total amount processed
 * @property {Decimal} averageGasPerTransaction - Average gas used per transaction
 * @property {Decimal} averageTransactionAmount - Average amount per transaction
 * @property {number} activeWallets - Number of unique active wallets
 */

/**
 * Calculate current transactions per minute
 * @returns {number} Transactions per minute
 */
export function calculateTransactionsPerMinute() {
    const elapsedMinutes = getElapsedMinutes();
    return elapsedMinutes > 0 ? (state.transactionCount / elapsedMinutes) : 0;
}

/**
 * Get elapsed minutes since start
 * @returns {number} Elapsed minutes
 */
function getElapsedMinutes() {
    return getElapsedSeconds() / 60;
}

/**
 * Get elapsed seconds since start
 * @returns {number} Elapsed seconds
 */
export function getElapsedSeconds() {
    return Math.floor((Date.now() - state.startTime) / 1000);
}

/**
 * Calculate average gas used per transaction
 * @returns {Decimal} Average gas used
 */
export function calculateAverageGas() {
    const Decimal = getDecimal();
    if (state.transactionCount === 0) return new Decimal(0);
    return state.totalGasUsed.dividedBy(state.transactionCount);
}

/**
 * Calculate average transaction amount
 * @returns {Decimal} Average transaction amount
 */
export function calculateAverageTransactionAmount() {
    const Decimal = getDecimal();
    if (state.transactionCount === 0) return new Decimal(0);
    return state.totalProcessed.dividedBy(state.transactionCount);
}

/**
 * Get count of unique active wallets
 * @returns {number} Number of active wallets
 */
export function getActiveWalletCount() {
    return state.walletIntervals.size;
}

/**
 * Calculate total PLS liquidity across all tokens
 * @returns {Decimal} Total PLS liquidity
 */
export function calculateTotalLiquidity() {
    const Decimal = getDecimal();
    return state.tokens.reduce((total, token) => {
        return total.plus(token.totalLiquidity);
    }, new Decimal(0));
}

/**
 * Calculate total PLS balance across all tokens
 * @returns {Decimal} Total PLS balance
 */
export function calculateTotalPlsBalance() {
    const Decimal = getDecimal();
    return state.tokens.reduce((total, token) => {
        return total.plus(token.plsBalance);
    }, new Decimal(0));
}

/**
 * Get current metrics snapshot
 * @returns {MetricsSnapshot} Current metrics
 */
export function getMetricsSnapshot() {
    return {
        elapsedSeconds: getElapsedSeconds(),
        transactionsPerMinute: calculateTransactionsPerMinute(),
        plsPrice: state.plsPrice,
        totalGasUsed: state.totalGasUsed,
        transactionCount: state.transactionCount,
        totalProcessed: state.totalProcessed,
        averageGasPerTransaction: calculateAverageGas(),
        averageTransactionAmount: calculateAverageTransactionAmount(),
        activeWallets: getActiveWalletCount()
    };
}

/**
 * Calculate token-specific metrics
 * @param {number} tokenId - Token ID to calculate metrics for
 * @returns {Object} Token metrics
 */
export function calculateTokenMetrics(tokenId) {
    const token = state.tokens.find(t => t.id === tokenId);
    if (!token) return null;

    return {
        amountProcessed: token.amountProcessed,
        plsBalance: token.plsBalance,
        liquidity: token.totalLiquidity,
        price: token.calculateTokenPrice(),
        supply: token.totalSupply
    };
}

/**
 * Calculate gas efficiency metrics
 * @returns {Object} Gas efficiency metrics
 */
export function calculateGasEfficiency() {
    const averageGas = calculateAverageGas();
    const totalValue = state.totalProcessed.times(state.plsPrice);
    
    return {
        averageGasPerTransaction: averageGas,
        gasToValueRatio: state.totalGasUsed.dividedBy(totalValue),
        totalGasCost: state.totalGasUsed.times(state.plsPrice)
    };
}

/**
 * Start metrics update interval
 * @param {number} [interval=1000] - Update interval in milliseconds
 * @returns {number} Interval ID
 */
export function startMetricsUpdate(interval = 1000) {
    return setInterval(() => {
        // Update all token prices through price chains
        updateAllTokenPrices();

        // Update metrics display
        const metrics = getMetricsSnapshot();
        updateMetricsDisplay(metrics);

        // Update capital dashboard
        updateCapitalDashboard();
    }, interval);
}

/**
 * Stop metrics update interval
 * @param {number} intervalId - Interval ID to stop
 */
export function stopMetricsUpdate(intervalId) {
    clearInterval(intervalId);
}

/**
 * Calculate performance metrics
 * @returns {Object} Performance metrics
 */
export function calculatePerformanceMetrics() {
    const elapsedMinutes = getElapsedMinutes();
    if (elapsedMinutes === 0) return null;

    return {
        transactionsPerMinute: calculateTransactionsPerMinute(),
        valuePerMinute: state.totalProcessed.dividedBy(elapsedMinutes),
        gasPerMinute: state.totalGasUsed.dividedBy(elapsedMinutes)
    };
}

/**
 * Calculate wallet-specific metrics
 * @param {string} walletId - Wallet ID to calculate metrics for
 * @returns {Object} Wallet metrics
 */
export function calculateWalletMetrics(walletId) {
    const interval = state.walletIntervals.get(walletId);
    if (!interval) return null;

    return {
        averageInterval: interval,
        transactionsPerMinute: 60000 / interval,
        isActive: !state.isPaused
    };
}

/**
 * Reset all metrics
 * This resets all calculated values but maintains current price
 */
export function resetMetrics() {
    const Decimal = getDecimal();
    const currentPrice = state.plsPrice;
    state.startTime = Date.now();
    state.transactionCount = 0;
    state.totalProcessed = new Decimal(0);
    state.totalGasUsed = new Decimal(0);
    state.plsPrice = currentPrice;

    // Update UI with reset metrics
    updateMetricsDisplay(getMetricsSnapshot());
} 