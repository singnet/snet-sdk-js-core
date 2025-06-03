import { logMessage, PaymentMetadataGenerator, toBNString } from './utils';
import { BigNumber } from 'bignumber.js';
import { isEmpty } from 'lodash';

class ServiceMetadataProvider {
    constructor(orgId, serviceId, metadata, mpeContract, group, options = {}) {
        const { serviceMetadata, orgMetadata } = metadata;
        this._serviceMetadata = { orgId, serviceId, ...serviceMetadata };
        this._orgMetadata = orgMetadata;
        this._mpeContract = mpeContract;
        this._group = this.enhanceGroupInfo(group);
        this._options = options;
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
     * @type {MPEContract}
     */
    get mpeContract() {
        return this._mpeContract;
    }

    get concurrencyManager() {
        logMessage('error', 'ServiceMetadataProvider', 'concurrencyManager must be implemented in the sub classes');
        return undefined;
    }

    /**
     * @type {ServiceMetadataProvider}
     */
    get serviceMetadata() {
        return this._serviceMetadata;
    }

    get organizationMetadata() {
        return this._orgMetadata;
    }

    /**
     * @type {Group}
     */
    get group() {
        return this._group;
    }

    get pricePerServiceCall() {
        const { pricing } = this.group;
        const fixedPricing = pricing.find(
            ({ price_model }) => price_model === 'fixed_price'
        );

        return new BigNumber(fixedPricing.price_in_cogs);
    }

    /**
     * get the details of the service
     * @returns {ServiceDetails}
     */
    getServiceDetails() {
        return {
            orgId: this._serviceMetadata.orgId,
            serviceId: this._serviceMetadata.serviceId,
            groupId: this._group.group_id,
            groupIdInBytes: this._group.group_id_in_bytes,
            daemonEndpoint: this._getServiceEndpoint(),
        };
    }

    getPaymentExpiryThreshold() {
        if (isEmpty(this._group)) {
            return 0;
        }
        const paymentExpirationThreshold =
            this._group.payment.payment_expiration_threshold;
        return paymentExpirationThreshold || 0;
    }

    /**
     * @returns {Promise<number>}
     */
    async defaultChannelExpiration(currentBlockNumber) {
        try {
            const paymentExpirationThreshold = this.getPaymentExpiryThreshold();
            return toBNString(currentBlockNumber) + paymentExpirationThreshold;
        } catch (error) {
            throw new Error(
                'getting default channel expiration error: ',
                error
            );
        }
    }

    async fetchPaymentMetadata(paymentChannelManagementStrategy) {
        const metadataGenerator = new PaymentMetadataGenerator();

        if (!this._options.paidCallMetadataGenerator) {
            return await paymentChannelManagementStrategy.getPaymentMetadata(this);
        }

        logMessage('debug', 'ServiceMetadataProvider', 'Selecting PaymentChannel using the given strategy');
        try {
            const channel =
                await paymentChannelManagementStrategy.selectChannel(
                    this.serviceClient
                );
            const {
                channelId,
                state: { nonce, currentSignedAmount },
            } = channel;
            const signingAmount = currentSignedAmount.plus(
                this.pricePerServiceCall
            );
            const channelIdStr = toBNString(channelId);
            const nonceStr = toBNString(nonce);
            const signingAmountStr = toBNString(signingAmount);
            logMessage('info', 'ServiceMetadataProvider', `Using PaymentChannel[id: ${channelIdStr}] with nonce: ${nonceStr} and amount: ${signingAmountStr}`)
            const { signatureBytes } =
                await this.serviceClient._options.paidCallMetadataGenerator(
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
            return metadataGenerator.generateMetadata(metadataValues);
        } catch (error) {
            throw new Error('fetching payment service metadata error: ', error);
        }
    }

    enhanceGroupInfo(group) {
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

    _getServiceEndpoint() {
        if (this._options.endpoint) {
            return new URL(this._options.endpoint);
        }

        const { endpoints } = this.group;
        if (isEmpty(endpoints) || endpoints.length === 0) {
            throw new Error('Service endpoints is empty');
        }
        const endpoint = endpoints[0];
        logMessage('debug', 'ServiceMetadataProvider', `Service endpoint: ${endpoint}`)

        return new URL(endpoint);
    }
}

export default ServiceMetadataProvider;
