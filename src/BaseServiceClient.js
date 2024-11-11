import url from 'url';
import { BigNumber } from 'bignumber.js';
import { isEmpty } from 'lodash';
import { debug, error, info } from 'loglevel';

import { toBNString } from './utils/bignumber_helper';
import { PaymentMetadataGenerator } from './utils/metadataUtils';
/* eslint-disable camelcase */
class BaseServiceClient {
    /**
     * @param {SnetSDK} sdk
     * @param {String} orgId
     * @param {String} serviceId
     * @param {MPEContract} mpeContract
     * @param {ServiceMetadata} metadata
     * @param {Group} group
     * @param {DefaultPaymentStrategy} paymentChannelManagementStrategy
     * @param {ServiceClientOptions} [options={}]
     */
    constructor(
        sdk,
        orgId,
        serviceId,
        mpeContract,
        metadata,
        group,
        paymentChannelManagementStrategy,
        options = {}
    ) {
        this._sdk = sdk;
        this._mpeContract = mpeContract;
        this._options = options;
        this._metadata = { orgId, serviceId, ...metadata };
        this._group = this._enhanceGroupInfo(group);
        this._paymentChannelManagementStrategy =
            paymentChannelManagementStrategy;
        this._modelServiceClient = this._generateModelServiceClient();
    }

    /**
     * @type {Group}
     */
    get group() {
        return this._group;
    }

    /**
     * @type {ServiceMetadata}
     */
    get metadata() {
        return this._metadata;
    }

    /**
     * @type {GRPCClient}
     */
    get paymentChannelStateServiceClient() {
        return this._paymentChannelStateServiceClient;
    }

    /**
     * @type {MPEContract}
     */
    get mpeContract() {
        return this._mpeContract;
    }

    /**
     * @type {boolean}
     */
    get concurrencyFlag() {
        if (typeof this._options.concurrency === 'undefined') {
            return true;
        }
        return this._options.concurrency;
    }

    /**
     * get the details of the service
     * @returns {ServiceDetails}
     */
    getServiceDetails() {
        return {
            orgId: this._metadata.orgId,
            serviceId: this._metadata.serviceId,
            groupId: this._group.group_id,
            groupIdInBytes: this._group.group_id_in_bytes,
            daemonEndpoint: this._getServiceEndpoint(),
        };
    }

    /**
     * Get the configuration for the freecall
     * @returns {FreeCallConfig}
     */
    getFreeCallConfig() {
        console.log('getFreeCallConfig this._options: ', this._options);

        return {
            email: this._options.email,
            tokenToMakeFreeCall: this._options.tokenToMakeFreeCall,
            tokenExpiryDateBlock: this._options.tokenExpirationBlock,
        };
    }

    /**
     * find the current blocknumber
     * @returns {Promise<number>}
     */
    async getCurrentBlockNumber() {
        try {
            return await this._web3.eth.getBlockNumber();
        } catch (error) {
            throw new Error('getting current block number error: ', error);
        }
    }

    /**
     * @param {...(*|Object)} data
     * @param {string} data.(t|type) - Type of data. One of the following (string|uint256|int256|bool|bytes)
     * @param {string} data.(v|value) - Value
     * @returns {Promise<Buffer>} - Signed binary data
     * @see {@link https://web3js.readthedocs.io/en/1.0/web3-utils.html#soliditysha3|data}
     */
    async signData(...data) {
        try {
            return await this.account.signData(...data);
        } catch (error) {
            throw new Error('signing data error: ', error);
        }
    }

    /**
     * @returns {Promise<number>}
     */
    async defaultChannelExpiration() {
        try {
            const currentBlockNumber = await this.getCurrentBlockNumber();
            const paymentExpirationThreshold =
                this._getPaymentExpiryThreshold();
            return toBNString(currentBlockNumber) + paymentExpirationThreshold;
        } catch (error) {
            throw new Error(
                'getting default channel expiration error: ',
                error
            );
        }
    }

    _getPaymentExpiryThreshold() {
        if (isEmpty(this._group)) {
            return 0;
        }
        const paymentExpirationThreshold =
            this._group.payment.payment_expiration_threshold;
        return paymentExpirationThreshold || 0;
    }

    _enhanceGroupInfo(group) {
        if (isEmpty(group)) {
            return group;
        }

        const { payment_address, payment_expiration_threshold } = group.payment;

        return {
            group_id_in_bytes: Buffer.from(group.group_id, 'base64'),
            ...group,
            payment_address,
            payment_expiration_threshold,
        };
    }

