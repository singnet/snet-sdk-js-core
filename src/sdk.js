import Web3 from 'web3';
import { isEmpty } from 'lodash';

import Account from './Account';
import MPEContract from './mpe/MPEContract';
import IPFSMetadataProvider from './IPFSMetadataProvider';
import { DefaultPaymentStrategy } from './payment_strategies';
import { setLevel } from 'loglevel';
import { logMessage } from './utils/logger';

const DEFAULT_CONFIG = {
    defaultGasLimit: 210000,
    defaultGasPrice: 4700000,
    ipfsEndpoint: 'http://ipfs.singularitynet.io:80',
    logLevel: 'info',
    tokenName: 'FET',
    standType: 'prod'
};

class SnetSDK {
    /**
     * @param {Config} config
     * @param {IPFSMetadataProvider} metadataProvider
     */
    constructor(config, metadataProvider = undefined) {
        this._config = {
            ...DEFAULT_CONFIG,
            ...config,
        };
        setLevel(this._config.logLevel);
        const options = {
            defaultGas: this._config.defaultGasLimit,
            defaultGasPrice: this._config.defaultGasPrice,
        };
        this._networkId = config.networkId;
        this._web3 = new Web3(config.web3Provider, null, options);
        const identity = this._createIdentity();
        // Some RPCs have a block size limit of 5000, but for the getPastEvents/log function, we need a higher limit.
        // So this parameter will be used in getPastOpenChannels function at packages/core/src/MPEContract.js
        const { rpcEndpoint } = config;
        this._mpeContract = new MPEContract(
            this._web3,
            this._networkId,
            rpcEndpoint,
            this._config.tokenName,
            this._config.standType
        );
        this._account = new Account(
            this._web3,
            this._networkId,
            config.tokenName,
            this._mpeContract,
            identity
        );
        this._metadataProvider =
            metadataProvider ||
            new IPFSMetadataProvider(
                this._web3,
                this._networkId,
                this._config.ipfsEndpoint,
                this._config.tokenName,
                this._config.standType               
            );
    }

    /**
     * @type {Account}
     */
    get account() {
        return this._account;
    }

    /**
     * @type {Web3}
     */
    get web3() {
        return this._web3;
    }

    async _serviceGroup(
        serviceMetadata,
        orgId,
        serviceId,
        groupName = undefined
    ) {
        const group = this._findGroup(serviceMetadata.groups, groupName);
        if (!group) {
            const errorMessage = `Group[name: ${groupName}] not found for orgId: ${orgId} and serviceId: ${serviceId}`;
            logMessage('error', 'SnetSDK', errorMessage)
            throw new Error(errorMessage);
        }

        return group;
    }

    _findGroup(groups, groupName) {
        if (!groupName) {
            return isEmpty(groups) ? undefined : groups[0];
        }
        /* eslint-disable camelcase */
        return groups.find(({ group_name }) => group_name === groupName);
    }

    _constructStrategy(paymentChannelManagementStrategy, concurrentCalls = 1) {
        if (paymentChannelManagementStrategy) {
            return paymentChannelManagementStrategy;
        }

        if (this._paymentChannelManagementStrategy) {
            return this._paymentChannelManagementStrategy;
        }

        logMessage('debug', 'SnetSDK', 'PaymentChannelManagementStrategy not provided, using DefaultPaymentChannelManagementStrategy')
        // return new DefaultPaymentChannelManagementStrategy(this);
        return new DefaultPaymentStrategy(concurrentCalls);
    }

    _createIdentity() {
        logMessage('error', 'SnetSDK', '_createIdentity must be implemented in the sub classes')
    }
}

export default SnetSDK;
