/**
 * @fileoverview Token class module for managing individual tokens and their operations
 */

import { state } from './state.js';
import { formatNumber, formatCurrency } from '../utils/formatters.js';

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
 * @typedef {Object} TokenOptions
 * @property {number} id - Token identifier
 * @property {Decimal} [initialSupply] - Initial token supply
 * @property {Decimal} [oppositeTokenPercentage] - Initial percentage for opposite token
 * @property {Decimal} [plsPercentage] - Initial PLS percentage
 */

/**
 * Class representing a token in the trading system
 */
export class Token {
    /**
     * Create a new Token instance
     * @param {TokenOptions} options - Token initialization options
     */
    constructor({ id, initialSupply, oppositeTokenPercentage, plsPercentage }) {
        try {
            const Decimal = getDecimal();

            if (!id || typeof id !== 'number') {
                throw new Error('Invalid token ID');
            }

            this.id = id;
            this.name = `Token ${id}`; // Default name
            this.amountProcessed = new Decimal(0);
            this.plsBalance = new Decimal('1000000'); // Start each token with 1,000,000 WPLS
            this.oppositeTokenPercentage = new Decimal(oppositeTokenPercentage || 0);
            this.plsPercentage = new Decimal(plsPercentage || 0);
            this.selectedOppositeToken = null;

            // Token Supply Management
            this.totalSupply = new Decimal(initialSupply || '1000000');
            this.totalLiquidity = new Decimal('0');

            // AMM Configuration
            this.pairType = 'USD';  // 'USD', 'WPLS', or 'TOKEN'
            this.pairedTokenId = null;  // ID of paired token if pairType === 'TOKEN'

            // AMM Reserves
            this.tokenReserve = new Decimal(0);  // This token's reserve in pool
            this.pairReserve = new Decimal('0');  // Paired asset reserve (WPLS or other token)

            // Liquidity Provider tracking
            this.lpTotalSupply = new Decimal('0');  // Total LP tokens issued
            this.k = new Decimal('0');  // Constant product invariant (x * y = k)

            // Price caching
            this.cachedUSDPrice = new Decimal('0');
            this.priceLastUpdated = 0;

            // Capital tracking (real vs derived liquidity)
            this.liquidityDepth = Infinity;  // Hops from WPLS (0=WPLS, 1=token paired with WPLS, etc.)
            this.realCapital = new Decimal('0');  // Actual WPLS deposited
            this.derivedCapital = new Decimal('0');  // Value from token pairs

            this.isLiquidityExpanded = false;
            this.element = this.createTokenElement();

            console.log(`Token ${id} created successfully with AMM support`);
        } catch (error) {
            console.error('Error creating token:', error);
            throw error;
        }
    }

    /**
     * Calculate the token price in USD using AMM reserves and price chains
     * @param {Set<number>} visited - Set of visited token IDs to prevent circular loops
     * @returns {Decimal} Calculated token price in USD
     */
    calculateTokenPriceUSD(visited = new Set()) {
        const Decimal = getDecimal();

        // Prevent infinite loops in circular pairs
        if (visited.has(this.id)) {
            console.warn(`Circular price dependency detected for token ${this.id}`);
            return new Decimal('0');
        }

        visited.add(this.id);

        // Use cached price if recent (< 1 second old)
        const now = Date.now();
        if (now - this.priceLastUpdated < 1000 && !this.cachedUSDPrice.isZero()) {
            return this.cachedUSDPrice;
        }

        // If no liquidity, return 0
        if (this.pairReserve.isZero() || this.tokenReserve.isZero()) {
            this.cachedUSDPrice = new Decimal('0');
            this.priceLastUpdated = now;
            return this.cachedUSDPrice;
        }

        // Calculate price in terms of pair asset
        const priceInPairAsset = this.pairReserve.dividedBy(this.tokenReserve);

        // Convert to USD based on pair type
        let usdPrice;
        if (this.pairType === 'USD') {
            // Direct USD pairing - price is already in USD
            usdPrice = priceInPairAsset;
        } else if (this.pairType === 'WPLS') {
            // Price = (PLS in pool / Tokens in pool) × WPLS_USD_price
            usdPrice = priceInPairAsset.times(state.plsPrice);
        } else {
            // TOKEN pairing: Price = (PairToken in pool / Tokens in pool) × PairToken_USD_price
            const pairedToken = state.tokens.find(t => t.id === this.pairedTokenId);
            if (!pairedToken) {
                usdPrice = new Decimal('0');
            } else {
                // Recursive price calculation through the chain
                const pairTokenUSDPrice = pairedToken.calculateTokenPriceUSD(visited);
                usdPrice = priceInPairAsset.times(pairTokenUSDPrice);
            }
        }

        // Cache the price
        this.cachedUSDPrice = usdPrice;
        this.priceLastUpdated = now;

        return usdPrice;
    }

    /**
     * Calculate the token price (legacy method for backward compatibility)
     * @returns {Decimal} Calculated token price in USD
     */
    calculateTokenPrice() {
        return this.calculateTokenPriceUSD();
    }

