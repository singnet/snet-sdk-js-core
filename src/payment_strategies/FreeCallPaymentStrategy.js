import { toBNString } from "../utils/bignumber_helper";
import EncodingUtils from "../utils/encodingUtils";
import { logMessage } from "../utils/logger";
import { FreecallMetadataGenerator } from "../utils/metadataUtils";
import { wrapRpcToPromise } from "../utils/protoHelper";

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
     * Get the metadata for the gRPC free-call
     * @returns {Promise<({'snet-free-call-auth-token-bin': FreeCallConfig.tokenToMakeFreeCall}|{'snet-free-call-token-expiry-block': *}|{'snet-payment-type': string}|{'snet-free-call-user-id': *}|{'snet-current-block-number': *})[]>}
     */
    async getPaymentMetadata() {
        const {address} = await this._getNecessaryFieldsForGetFreeCallsAvailable();
        const tokenWithExpiration = await this._getFreeCallsTokenWithExpiration(address);

        const currentBlockNumber = await this._account.getCurrentBlockNumber();
        const signature = await this._generateSignature(address, currentBlockNumber, tokenWithExpiration.tokenHex, tokenWithExpiration.tokenExpirationBlock);
        const tokenBytes = this._encodingUtils.hexStringToBytes(tokenWithExpiration.tokenHex);
        const metadataFields = {
            type: "free-call",
            userAddress: address,
            currentBlockNumber,
            freecallAuthToken: tokenBytes,
            freecallTokenExpiryBlock: tokenWithExpiration.tokenExpirationBlock,
            signatureBytes: signature,
        };

        return this.metadataGenerator.generateMetadata(metadataFields);
    }

    /* getFreeCallsAvailable helpers */
    async _getNecessaryFieldsForGetFreeCallsAvailable() {
        const address = await this._account.getAddress();
        return { address };
    }
    _getFreeCallsTokenWithExpirationRequest(address) {
        const request = new this._freeCallTokenMethodDescriptor.requestType();
        request.setAddress(address);
        return request;
    }
    async _getFreeCallsTokenWithExpiration(address) {
        const request = this._getFreeCallsTokenWithExpirationRequest(address);
        const tokenWithExpirationResponse = await wrapRpcToPromise(
        this._freeCallStateServiceClient, "getFreeCallToken", request);
        const token = tokenWithExpirationResponse.getToken(); //INFO: not used
        const tokenHex = tokenWithExpirationResponse.getTokenHex();
        const tokenExpirationBlock = tokenWithExpirationResponse.getTokenExpirationBlock();
        return { token, tokenHex, tokenExpirationBlock };
    }

    /**
     *
     * @returns {Promise<Bytes<Signature>>>}
     * @private
     */
    async _generateSignature(address, currentBlockNumber, tokenToMakeFreeCall, tokenExpiryDateBlock) {
        const { orgId, serviceId, groupId } = this._serviceMetadata.getServiceDetails();

        const enhancedToken = /^0x/.test(tokenToMakeFreeCall.toLowerCase()) ? tokenToMakeFreeCall.substring(2, tokenToMakeFreeCall.length) : tokenToMakeFreeCall;
        return this._account.signData(
            { t: "string", v: "__prefix_free_trial" },
            { t: "string", v: address },
            { t: "string", v: orgId },
            { t: "string", v: serviceId },
            { t: "string", v: groupId },
            { t: "uint256", v: currentBlockNumber },
            { t: "bytes", v: enhancedToken }
        );
    }

    async _getFreeCallStateRequestProperties(address, tokenWithExpiration) {
        const currentBlockNumber = await this._account.getCurrentBlockNumber();
        const signature = await this._generateSignature(
            address,
            currentBlockNumber,
            tokenWithExpiration.tokenHex,
            tokenWithExpiration.tokenExpirationBlock
        );
        return {
            signature,
            currentBlockNumber: toBNString(currentBlockNumber),
        };
    }
    /**
     * helper. create the request for the freecall state service grpc
     * @returns {FreeCallStateRequest}
     * @private
     */
    async _getFreeCallStateRequest(address, tokenWithExpiration) {
        const request = new this._freeCallStateMethodDescriptor.requestType();

        const { signature, currentBlockNumber } = await this._getFreeCallStateRequestProperties(address, tokenWithExpiration);
        const tokenBytes = this._encodingUtils.hexStringToBytes(tokenWithExpiration.tokenHex);
        request.setUserAddress(address);
        request.setTokenForFreeCall(tokenBytes);
        request.setTokenExpiryDateBlock(tokenWithExpiration.tokenExpirationBlock);
        request.setSignature(signature);
        request.setCurrentBlock(currentBlockNumber);

        return request;
    }
    /**
     * helper. get avaliable number of free calls for user
     * @param {*} address user wallet address (metamask, for example)
     * @param {*} tokenWithExpiration token required to get free calls previously got from daemon
     * @returns {Promise<number>} number of avaliable free calls
     */
    async _getFreeCallsAvaliableWithFreeCallsToken(address, tokenWithExpiration) {
        const request = await this._getFreeCallStateRequest(address, tokenWithExpiration);
        const response = await wrapRpcToPromise(this._freeCallStateServiceClient, "getFreeCallsAvailable", request);
        const avaliableFreeCalls = response.getFreeCallsAvailable();
        return avaliableFreeCalls;
    }
    /* /getFreeCallsAvailable helpers */

    /**
     * Fetch the free calls available data from daemon
     * @returns {Promise<number>}
     * @public
     */
    async getFreeCallsAvailable() {
        const { address } = await this._getNecessaryFieldsForGetFreeCallsAvailable();
        const tokenWithExpiration = await this._getFreeCallsTokenWithExpiration(address);
        const avaliableFreeCalls = await this._getFreeCallsAvaliableWithFreeCallsToken(address, tokenWithExpiration);
        return avaliableFreeCalls;
    }

    /**
     * Check if there is any freecalls left for x service.
     * @returns {Promise<boolean>}
     */
    async isFreeCallAvailable() {
        const freeCallsAvailable = await this.getFreeCallsAvailable();
        return freeCallsAvailable > 0;
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
