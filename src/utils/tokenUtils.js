import BigNumber from "bignumber.js";

export const TOKEN_NAMES = {
    FET: "FET",
    AGIX: "AGIX"
} 

const TOKEN_DECIMALS = {
    [TOKEN_NAMES.FET]: 18,
    [TOKEN_NAMES.AGIX]: 8,
};

const getTokenPrecision = (tokenName) => {
    if (!TOKEN_DECIMALS.hasOwnProperty(tokenName)) {
        throw new Error(`Unsupported token: ${tokenName}. Valid options: ${Object.keys(TOKEN_DECIMALS).join(', ')}`);
    }

    const decimals = TOKEN_DECIMALS[tokenName];
    return {
        precision: new BigNumber(10).exponentiatedBy(decimals),
        decimals: decimals
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
    if (!cogs || isNaN(cogs)) {
        throw new Error('Cogs value must be a valid number');
    }

    const { precision, decimals } = getTokenPrecision(tokenName);
    return new BigNumber(cogs)
        .dividedBy(precision)
        .toFixed(decimals, BigNumber.ROUND_DOWN);
};

/**
 * Converts token to cogs (base units) 
 * @param {string|number} cogs - Amount in cogs
 * @param {string} tokenName - Token name (FET/AGIX)
 * @returns {string} Formatted token amount
 * @throws {Error} On invalid inputs
 */
export const tokenToCogs = (tokenAmount, tokenName) => {
    if (!tokenAmount || isNaN(tokenAmount)) {
        throw new Error('Token amount must be a valid number');
    }

    const { precision } = getTokenPrecision(tokenName);
    return new BigNumber(tokenAmount)
        .multipliedBy(precision)
        .toFixed(0, BigNumber.ROUND_DOWN); // Cogs should be whole numbers
};

/**
 * Converts token to base units
 * @param {string|number} tokenAmount - Token amount
 * @param {string} tokenName - Token name (FET/AGIX)
 * @returns {string} Formatted token amount
 * @throws {Error} On invalid inputs
 */
export const formatTokenDecimal = (tokenAmount, tokenName) => {
    if (!tokenAmount || isNaN(tokenAmount)) {
        throw new Error('Token amount must be a valid number');
    }

    const { decimals } = getTokenPrecision(tokenName);
    return new BigNumber(tokenAmount)
        .toFixed(decimals, BigNumber.ROUND_DOWN);
};