    /**
     * Add liquidity to the AMM pool (dual-sided)
     * @param {string|number|Decimal} tokenAmount - Amount of this token to add
     * @param {string|number|Decimal} pairAmount - Amount of pair asset to add
     * @returns {boolean} Success status of the operation
     */
    addLiquidity(tokenAmount, pairAmount) {
        const Decimal = getDecimal();
        const tokenToAdd = new Decimal(tokenAmount);
        const pairToAdd = new Decimal(pairAmount);

        // Validate inputs
        if (tokenToAdd.lte(0) || pairToAdd.lte(0)) {
            alert('Both amounts must be greater than 0');
            return false;
        }

        // Check available supply
        const availableSupply = this.totalSupply.minus(this.tokenReserve);
        if (tokenToAdd.gt(availableSupply)) {
            alert(`Insufficient token supply!\nAvailable: ${availableSupply.toString()}\nTrying to add: ${tokenToAdd.toString()}\nTotal Supply: ${this.totalSupply.toString()}\nAlready in pool: ${this.tokenReserve.toString()}`);
            return false;
        }

        // Check if this is initial liquidity
        const isInitialLiquidity = this.pairReserve.isZero() && this.tokenReserve.isZero();

        if (!isInitialLiquidity) {
            // For subsequent liquidity additions, maintain price ratio
            const currentRatio = this.pairReserve.dividedBy(this.tokenReserve);
            const providedRatio = pairToAdd.dividedBy(tokenToAdd);

            // Allow 0.1% tolerance for ratio matching
            const tolerance = new Decimal('0.001');
            const ratioDiff = currentRatio.minus(providedRatio).abs().dividedBy(currentRatio);

            if (ratioDiff.gt(tolerance)) {
                alert(`Amounts must maintain current pool ratio.\nCurrent ratio: 1 Token = ${formatNumber(currentRatio, 0)} ${this.pairType === 'WPLS' ? 'WPLS' : 'Pair Token'}\nYour ratio: 1 Token = ${formatNumber(providedRatio, 0)}`);
                return false;
            }
        }

        // For WPLS pairs, check PLS balance
        if (this.pairType === 'WPLS') {
            if (pairToAdd.gt(this.plsBalance)) {
                alert('Insufficient PLS balance in contract');
                return false;
            }
            this.plsBalance = this.plsBalance.minus(pairToAdd);
        } else if (this.pairType === 'TOKEN') {
            // For token pairs, verify paired token exists and has sufficient supply
            const pairedToken = state.tokens.find(t => t.id === this.pairedTokenId);
            if (!pairedToken) {
                alert('Paired token not found');
                return false;
            }

            // Check if paired token has enough available supply
            const pairedTokenAvailable = pairedToken.getAvailableSupply();
            if (pairToAdd.gt(pairedTokenAvailable)) {
                alert(`Insufficient ${pairedToken.name || 'paired token'} supply!\n` +
                      `Available: ${pairedTokenAvailable.toString()}\n` +
                      `Trying to use: ${pairToAdd.toString()}\n` +
                      `Total Supply: ${pairedToken.totalSupply.toString()}\n` +
                      `In own pool: ${pairedToken.tokenReserve.toString()}\n` +
                      `Locked in other pools: ${pairedToken.getTokensLockedInOtherPools().toString()}`);
                return false;
            }

            // Supply is tracked in paired token's available supply calculation
            // No need to deduct here - getAvailableSupply() will account for it
        }

        // Calculate LP tokens to mint
        let lpTokensToMint;
        if (isInitialLiquidity) {
            // Initial liquidity: LP tokens = sqrt(tokenAmount * pairAmount)
            lpTokensToMint = tokenToAdd.times(pairToAdd).sqrt();
        } else {
            // Subsequent: LP tokens proportional to existing pool
            const tokenShare = tokenToAdd.dividedBy(this.tokenReserve);
            lpTokensToMint = this.lpTotalSupply.times(tokenShare);
        }

        // Update reserves
        this.tokenReserve = this.tokenReserve.plus(tokenToAdd);
        this.pairReserve = this.pairReserve.plus(pairToAdd);

        // Update LP supply
        this.lpTotalSupply = this.lpTotalSupply.plus(lpTokensToMint);

        // Update invariant
        this.k = this.tokenReserve.times(this.pairReserve);

        // Update legacy property for backward compatibility
        this.totalLiquidity = this.pairReserve;

        // Update capital tracking
        this.updateCapitalTracking();

        // Update displays
        this.updateDisplay();
        this.updateLiquidityDisplay();

        // Invalidate price cache
        this.priceLastUpdated = 0;

        console.log('Liquidity added:', {
            tokenId: this.id,
            tokenAdded: tokenToAdd.toString(),
            pairAdded: pairToAdd.toString(),
            lpMinted: lpTokensToMint.toString(),
            newK: this.k.toString(),
            newPrice: this.calculateTokenPriceUSD().toString(),
            liquidityDepth: this.liquidityDepth,
            realCapital: this.realCapital.toString(),
            derivedCapital: this.derivedCapital.toString()
        });

        return true;
    }

