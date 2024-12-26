import { error } from 'loglevel';
import PaymentChannelProvider from '../mpe/PaymentChannelProvider';

class BasePaidPaymentStrategy {
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
        this._account = account;
        this._serviceMetadata = serviceMetadata;
        this._blockOffset = blockOffset;
        this._callAllowance = callAllowance;
    }

    /**
     * @returns {Promise<PaymentChannel>}
     * @protected
     */
    async _selectChannel(preselectChannelId) {
        const paymentChannelProvider = new PaymentChannelProvider(
            this._account,
            this._serviceMetadata
        );

        await paymentChannelProvider.updateChannelStates();

        const { paymentChannels } = paymentChannelProvider;
        const serviceCallPrice = this._getPrice();
        const extendedChannelFund = serviceCallPrice * this._callAllowance;
        const mpeBalance = await this._account.escrowBalance();
        const currentBlockNumber = await this._account.getCurrentBlockNumber();
        const defaultExpiration =
            await this._serviceMetadata.defaultChannelExpiration(
                currentBlockNumber
            );
        const extendedExpiry = defaultExpiration + this._blockOffset;

        if (preselectChannelId) {
            const foundPreselectChannel = paymentChannels.find(
                (el) => el.channelId === preselectChannelId
            );
            if (foundPreselectChannel) {
                return foundPreselectChannel;
            }
        }

        let selectedPaymentChannel;

        if (paymentChannels.length < 1) {
            if (serviceCallPrice > mpeBalance) {
                selectedPaymentChannel =
                    await paymentChannelProvider.depositAndOpenChannel(
                        serviceCallPrice,
                        extendedExpiry
                    );
            } else {
                selectedPaymentChannel =
                    await paymentChannelProvider.openChannel(
                        serviceCallPrice,
                        extendedExpiry
                    );
            }
        } else {
            selectedPaymentChannel = paymentChannels[0];
        }
        const hasSufficientFunds = this._doesChannelHaveSufficientFunds(
            selectedPaymentChannel,
            serviceCallPrice
        );
        const isValid = this._isValidChannel(
            selectedPaymentChannel,
            defaultExpiration
        );
        if (hasSufficientFunds && !isValid) {
            await selectedPaymentChannel.extendExpiry(extendedExpiry);
        } else if (!hasSufficientFunds && isValid) {
            await selectedPaymentChannel.addFunds(extendedChannelFund);
        } else if (!hasSufficientFunds && !isValid) {
            await selectedPaymentChannel.extendAndAddFunds(
                extendedExpiry,
                extendedChannelFund
            );
        }
        return selectedPaymentChannel;
    }

    _getPrice() {
        error('_getPrice must be implemented in the sub classes');
    }

    /**
     * @param {PaymentChannel} channel
     * @param {number} requiredAmount
     * @returns {boolean}
     * @private
     */
    _doesChannelHaveSufficientFunds(channel, requiredAmount) {
        return channel.state.availableAmount >= requiredAmount;
    }

    /**
     *
     * @param {PaymentChannel} channel
     * @param {number} expiry
     * @returns {boolean}
     * @private
     */
    _isValidChannel(channel, expiry) {
        return channel.state.expiry >= expiry;
    }
}

export default BasePaidPaymentStrategy;
