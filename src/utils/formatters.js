/**
 * @fileoverview Utility functions for formatting numbers and other values
 */

/**
 * Format a number with commas as thousands separators
 * @param {number|string|Decimal} value - Value to format
 * @param {number} decimals - Number of decimal places (default 0)
 * @returns {string} Formatted number string
 */
export function formatNumber(value, decimals = 0) {
    // Handle Decimal.js objects
    if (value && typeof value.toFixed === 'function') {
        value = value.toFixed(decimals);
    }

    // Convert to number if string
    const num = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(num)) return '0';

    // Use toLocaleString for comma formatting
    return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

/**
 * Format a number with subscript zeros for better readability
 * @param {string|number} number - The number to format
 * @returns {string} Formatted number with HTML subscript for leading zeros
 */
export function formatNumberWithSubscript(number) {
    const numStr = number.toString();
    if (!numStr.includes('.')) return numStr;

    const [whole, decimal] = numStr.split('.');

    // Remove trailing zeros first
    const trimmedDecimal = decimal.replace(/0+$/, '');
    if (!trimmedDecimal) return whole;

    // If 8 or fewer decimals, just show them normally
    if (trimmedDecimal.length <= 8) {
        return `${whole}.${trimmedDecimal}`;
    }

    // Count leading zeros in decimal
    let leadingZeros = 0;
    for (let i = 0; i < trimmedDecimal.length; i++) {
        if (trimmedDecimal[i] === '0') leadingZeros++;
        else break;
    }

    // If not many leading zeros, just show first 8 decimals
    if (leadingZeros < 4) {
        return `${whole}.${trimmedDecimal.slice(0, 8)}`;
    }

    // For very small numbers with many leading zeros, use subscript notation
    // Show: 0.0[subscript:leadingZeros]significantDigits
    const significantDigits = trimmedDecimal.slice(leadingZeros, leadingZeros + 6);
    return `${whole}.0<sub>${leadingZeros}</sub>${significantDigits}`;
}

/**
 * Format a number to a fixed number of decimal places with proper rounding
 * @param {number|string} number - The number to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted number string
 */
export function formatDecimal(number, decimals = 8) {
    return Number(number).toFixed(decimals);
}

/**
 * Format a number as currency with commas
 * @param {number|string|Decimal} number - The number to format
 * @param {string} [currency='$'] - Currency symbol
 * @param {number} [decimals=0] - Number of decimal places
 * @returns {string} Formatted currency string
 */
export function formatCurrency(number, currency = '$', decimals = 0) {
    return `${currency}${formatNumber(number, decimals)}`;
}

/**
 * Format a time duration in seconds to a human-readable string
 * @param {number} seconds - Number of seconds
 * @returns {string} Formatted time string (e.g., "2h 30m 45s")
 */
export function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}s`);

    return parts.join(' ');
}

/**
 * Format a number with appropriate unit prefix (K, M, B, T)
 * @param {number} number - The number to format
 * @returns {string} Formatted number with unit prefix
 */
export function formatWithPrefix(number) {
    const prefixes = [
        { value: 1e12, symbol: 'T' },
        { value: 1e9, symbol: 'B' },
        { value: 1e6, symbol: 'M' },
        { value: 1e3, symbol: 'K' }
    ];

    for (const { value, symbol } of prefixes) {
        if (Math.abs(number) >= value) {
            return (number / value).toFixed(1) + symbol;
        }
    }
    return number.toString();
}

/**
 * Format a percentage value
 * @param {number} value - The value to format as percentage
 * @param {number} [decimals=2] - Number of decimal places
 * @returns {string} Formatted percentage string
 */
export function formatPercentage(value, decimals = 2) {
    return `${formatDecimal(value, decimals)}%`;
}

/**
 * Format a gas value in Gwei
 * @param {number|string} value - The gas value to format
 * @returns {string} Formatted gas string
 */
export function formatGas(value) {
    return `${formatDecimal(value, 9)} Gwei`;
}

/**
 * Format a wallet address to show only first and last few characters
 * @param {string} address - The wallet address
 * @param {number} [startChars=6] - Number of characters to show at start
 * @param {number} [endChars=4] - Number of characters to show at end
 * @returns {string} Formatted address string
 */
export function formatAddress(address, startChars = 6, endChars = 4) {
    if (!address || address.length < (startChars + endChars + 3)) {
        return address;
    }
    return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Format a transaction hash to show only first and last few characters
 * @param {string} hash - The transaction hash
 * @param {number} [chars=8] - Number of characters to show at each end
 * @returns {string} Formatted hash string
 */
export function formatHash(hash, chars = 8) {
    return formatAddress(hash, chars, chars);
}

/**
 * Format a number to show significant digits with scientific notation if needed
 * @param {number|string} number - The number to format
 * @param {number} [significantDigits=6] - Number of significant digits to show
 * @returns {string} Formatted number string
 */
export function formatSignificant(number, significantDigits = 6) {
    const num = Number(number);
    if (isNaN(num)) return 'NaN';
    
    const absNum = Math.abs(num);
    if (absNum === 0) return '0';
    
    if (absNum < 1e-6 || absNum >= 1e9) {
        return num.toExponential(significantDigits - 1);
    }
    
    return num.toPrecision(significantDigits);
} 