/**
 * @fileoverview Automated Trading System
 * Configurable market simulation with buy/sell automation
 */

import { state } from './state.js';
import { processBuy, processSell } from './transactions.js';
import { getWalletById } from './wallet.js';

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
 * Active strategy state
 */
let activeStrategy = null;
let strategyInterval = null;
let currentTokenIndex = 0; // For in-order and reverse modes
let strategyStats = {
    currentTrade: 0,
    totalTrades: 0,
    totalSpent: 0,
    totalEarned: 0,
    totalImpact: 0,
    startTime: null,
    buys: 0,
    sells: 0
};

/**
 * Start automated trading
 * @param {Object} config - Trading configuration
 */
export async function startStrategy(config) {
    if (activeStrategy) {
        console.error('A strategy is already running');
        return false;
    }

    // Validate config based on selection mode
    if (config.tokenSelectionMode === 'specific' && (!config.tokenId || config.tokenId === '')) {
        alert('Please select a target token');
        return false;
    }

    if ((config.tokenSelectionMode === 'random' || config.tokenSelectionMode === 'in-order' || config.tokenSelectionMode === 'reverse') && state.tokens.length === 0) {
        alert('No tokens available. Please add tokens first.');
        return false;
    }

    if (!config.amount || config.amount <= 0) {
        alert('Please enter a valid amount');
        return false;
    }

    if (!config.interval || config.interval <= 0) {
        alert('Please enter a valid interval');
        return false;
    }

    if (!config.continuousMode && (!config.tradeCount || config.tradeCount <= 0)) {
        alert('Please enter a valid trade count or enable continuous mode');
        return false;
    }

    // Initialize strategy stats
    strategyStats = {
        currentTrade: 0,
        totalTrades: config.continuousMode ? Infinity : parseInt(config.tradeCount),
        totalSpent: 0,
        totalEarned: 0,
        totalImpact: 0,
        startTime: Date.now(),
        buys: 0,
        sells: 0
    };

    activeStrategy = { config };

    // Reset token index for ordered modes
    if (config.tokenSelectionMode === 'reverse') {
        currentTokenIndex = state.tokens.length - 1;
    } else {
        currentTokenIndex = 0;
    }

    // Start execution
    executeStrategyStep();

    // Update UI
    updateStrategyUI();

    console.log('Started automated trading strategy');
    return true;
}

/**
 * Execute a single strategy step
 */