    async _fetchPaymentMetadata() {
        console.log('this._options: ', this._options);

        const metadataGenerator = new PaymentMetadataGenerator();

        if (!this._options.paidCallMetadataGenerator) {
            console.log(
                '_options.paidCallMetadataGenerator is false, will use: ',
                this._paymentChannelManagementStrategy
            );

            const metadata =
                await this._paymentChannelManagementStrategy.getPaymentMetadata(
                    this
                );

            // const metadata = metadataGenerator.generateMetadata(metadataValues);
            console.log('_fetchPaymentMetadata metadata: ', metadata);

            return metadata;
        }

        debug('Selecting PaymentChannel using the given strategy', {
            tags: ['PaypalPaymentMgmtStrategy, gRPC'],
        });
        try {
            const channel =
                await this._paymentChannelManagementStrategy.selectChannel(
                    this
                );
            const {
                channelId,
                state: { nonce, currentSignedAmount },
            } = channel;
            const signingAmount = currentSignedAmount.plus(
                this._pricePerServiceCall
            );
            const channelIdStr = toBNString(channelId);
            const nonceStr = toBNString(nonce);
            const signingAmountStr = toBNString(signingAmount);
            info(
                `Using PaymentChannel[id: ${channelIdStr}] with nonce: ${nonceStr} and amount: ${signingAmountStr} and `,
                { tags: ['PaymentChannelManagementStrategy', 'gRPC'] }
            );
            const { signatureBytes } =
                await this._options.paidCallMetadataGenerator(
                    channelId,
                    signingAmount,
                    nonce
                );
            const metadataValues = {
                type: 'escrow',
                channelId,
                channelNonce: nonce,
                channelAmount: signingAmount,
                signatureBytes: signatureBytes,
            };
            const metadata = metadataGenerator.generateMetadata(metadataValues);
            console.log('CORE _fetchPaymentMetadata metadata: ', metadata);

            return metadata;
        } catch (error) {
            throw new Error('fathing payment metada error: ', error);
        }
    }

    get _web3() {
        return this._sdk.web3;
    }

    /**
     * @type {Account}
     */
    get account() {
        return this._sdk.account;
    }

    get _pricePerServiceCall() {
        const { pricing } = this.group;
        const fixedPricing = pricing.find(
            ({ price_model }) => price_model === 'fixed_price'
        );

        return new BigNumber(fixedPricing.price_in_cogs);
    }

    _getServiceEndpoint() {
        if (this._options.endpoint) {
            return url.parse(this._options.endpoint); // TODO new URL
        }

        const { endpoints } = this.group;
        const endpoint = isEmpty(endpoints) ? undefined : endpoints[0];
        debug(`Service endpoint: ${endpoint}`, { tags: ['gRPC'] });
        return endpoint && url.parse(endpoint); // TODO new URL
    }

    _generatePaymentChannelStateServiceClient() {
        error(
            '_generatePaymentChannelStateServiceClient must be implemented in the sub classes'
        );
    }

    _getChannelStateRequestMethodDescriptor() {
        error(
            '_getChannelStateRequestMethodDescriptor must be implemented in the sub classes'
        );
    }

    _generateModelServiceClient() {
        error(
            '_generateTrainingStateServiceClient must be implemented in the sub classes'
        );
    }

    _getModelRequestMethodDescriptor() {
        error(
            '_getModelRequestMethodDescriptor must be implemented in the sub classes'
        );
    }

    _getAuthorizationRequestMethodDescriptor() {
        error(
            '_getAuthorizationRequestMethodDescriptor must be implemented in the sub classes'
        );
    }

    _getCreateModelRequestMethodDescriptor() {
        error(
            '_getCreateModelRequestMethodDescriptor must be implemented in the sub classes'
        );
    }

    _getDeleteModelRequestMethodDescriptor() {
        error(
            '_getDeleteModelRequestMethodDescriptor must be implemented in the sub classes'
        );
    }

    _getUpdateModelRequestMethodDescriptor() {
        error(
            '__getUpdateModelRequestMethodDescriptor must be implemented in the sub classes'
        );
    }

    _getModelDetailsRequestMethodDescriptor() {
        error(
            '_getModelDetailsRequestMethodDescriptor must be implemented in the sub classes'
        );
    }

    get concurrencyManager() {
        error('concurrencyManager must be implemented in the sub classes');
        return undefined;
    }
}

export default BaseServiceClient;
