/**
 * @fileoverview State management module for the trading application
 * Handles global state, token management, and application settings
 */

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
 * @typedef {Object} GlobalState
 * @property {Token[]} tokens - Array of token instances
 * @property {number} transactionCount - Total number of transactions processed
 * @property {Decimal} totalProcessed - Total amount processed in USD
 * @property {Decimal} totalGasUsed - Total gas used across all transactions
 * @property {number} startTime - Timestamp when the application started
 * @property {Decimal} plsPrice - Current PLS price
 * @property {number} maxTokens - Maximum number of tokens allowed
 * @property {Set<string>} activeTransactions - Set of active transaction IDs
 * @property {Decimal} minGlobalGas - Minimum gas limit
 * @property {Decimal} maxGlobalGas - Maximum gas limit
 * @property {string|null} currentWalletId - Currently selected wallet ID
 * @property {Map<string, number>} walletIntervals - Map of wallet IDs to their intervals
 * @property {number} currentTxNumber - Current transaction number
 * @property {Decimal} minTimeInterval - Minimum time interval between transactions
 * @property {Decimal} maxTimeInterval - Maximum time interval between transactions
 * @property {boolean} isPaused - Trading system pause state
 */

/**
 * Initialize the state with Decimal values
 * @returns {GlobalState}
 */
function initializeState() {
    const Decimal = getDecimal();
    return {
        tokens: [],
        transactionCount: 0,
        totalProcessed: new Decimal(0),
        totalGasUsed: new Decimal(0),
        startTime: Date.now(),
        plsPrice: new Decimal('1'), // Start at $1
        maxTokens: 20,
        activeTransactions: new Set(),
        minGlobalGas: new Decimal('0.000001'),
        maxGlobalGas: new Decimal('0.000005'),
        currentWalletId: null,
        walletIntervals: new Map(),
        currentTxNumber: 0,
        minTimeInterval: new Decimal(0.1),
        maxTimeInterval: new Decimal(1),
        isPaused: false
    };
}

/**
 * Global state object containing all application state
 * @type {GlobalState}
 */
export let state = {
    tokens: [],
    maxTokens: 20,
    isPaused: false,
    currentTxNumber: 0,
    minTimeInterval: 0.1,
    maxTimeInterval: 1.0,
    totalGasUsed: null,
    totalProcessed: null,
    transactionCount: 0,
    plsPrice: null,
    activeTransactions: new Set(),
    minGlobalGas: null,
    maxGlobalGas: null,
    currentWalletId: null,
    walletIntervals: new Map(),
    startTime: Date.now(),
    maxRoutingHops: 3,
    requireRoutingConfirmation: false,
    requireGas: true,
    applySlippage: true  // Toggle for realistic slippage calculation
};

/**
 * Initialize state with Decimal values after Decimal.js is loaded
 */
export function initializeStateValues() {
    const Decimal = getDecimal();
    state.totalGasUsed = new Decimal(0);
    state.totalProcessed = new Decimal(0);
    state.plsPrice = new Decimal('1'); // Start at $1
    state.minGlobalGas = new Decimal('0.000001');
    state.maxGlobalGas = new Decimal('0.000005');
    state.minTimeInterval = new Decimal(0.1);
    state.maxTimeInterval = new Decimal(1);
}

/**
 * Updates the PLS price with a small random variation
 * Note: This is disabled when using manual price slider
 * @returns {void}
 */
export function updatePLSPrice() {
    // Price is now controlled by the slider in settings
    // This function is kept for backwards compatibility
    return;
}

/**
 * Calculates gas cost for a transaction
 * @param {Decimal} amount - Transaction amount
 * @returns {Decimal} Calculated gas amount
 */
export function calculateGas(amount) {
    const Decimal = getDecimal();
    const minGas = state.minGlobalGas;
    const maxGas = state.maxGlobalGas;
    const randomFactor = Math.random();
    return minGas.plus(maxGas.minus(minGas).times(randomFactor));
}

/**
 * Gets or creates a random delay for a wallet
 * @param {string} walletId - Wallet identifier
 * @returns {number} Delay in milliseconds
 */
export function getRandomDelay(walletId) {
    const Decimal = getDecimal();
    if (!state.walletIntervals.has(walletId)) {
        const minMs = state.minTimeInterval.times(1000);
        const maxMs = state.maxTimeInterval.times(1000);
        const randomDelay = minMs.plus(
            maxMs.minus(minMs).times(Math.random())
        );
        state.walletIntervals.set(walletId, randomDelay.toNumber());
    }
    return state.walletIntervals.get(walletId);
}