async function executeStrategyStep() {
    if (!activeStrategy) return;

    const { config } = activeStrategy;
    const Decimal = getDecimal();

    try {
        // Determine which token to trade
        const targetTokenId = getTargetToken(config);

        if (!targetTokenId) {
            console.error('No token available for trading');
            strategyInterval = setTimeout(executeStrategyStep, parseFloat(config.interval) * 1000);
            return;
        }

        // Calculate randomized amount
        const baseAmount = new Decimal(config.amount);
        const variance = parseFloat(config.amountVariance) || 0;
        const randomFactor = variance > 0 ?
            (1 - variance/100) + (Math.random() * 2 * variance/100) : 1;
        const amount = baseAmount.times(randomFactor);

        // Determine action (buy or sell)
        const action = determineAction(config);

        let result;
        if (action === 'buy') {
            result = await processBuy({
                amount,
                walletId: state.currentWalletId.toString(),
                tokenId: targetTokenId,
                isInitialBuy: false
            });
            if (result.success) {
                strategyStats.buys++;
                strategyStats.totalSpent += parseFloat(amount.toString());
            }
        } else if (action === 'sell') {
            // Get wallet holdings
            const wallet = getWalletById(state.currentWalletId);
            const holdings = wallet.getTokenBalance(targetTokenId);

            if (holdings.gt(0)) {
                // Sell a portion of holdings
                const sellAmount = amount.dividedBy(
                    state.tokens.find(t => t.id === targetTokenId)?.calculateTokenPriceUSD() || 1
                );
                const actualSellAmount = sellAmount.lt(holdings) ? sellAmount : holdings.times(0.5);

                result = await processSell({
                    tokenAmount: actualSellAmount,
                    walletId: state.currentWalletId.toString(),
                    tokenId: targetTokenId
                });

                if (result.success) {
                    strategyStats.sells++;
                    strategyStats.totalEarned += parseFloat(result.usdReceived || 0);
                }
            } else {
                result = { success: true }; // Skip if no holdings
            }
        }

        if (result && result.success) {
            strategyStats.currentTrade++;

            // Track price impact if available
            if (result.priceImpact) {
                strategyStats.totalImpact += parseFloat(result.priceImpact);
            }

            // Update UI
            updateStrategyUI();

            // Check if strategy is complete
            if (!config.continuousMode && strategyStats.currentTrade >= strategyStats.totalTrades) {
                stopStrategy();
                alert(`Strategy completed! ${strategyStats.currentTrade} trades executed.`);
                return;
            }

            // Calculate next interval with variance
            let nextInterval = parseFloat(config.interval) * 1000;
            const intervalVariance = parseFloat(config.intervalVariance) || 0;

            if (intervalVariance > 0) {
                const randomFactor = (1 - intervalVariance/100) +
                    (Math.random() * 2 * intervalVariance/100);
                nextInterval *= randomFactor;
            }

            // Schedule next execution
            strategyInterval = setTimeout(executeStrategyStep, nextInterval);
        } else {
            console.error('Strategy execution failed:', result?.error);
            // Continue anyway after a delay
            strategyInterval = setTimeout(executeStrategyStep, parseFloat(config.interval) * 1000);
        }
    } catch (error) {
        console.error('Error executing strategy:', error);
        // Continue execution instead of stopping
        strategyInterval = setTimeout(executeStrategyStep, parseFloat(config.interval) * 1000);
    }
}

/**
 * Get the target token based on selection mode
 */
function getTargetToken(config) {
    const mode = config.tokenSelectionMode || 'specific';

    console.log('getTargetToken called:', {
        mode,
        configTokenId: config.tokenId,
        totalTokens: state.tokens.length,
        tokenIds: state.tokens.map(t => t.id)
    });

    if (mode === 'specific') {
        console.log('Using specific mode, returning:', config.tokenId);
        return config.tokenId;
    }

    if (state.tokens.length === 0) {
        console.log('No tokens available');
        return null;
    }

    if (mode === 'random') {
        const randomIndex = Math.floor(Math.random() * state.tokens.length);
        const selectedToken = state.tokens[randomIndex];
        console.log('Random mode selected:', {
            randomIndex,
            selectedTokenId: selectedToken.id,
            selectedTokenName: selectedToken.name
        });
        return selectedToken.id;
    }

    if (mode === 'in-order') {
        const token = state.tokens[currentTokenIndex];
        console.log('In-order mode selected:', {
            currentIndex: currentTokenIndex,
            selectedTokenId: token.id,
            selectedTokenName: token.name
        });
        currentTokenIndex = (currentTokenIndex + 1) % state.tokens.length;
        return token.id;
    }

    if (mode === 'reverse') {
        const token = state.tokens[currentTokenIndex];
        console.log('Reverse mode selected:', {
            currentIndex: currentTokenIndex,
            selectedTokenId: token.id,
            selectedTokenName: token.name
        });
        currentTokenIndex = currentTokenIndex - 1;
        if (currentTokenIndex < 0) {
            currentTokenIndex = state.tokens.length - 1;
        }
        return token.id;
    }

    console.log('No mode matched, falling back to config.tokenId:', config.tokenId);
    return config.tokenId;
}

/**
 * Determine whether to buy or sell
 */
function determineAction(config) {
    const mode = config.tradingMode || 'buy-only';

    if (mode === 'buy-only') return 'buy';
    if (mode === 'sell-only') return 'sell';

    // For 'both' mode, randomly choose
    return Math.random() > 0.5 ? 'buy' : 'sell';
}

/**
 * Stop the active strategy
 */
export function stopStrategy() {
    if (strategyInterval) {
        clearTimeout(strategyInterval);
        strategyInterval = null;
    }

    activeStrategy = null;

    // Update UI
    updateStrategyUI();

    console.log('Strategy stopped');
}

