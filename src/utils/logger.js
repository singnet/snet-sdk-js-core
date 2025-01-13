import { debug, info, error } from 'loglevel';

const formatLogMessage = (level, moduleName, message) => {
    const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
    return `[${timestamp}] [${level.toUpperCase()}] [${moduleName}] ${message}`;
};

/**
 * Logs a message in the specified format.
 * @param {string} level - The log level ('debug', 'info', 'error').
 * @param {string} moduleName - The name of the module.
 * @param {string} message - The log message.
 */
export const logMessage = (level, moduleName, message) => {
    const formattedMessage = formatLogMessage(level, moduleName, message);

    switch (level) {
        case 'debug':
            debug(formattedMessage);
            break;
        case 'info':
            info(formattedMessage);
            break;
        case 'error':
            error(formattedMessage);
            break;
        default:
            info(formattedMessage);
    }
};