/**
 * Resets the application state
 * @returns {void}
 */
export function resetState() {
    state.tokens = [];
    state.transactionCount = 0;
    state.totalProcessed = new Decimal(0);
    state.totalGasUsed = new Decimal(0);
    state.startTime = Date.now();
    state.currentTxNumber = 0;
    state.walletIntervals.clear();
    state.activeTransactions.clear();
}

/**
 * Toggles the pause state of the trading system
 * @returns {boolean} New pause state
 */
export function togglePauseState() {
    state.isPaused = !state.isPaused;
    return state.isPaused;
}

/**
 * Updates the current wallet ID
 * @param {string} walletId - New wallet ID
 */
export function setCurrentWallet(walletId) {
    state.currentWalletId = walletId;
}

/**
 * Increments the transaction count and returns the new value
 * @returns {number} New transaction count
 */
export function incrementTransactionCount() {
    state.transactionCount++;
    return state.transactionCount;
}

/**
 * Adds to the total processed amount
 * @param {Decimal} amount - Amount to add
 */
export function addToTotalProcessed(amount) {
    state.totalProcessed = state.totalProcessed.plus(amount);
}

/**
 * Adds to the total gas used
 * @param {Decimal} gasAmount - Gas amount to add
 */
export function addToTotalGasUsed(gasAmount) {
    state.totalGasUsed = state.totalGasUsed.plus(gasAmount);
}

/**
 * Gets the elapsed time since start in seconds
 * @returns {number} Elapsed seconds
 */
export function getElapsedSeconds() {
    return Math.floor((Date.now() - state.startTime) / 1000);
}

/**
 * Calculates transactions per minute
 * @returns {number} Transactions per minute
 */
export function getTransactionsPerMinute() {
    const Decimal = getDecimal();
    const minutesElapsed = getElapsedSeconds() / 60;
    return minutesElapsed > 0 ? (state.transactionCount / minutesElapsed) : 0;
}

/**
 * Update all token prices recursively through price chains
 * This ensures tokens paired with other tokens get correct USD prices
 */
export function updateAllTokenPrices() {
    const Decimal = getDecimal();
    const visited = new Set();

    // First pass: update all WPLS-paired tokens (direct calculation)
    const wplsPairedTokens = state.tokens.filter(t => t.pairType === 'WPLS');
    wplsPairedTokens.forEach(token => {
        token.calculateTokenPriceUSD(visited);
    });

    // Iterative passes: update token-paired tokens until prices stabilize
    let updated = true;
    let maxIterations = 10;  // Prevent infinite loops
    let iteration = 0;

    while (updated && iteration < maxIterations) {
        updated = false;
        iteration++;

        const tokenPairedTokens = state.tokens.filter(t => t.pairType === 'TOKEN');
        tokenPairedTokens.forEach(token => {
            const oldPrice = token.cachedUSDPrice;
            token.calculateTokenPriceUSD(visited);

            // Check if price changed significantly (>0.01%)
            if (!oldPrice.isZero()) {
                const change = token.cachedUSDPrice.minus(oldPrice).abs().dividedBy(oldPrice);
                if (change.gt(new Decimal('0.0001'))) {
                    updated = true;
                }
            } else if (!token.cachedUSDPrice.isZero()) {
                updated = true;
            }
        });
    }

    if (iteration >= maxIterations) {
        console.warn('Price update loop reached max iterations - possible circular dependency');
    }
}

/**
 * Get the price chain for a token (for debugging)
 * Shows how a token's USD price is calculated through pairs
 * @param {number} tokenId - Token ID to trace
 * @returns {Array|null} Price chain or null if token not found
 */
export function getTokenPriceChain(tokenId) {
    const token = state.tokens.find(t => t.id === tokenId);
    if (!token) return null;

    const chain = [];
    let current = token;
    const visited = new Set();

    while (current && !visited.has(current.id)) {
        visited.add(current.id);

        const priceInPair = current.pairReserve.isZero() || current.tokenReserve.isZero()
            ? '0'
            : current.pairReserve.dividedBy(current.tokenReserve).toString();

        chain.push({
            tokenId: current.id,
            pairType: current.pairType,
            pairedTokenId: current.pairedTokenId,
            priceInPair: priceInPair,
            priceInUSD: current.cachedUSDPrice.toString()
        });

        if (current.pairType === 'TOKEN') {
            current = state.tokens.find(t => t.id === current.pairedTokenId);
        } else {
            break;
        }
    }

    return chain;
} 