/**
 * Check if a strategy is currently running
 */
export function isStrategyRunning() {
    return activeStrategy !== null;
}

/**
 * Get current strategy stats
 */
export function getStrategyStats() {
    return { ...strategyStats };
}

/**
 * Update the strategy UI
 */
function updateStrategyUI() {
    const statusEl = document.getElementById('strategyStatus');
    const statusText = document.getElementById('statusText');
    const activeInfo = document.getElementById('activeStrategyInfo');
    const startBtn = document.getElementById('startStrategyBtn');
    const stopBtn = document.getElementById('stopStrategyBtn');

    if (activeStrategy) {
        // Update status
        if (statusEl) {
            statusEl.classList.remove('inactive');
            statusEl.classList.add('active');
        }
        if (statusText) {
            statusText.textContent = 'Active';
        }

        // Show active info
        if (activeInfo) {
            activeInfo.classList.remove('hidden');
        }

        // Update progress
        const progress = document.getElementById('strategyProgress');
        const total = document.getElementById('strategyTotal');
        const progressBar = document.getElementById('strategyProgressBar');

        if (progress) progress.textContent = strategyStats.currentTrade;
        if (total) {
            total.textContent = activeStrategy.config.continuousMode ? '∞' : strategyStats.totalTrades;
        }

        if (progressBar && !activeStrategy.config.continuousMode) {
            const percentage = (strategyStats.currentTrade / strategyStats.totalTrades) * 100;
            progressBar.style.width = `${Math.min(percentage, 100)}%`;
        } else if (progressBar) {
            progressBar.style.width = '100%';
        }

        // Update stats
        const totalSpent = document.getElementById('strategyTotalSpent');
        const avgImpact = document.getElementById('strategyAvgImpact');
        const timeElapsed = document.getElementById('strategyTimeElapsed');

        if (totalSpent) {
            const netSpent = strategyStats.totalSpent - strategyStats.totalEarned;
            totalSpent.textContent = netSpent.toFixed(2);
        }

        if (avgImpact && strategyStats.currentTrade > 0) {
            const avg = strategyStats.totalImpact / strategyStats.currentTrade;
            avgImpact.textContent = avg.toFixed(2);
        }

        if (timeElapsed) {
            const elapsed = Math.floor((Date.now() - strategyStats.startTime) / 1000);
            timeElapsed.textContent = elapsed;
        }

        // Update buttons
        if (startBtn) startBtn.classList.add('hidden');
        if (stopBtn) stopBtn.classList.remove('hidden');
    } else {
        // Update status
        if (statusEl) {
            statusEl.classList.remove('active');
            statusEl.classList.add('inactive');
        }
        if (statusText) {
            statusText.textContent = 'Inactive';
        }

        // Hide active info
        if (activeInfo) {
            activeInfo.classList.add('hidden');
        }

        // Update buttons
        if (startBtn) startBtn.classList.remove('hidden');
        if (stopBtn) stopBtn.classList.add('hidden');
    }
}

/**
 * Initialize trading UI
 */
export function initializeTradingUI() {
    const startBtn = document.getElementById('startStrategyBtn');
    const stopBtn = document.getElementById('stopStrategyBtn');

    // Bind input listeners for live updates
    bindInputListeners();

    // Bind preset chip buttons
    bindPresetChips();

    // Update token select
    updateTokenSelect();

    // Bind token selection mode listener
    bindTokenSelectionModeListener();

    // Start button
    if (startBtn) {
        startBtn.addEventListener('click', async () => {
            const tokenSelectionMode = document.getElementById('tokenSelectionMode').value;
            const config = {
                tokenSelectionMode: tokenSelectionMode,
                tokenId: tokenSelectionMode === 'specific' ? parseInt(document.getElementById('strategyTargetToken').value) : null,
                tradingMode: document.getElementById('tradingMode').value,
                amount: parseFloat(document.getElementById('strategyAmount').value),
                amountVariance: parseFloat(document.getElementById('amountVariance').value),
                interval: parseFloat(document.getElementById('strategyInterval').value),
                intervalVariance: parseFloat(document.getElementById('intervalVariance').value),
                tradeCount: parseInt(document.getElementById('strategyTradeCount').value),
                continuousMode: document.getElementById('continuousMode').checked
            };

            console.log('Starting strategy with config:', config);

            const started = await startStrategy(config);
            if (!started) {
                console.error('Failed to start strategy');
            }
        });
    }

    // Stop button
    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to stop automated trading?')) {
                stopStrategy();
            }
        });
    }

    console.log('Trading UI initialized');
}

