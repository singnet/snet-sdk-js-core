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
     * Check if there is any freecalls left for x service.
     * @returns {Promise<boolean>}
     */
    async isFreeCallAvailable() {
        try {
        const freeCallsAvailable = await this.getFreeCallsAvailable();

        logMessage("info", "FreeCallPaymentStrategy", "is freecalls available");
        return freeCallsAvailable > 0;
        } catch (err) {
        logMessage(
            "error",
            "FreeCallPaymentStrategy",
            "is freecall available error"
        );
        return false;
        }
    }

    /**
     * Get the metadata for the gRPC free-call
     * @returns {Promise<({'snet-free-call-auth-token-bin': FreeCallConfig.tokenToMakeFreeCall}|{'snet-free-call-token-expiry-block': *}|{'snet-payment-type': string}|{'snet-free-call-user-id': *}|{'snet-current-block-number': *})[]>}
     */
    async getPaymentMetadata() {
        // const { email, tokenToMakeFreeCall, tokenExpiryDateBlock } =
        //     this._serviceMetadata.getFreeCallConfig(); //TODO: remove
        const address = this._account.getAddress();

        const currentBlockNumber = await this._account.getCurrentBlockNumber();
        const signature = await this._generateSignature(
        address,
        currentBlockNumber,
        tokenToMakeFreeCall,
        tokenExpiryDateBlock
        );
        const tokenBytes =
        this._encodingUtils.hexStringToBytes(tokenToMakeFreeCall);
        const metadataFields = {
        type: "free-call",
        userAddress: address,
        currentBlockNumber,
        freecallAuthToken: tokenBytes,
        freecallTokenExpiryBlock: tokenExpiryDateBlock,
        signatureBytes: signature,
        };

        return this.metadataGenerator.generateMetadata(metadataFields);
    }

    async _getNecessaryFieldsForGetFreeCallsAvailable() {
        const address = await this._account.getAddress();
        const { orgId, serviceId, groupId } =
        this._serviceMetadata.getServiceDetails();
        return { address, orgId, serviceId, groupId };
    }
    _getFreeCallsTokenWithExpirationRequest(address, orgId, serviceId, groupId) {
        const request = new this._freeCallTokenMethodDescriptor.requestType();
        request.setGroupId(groupId);
        // request.setServiceId(serviceId);
        request.setOrgId(orgId);
        request.setAddress(address);
        return request;
    }
    async _getFreeCallsTokenWithExpiration(address, orgId, serviceId, groupId) {
        const request = this._getFreeCallsTokenWithExpirationRequest(address, orgId, serviceId, groupId);
        const tokenWithExpirationResponse = await wrapRpcToPromise(
        this._freeCallStateServiceClient.getFreeCallToken.bind(this._freeCallStateServiceClient), request);
        // const token = tokenWithExpirationResponse.getToken();
        const tokenHex = tokenWithExpirationResponse.getTokenHex();
        // const tokenBase64 = tokenWithExpirationResponse.getTokenBase64();
        const tokenExpirationBlock = tokenWithExpirationResponse.getTokenExpirationBlock();
        return { tokenHex, tokenExpirationBlock };
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
   * create the request for the freecall state service grpc
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
  async _getFreeCallsAvaliableWithFreeCallsToken(address, tokenWithExpiration) {
    const request = await this._getFreeCallStateRequest(address, tokenWithExpiration);
    console.log("request=", request);
    const response = await wrapRpcToPromise(this._freeCallStateServiceClient.getFreeCallsAvailable.bind(this._freeCallStateServiceClient), request);
    console.log("response=", response);
    const avaliableFreeCalls = response.getFreeCallsAvailable();
    console.log("avaliableFreeCalls=", avaliableFreeCalls);
    return avaliableFreeCalls;
  }

  /**
   * Fetch the free calls available data from daemon
   * @returns {Promise<FreeCallStateReply>}
   * @private
   */
  async getFreeCallsAvailable() {
    const { address, orgId, serviceId, groupId } = await this._getNecessaryFieldsForGetFreeCallsAvailable();
    const tokenWithExpiration = await this._getFreeCallsTokenWithExpiration(address, orgId, serviceId, groupId);
    const avaliableFreeCalls = await this._getFreeCallsAvaliableWithFreeCallsToken(address, tokenWithExpiration);
    return avaliableFreeCalls;
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
