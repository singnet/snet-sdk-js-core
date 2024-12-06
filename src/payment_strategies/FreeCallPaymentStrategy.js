import { toBNString } from '../utils/bignumber_helper';
import EncodingUtils from '../utils/encodingUtils';
import { FreecallMetadataGenerator } from '../utils/metadataUtils';
import { error, info } from 'loglevel';

class FreeCallPaymentStrategy {
    /**
     * @param {Account} account
     * @param {ServiceMetadataProvider} serviceMetadata
     */
    constructor(account, serviceMetadata) {
        this._account = account;
        this._serviceMetadata = serviceMetadata;
        this._freeCallStateServiceClient = undefined; // must be implemented as subclass property
        this._freeCallStateMethodDescriptor = undefined; // must be implemented as subclass property
        this._encodingUtils = new EncodingUtils();
        this.metadataGenerator = new FreecallMetadataGenerator();
    }

    /**
     * Check if there is any freecalls left for x service.
     * @returns {Promise<boolean>}
     */
    async isFreeCallAvailable() {
        try {
            const freeCallsAvailable = await this.getFreeCallsAvailable();

            info('is freecalls available', freeCallsAvailable, {
                tags: ['freecalls'],
            });
            return freeCallsAvailable > 0;
        } catch (err) {
            error('is freecall available error', err, {
                tags: ['freecalls'],
            });
            return false;
        }
    }

    /**
     * Get the metadata for the gRPC free-call
     * @returns {Promise<({'snet-free-call-auth-token-bin': FreeCallConfig.tokenToMakeFreeCall}|{'snet-free-call-token-expiry-block': *}|{'snet-payment-type': string}|{'snet-free-call-user-id': *}|{'snet-current-block-number': *})[]>}
     */
    async getPaymentMetadata() {
        const { email, tokenToMakeFreeCall, tokenExpiryDateBlock } =
            this._serviceMetadata.getFreeCallConfig();
        const currentBlockNumber = await this._account.getCurrentBlockNumber();
        const signature = await this._generateSignature(currentBlockNumber);
        const tokenBytes =
            this._encodingUtils.hexStringToBytes(tokenToMakeFreeCall);
        const metadataFields = {
            type: 'free-call',
            userId: email,
            currentBlockNumber,
            freecallAuthToken: tokenBytes,
            freecallTokenExpiryBlock: tokenExpiryDateBlock,
            signatureBytes: signature,
        };

        return this.metadataGenerator.generateMetadata(metadataFields);
    }

    /**
     * Fetch the free calls available data from daemon
     * @returns {Promise<FreeCallStateReply>}
     * @private
     */
    async getFreeCallsAvailable() {
        const freeCallStateRequest = await this._getFreeCallStateRequest();
        if (!freeCallStateRequest) {
            info('freecalls state request is undefined', {
                tags: ['freecalls'],
            });
            // Bypassing free calls if the token is empty
            return undefined;
        }

        const freeCallsAvailableReply = await new Promise((resolve, reject) =>
            this._freeCallStateServiceClient.getFreeCallsAvailable(
                freeCallStateRequest,
                (err, responseMessage) => {
                    if (err) {
                        error('getting freecalls error', err, {
                            tags: ['freecalls'],
                        });
                        reject(err);
                    } else {
                        resolve(responseMessage);
                    }
                }
            )
        );

        const freeCallsAvailable = freeCallsAvailableReply
            ? freeCallsAvailableReply.getFreeCallsAvailable()
            : 0;

        return freeCallsAvailable;
    }

    /**
     *
     * @returns {Promise<Bytes<Signature>>>}
     * @private
     */
    async _generateSignature(currentBlockNumber) {
        const { orgId, serviceId, groupId } =
            this._serviceMetadata.getServiceDetails();
        const { email, tokenToMakeFreeCall, tokenExpiryDateBlock } =
            this._serviceMetadata.getFreeCallConfig();
        if (tokenExpiryDateBlock === 0 || !email || email.length === 0) {
            throw Error('invalid entries');
        }
        const enhancedToken = /^0x/.test(tokenToMakeFreeCall.toLowerCase())
            ? tokenToMakeFreeCall.substring(2, tokenToMakeFreeCall.length)
            : tokenToMakeFreeCall;
        return this._account.signData(
            { t: 'string', v: '__prefix_free_trial' },
            { t: 'string', v: email },
            { t: 'string', v: orgId },
            { t: 'string', v: serviceId },
            { t: 'string', v: groupId },
            { t: 'uint256', v: currentBlockNumber },
            { t: 'bytes', v: enhancedToken }
        );
    }

    /**
     * create the request for the freecall state service grpc
     * @returns {FreeCallStateRequest}
     * @private
     */
    async _getFreeCallStateRequest() {
        try {
            const request =
                new this._freeCallStateMethodDescriptor.requestType();

            const {
                userId,
                tokenForFreeCall,
                tokenExpiryDateBlock,
                signature,
                currentBlockNumber,
            } = await this._getFreeCallStateRequestProperties();

            //  if the token for freecall is empty, then user is taken to paid call directly
            if (!tokenForFreeCall) {
                return undefined;
            }

            const tokenBytes =
                this._encodingUtils.hexStringToBytes(tokenForFreeCall);
            request.setUserId(userId);
            request.setTokenForFreeCall(tokenBytes);
            request.setTokenExpiryDateBlock(tokenExpiryDateBlock);
            request.setSignature(signature);
            request.setCurrentBlock(currentBlockNumber);

            return request;
        } catch (err) {
            throw new Error('Free call state request error: ', err);
        }
    }

    async _getFreeCallStateRequestProperties() {
        const freecallConfig = this._serviceMetadata.getFreeCallConfig();

        const { email, tokenToMakeFreeCall, tokenExpiryDateBlock } =
            freecallConfig;
        const currentBlockNumber = await this._account.getCurrentBlockNumber();
        const signature = await this._generateSignature(currentBlockNumber);
        return {
            userId: email,
            tokenForFreeCall: tokenToMakeFreeCall,
            tokenExpiryDateBlock,
            signature,
            currentBlockNumber: toBNString(currentBlockNumber),
        };
    }

    // /**
    //  * create the grpc client for free call state service
    //  * @returns {module:grpc.Client}
    //  * @private
    //  */
    // _generateFreeCallStateServiceClient() {
    //     const serviceEndpoint = this._serviceMetadata._getServiceEndpoint();
    //     const grpcCredentials = this._getGrpcCredentials(serviceEndpoint);
    //     return new services.FreeCallStateServiceClient(
    //         serviceEndpoint.host,
    //         grpcCredentials
    //     );
    // }
}

export default FreeCallPaymentStrategy;
