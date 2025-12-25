/**
 * @fileoverview Multi-token routing module for finding and executing optimal swap paths
 */

import { state } from './state.js';
import { formatNumber, formatCurrency } from '../utils/formatters.js';

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
 * @typedef {Object} RouteHop
 * @property {Object} token - Token being swapped
 * @property {Decimal} amountIn - Amount going into this hop
 * @property {Decimal} amountOut - Amount coming out of this hop
 * @property {Decimal} priceImpact - Price impact for this hop (%)
 * @property {string} pairType - Type of pair (USD, WPLS, TOKEN)
 */

/**
 * @typedef {Object} Route
 * @property {RouteHop[]} hops - Array of swap hops
 * @property {Decimal} totalAmountOut - Final amount received
 * @property {Decimal} totalPriceImpact - Cumulative price impact
 * @property {string} pathDescription - Human-readable path (e.g., "USD → Token A → Token B")
 */

/**
 * Find all possible paths from USD to target token using BFS
 * @param {Object} targetToken - Token to route to
 * @param {number} maxDepth - Maximum number of hops allowed
 * @returns {Array<Array<Object>>} Array of paths, each path is an array of tokens
 */
export function findAllPaths(targetToken, maxDepth = null) {
    if (maxDepth === null) {
        maxDepth = state.maxRoutingHops;
    }

    const paths = [];
    const queue = [[targetToken]]; // Queue of paths (in reverse - target to source)
    const visited = new Set();

    while (queue.length > 0) {
        const currentPath = queue.shift();
        const currentToken = currentPath[currentPath.length - 1];

        // Check if we've reached a USD or WPLS pair (source of liquidity)
        if (currentToken.pairType === 'USD' || currentToken.pairType === 'WPLS') {
            // Reverse path to go from source to target
            paths.push([...currentPath].reverse());
            continue;
        }

        // Check depth limit
        if (currentPath.length >= maxDepth) {
            continue;
        }

        // If token is paired with another token, continue searching
        if (currentToken.pairType === 'TOKEN' && currentToken.pairedTokenId) {
            const pairedToken = state.tokens.find(t => t.id === currentToken.pairedTokenId);

            if (pairedToken && !currentPath.some(t => t.id === pairedToken.id)) {
                // Create new path with paired token
                queue.push([...currentPath, pairedToken]);
            }
        }
    }

    return paths;
}

/**
 * Calculate output amount through a specific path
 * @param {Array<Object>} path - Array of tokens representing the path
 * @param {Decimal} amountIn - Initial USD amount
 * @returns {Route|null} Route object with hop details or null if path invalid
 */
export function calculatePathOutput(path, amountIn) {
    const Decimal = getDecimal();

    if (!path || path.length === 0) {
        return null;
    }

    const hops = [];
    let currentAmount = amountIn;
    let totalPriceImpact = new Decimal(0);

    // For single token with direct USD/WPLS pair
    if (path.length === 1) {
        const token = path[0];

        if (token.pairType === 'USD') {
            // Direct USD swap
            const result = simulateSwap(token, currentAmount, 'USD');
            if (!result) return null;

            hops.push({
                token: token,
                amountIn: currentAmount,
                amountOut: result.amountOut,
                priceImpact: result.priceImpact,
                pairType: 'USD'
            });

            currentAmount = result.amountOut;
            totalPriceImpact = result.priceImpact;
        } else if (token.pairType === 'WPLS') {
            // USD → WPLS first
            const wplsAmount = currentAmount.dividedBy(state.plsPrice);

            // Then WPLS → Token
            const result = simulateSwap(token, wplsAmount, 'WPLS');
            if (!result) return null;

            hops.push({
                token: token,
                amountIn: currentAmount,
                amountOut: result.amountOut,
                priceImpact: result.priceImpact,
                pairType: 'WPLS'
            });

            currentAmount = result.amountOut;
            totalPriceImpact = result.priceImpact;
        }
    } else {
        // Multi-hop path
        for (let i = 0; i < path.length; i++) {
            const token = path[i];
            const isFirstHop = i === 0;
            const isLastHop = i === path.length - 1;

            // Determine input type
            let inputType;
            if (isFirstHop) {
                if (token.pairType === 'USD') {
                    inputType = 'USD';
                } else if (token.pairType === 'WPLS') {
                    inputType = 'WPLS';
                    // Convert USD to WPLS
                    currentAmount = currentAmount.dividedBy(state.plsPrice);
                }
            } else {
                // Previous token output becomes this token's input
                inputType = 'TOKEN';
            }

            // Simulate the swap
            const result = simulateSwap(token, currentAmount, inputType, i > 0 ? path[i - 1] : null);
            if (!result) return null;

            hops.push({
                token: token,
                amountIn: currentAmount,
                amountOut: result.amountOut,
                priceImpact: result.priceImpact,
                pairType: token.pairType
            });

            currentAmount = result.amountOut;
            totalPriceImpact = totalPriceImpact.plus(result.priceImpact.abs());
        }
    }

    // Build path description
    const pathDescription = buildPathDescription(path);

    return {
        hops,
        totalAmountOut: currentAmount,
        totalPriceImpact,
        pathDescription
    };
}

