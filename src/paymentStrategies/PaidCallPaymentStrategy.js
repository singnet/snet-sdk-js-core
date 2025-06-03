import BasePaidPaymentStrategy from './BasePaidPaymentStrategy';

class PaidCallPaymentStrategy extends BasePaidPaymentStrategy {
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
    }

    /**
     * Get the metadata for the gRPC payment call
     * @returns {Promise<[{'snet-payment-type': string}, {'snet-payment-channel-id': string}, {'snet-payment-channel-nonce': string}, {'snet-payment-channel-amount': string}, {'snet-payment-channel-signature-bin': Buffer}]>}
     */
    async getPaymentMetadata() {
        const channel = await this._selectChannel();
        const amount =
            channel.state.currentSignedAmount.toNumber() + this._getPrice();
        const signature = await this._generateSignature(
            channel.channelId,
            channel.state.nonce,
            amount
        );

        return {
            type: 'escrow',
            channelId: channel.channelId,
            channelNonce: channel.state.nonce,
            channelAmount: amount,
            signatureBytes: signature,
        };
    }

    /**
     * @returns {Promise<[{'snet-payment-type': string}, {'snet-payment-channel-id': string}, {'snet-payment-channel-nonce': string}, {'snet-payment-channel-amount': string}, {'snet-payment-channel-signature-bin': Buffer}]>}
     */
    async getTrainingPaymentMetadata(modelId, amount) {
        const channel = await this._selectChannel(undefined, amount);
        const currentNonce = channel.state.nonce;
        const channelAmount = channel.state.currentSignedAmount.toNumber() + amount;
        const signature = await this._generateSignature(channel.channelId, currentNonce, channelAmount);
        const metadataFields = {
            type: 'train-call',
            modelId: modelId,
            channelId: channel.channelId,
            channelNonce: channel.state.nonce,
            channelAmount,
            signatureBytes: signature
        };
        return metadataFields;
    }

    /**
     * Generate signature for getting payment metadata
     * @param {uint256} channelId
     * @param {uint256} nonce
     * @param {uint256} amount
     * @returns {Promise<Buffer>}
     * @private
     */
    async _generateSignature(channelId, nonce, amount) {
        return this._account.signData(
            { t: 'string', v: '__MPE_claim_message' },
            { t: 'address', v: this._serviceMetadata.mpeContract.address },
            { t: 'uint256', v: channelId },
            { t: 'uint256', v: nonce },
            { t: 'uint256', v: amount }
        );
    }

    /**
     * total price for all the service calls
     * @returns {number}
     * @private
     */
    _getPrice() {
        return this._serviceMetadata.pricePerServiceCall.toNumber();
    }
}

export default PaidCallPaymentStrategy;
