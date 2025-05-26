import { VALID_LOG_LEVELS } from "./logger";
import { TOKEN_NAMES } from "./tokenUtils";

export const DEFAULT_CONFIG = {
    defaultGasLimit: 210000,
    defaultGasPrice: 4700000,
    ipfsEndpoint: 'https://ipfs.singularitynet.io:443',
    logLevel: 'info',
    tokenName: 'FET',
    standType: 'prod'
};

const NETWORK_ID = {
     MAINNET: 1,
     SEPOLIA: 11155111  
}

const STAND_TYPES = {
    PRODUCTION: 'prod',
    DEMO: 'demo',
    DEVELOPMENT: 'dev'  
}

const validateStandType = (standType, networkId) => {
    if (!standType) {
        return;
    }

    if (networkId === NETWORK_ID.MAINNET && standType !== STAND_TYPES.PRODUCTION) {
        throw new Error(`Mainnet only supports stand type: ${STAND_TYPES.PRODUCTION}`)
    }

    if (networkId === NETWORK_ID.SEPOLIA && standType !== STAND_TYPES.DEMO && standType !== STAND_TYPES.DEVELOPMENT) {
        throw new Error(`Sepolia supports stand types: ${STAND_TYPES.DEMO} or ${STAND_TYPES.DEVELOPMENT}`)
    }
}

const isValidUrl = (urlString) => {
    try {
      const url = new URL(urlString);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (err) {
      return false;
    }
  };

export const validateConfig = (config) => {
    if (!config || typeof config !== 'object') {
        throw new Error('Configuration must be an object');
    }

    const validTokenNames = Object.keys(TOKEN_NAMES);
    if (!validTokenNames.includes(config.tokenName)) {
        throw new Error(`Token must be one of: ${validTokenNames.join(", ")}`)
    }

    // if (!config?.web3Provider) {
    //     throw new Error('Web3 provider is required');
    // }
    const numberNetworkId = Number(config.networkId);
    if (!numberNetworkId) {
        throw new Error('Network ID must be a number');
    }

    const validNetworkIds = Object.values(NETWORK_ID);
    if (!validNetworkIds.includes(numberNetworkId)) {
        throw new Error(`Network ID must be one of: ${validNetworkIds.join(', ')}`);
    }

    validateStandType(config.standType, numberNetworkId);

    const validLogLevels = Object.keys(VALID_LOG_LEVELS);
    if (config.logLevel && !validLogLevels.includes(config.logLevel)) {
        throw new Error(`Log level must be one of: ${validLogLevels.join(', ')}`);
    }

    if (config.ipfsEndpoint && !isValidUrl(config.ipfsEndpoint)) {
        throw new Error('IPFS endpoint must be a valid HTTP/HTTPS URL');
    }
}