    /**
     * Calculate output amount for AMM swap using constant product formula
     * @param {Decimal} inputAmount - Amount of input asset
     * @param {Decimal} inputReserve - Reserve of input asset
     * @param {Decimal} outputReserve - Reserve of output asset
     * @param {number} feePercent - Fee percentage (default 0.3%)
     * @returns {Decimal} Output amount
     */
    calculateSwapOutput(inputAmount, inputReserve, outputReserve, feePercent = 0.3) {
        const Decimal = getDecimal();
        const input = new Decimal(inputAmount);

        // Apply fee (0.3% default)
        const fee = new Decimal(feePercent).dividedBy(100);
        const inputWithFee = input.times(new Decimal('1').minus(fee));

        // Constant product formula: (x + Δx) * (y - Δy) = k
        // Δy = (y * Δx) / (x + Δx)
        const output = outputReserve.times(inputWithFee).dividedBy(
            inputReserve.plus(inputWithFee)
        );

        return output;
    }

    /**
     * Execute AMM buy (buy this token with pair asset)
     * @param {Decimal} pairAmountIn - Amount of pair asset to spend
     * @returns {Object} Result with success, tokensReceived, priceImpact, newPrice
     */
    executeBuy(pairAmountIn) {
        const Decimal = getDecimal();
        const amountIn = new Decimal(pairAmountIn);

        if (amountIn.lte(0)) {
            return { success: false, error: 'Amount must be positive' };
        }

        if (this.pairReserve.isZero() || this.tokenReserve.isZero()) {
            return { success: false, error: 'No liquidity in pool' };
        }

        let tokenOut;
        let priceImpact;

        if (state.applySlippage) {
            // Realistic mode: Use constant product formula (slippage based on liquidity)
            tokenOut = this.calculateSwapOutput(
                amountIn,
                this.pairReserve,
                this.tokenReserve
            );

            if (tokenOut.gte(this.tokenReserve)) {
                return { success: false, error: 'Insufficient liquidity for this trade' };
            }

            // Calculate actual price impact
            priceImpact = this.calculatePriceImpact(amountIn, tokenOut);
        } else {
            // Ideal mode: No slippage, execute at current price
            const currentPrice = this.pairReserve.dividedBy(this.tokenReserve);
            tokenOut = amountIn.dividedBy(currentPrice);

            if (tokenOut.gte(this.tokenReserve)) {
                return { success: false, error: 'Insufficient liquidity for this trade' };
            }

            // No price impact in ideal mode
            priceImpact = new Decimal(0);
        }

        // Update reserves
        this.pairReserve = this.pairReserve.plus(amountIn);
        this.tokenReserve = this.tokenReserve.minus(tokenOut);

        // Update invariant
        this.k = this.tokenReserve.times(this.pairReserve);

        // Update legacy property
        this.totalLiquidity = this.pairReserve;

        // Invalidate price cache
        this.priceLastUpdated = 0;

        // Update display
        this.updateDisplay();
        this.updateLiquidityDisplay();

        return {
            success: true,
            tokensReceived: tokenOut,
            priceImpact: priceImpact,
            slippageApplied: state.applySlippage,
            newPrice: this.calculateTokenPriceUSD()
        };
    }

    /**
     * Calculate price impact percentage for a trade
     * @param {Decimal} amountIn - Amount of pair asset being traded
     * @param {Decimal} amountOut - Amount of tokens being received
     * @returns {Decimal} Price impact as a percentage
     */
    calculatePriceImpact(amountIn, amountOut) {
        const Decimal = getDecimal();

        // Price before = pairReserve / tokenReserve
        const priceBefore = this.pairReserve.dividedBy(this.tokenReserve);

        // Price after = (pairReserve + amountIn) / (tokenReserve - amountOut)
        const priceAfter = this.pairReserve.plus(amountIn).dividedBy(
            this.tokenReserve.minus(amountOut)
        );

        // Impact = (priceAfter - priceBefore) / priceBefore * 100
        const impact = priceAfter.minus(priceBefore).dividedBy(priceBefore).times(100);

        return impact;
    }

    /**
     * Update capital tracking (real vs derived)
     * Calculates liquidity depth and capital sources
     */
    updateCapitalTracking() {
        const Decimal = getDecimal();

        // Import capital tracking functions dynamically
        import('./capitalTracking.js').then(module => {
            this.liquidityDepth = module.calculateLiquidityDepth(this);
            this.realCapital = module.calculateRealCapital(this);
            this.derivedCapital = module.calculateDerivedCapital(this);
        });
    }

    /**
     * Get tokens locked in other pools where this token is the pair asset
     * @returns {Decimal} Tokens locked in other pools
     */
    getTokensLockedInOtherPools() {
        const Decimal = getDecimal();
        let lockedAmount = new Decimal(0);

        // Check all tokens to see if they're paired with this token
        state.tokens.forEach(otherToken => {
            if (otherToken.id !== this.id &&
                otherToken.pairType === 'TOKEN' &&
                otherToken.pairedTokenId === this.id) {
                // This token is being used as pair asset in otherToken's pool
                lockedAmount = lockedAmount.plus(otherToken.pairReserve);
            }
        });

        return lockedAmount;
    }

