/**
 * @fileoverview Capital tracking module for distinguishing real vs derived liquidity
 * This module exposes the "liquidity mirage" in token pairing systems
 */

import { state } from './state.js';

/**
 * Calculation mode for derived capital
 * 'market' = Use full market value (DEX method - inflates TVL)
 * 'backing' = Use proportional real capital (honest method)
 */
export let capitalCalculationMode = 'market';

/**
 * Set the capital calculation mode
 * @param {string} mode - 'market' or 'backing'
 */
export function setCapitalCalculationMode(mode) {
    if (mode !== 'market' && mode !== 'backing') {
        throw new Error('Invalid mode. Use "market" or "backing"');
    }
    capitalCalculationMode = mode;
}

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
 * @typedef {Object} CapitalBreakdown
 * @property {Decimal} realCapital - Actual WPLS deposited from external sources
 * @property {Decimal} derivedCapital - Value calculated from token pairs
 * @property {Decimal} totalDisplayedValue - Total liquidity shown (real + derived)
 * @property {Decimal} leverageRatio - Ratio of derived to real capital
 * @property {number} averageDepth - Average hops from WPLS across all tokens
 */

/**
 * Calculate liquidity depth for a token (hops from WPLS)
 * @param {Object} token - Token to calculate depth for
 * @param {Set<number>} visited - Set to prevent circular loops
 * @returns {number} Depth level (0 = WPLS, 1 = paired with WPLS, etc.)
 */
export function calculateLiquidityDepth(token, visited = new Set()) {
    // Prevent infinite loops
    if (visited.has(token.id)) {
        return Infinity; // Circular dependency detected
    }
    visited.add(token.id);

    // Base case: paired with USD or WPLS (real capital)
    if (token.pairType === 'USD' || token.pairType === 'WPLS') {
        return 0;
    }

    // Recursive case: paired with another token
    if (token.pairType === 'TOKEN' && token.pairedTokenId) {
        const pairedToken = state.tokens.find(t => t.id === token.pairedTokenId);
        if (!pairedToken) {
            return Infinity; // Invalid pair
        }
        return 1 + calculateLiquidityDepth(pairedToken, visited);
    }

    // No liquidity yet
    return Infinity;
}

/**
 * Calculate real capital (actual WPLS deposited) for a token
 * @param {Object} token - Token to calculate for
 * @returns {Decimal} Real capital amount
 */
export function calculateRealCapital(token) {
    const Decimal = getDecimal();

    // USD and WPLS pairs have real capital
    if (!token.pairReserve.isZero()) {
        if (token.pairType === 'USD') {
            // Direct USD pairing - reserve is already in USD
            return token.pairReserve;
        } else if (token.pairType === 'WPLS') {
            // WPLS pairing - convert to USD
            return token.pairReserve.times(state.plsPrice);
        }
    }

    return new Decimal(0);
}

/**
 * Calculate derived capital (value from token pairs) for a token
 * @param {Object} token - Token to calculate for
 * @returns {Decimal} Derived capital amount
 */
export function calculateDerivedCapital(token) {
    const Decimal = getDecimal();

    // Token pairs have derived capital
    if (token.pairType === 'TOKEN' && token.pairedTokenId && !token.pairReserve.isZero()) {
        // Find the paired token
        const pairedToken = state.tokens.find(t => t.id === token.pairedTokenId);
        if (!pairedToken) {
            return new Decimal(0);
        }

        if (capitalCalculationMode === 'market') {
            // MARKET VALUE METHOD (DEX Method - Inflates TVL)
            // Value = pair reserve × paired token's market price
            const pairedTokenPrice = pairedToken.calculateTokenPriceUSD();
            return token.pairReserve.times(pairedTokenPrice);
        } else {
            // REAL CAPITAL BACKING METHOD (Honest Method)
            // Calculate proportional real capital based on supply used
            return calculateRealCapitalBacking(token, pairedToken, new Set());
        }
    }

    return new Decimal(0);
}

