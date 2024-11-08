import BigNumber from 'bignumber.js';

// import { log as logger } from 'loglevel';
import { toBNString, uint8ArrayToBN } from '../utils/bignumber_helper';
import PaymentChannelProvider from './PaymentChannelProvider';
import { debug, error } from 'loglevel';

class PaymentChannel {
    /**
     * @param {BigNumber} channelId
     * @param {Web3} web3
     * @param {Account} account
     * @param {BaseServiceClient} service
     * @param {MPEContract} mpeContract
     */
    constructor(channelId, web3, account, service, mpeContract) {
        this._channelId = channelId;
        this._web3 = web3;
        this._account = account;
        this._mpeContract = mpeContract;
        this._serviceClient = service;
        this._state = {
            nonce: new BigNumber(0),
            currentSignedAmount: new BigNumber(0),
        };
    }

    /**
     * @type {BigNumber}
     */
    get channelId() {
        return this._channelId;
    }

    /**
     * @type {PaymentChannelState}
     */
    get state() {
        return this._state;
    }

    /**
     * Adds fund to the payment channel
     * @param {BigNumber} amount
     * @returns {Promise.<TransactionReceipt>}
     */
    async addFunds(amount) {
        return this._mpeContract.channelAddFunds(
            this._account,
            this._channelId,
            amount
        );
    }

    /**
     * Extends the expiry of the payment channel
     * @param {BigNumber} expiry - Expiry in terms of block number
     * @returns {Promise.<TransactionReceipt>}
     */
    async extendExpiry(expiry) {
        return this._mpeContract.channelExtend(
            this._account,
            this._channelId,
            expiry
        );
    }

    /**
     * Extends the expiry of the payment channel and add funds to it
     * @param {BigNumber} expiry
     * @param {BigNumber} amount
     * @returns {Promise.<TransactionReceipt>}
     */
    async extendAndAddFunds(expiry, amount) {
        return this._mpeContract.channelExtendAndAddFunds(
            this._account,
            this._channelId,
            expiry,
            amount
        );
    }

    /**
     * Claims unused tokens in the channel from the MPE Account.
     * @returns {Promise.<TransactionReceipt>}
     */
    async claimUnusedTokens() {
        return this._mpeContract.channelClaimTimeout(
            this._account,
            this._channelId
        );
    }

    /**
     * Updates the state of the payment channel by fetching latest info from the mpe contract and the ai service daemon
     * @returns {Promise<PaymentChannel>}
     */
    async syncState() {
        debug(`Syncing PaymentChannel[id: ${this._channelId}] state`, {
            tags: ['PaymentChannel'],
        });
        // try {
        const latestChannelInfoOnBlockchain = await this._mpeContract.channels(
            this._channelId
        );
        console.log("latestChannelInfoOnBlockchain: ", latestChannelInfoOnBlockchain);

        const currentState = await this._currentChannelState();
        console.log('currentState: ', currentState);
        const { currentSignedAmount, nonce: currentNonce } = currentState;
        const {
            nonce,
            expiration: expiry,
            value: amountDeposited,
        } = latestChannelInfoOnBlockchain;
        const availableAmount =
            toBNString(amountDeposited) - toBNString(currentSignedAmount);
        this._state = {
            nonce: nonce.toString(),
            currentNonce,
            expiry,
            amountDeposited,
            currentSignedAmount,
            availableAmount,
        };
        // logger.debug(
        //     `Latest PaymentChannel[id: ${this._channelId}] state:`,
        //     this._state,
        //     { tags: ['PaymentChannel'] }
        // );
        return Promise.resolve(this);
        // } catch (error) {
        //     throw new Error('syncing payment channel state error: ', error);
        // }
    }

    async _currentChannelState() {
        console.log('_currentChannelState start');

        debug(
            `Fetching latest PaymentChannel[id: ${this._channelId}] state from service daemon`,
            { tags: ['PaymentChannel'] }
        );
        try {
            const paymentChannelProvider = new PaymentChannelProvider(
                this._serviceClient
            );
            const response = await paymentChannelProvider.getChannelState(
                this._channelId
            );
            console.log('_currentChannelState response: ', response.toObject());

            const nonce = uint8ArrayToBN(response.getCurrentNonce());
            const currentSignedAmount = uint8ArrayToBN(
                response.getCurrentSignedAmount()
            );
            const channelState = {
                currentSignedAmount,
                nonce,
            };
            return Promise.resolve(channelState);
        } catch (err) {
            error(
                `Failed to fetch latest PaymentChannel[id: ${this._channelId}] state from service daemon. ${err.message}`,
                { tags: ['PaymentChannel'] }
            );
            return Promise.reject(err);
        } finally {
            console.log('_currentChannelState end');
        }
    }
}

export default PaymentChannel;