    /**
     * Get available token supply (total supply - tokens in pools)
     * Accounts for tokens in own pool AND tokens used as pair asset in other pools
     * @returns {Decimal} Available supply
     */
    getAvailableSupply() {
        const tokensInOwnPool = this.tokenReserve;
        const tokensInOtherPools = this.getTokensLockedInOtherPools();
        return this.totalSupply.minus(tokensInOwnPool).minus(tokensInOtherPools);
    }

    /**
     * Update total supply (can only increase, not decrease below allocated amount)
     * @param {number|string|Decimal} newSupply - New total supply
     * @returns {boolean} Success
     */
    updateTotalSupply(newSupply) {
        const Decimal = getDecimal();
        const supply = new Decimal(newSupply);

        if (supply.lt(this.tokenReserve)) {
            alert(`Cannot set total supply below tokens already in pool (${this.tokenReserve.toString()})`);
            return false;
        }

        this.totalSupply = supply;
        this.updateLiquidityDisplay();
        return true;
    }

    /**
     * Generate options for opposite token selection
     * @returns {string} HTML string of option elements
     */
    generateOppositeTokenOptions() {
        let options = '<option value="">Select Token</option>';
        state.tokens
            .filter(token => token.id !== this.id)
            .forEach(token => {
                options += `<option value="${token.id}">${token.name}</option>`;
            });
        return options;
    }

    /**
     * Generate options for pair selection (includes tokens)
     * @returns {string} HTML string of option elements
     */
    generatePairTokenOptions() {
        let options = '';
        state.tokens
            .filter(token => token.id !== this.id)
            .forEach(token => {
                options += `<option value="TOKEN:${token.id}">${token.name}</option>`;
            });
        return options;
    }

    /**
     * Update token name in all dropdowns across all tokens
     */
    updateTokenNameInDropdowns() {
        // Update all tokens' dropdowns
        state.tokens.forEach(token => {
            if (token.id !== this.id) {
                token.updateOppositeTokenOptions();
            }
        });
    }