/**
 * Calculate real capital backing for a token (recursive)
 * @param {Object} token - Token to calculate for
 * @param {Object} pairedToken - The token this is paired with
 * @param {Set<number>} visited - Visited tokens to prevent circular loops
 * @returns {Decimal} Real capital backing amount
 */
function calculateRealCapitalBacking(token, pairedToken, visited) {
    const Decimal = getDecimal();

    // Prevent infinite loops
    if (visited.has(pairedToken.id)) {
        return new Decimal(0);
    }
    visited.add(pairedToken.id);

    // Amount of paired token used in this pool
    const pairedTokenUsed = token.pairReserve;

    // Total supply of paired token
    const pairedTokenTotalSupply = pairedToken.totalSupply;

    if (pairedTokenTotalSupply.isZero()) {
        return new Decimal(0);
    }

    // Percentage of paired token's supply used
    const percentageUsed = pairedTokenUsed.dividedBy(pairedTokenTotalSupply);

    // Get real capital behind the paired token
    let realCapitalBehindPaired = new Decimal(0);

    if (pairedToken.pairType === 'USD') {
        // Paired token is backed by USD - direct real capital
        realCapitalBehindPaired = pairedToken.pairReserve;
    } else if (pairedToken.pairType === 'WPLS') {
        // Paired token is backed by WPLS - convert to USD
        realCapitalBehindPaired = pairedToken.pairReserve.times(state.plsPrice);
    } else if (pairedToken.pairType === 'TOKEN' && pairedToken.pairedTokenId) {
        // Paired token is backed by another token - recurse
        const grandparentToken = state.tokens.find(t => t.id === pairedToken.pairedTokenId);
        if (grandparentToken) {
            realCapitalBehindPaired = calculateRealCapitalBacking(pairedToken, grandparentToken, visited);
        }
    }

    // Return proportional amount
    return realCapitalBehindPaired.times(percentageUsed);
}

/**
 * Get comprehensive capital breakdown for entire system
 * @returns {CapitalBreakdown} Complete capital analysis
 */
export function getCapitalBreakdown() {
    const Decimal = getDecimal();
    let realCapital = new Decimal(0);
    let derivedCapital = new Decimal(0);
    let totalDepth = 0;
    let tokenCount = 0;

    state.tokens.forEach(token => {
        const real = calculateRealCapital(token);
        const derived = calculateDerivedCapital(token);

        realCapital = realCapital.plus(real);
        derivedCapital = derivedCapital.plus(derived);

        // Calculate depth for average
        const depth = calculateLiquidityDepth(token);
        if (depth !== Infinity) {
            totalDepth += depth;
            tokenCount++;
        }
    });

    const totalDisplayedValue = realCapital.plus(derivedCapital);
    const leverageRatio = realCapital.isZero()
        ? new Decimal(0)
        : derivedCapital.dividedBy(realCapital);
    const averageDepth = tokenCount > 0 ? totalDepth / tokenCount : 0;

    return {
        realCapital,
        derivedCapital,
        totalDisplayedValue,
        leverageRatio,
        averageDepth
    };
}

/**
 * Calculate cascade impact of WPLS price change
 * @param {number} percentageChange - Price change percentage (-50 to +50)
 * @returns {Object} Impact analysis
 */
