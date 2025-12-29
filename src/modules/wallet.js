/**
 * @fileoverview Wallet management module for handling wallet balances and ownership
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
 * Wallet class representing a user wallet with token and PLS balances
 */
export class Wallet {
    /**
     * Create a new wallet
     * @param {Object} options - Wallet options
     * @param {number} options.id - Wallet ID
     * @param {string} [options.name] - Wallet name (defaults to "Wallet X")
     */
    constructor({ id, name }) {
        const Decimal = getDecimal();

        this.id = id;
        this.name = name || `Wallet ${id}`;

        // Token balances: Map of tokenId -> Decimal balance
        this.tokenBalances = new Map();

        // PLS balance for gas
        this.plsBalance = new Decimal(1000000); // Start with 1,000,000 PLS

        // USD balance for buying (starts with some amount)
        this.usdBalance = new Decimal(1000000); // Start with $1,000,000
    }

    /**
     * Get balance of a specific token
     * @param {number} tokenId - Token ID
     * @returns {Decimal} Token balance
     */
    getTokenBalance(tokenId) {
        const Decimal = getDecimal();
        return this.tokenBalances.get(tokenId) || new Decimal(0);
    }

    /**
     * Set balance of a specific token
     * @param {number} tokenId - Token ID
     * @param {Decimal|string|number} balance - New balance
     */
    setTokenBalance(tokenId, balance) {
        const Decimal = getDecimal();
        this.tokenBalances.set(tokenId, new Decimal(balance));
    }

    /**
     * Add to token balance
     * @param {number} tokenId - Token ID
     * @param {Decimal|string|number} amount - Amount to add
     */
    addTokenBalance(tokenId, amount) {
        const Decimal = getDecimal();
        const currentBalance = this.getTokenBalance(tokenId);
        const newBalance = currentBalance.plus(new Decimal(amount));
        this.setTokenBalance(tokenId, newBalance);
    }

    /**
     * Subtract from token balance
     * @param {number} tokenId - Token ID
     * @param {Decimal|string|number} amount - Amount to subtract
     * @returns {boolean} Success (false if insufficient balance)
     */
    subtractTokenBalance(tokenId, amount) {
        const Decimal = getDecimal();
        const currentBalance = this.getTokenBalance(tokenId);
        const amountDecimal = new Decimal(amount);

        if (currentBalance.lt(amountDecimal)) {
            return false; // Insufficient balance
        }

        const newBalance = currentBalance.minus(amountDecimal);
        this.setTokenBalance(tokenId, newBalance);
        return true;
    }

    /**
     * Add USD to wallet
     * @param {Decimal|string|number} amount - Amount to add
     */
    addUSD(amount) {
        const Decimal = getDecimal();
        this.usdBalance = this.usdBalance.plus(new Decimal(amount));
    }

    /**
     * Subtract USD from wallet
     * @param {Decimal|string|number} amount - Amount to subtract
     * @returns {boolean} Success (false if insufficient balance)
     */
    subtractUSD(amount) {
        const Decimal = getDecimal();
        const amountDecimal = new Decimal(amount);

        if (this.usdBalance.lt(amountDecimal)) {
            return false; // Insufficient balance
        }

        this.usdBalance = this.usdBalance.minus(amountDecimal);
        return true;
    }

    /**
     * Add PLS to wallet
     * @param {Decimal|string|number} amount - Amount to add
     */
    addPLS(amount) {
        const Decimal = getDecimal();
        this.plsBalance = this.plsBalance.plus(new Decimal(amount));
    }

    /**
     * Subtract PLS from wallet
     * @param {Decimal|string|number} amount - Amount to subtract
     * @returns {boolean} Success (false if insufficient balance)
     */
    subtractPLS(amount) {
        const Decimal = getDecimal();
        const amountDecimal = new Decimal(amount);

        if (this.plsBalance.lt(amountDecimal)) {
            return false; // Insufficient balance
        }

        this.plsBalance = this.plsBalance.minus(amountDecimal);
        return true;
    }

    /**
     * Get summary of wallet balances
     * @returns {Object} Balance summary
     */
    getBalanceSummary() {
        const summary = {
            name: this.name,
            usd: this.usdBalance,
            pls: this.plsBalance,
            tokens: {}
        };

        for (const [tokenId, balance] of this.tokenBalances.entries()) {
            if (balance.gt(0)) {
                const token = state.tokens.find(t => t.id === tokenId);
                summary.tokens[tokenId] = {
                    balance: balance,
                    name: token ? token.name : `Token ${tokenId}`
                };
            }
        }

        return summary;
    }
}

/**
 * Initialize wallet system
 */
export function initializeWalletSystem() {
    if (!state.wallets) {
        state.wallets = [];
    }

    // Create first wallet if none exist
    if (state.wallets.length === 0) {
        const wallet1 = new Wallet({ id: 1, name: 'Wallet 1' });
        state.wallets.push(wallet1);
        console.log('Created Wallet 1');
    }
}

/**
 * Get wallet by ID
 * @param {number} walletId - Wallet ID
 * @returns {Wallet|null} Wallet instance or null
 */
export function getWalletById(walletId) {
    return state.wallets.find(w => w.id === walletId) || null;
}

/**
 * Get wallet by name
 * @param {string} walletName - Wallet name
 * @returns {Wallet|null} Wallet instance or null
 */
export function getWalletByName(walletName) {
    return state.wallets.find(w => w.name === walletName) || null;
}

/**
 * Create a new wallet
 * @param {string} [name] - Wallet name (defaults to "Wallet X")
 * @returns {Wallet} New wallet instance
 */
export function createWallet(name) {
    const newId = state.wallets.length + 1;
    const wallet = new Wallet({ id: newId, name: name || `Wallet ${newId}` });
    state.wallets.push(wallet);
    console.log(`Created ${wallet.name}`);
    return wallet;
}

/**
 * Get all wallets
 * @returns {Wallet[]} Array of all wallets
 */
export function getAllWallets() {
    return state.wallets || [];
}
