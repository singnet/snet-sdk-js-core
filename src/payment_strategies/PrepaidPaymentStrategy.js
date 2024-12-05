import BasePaidPaymentStrategy from './BasePaidPaymentStrategy';
import EncodingUtils from '../utils/encodingUtils';

class PrepaidPaymentStrategy extends BasePaidPaymentStrategy {
    /**
     * @param {Account} account
     * @param {ServiceMetadataProvider} serviceMetadata
     * @param {number} blockOffset
     * @param {number} callAllowance
     */
    constructor(
        account,
        serviceMetadata,
        blockOffset = 240,
        callAllowance = 1
    ) {
        super(account, serviceMetadata, blockOffset, callAllowance);
        this._encodingUtils = new EncodingUtils();
        this._concurrencyManager = serviceMetadata.concurrencyManager;
    }

    /**
     * @returns {Promise<[{'snet-payment-type': string}, {'snet-payment-channel-id': string}, {'snet-payment-channel-nonce': string}, {'snet-prepaid-auth-token-bin': *}]>}
     */
    async getPaymentMetadata(preselectChannelId) {
        if (!this._concurrencyManager) {
            throw new Error('concurrency manager not found!');
        }

        const channel = await this._selectChannel(preselectChannelId);
        const concurrentCallsPrice = this._getPrice();
        const token = await this._concurrencyManager.getToken(
            channel,
            concurrentCallsPrice
        );
        const tokenBytes = this._encodingUtils.utfStringToBytes(token);
        const metadataFields = {
            type: 'prepaid-call',
            channelId: channel.channelId,
            channelNonce: channel.state.nonce,
            prepaidAuthTokenBytes: tokenBytes,
        };
        return metadataFields;
    }

    /**
     * @returns {Promise<String>} concurrencyToken
     */
    async getConcurrencyToken(channel) {
        const concurrentCallsPrice = this._getPrice();
        const token = await this._concurrencyManager.getToken(
            channel,
            concurrentCallsPrice
        );
        return token;
    }

    /**
     * total price for all the service calls
     * @returns {number}
     * @private
     */
    _getPrice() {
        if (!this._concurrencyManager?.concurrentCalls) {
            return 0;
        }

        return (
            this._serviceMetadata.pricePerServiceCall.toNumber() *
            this._concurrencyManager.concurrentCalls
        );
    }
}

export default PrepaidPaymentStrategy;
