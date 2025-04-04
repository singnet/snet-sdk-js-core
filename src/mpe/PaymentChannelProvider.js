import { toBNString } from '../utils/bignumber_helper';
import { logMessage } from '../utils/logger';

class PaymentChannelProvider {
    /**
     * @param {Account} account
     * @param {ServiceMetadataProvider} serviceMetadata
     */
    constructor(account, serviceMetadata) {
        this.options = serviceMetadata._options;
        this.account = account;
        this.mpeContract = serviceMetadata.mpeContract;
        this.group = serviceMetadata.group;
        this.serviceMetadata = serviceMetadata;
        this.paymentChannels = [];
        this.ChannelModelProvider = serviceMetadata?.ChannelModelProvider; //should be implemented as subclass
        this.lastReadBlock;
    }

    async _channelStateRequestProperties(channelId) {
        try {
            if (this.options.channelStateRequestSigner) {
                const { currentBlockNumber, signatureBytes } =
                    await this.options.channelStateRequestSigner(channelId);
                return { currentBlockNumber, signatureBytes };
            }
            const currentBlockNumber =
                await this.account.getCurrentBlockNumber();
            const channelIdStr = toBNString(channelId);
            const signatureBytes = await this.account.signData(
                { t: 'string', v: '__get_channel_state' },
                { t: 'address', v: this.mpeContract.address },
                { t: 'uint256', v: channelIdStr },
                { t: 'uint256', v: currentBlockNumber }
            );

            return { currentBlockNumber, signatureBytes };
        } catch (error) {
            throw new Error(
                'channel state request properties generating error: ',
                error
            );
        }
    }

    async _channelStateRequest(channelId) {
        const { currentBlockNumber, signatureBytes } =
            await this._channelStateRequestProperties(toBNString(channelId));
        const channelIdBytes = Buffer.alloc(4);
        channelIdBytes.writeUInt32BE(toBNString(channelId), 0);

        const ChannelStateRequest =
            this.ChannelModelProvider.getChannelStateRequestMethodDescriptor();
        const channelStateRequest = new ChannelStateRequest();
        channelStateRequest.setChannelId(channelIdBytes);
        channelStateRequest.setSignature(signatureBytes);
        channelStateRequest.setCurrentBlock(toBNString(currentBlockNumber));
        return channelStateRequest;
    }

    async _getNewlyOpenedChannel() {
        try {
            const openChannels = await this.mpeContract.getPastOpenChannels(
                this.account,
                this.serviceMetadata,
                this.group
            );
            const newPaymentChannel = openChannels[0];
            logMessage('info', 'PaymentChannelProvider', `New PaymentChannel[id: ${newPaymentChannel.channelId}] opened`)
            return newPaymentChannel;
        } catch (error) {
            throw new Error('getting newly opened channel error: ', error);
        }
    }

    /**
     * Fetches the latest channel state from the ai service daemon
     * @param channelId
     * @returns {Promise<ChannelStateReply>}
     */
    async getChannelState(channelId) {
        const channelStateRequest = await this._channelStateRequest(channelId);

        return new Promise((resolve, reject) => {
            const paymentChannelStateServiceClient =
                this.ChannelModelProvider.generatePaymentChannelStateServiceClient();

            paymentChannelStateServiceClient.getChannelState(
                channelStateRequest,
                (err, response) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(response);
                    }
                }
            );
        });
    }

    /**
     * @returns {Promise.<PaymentChannel[]>}
     */
    async loadOpenChannels() {
        const newPaymentChannels = await this.mpeContract.getPastOpenChannels(
            this.account,
            this.serviceMetadata,
            this.group,
        );
        logMessage('debug', 'PaymentChannelProvider', `Found ${newPaymentChannels.length} payment channel open events`);
        this.paymentChannels = [...this.paymentChannels, ...newPaymentChannels];
        return this.paymentChannels;
    }

    findPreselectChannel = (paymentChannels, preselectChannelId) =>{ 
        const preselectChannel = paymentChannels.find(
            (el) => el.channelId === preselectChannelId
        );
        if (preselectChannel) {
            return preselectChannel;
        }
    }

    /**
     * @param preselectChannelId
     * @returns {Promise.<PaymentChannel[]>}
     */
    async updateChannelState(preselectChannelId) {
        logMessage('info', 'PaymentChannelProvider', 'Updating payment channel state')
        const loadedChannels = await this.loadOpenChannels();
        this.paymentChannels = loadedChannels;

        let channel;
        if (preselectChannelId) {
            channel = this.findPreselectChannel(loadedChannels, preselectChannelId);
        } else {
            channel = loadedChannels[0]
        }

        await channel.syncState();
        return loadedChannels;
    }

    /**
     *
     * @param {BigNumber} amount
     * @param {BigNumber} expiry
     * @returns {Promise.<PaymentChannel>}
     */
    async openChannel(amount, expiry) {
        try {
            await this.mpeContract.openChannel(
                this.account,
                this.group,
                amount,
                expiry
            );
            return this._getNewlyOpenedChannel();
        } catch (error) {
            throw new Error('opening channel states error: ', error);
        }
    }

    /**
     * @param {BigNumber} amount
     * @param {BigNumber} expiry
     * @returns {Promise.<PaymentChannel>}
     */
    async depositAndOpenChannel(amount, expiry) {
        try {
            await this.mpeContract.depositAndOpenChannel(
                this.account,
                this.group,
                amount,
                expiry
            );
            return this._getNewlyOpenedChannel();
        } catch (error) {
            throw new Error(
                'depositing and opening channel states error: ',
                error
            );
        }
    }
}

export default PaymentChannelProvider;