/**
 * Bind input listeners for live display updates
 */
function bindInputListeners() {
    // Amount display
    const amountInput = document.getElementById('strategyAmount');
    const amountDisplay = document.getElementById('amountDisplay');
    if (amountInput && amountDisplay) {
        amountInput.addEventListener('input', (e) => {
            amountDisplay.textContent = `$${e.target.value}`;
        });
    }

    // Amount variance display
    const varianceInput = document.getElementById('amountVariance');
    const varianceDisplay = document.getElementById('varianceDisplay');
    if (varianceInput && varianceDisplay) {
        varianceInput.addEventListener('input', (e) => {
            varianceDisplay.textContent = `±${e.target.value}%`;
        });
    }

    // Interval display
    const intervalInput = document.getElementById('strategyInterval');
    const intervalDisplay = document.getElementById('intervalDisplay');
    if (intervalInput && intervalDisplay) {
        intervalInput.addEventListener('input', (e) => {
            intervalDisplay.textContent = `${parseFloat(e.target.value).toFixed(1)}s`;
        });
    }

    // Interval variance display
    const intervalVarianceInput = document.getElementById('intervalVariance');
    const intervalVarianceDisplay = document.getElementById('intervalVarianceDisplay');
    if (intervalVarianceInput && intervalVarianceDisplay) {
        intervalVarianceInput.addEventListener('input', (e) => {
            intervalVarianceDisplay.textContent = `±${e.target.value}%`;
        });
    }

    // Trade count display
    const tradeCountInput = document.getElementById('strategyTradeCount');
    const tradeCountDisplay = document.getElementById('tradeCountDisplay');
    if (tradeCountInput && tradeCountDisplay) {
        tradeCountInput.addEventListener('input', (e) => {
            tradeCountDisplay.textContent = e.target.value;
        });
    }
}

/**
 * Bind preset chip buttons
 */
function bindPresetChips() {
    const presetChips = document.querySelectorAll('.preset-chip');
    presetChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            e.preventDefault();
            const target = chip.dataset.target;
            const value = chip.dataset.value;
            const input = document.getElementById(target);
            if (input) {
                input.value = value;
                // Trigger input event to update display
                input.dispatchEvent(new Event('input'));
            }
        });
    });
}

/**
 * Bind token selection mode listener
 */
function bindTokenSelectionModeListener() {
    const modeSelect = document.getElementById('tokenSelectionMode');
    const specificTokenGroup = document.getElementById('specificTokenGroup');

    if (modeSelect && specificTokenGroup) {
        const updateVisibility = () => {
            const mode = modeSelect.value;
            if (mode === 'specific') {
                specificTokenGroup.style.display = 'flex';
            } else {
                specificTokenGroup.style.display = 'none';
            }
        };

        // Initial update
        updateVisibility();

        // Listen for changes
        modeSelect.addEventListener('change', updateVisibility);
    }
}

/**
 * Update token select options
 */
export function updateTokenSelect() {
    const select = document.getElementById('strategyTargetToken');
    if (!select) return;

    // Save current selection
    const currentValue = select.value;

    // Clear and rebuild
    select.innerHTML = '<option value="">Select Token</option>';

    // Add tokens
    state.tokens.forEach(token => {
        const option = document.createElement('option');
        option.value = token.id;
        option.textContent = token.name || `Token ${token.id}`;
        select.appendChild(option);
    });

    // Restore selection if still valid
    if (currentValue && state.tokens.find(t => t.id === parseInt(currentValue))) {
        select.value = currentValue;
    }
}
