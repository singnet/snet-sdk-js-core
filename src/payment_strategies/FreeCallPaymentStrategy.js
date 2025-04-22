import { toBNString } from '../utils/bignumber_helper';
import EncodingUtils from '../utils/encodingUtils';
import { logMessage } from '../utils/logger';
import { FreecallMetadataGenerator } from '../utils/metadataUtils';

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
        this._freeCallTokenMethodDescriptor = undefined; // must be implemented as subclass property
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

            logMessage('info', 'FreeCallPaymentStrategy', 'is freecalls available');
            return freeCallsAvailable > 0;
        } catch (err) {
            logMessage('error', 'FreeCallPaymentStrategy', 'is freecall available error');
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
            userAddress: email,
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
            logMessage('info', 'FreeCallPaymentStrategy', 'freecalls state request is undefined');
            // Bypassing free calls if the token is empty
            return undefined;
        }

        const freeCallsAvailableReply = await new Promise((resolve, reject) =>
            this._freeCallStateServiceClient.getFreeCallsAvailable(
                freeCallStateRequest,
                (err, responseMessage) => {
                    if (err) {
                        logMessage('error', 'FreeCallPaymentStrategy', 'getting freecalls error');
                        reject(err);
                    } else {
                        resolve(responseMessage);
                    }
                }
            )
        );

        return freeCallsAvailableReply
            ? freeCallsAvailableReply.getFreeCallsAvailable()
            : 0;
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
        if (tokenExpiryDateBlock === 0 || email === '' || tokenToMakeFreeCall === '') {
            console.log('freecall _generateSignature error: invalid entries')
            return undefined
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
        async _getFreeCallTokenRequest(params) {
            try {
                const request =
                    new this._freeCallTokenMethodDescriptor.requestType();
    
                request.setGroupId(params.groupId);
                request.setOrgId(params.orgId);
                request.setAddress(params.address);

                return request;
            } catch (err) {
                console.log('freecall state request error: invalid entries')
                return undefined
            }
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
                userAddress,
                tokenForFreeCall,
                tokenExpiryDateBlock,
                signature,
                currentBlockNumber,
            } = await this._getFreeCallStateRequestProperties();

            //  if the token for freecall is empty, then user is taken to paid call directly
            if (!tokenForFreeCall || !tokenExpiryDateBlock || !userAddress || !signature || !currentBlockNumber) {
                console.log('freecall state request error: invalid entries')
                return undefined;
            }

            const tokenBytes =
                this._encodingUtils.hexStringToBytes(tokenForFreeCall);
            request.setUserAddress(userAddress);
            request.setTokenForFreeCall(tokenBytes);
            request.setTokenExpiryDateBlock(tokenExpiryDateBlock);
            request.setSignature(signature);
            request.setCurrentBlock(currentBlockNumber);

            return request;
        } catch (err) {
            console.log('freecall state request error: invalid entries')
            return undefined
        }
    }

    async _getFreeCallStateRequestProperties() {
        // const { tokenToMakeFreeCall, tokenExpiryDateBlock } =
        //     this._serviceMetadata.getFreeCallConfig();
        const tokenToMakeFreeCall = await this._getFreeCallTokenRequest();
        const currentBlockNumber = await this._account.getCurrentBlockNumber();
        const userAddress = await this._account.getAddress();
        const signature = await this._generateSignature(currentBlockNumber);
        return {
            userAddress: userAddress,
            tokenForFreeCall: tokenToMakeFreeCall,
            tokenExpiryDateBlock,
            signature,
            currentBlockNumber: toBNString(currentBlockNumber),
        };
    }

    /**
     * create the grpc client for free call state service
     * @returns {module:grpc.Client}
     * @private
     */
    _generateFreeCallStateServiceClient() {
        const serviceEndpoint = this._serviceMetadata._getServiceEndpoint();
        const grpcCredentials = this._getGrpcCredentials(serviceEndpoint);
        return new services.FreeCallStateServiceClient(
            serviceEndpoint.host,
            grpcCredentials
        );
    }
}

export default FreeCallPaymentStrategy;
