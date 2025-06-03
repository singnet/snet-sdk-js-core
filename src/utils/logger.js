import { debug, error, info } from 'loglevel';

const formatLogMessage = (level, moduleName, message) => {
    const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
    return `[${timestamp}] [${level.toUpperCase()}] [${moduleName}] ${message}`;
};

/**
 * Converts objects or arrays of objects into a readable string,
 * replacing BigInt values with strings.
 *
 * @param {Object|Array} data - The object(s) to stringify.
 * @returns {string} - A formatted string with BigInt values replaced.
 */
export const stringifyWithBigInt = (data) => {
    const replacer = (_, value) => {
        return typeof value === 'bigint' ? value.toString() : value; // Convert BigInt to string
    };

    if (Array.isArray(data)) {
        return data.map((item) => JSON.stringify(item, replacer, 2)).join(', ');
    }

    return JSON.stringify(data, replacer, 2);
};

export const VALID_LOG_LEVELS = {
    debug: debug, info: info, error: error,
};


/**
 * Logs a message in the specified format.
 * @param {string} level - The log level ('debug', 'info', 'error').
 * @param {string} moduleName - The name of the module.
 * @param {string} message - The log message.
 */
export const logMessage = (level, moduleName, message) => {

    const effectiveLevel = VALID_LOG_LEVELS[level] ? level : 'info';
    const formattedMessage = formatLogMessage(effectiveLevel, moduleName, message);

    VALID_LOG_LEVELS[effectiveLevel](formattedMessage);
};