export function calculateCascadeImpact(percentageChange) {
    const Decimal = getDecimal();
    const multiplier = new Decimal(1).plus(new Decimal(percentageChange).dividedBy(100));

    const originalBreakdown = getCapitalBreakdown();

    // Simulate price change
    const newPlsPrice = state.plsPrice.times(multiplier);
    const newRealCapital = originalBreakdown.realCapital.times(multiplier);

    // Derived capital changes based on depth
    const impacts = state.tokens.map(token => {
        const depth = calculateLiquidityDepth(token);
        const originalValue = calculateRealCapital(token).plus(calculateDerivedCapital(token));

        // Price impact compounds with depth
        const depthMultiplier = multiplier.pow(depth + 1);
        const newValue = originalValue.times(depthMultiplier);
        const changePercent = originalValue.isZero()
            ? new Decimal(0)
            : newValue.minus(originalValue).dividedBy(originalValue).times(100);

        return {
            tokenId: token.id,
            depth,
            originalValue,
            newValue,
            changePercent: changePercent.toNumber()
        };
    });

    // Sort by most impacted
    impacts.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

    return {
        plsPriceChange: percentageChange,
        newPlsPrice,
        realCapitalChange: newRealCapital.minus(originalBreakdown.realCapital),
        impacts,
        mostVulnerable: impacts[0],
        averageImpact: impacts.reduce((sum, t) => sum + Math.abs(t.changePercent), 0) / impacts.length
    };
}

/**
 * Get liquidity depth label
 * @param {number} depth - Depth level
 * @returns {string} Human-readable label
 */
export function getDepthLabel(depth) {
    if (depth === 0) return 'REAL (USD/WPLS)';
    if (depth === 1) return 'DERIVED (1 hop)';
    if (depth === 2) return 'DERIVED (2 hops)';
    if (depth === 3) return 'DERIVED (3 hops)';
    if (depth === Infinity) return 'ISOLATED';
    return `DERIVED (${depth} hops)`;
}

/**
 * Get depth color for visual indicators
 * @param {number} depth - Depth level
 * @returns {string} CSS color
 */
export function getDepthColor(depth) {
    if (depth === 0) return '#2ecc71'; // Green - real capital
    if (depth === 1) return '#f39c12'; // Orange - 1 hop
    if (depth === 2) return '#e67e22'; // Dark orange - 2 hops
    if (depth >= 3) return '#e74c3c'; // Red - 3+ hops (very risky)
    return '#95a5a6'; // Gray - isolated
}

/**
 * Check if web has arbitrage opportunities
 * @returns {Array} Array of arbitrage paths
 */
export function detectArbitrageOpportunities() {
    const opportunities = [];
    const Decimal = getDecimal();

    // Check all token pairs for price discrepancies
    state.tokens.forEach(tokenA => {
        state.tokens.forEach(tokenB => {
            if (tokenA.id >= tokenB.id) return; // Skip duplicates

            // Calculate price of A in terms of B through different paths
            const directPath = calculatePathPrice(tokenA, tokenB, []);
            const viaWPLS = calculatePathPriceThroughWPLS(tokenA, tokenB);

            if (directPath && viaWPLS && !directPath.eq(viaWPLS)) {
                const discrepancy = viaWPLS.minus(directPath).dividedBy(directPath).times(100);

                if (discrepancy.abs().gt(new Decimal('0.1'))) { // > 0.1% discrepancy
                    opportunities.push({
                        tokenA: tokenA.id,
                        tokenB: tokenB.id,
                        directPrice: directPath.toNumber(),
                        indirectPrice: viaWPLS.toNumber(),
                        discrepancy: discrepancy.toNumber()
                    });
                }
            }
        });
    });

    return opportunities;
}

/**
 * Calculate price through a specific path
 * @param {Object} tokenA - Start token
 * @param {Object} tokenB - End token
 * @param {Array} visited - Visited token IDs
 * @returns {Decimal|null} Price or null if no path
 */
function calculatePathPrice(tokenA, tokenB, visited) {
    // Implementation would do BFS/DFS to find path
    // For now, simplified version
    return null;
}

/**
 * Calculate price through WPLS
 * @param {Object} tokenA - Start token
 * @param {Object} tokenB - End token
 * @returns {Decimal|null} Price or null if no path
 */
function calculatePathPriceThroughWPLS(tokenA, tokenB) {
    const Decimal = getDecimal();
    const priceA = tokenA.calculateTokenPriceUSD();
    const priceB = tokenB.calculateTokenPriceUSD();

    if (priceA.isZero() || priceB.isZero()) return null;

    return priceA.dividedBy(priceB);
}
