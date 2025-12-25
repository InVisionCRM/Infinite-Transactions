/**
 * @fileoverview Validation utilities for input checking and data verification
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
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether the validation passed
 * @property {string} [message] - Error message if validation failed
 */

/**
 * Validate a number is within a specified range
 * @param {number|string|Decimal} value - Value to validate
 * @param {number|string|Decimal} min - Minimum allowed value
 * @param {number|string|Decimal} max - Maximum allowed value
 * @returns {ValidationResult} Validation result
 */
export function validateRange(value, min, max) {
    try {
        const Decimal = getDecimal();
        const decValue = new Decimal(value);
        const decMin = new Decimal(min);
        const decMax = new Decimal(max);

        if (decValue.lt(decMin)) {
            return {
                isValid: false,
                message: `Value must be greater than or equal to ${decMin}`
            };
        }

        if (decValue.gt(decMax)) {
            return {
                isValid: false,
                message: `Value must be less than or equal to ${decMax}`
            };
        }

        return { isValid: true };
    } catch (error) {
        return {
            isValid: false,
            message: 'Invalid number format'
        };
    }
}

/**
 * Validate a percentage value (0-100)
 * @param {number|string|Decimal} value - Value to validate
 * @returns {ValidationResult} Validation result
 */
export function validatePercentage(value) {
    return validateRange(value, 0, 100);
}

/**
 * Validate a positive number
 * @param {number|string|Decimal} value - Value to validate
 * @returns {ValidationResult} Validation result
 */
export function validatePositiveNumber(value) {
    try {
        const Decimal = getDecimal();
        const decValue = new Decimal(value);
        
        if (decValue.lte(0)) {
            return {
                isValid: false,
                message: 'Value must be greater than 0'
            };
        }

        return { isValid: true };
    } catch (error) {
        return {
            isValid: false,
            message: 'Invalid number format'
        };
    }
}

/**
 * Validate a non-negative number
 * @param {number|string|Decimal} value - Value to validate
 * @returns {ValidationResult} Validation result
 */
export function validateNonNegativeNumber(value) {
    try {
        const Decimal = getDecimal();
        const decValue = new Decimal(value);
        
        if (decValue.lt(0)) {
            return {
                isValid: false,
                message: 'Value must be greater than or equal to 0'
            };
        }

        return { isValid: true };
    } catch (error) {
        return {
            isValid: false,
            message: 'Invalid number format'
        };
    }
}

/**
 * Validate gas input
 * @param {number|string|Decimal} value - Value to validate
 * @param {number|string|Decimal} minGas - Minimum gas value
 * @param {number|string|Decimal} maxGas - Maximum gas value
 * @returns {ValidationResult} Validation result
 */
export function validateGas(value, minGas, maxGas) {
    const rangeValidation = validateRange(value, minGas, maxGas);
    if (!rangeValidation.isValid) {
        return {
            isValid: false,
            message: `Gas ${rangeValidation.message}`
        };
    }
    return { isValid: true };
}

/**
 * Validate wallet ID format
 * @param {string} walletId - Wallet ID to validate
 * @returns {ValidationResult} Validation result
 */
export function validateWalletId(walletId) {
    if (!walletId || typeof walletId !== 'string') {
        return {
            isValid: false,
            message: 'Invalid wallet ID format'
        };
    }

    const pattern = /^wallet \d+$/;
    if (!pattern.test(walletId)) {
        return {
            isValid: false,
            message: 'Wallet ID must be in format "wallet X" where X is a number'
        };
    }

    return { isValid: true };
}

/**
 * Validate token ID
 * @param {number} tokenId - Token ID to validate
 * @param {number} maxTokens - Maximum allowed tokens
 * @returns {ValidationResult} Validation result
 */
export function validateTokenId(tokenId, maxTokens) {
    if (!Number.isInteger(tokenId) || tokenId < 1 || tokenId > maxTokens) {
        return {
            isValid: false,
            message: `Token ID must be an integer between 1 and ${maxTokens}`
        };
    }
    return { isValid: true };
}

/**
 * Validate time interval
 * @param {number|string|Decimal} value - Value to validate
 * @returns {ValidationResult} Validation result
 */
export function validateTimeInterval(value) {
    try {
        const Decimal = getDecimal();
        const decValue = new Decimal(value);
        
        if (decValue.lt(0.01)) {
            return {
                isValid: false,
                message: 'Time interval must be at least 0.01 seconds'
            };
        }

        if (decValue.gt(10)) {
            return {
                isValid: false,
                message: 'Time interval must not exceed 10 seconds'
            };
        }

        return { isValid: true };
    } catch (error) {
        return {
            isValid: false,
            message: 'Invalid time interval format'
        };
    }
}

/**
 * Validate liquidity input
 * @param {number|string|Decimal} amount - Amount to validate
 * @param {number|string|Decimal} balance - Current balance
 * @returns {ValidationResult} Validation result
 */
export function validateLiquidity(amount, balance) {
    try {
        const Decimal = getDecimal();
        const decAmount = new Decimal(amount);
        const decBalance = new Decimal(balance);

        if (decAmount.lte(0)) {
            return {
                isValid: false,
                message: 'Liquidity amount must be greater than 0'
            };
        }

        if (decAmount.gt(decBalance)) {
            return {
                isValid: false,
                message: 'Insufficient balance for liquidity'
            };
        }

        return { isValid: true };
    } catch (error) {
        return {
            isValid: false,
            message: 'Invalid liquidity amount format'
        };
    }
}

/**
 * Validate token supply
 * @param {number|string|Decimal} supply - Supply to validate
 * @returns {ValidationResult} Validation result
 */
export function validateTokenSupply(supply) {
    try {
        const Decimal = getDecimal();
        const decSupply = new Decimal(supply);
        
        if (decSupply.lte(0)) {
            return {
                isValid: false,
                message: 'Token supply must be greater than 0'
            };
        }

        if (!decSupply.isInteger()) {
            return {
                isValid: false,
                message: 'Token supply must be a whole number'
            };
        }

        return { isValid: true };
    } catch (error) {
        return {
            isValid: false,
            message: 'Invalid token supply format'
        };
    }
}

/**
 * Validate total percentages add up to 100
 * @param {...number} percentages - Percentage values to validate
 * @returns {ValidationResult} Validation result
 */
export function validateTotalPercentage(...percentages) {
    try {
        const Decimal = getDecimal();
        const total = percentages.reduce((sum, value) => {
            return sum.plus(new Decimal(value));
        }, new Decimal(0));

        if (!total.eq(100)) {
            return {
                isValid: false,
                message: 'Percentages must add up to 100'
            };
        }

        return { isValid: true };
    } catch (error) {
        return {
            isValid: false,
            message: 'Invalid percentage format'
        };
    }
} 