    /**
     * Create the token's DOM element
     * @returns {HTMLElement} The created token element
     */
    createTokenElement() {
        const tokenBox = document.createElement('div');
        tokenBox.className = 'token-box';
        
        const template = `
            <div class="token-header">
                <input type="text" class="token-name-input" value="${this.name}" placeholder="Token Name">
            </div>

            <!-- Summary Stats (Always Visible) -->
            <div class="token-summary">
                <div class="summary-item">
                    <span class="summary-label">Processed:</span>
                    <span class="amount-processed">$0.00</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">PLS Balance:</span>
                    <span class="pls-balance">0.000000</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Available Supply:</span>
                    <span class="available-supply">${this.totalSupply.toString()}</span>
                </div>
            </div>

            <!-- Supply Management Section -->
            <div class="config-section">
                <button class="section-toggle supply-toggle">
                    <span>⚙️ Supply & Settings</span>
                    <svg class="chevron-icon" viewBox="0 0 24 24" width="16" height="16">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" fill="none" stroke-width="2"/>
                    </svg>
                </button>
                <div class="section-content hidden">
                    <div>
                        <label>Total Supply:</label>
                        <input type="number" class="total-supply-input" value="${this.totalSupply.toString()}" min="0" step="1">
                    </div>
                    <div>
                        <label>% to Next Token:</label>
                        <input type="number" class="opposite-token-percentage" min="0" max="100" value="0">
                    </div>
                    <div>
                        <label>% to PLS for Next Contract:</label>
                        <input type="number" class="pls-percentage" min="0" max="100" value="0">
                    </div>
                    <div>
                        <label>Buy Token:</label>
                        <select class="opposite-token">
                            ${this.generateOppositeTokenOptions()}
                        </select>
                    </div>
                </div>
            </div>

            <div class="liquidity-header">
                <button class="liquidity-toggle">
                    <span>Liquidity</span>
                    <svg class="chevron-icon" viewBox="0 0 24 24" width="16" height="16">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" fill="none" stroke-width="2"/>
                    </svg>
                </button>
            </div>
            <div class="liquidity-content hidden">
                <div class="liquidity-section">
                    <!-- Pair Selection -->
                    <div class="liquidity-card">
                        <h4>Pair With</h4>
                        <select class="pair-select">
                            <option value="USD" selected>USD (Direct)</option>
                            <option value="WPLS">WPLS</option>
                            ${this.generatePairTokenOptions()}
                        </select>
                    </div>

                    <!-- Dual-sided Liquidity Input -->
                    <div class="liquidity-card">
                        <h4>Add Liquidity</h4>
                        <div class="liquidity-presets">
                            <button class="preset-btn preset-50" title="Use 50% of available supply">50% Supply</button>
                            <button class="preset-btn preset-100" title="Use 100% of available supply">100% Supply</button>
                            <button class="preset-btn preset-custom" title="Custom amounts">Custom</button>
                        </div>
                        <div class="dual-liquidity-inputs">
                            <div class="liquidity-input-row">
                                <label>${this.name} Amount:</label>
                                <input type="number" class="token-amount-input" value="0" min="0" step="0.000001" placeholder="0.0">
                            </div>
                            <div class="liquidity-input-row">
                                <label class="pair-label">USD Amount:</label>
                                <input type="number" class="pair-amount-input" value="0" min="0" step="0.01" placeholder="0.0">
                            </div>
                            <div class="current-ratio">
                                Current Ratio: <span class="ratio-display">No liquidity yet</span>
                            </div>
                            <button class="add-liquidity-btn">Add Liquidity</button>
                        </div>
                    </div>

                    <!-- Pool Information -->
                    <div class="liquidity-card">
                        <h4>Pool Reserves</h4>
                        <div class="pool-info">
                            <div><span>Token Reserve:</span> <span class="token-reserve-display">0</span></div>
                            <div><span>Pair Reserve:</span> <span class="pair-reserve-display">0</span></div>
                            <div><span>K Constant:</span> <span class="k-display">0</span></div>
                        </div>
                    </div>

                    <!-- Price Information -->
                    <div class="liquidity-card">
                        <h4>Price Information</h4>
                        <div class="price-info">
                            <div><span>Price in Pair:</span> <span class="pair-price-display">0</span></div>
                            <div><span>Price in USD:</span> <span class="usd-price-display">$0.00</span></div>
                            <div><span>LP Tokens:</span> <span class="lp-supply-display">0</span></div>
                        </div>
                    </div>

                    <!-- Capital Tracking -->
                    <div class="liquidity-card capital-tracking-card">
                        <h4>Capital Analysis</h4>
                        <div class="capital-info">
                            <div class="capital-depth">
                                <span>Liquidity Depth:</span>
                                <span class="depth-badge depth-display">Not Set</span>
                            </div>
                            <div><span>Real Capital:</span> <span class="real-capital-display">$0.00</span></div>
                            <div><span>Derived Capital:</span> <span class="derived-capital-display">$0.00</span></div>
                            <div class="capital-bar-container">
                                <div class="capital-bar">
                                    <div class="capital-bar-real" style="width: 0%"></div>
                                    <div class="capital-bar-derived" style="width: 0%"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        tokenBox.innerHTML = template;
        this.setupTokenEventListeners(tokenBox);
        this.setupCollapsibleSections(tokenBox);
        return tokenBox;
    }

    /**
     * Set up collapsible section toggles
     * @param {HTMLElement} tokenBox - The token's container element
     */
    setupCollapsibleSections(tokenBox) {
        // Supply section toggle
        const supplyToggle = tokenBox.querySelector('.supply-toggle');
        const supplyContent = supplyToggle?.nextElementSibling;

        if (supplyToggle && supplyContent) {
            supplyToggle.addEventListener('click', (e) => {
                e.preventDefault();
                supplyContent.classList.toggle('hidden');
                supplyToggle.classList.toggle('expanded');
            });
        }

        // Liquidity section toggle
        const liquidityToggle = tokenBox.querySelector('.liquidity-toggle');
        const liquidityContent = tokenBox.querySelector('.liquidity-content');

        if (liquidityToggle && liquidityContent) {
            liquidityToggle.addEventListener('click', (e) => {
                e.preventDefault();
                this.isLiquidityExpanded = !this.isLiquidityExpanded;
                liquidityContent.classList.toggle('hidden');
                liquidityToggle.classList.toggle('expanded');
            });
        }
    }

    /**
     * Set up event listeners for token controls
     * @param {HTMLElement} tokenBox - The token's container element
     */
    setupTokenEventListeners(tokenBox) {
        const Decimal = getDecimal();
        const tokenNameInput = tokenBox.querySelector('.token-name-input');
        const oppositeTokenPercentageInput = tokenBox.querySelector('.opposite-token-percentage');
        const plsPercentageInput = tokenBox.querySelector('.pls-percentage');
        const oppositeTokenSelect = tokenBox.querySelector('.opposite-token');
        const totalSupplyInput = tokenBox.querySelector('.total-supply-input');

        // AMM-specific selectors
        const pairSelect = tokenBox.querySelector('.pair-select');
        const pairLabel = tokenBox.querySelector('.pair-label');
        const tokenAmountInput = tokenBox.querySelector('.token-amount-input');
        const pairAmountInput = tokenBox.querySelector('.pair-amount-input');
        const addLiquidityBtn = tokenBox.querySelector('.add-liquidity-btn');

        // Token name input
        if (tokenNameInput) {
            tokenNameInput.addEventListener('change', (e) => {
                const newName = e.target.value.trim();
                if (newName) {
                    this.name = newName;
                    // Update all token references in dropdowns
                    this.updateTokenNameInDropdowns();
                    // Update liquidity labels for tokens paired with this one
                    state.tokens.forEach(token => {
                        if (token.pairType === 'TOKEN' && token.pairedTokenId === this.id) {
                            token.updateLiquidityDisplay();
                        }
                    });
                    // Update this token's own display
                    this.updateLiquidityDisplay();
                } else {
                    // Restore default name if empty
                    this.name = `Token ${this.id}`;
                    e.target.value = this.name;
                }
            });
        }

        if (oppositeTokenPercentageInput) {
            oppositeTokenPercentageInput.addEventListener('change', (e) => {
                this.oppositeTokenPercentage = new Decimal(e.target.value);
            });
        }

        if (plsPercentageInput) {
            plsPercentageInput.addEventListener('change', (e) => {
                this.plsPercentage = new Decimal(e.target.value);
            });
        }

        if (oppositeTokenSelect) {
            oppositeTokenSelect.addEventListener('change', (e) => {
                this.selectedOppositeToken = parseInt(e.target.value);
            });
        }

        // Total supply input
        if (totalSupplyInput) {
            totalSupplyInput.addEventListener('change', (e) => {
                const newSupply = e.target.value;
                if (newSupply && parseFloat(newSupply) > 0) {
                    this.updateTotalSupply(newSupply);
                }
            });
        }

        // Pair selection (combined USD/WPLS/Token dropdown)
        if (pairSelect) {
            pairSelect.addEventListener('change', (e) => {
                const value = e.target.value;

                if (value.startsWith('TOKEN:')) {
                    // Token pairing
                    this.pairType = 'TOKEN';
                    const tokenId = parseInt(value.split(':')[1]);
                    this.pairedTokenId = tokenId;

                    // Get the paired token's name
                    const pairedToken = state.tokens.find(t => t.id === tokenId);
                    const pairedTokenName = pairedToken ? pairedToken.name : `Token ${tokenId}`;
                    if (pairLabel) pairLabel.textContent = `${pairedTokenName} Amount:`;
                } else if (value === 'USD') {
                    // USD pairing
                    this.pairType = 'USD';
                    this.pairedTokenId = null;
                    if (pairLabel) pairLabel.textContent = 'USD Amount:';
                } else if (value === 'WPLS') {
                    // WPLS pairing
                    this.pairType = 'WPLS';
                    this.pairedTokenId = null;
                    if (pairLabel) pairLabel.textContent = 'WPLS Amount:';
                }

                this.updateLiquidityDisplay();
            });
        }

        // Token amount input - auto-calculate pair amount to maintain ratio
        if (tokenAmountInput) {
            tokenAmountInput.addEventListener('input', (e) => {
                if (!this.pairReserve.isZero() && !this.tokenReserve.isZero()) {
                    // Auto-calculate pair amount to maintain ratio
                    const tokenAmount = new Decimal(e.target.value || 0);
                    const ratio = this.pairReserve.dividedBy(this.tokenReserve);
                    const calculatedPairAmount = tokenAmount.times(ratio);

                    if (pairAmountInput) {
                        pairAmountInput.value = calculatedPairAmount.toNumber();
                    }
                }
            });
        }

        // Pair amount input - auto-calculate token amount to maintain ratio
        if (pairAmountInput) {
            pairAmountInput.addEventListener('input', (e) => {
                if (!this.pairReserve.isZero() && !this.tokenReserve.isZero()) {
                    // Auto-calculate token amount to maintain ratio
                    const pairAmount = new Decimal(e.target.value || 0);
                    const ratio = this.tokenReserve.dividedBy(this.pairReserve);
                    const calculatedTokenAmount = pairAmount.times(ratio);

                    if (tokenAmountInput) {
                        tokenAmountInput.value = calculatedTokenAmount.toNumber();
                    }
                }
            });
        }

        // Add liquidity button
        if (addLiquidityBtn) {
            addLiquidityBtn.addEventListener('click', () => {
                const tokenAmount = tokenAmountInput?.value || 0;
                const pairAmount = pairAmountInput?.value || 0;

                if (this.addLiquidity(tokenAmount, pairAmount)) {
                    // Clear inputs on success
                    if (tokenAmountInput) tokenAmountInput.value = '0';
                    if (pairAmountInput) pairAmountInput.value = '0';
                }
            });
        }

        // Preset buttons
        const preset50Btn = tokenBox.querySelector('.preset-50');
        const preset100Btn = tokenBox.querySelector('.preset-100');
        const presetCustomBtn = tokenBox.querySelector('.preset-custom');

        if (preset50Btn) {
            preset50Btn.addEventListener('click', () => {
                this.applyLiquidityPreset(50, tokenAmountInput, pairAmountInput);
            });
        }

        if (preset100Btn) {
            preset100Btn.addEventListener('click', () => {
                this.applyLiquidityPreset(100, tokenAmountInput, pairAmountInput);
            });
        }

        if (presetCustomBtn) {
            presetCustomBtn.addEventListener('click', () => {
                // Just focus the token amount input for manual entry
                if (tokenAmountInput) {
                    tokenAmountInput.focus();
                }
            });
        }
    }

    /**
     * Apply a liquidity preset (50% or 100% of available supply)
     * @param {number} percentage - Percentage of available supply to use
     * @param {HTMLInputElement} tokenInput - Token amount input element
     * @param {HTMLInputElement} pairInput - Pair amount input element
     */
    applyLiquidityPreset(percentage, tokenInput, pairInput) {
        const Decimal = getDecimal();
        const availableSupply = this.getAvailableSupply();

        if (availableSupply.isZero()) {
            alert('No available supply to add to liquidity pool');
            return;
        }

        // Calculate token amount based on percentage
        const tokenAmount = availableSupply.times(percentage).dividedBy(100);

        // Set token amount
        if (tokenInput) {
            tokenInput.value = tokenAmount.toString();
        }

        // For initial liquidity, suggest a reasonable USD amount based on token amount
        if (this.pairReserve.isZero() && this.tokenReserve.isZero()) {
            // Initial liquidity: suggest $1 per 1000 tokens as a starting point
            const suggestedPairAmount = tokenAmount.dividedBy(1000);
            if (pairInput) {
                if (this.pairType === 'USD') {
                    pairInput.value = suggestedPairAmount.toNumber();
                } else if (this.pairType === 'WPLS') {
                    // Convert USD to PLS
                    const plsAmount = suggestedPairAmount.dividedBy(state.plsPrice);
                    pairInput.value = plsAmount.toNumber();
                } else if (this.pairType === 'TOKEN' && this.pairedTokenId) {
                    // Suggest using proportional amount from paired token
                    const pairedToken = state.tokens.find(t => t.id === this.pairedTokenId);
                    if (pairedToken) {
                        const pairedAvailable = pairedToken.getAvailableSupply();
                        const pairedAmount = pairedAvailable.times(percentage).dividedBy(100);
                        pairInput.value = pairedAmount.toNumber();
                    }
                }
            }
        } else {
            // Subsequent liquidity: calculate to maintain ratio
            const ratio = this.pairReserve.dividedBy(this.tokenReserve);
            const pairAmount = tokenAmount.times(ratio);
            if (pairInput) {
                pairInput.value = pairAmount.toNumber();
            }
        }
    }

    /**
     * Update opposite token selection options
     */
    updateOppositeTokenOptions() {
        const select = this.element.querySelector('.opposite-token');
        if (select) {
            select.innerHTML = this.generateOppositeTokenOptions();
        }

        // Also update pair selection dropdown
        const pairSelect = this.element.querySelector('.pair-select');
        if (pairSelect) {
            const currentValue = pairSelect.value;
            const usdOption = '<option value="USD">USD (Direct)</option>';
            const wplsOption = '<option value="WPLS">WPLS</option>';
            pairSelect.innerHTML = usdOption + wplsOption + this.generatePairTokenOptions();

            // Restore selection if it still exists
            if (currentValue && Array.from(pairSelect.options).some(opt => opt.value === currentValue)) {
                pairSelect.value = currentValue;
            }
        }
    }

    /**
     * Update liquidity display information
     */
    updateLiquidityDisplay() {
        const Decimal = getDecimal();

        // Update token amount label with current name
        const tokenAmountLabels = this.element.querySelectorAll('.liquidity-input-row label');
        if (tokenAmountLabels.length > 0) {
            tokenAmountLabels[0].textContent = `${this.name} Amount:`;
        }

        // Update pair amount label based on pair type
        if (tokenAmountLabels.length > 1) {
            let pairLabelText = 'USD Amount:';
            if (this.pairType === 'WPLS') {
                pairLabelText = 'WPLS Amount:';
            } else if (this.pairType === 'TOKEN' && this.pairedTokenId) {
                const pairedToken = state.tokens.find(t => t.id === this.pairedTokenId);
                const pairedTokenName = pairedToken ? pairedToken.name : `Token ${this.pairedTokenId}`;
                pairLabelText = `${pairedTokenName} Amount:`;
            }
            tokenAmountLabels[1].textContent = pairLabelText;
        }

        // Update reserves
        const tokenReserveDisplay = this.element.querySelector('.token-reserve-display');
        const pairReserveDisplay = this.element.querySelector('.pair-reserve-display');
        const kDisplay = this.element.querySelector('.k-display');

        if (tokenReserveDisplay) {
            tokenReserveDisplay.textContent = formatNumber(this.tokenReserve, 0);
        }
        if (pairReserveDisplay) {
            pairReserveDisplay.textContent = formatNumber(this.pairReserve, 0);
        }
        if (kDisplay) {
            kDisplay.textContent = formatNumber(this.k, 0);
        }

        // Update ratio
        const ratioDisplay = this.element.querySelector('.ratio-display');
        if (ratioDisplay) {
            if (this.tokenReserve.isZero() || this.pairReserve.isZero()) {
                ratioDisplay.textContent = 'No liquidity yet';
            } else {
                const ratio = this.pairReserve.dividedBy(this.tokenReserve);
                let pairName = 'USD';
                if (this.pairType === 'WPLS') {
                    pairName = 'WPLS';
                } else if (this.pairType === 'TOKEN' && this.pairedTokenId) {
                    const pairedToken = state.tokens.find(t => t.id === this.pairedTokenId);
                    pairName = pairedToken ? pairedToken.name : `Token ${this.pairedTokenId}`;
                }
                ratioDisplay.textContent = `1 ${this.name} = ${formatNumber(ratio, 0)} ${pairName}`;
            }
        }

        // Update prices
        const pairPriceDisplay = this.element.querySelector('.pair-price-display');
        const usdPriceDisplay = this.element.querySelector('.usd-price-display');

        if (pairPriceDisplay) {
            if (!this.pairReserve.isZero() && !this.tokenReserve.isZero()) {
                const pairPrice = this.pairReserve.dividedBy(this.tokenReserve);
                pairPriceDisplay.textContent = formatNumber(pairPrice, 0);
            } else {
                pairPriceDisplay.textContent = '0';
            }
        }

        if (usdPriceDisplay) {
            const usdPrice = this.calculateTokenPriceUSD();
            usdPriceDisplay.textContent = formatCurrency(usdPrice, '$', 0);
        }

        // Update LP supply
        const lpSupplyDisplay = this.element.querySelector('.lp-supply-display');
        if (lpSupplyDisplay) {
            lpSupplyDisplay.textContent = formatNumber(this.lpTotalSupply, 0);
        }

        // Update available supply
        const availableSupplyDisplay = this.element.querySelector('.available-supply');
        if (availableSupplyDisplay) {
            const available = this.getAvailableSupply();
            availableSupplyDisplay.textContent = formatNumber(available, 0);
        }

        // Update capital tracking displays
        this.updateCapitalDisplay();

        console.log('AMM Display updated:', {
            tokenId: this.id,
            tokenReserve: this.tokenReserve.toString(),
            pairReserve: this.pairReserve.toString(),
            k: this.k.toString(),
            usdPrice: this.calculateTokenPriceUSD().toString(),
            availableSupply: this.getAvailableSupply().toString(),
            liquidityDepth: this.liquidityDepth,
            realCapital: this.realCapital.toString(),
            derivedCapital: this.derivedCapital.toString()
        });
    }

    /**
     * Update capital tracking display
     */
    updateCapitalDisplay() {
        const Decimal = getDecimal();

        // Import and use capital tracking functions
        import('./capitalTracking.js').then(module => {
            // Update depth
            this.liquidityDepth = module.calculateLiquidityDepth(this);
            this.realCapital = module.calculateRealCapital(this);
            this.derivedCapital = module.calculateDerivedCapital(this);

            const depthDisplay = this.element.querySelector('.depth-display');
            if (depthDisplay) {
                const depthLabel = module.getDepthLabel(this.liquidityDepth);
                const depthColor = module.getDepthColor(this.liquidityDepth);
                depthDisplay.textContent = depthLabel;
                depthDisplay.style.backgroundColor = depthColor;
                depthDisplay.style.color = 'white';
                depthDisplay.style.padding = '4px 8px';
                depthDisplay.style.borderRadius = '4px';
                depthDisplay.style.fontSize = '0.85em';
                depthDisplay.style.fontWeight = '600';
            }

            // Update real capital
            const realCapitalDisplay = this.element.querySelector('.real-capital-display');
            if (realCapitalDisplay) {
                realCapitalDisplay.textContent = formatCurrency(this.realCapital, '$', 0);
                realCapitalDisplay.style.color = '#2ecc71';
                realCapitalDisplay.style.fontWeight = '600';
            }

            // Update derived capital
            const derivedCapitalDisplay = this.element.querySelector('.derived-capital-display');
            if (derivedCapitalDisplay) {
                derivedCapitalDisplay.textContent = formatCurrency(this.derivedCapital, '$', 0);
                derivedCapitalDisplay.style.color = '#e67e22';
                derivedCapitalDisplay.style.fontWeight = '600';
            }

            // Update capital bar
            const totalCapital = this.realCapital.plus(this.derivedCapital);
            if (!totalCapital.isZero()) {
                const realPercent = this.realCapital.dividedBy(totalCapital).times(100).toNumber();
                const derivedPercent = this.derivedCapital.dividedBy(totalCapital).times(100).toNumber();

                const realBar = this.element.querySelector('.capital-bar-real');
                const derivedBar = this.element.querySelector('.capital-bar-derived');

                if (realBar) {
                    realBar.style.width = `${realPercent}%`;
                }
                if (derivedBar) {
                    derivedBar.style.width = `${derivedPercent}%`;
                }
            }
        });
    }

    /**
     * Update token display information
     */
    updateDisplay() {
        const amountProcessed = this.element.querySelector('.amount-processed');
        const plsBalance = this.element.querySelector('.pls-balance');

        if (amountProcessed) {
            amountProcessed.textContent = formatCurrency(this.amountProcessed, '$', 0);
        }
        if (plsBalance) {
            plsBalance.textContent = formatNumber(this.plsBalance, 0);
        }

        this.updateLiquidityDisplay();
    }

    /**
     * Trigger visual glow effect on the token element
     */
    triggerGlowEffect() {
        this.element.classList.add('flash-glow');
        setTimeout(() => {
            this.element.classList.remove('flash-glow');
        }, 100);
    }
} 