/**
 * Simulate a swap without modifying state
 * @param {Object} token - Token to swap into
 * @param {Decimal} amountIn - Amount of input asset
 * @param {string} inputType - Type of input ('USD', 'WPLS', 'TOKEN')
 * @param {Object|null} inputToken - Previous token if inputType is 'TOKEN'
 * @returns {Object|null} Result with amountOut and priceImpact, or null if invalid
 */
function simulateSwap(token, amountIn, inputType, inputToken = null) {
    const Decimal = getDecimal();

    // Validate pool has liquidity
    if (token.tokenReserve.isZero() || token.pairReserve.isZero()) {
        return null;
    }

    let pairAmountIn;

    if (inputType === 'USD') {
        pairAmountIn = amountIn;
    } else if (inputType === 'WPLS') {
        pairAmountIn = amountIn;
    } else if (inputType === 'TOKEN') {
        // We're swapping from previous token to this token
        // The amountIn is in terms of the previous token
        pairAmountIn = amountIn;
    }

    // Calculate swap output using constant product formula (x * y = k)
    // With 0.3% fee
    const fee = new Decimal('0.003'); // 0.3%
    const amountInWithFee = pairAmountIn.times(new Decimal(1).minus(fee));

    // Δy = (y × Δx) / (x + Δx)
    const tokenOut = token.tokenReserve.times(amountInWithFee).dividedBy(
        token.pairReserve.plus(amountInWithFee)
    );

    // Calculate price impact
    const priceBefore = token.pairReserve.dividedBy(token.tokenReserve);
    const newPairReserve = token.pairReserve.plus(pairAmountIn);
    const newTokenReserve = token.tokenReserve.minus(tokenOut);
    const priceAfter = newPairReserve.dividedBy(newTokenReserve);
    const priceImpact = priceAfter.minus(priceBefore).dividedBy(priceBefore).times(100);

    return {
        amountOut: tokenOut,
        priceImpact
    };
}

/**
 * Build human-readable path description
 * @param {Array<Object>} path - Array of tokens
 * @returns {string} Path description
 */
function buildPathDescription(path) {
    if (path.length === 0) return 'No path';
    if (path.length === 1) {
        const token = path[0];
        if (token.pairType === 'USD') {
            return `USD → ${token.name}`;
        } else if (token.pairType === 'WPLS') {
            return `USD → WPLS → ${token.name}`;
        }
    }

    const parts = [];

    // Start with USD
    parts.push('USD');

    // Add WPLS if first token is WPLS-paired
    if (path[0].pairType === 'WPLS') {
        parts.push('WPLS');
    }

    // Add all tokens in path
    path.forEach(token => {
        parts.push(token.name);
    });

    return parts.join(' → ');
}

/**
 * Find the best path to target token
 * @param {Object} targetToken - Token to route to
 * @param {Decimal} amountIn - USD amount to invest
 * @returns {Route|null} Best route or null if no path exists
 */
export function findBestPath(targetToken, amountIn) {
    const paths = findAllPaths(targetToken);

    if (paths.length === 0) {
        return null;
    }

    let bestRoute = null;
    let bestOutput = getDecimal().zero();

    // Evaluate each path
    for (const path of paths) {
        const route = calculatePathOutput(path, amountIn);

        if (route && route.totalAmountOut.gt(bestOutput)) {
            bestOutput = route.totalAmountOut;
            bestRoute = route;
        }
    }

    return bestRoute;
}

/**
 * Execute a route by performing swaps
 * @param {Route} route - Route to execute
 * @param {Decimal} amountIn - Initial USD amount
 * @param {string} walletId - Wallet executing the trade
 * @returns {Object} Execution result
 */
export function executeRoute(route, amountIn, walletId) {
    const Decimal = getDecimal();

    if (!route || !route.hops || route.hops.length === 0) {
        return {
            success: false,
            error: 'Invalid route'
        };
    }

    const executedHops = [];

    for (let i = 0; i < route.hops.length; i++) {
        const hop = route.hops[i];
        const token = hop.token;

        // Update token reserves based on the swap
        const fee = new Decimal('0.003'); // 0.3%
        const amountInWithFee = hop.amountIn.times(new Decimal(1).minus(fee));

        // Update reserves
        token.pairReserve = token.pairReserve.plus(hop.amountIn);
        token.tokenReserve = token.tokenReserve.minus(hop.amountOut);
        token.k = token.tokenReserve.times(token.pairReserve);

        // Update display
        token.updateLiquidityDisplay();

        // Track hop execution
        executedHops.push({
            tokenId: token.id,
            tokenName: token.name,
            amountIn: hop.amountIn,
            amountOut: hop.amountOut,
            priceImpact: hop.priceImpact
        });
    }

    return {
        success: true,
        finalAmount: route.totalAmountOut,
        hops: executedHops,
        totalPriceImpact: route.totalPriceImpact,
        pathDescription: route.pathDescription
    };
}

/**
 * Get route preview for display
 * @param {Object} targetToken - Token to route to
 * @param {Decimal} amountIn - USD amount
 * @returns {string} Preview text
 */
export function getRoutePreview(targetToken, amountIn) {
    const route = findBestPath(targetToken, amountIn);

    if (!route) {
        return 'No liquidity path available';
    }

    if (route.hops.length === 1) {
        return 'Direct swap';
    }

    return `Route: ${route.pathDescription} (${route.hops.length} hops)`;
}
