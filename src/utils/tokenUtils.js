import BigNumber from "bignumber.js";
import { isNaN } from "lodash";

export const TOKEN_NAMES = {
    FET: "FET", AGIX: "AGIX"
}

const TOKEN_DECIMALS = {
    [TOKEN_NAMES.FET]: 18, [TOKEN_NAMES.AGIX]: 8,
};

/**
 * Validates token name
 * @private
 * @param {*} value
 * @throws {Error} When value is invalid
 */
const validateTokenName = (value) => {
    if (!TOKEN_DECIMALS.hasOwnProperty(value)) {
        throw new Error(`Unsupported token: ${value}. Valid options: ${Object.keys(TOKEN_DECIMALS).join(', ')}`);
    }
}

/**
 * Validates input value
 * @param {*} value
 * @throws {Error} When value is invalid
 */
const validateInput = (value) => {
    if (value === null || value === undefined || value === '' || isNaN(value)) {
        throw new Error('Amount must be a valid number');
    }
}

/**
 * Gets token precision info
 * @param {string} tokenName - Token name (FET/AGIX)
 * @returns {{precision: BigNumber, decimals: number}}
 */
const getTokenPrecision = (tokenName) => {
    validateTokenName(tokenName);

    const decimals = TOKEN_DECIMALS[tokenName];
    return {
        precision: new BigNumber(10).exponentiatedBy(decimals), decimals: decimals
    };
};

/**
 * Converts cogs (base units) to token units
 * @param {string|number} cogs - Amount in cogs
 * @param {string} tokenName - Token name (FET/AGIX)
 * @returns {string} Formatted token amount
 * @throws {Error} On invalid inputs
 */
export const cogsToToken = (cogs, tokenName) => {
    validateInput(cogs);

    const { precision, decimals } = getTokenPrecision(tokenName);
    return new BigNumber(cogs).dividedBy(precision).toFixed(decimals, BigNumber.ROUND_DOWN);
};

/**
 * Converts token to cogs (base units)
 * @param {string|number} cogs - Amount in cogs
 * @param {string} tokenName - Token name (FET/AGIX)
 * @returns {string} Formatted token amount
 * @throws {Error} On invalid inputs
 */
export const tokenToCogs = (tokenAmount, tokenName) => {
    validateInput(tokenAmount);

    const { precision } = getTokenPrecision(tokenName);
    return new BigNumber(tokenAmount).multipliedBy(precision).toFixed(0, BigNumber.ROUND_DOWN); // Cogs should be whole numbers
};

/**
 * Converts token to base units
 * @param {string|number} tokenAmount - Token amount
 * @param {string} tokenName - Token name (FET/AGIX)
 * @returns {string} Formatted token amount
 * @throws {Error} On invalid inputs
 */
export const formatTokenDecimal = (tokenAmount, tokenName) => {
    validateInput(tokenAmount);

    const { decimals } = getTokenPrecision(tokenName);
    return new BigNumber(tokenAmount).toFixed(decimals, BigNumber.ROUND_DOWN);
};
