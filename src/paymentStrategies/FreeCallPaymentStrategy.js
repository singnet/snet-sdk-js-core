import { isEmpty } from "lodash";
import { FreecallMetadataGenerator, hexStringToBytes, logMessage, toBNString, utfStringToBytes, wrapRpcToPromise } from "../utils";

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
        this.metadataGenerator = new FreecallMetadataGenerator();
        this._freeCallToken = { token: "", tokenExpirationBlock: "" };
    }

    /**
     * Get the metadata for the gRPC free-call
     * @returns {Promise<({'snet-free-call-auth-token-bin': FreeCallConfig.tokenToMakeFreeCall}|{'snet-payment-type': string}|{'snet-free-call-user-id': *}|{'snet-current-block-number': *})[]>}
     */
    async getPaymentMetadata() {
        const { address } = await this._getNecessaryFieldsForGetFreeCallsAvailable();
        await this._updateFreeCallsToken(address);

        const currentBlockNumber = await this._account.getCurrentBlockNumber();
        const signature = await this._generateSignature(address, currentBlockNumber, this._freeCallToken.token, this._freeCallToken.tokenExpirationBlock);
        const tokenBytes = hexStringToBytes(this._freeCallToken.token);
        const metadataFields = {
            type: "free-call",
            userAddress: address,
            currentBlockNumber,
            freecallAuthToken: tokenBytes,
            signatureBytes: signature,
        };

        return this.metadataGenerator.generateMetadata(metadataFields);
    }

    /* getFreeCallsAvailable helpers */
    async _getNecessaryFieldsForGetFreeCallsAvailable() {
        const address = await this._account.getAddress();
        return { address };
    }

    async _getFreeCallsTokenWithExpirationRequest(address) {
        logMessage('debug', 'FreeCallPaymentStrategy', `creating free call token request for address=${address}`);
        const request = new this._freeCallTokenMethodDescriptor.requestType();
        const currentBlockNumber = await this._account.getCurrentBlockNumber();
        const signature = await this._generateSignature(
            address,
            currentBlockNumber
        );
        request.setAddress(address);
        request.setCurrentBlock(Number(currentBlockNumber));
        request.setSignature(signature)
        return request;
    }

    async _updateFreeCallsToken(address) {
        const currentBlockNumber = await this._account.getCurrentBlockNumber();
        if (this._freeCallToken.token && this._freeCallToken.tokenExpirationBlock > currentBlockNumber) {
            return
        }
        const request = await this._getFreeCallsTokenWithExpirationRequest(address);
        const tokenWithExpirationResponse = await wrapRpcToPromise(
            this._freeCallStateServiceClient, "getFreeCallToken", request);
        const tokenHex = tokenWithExpirationResponse.getTokenHex();
        const tokenExpirationBlock = tokenWithExpirationResponse.getTokenExpirationBlock();
        this._freeCallToken = { token: tokenHex, tokenExpirationBlock };
    }

    /**
     * Generates a signature for free call authentication
     * @param {string} address - User's blockchain address
     * @param {number|string} currentBlockNumber - Current blockchain block number
     * @param {string} [tokenToMakeFreeCall] - Optional token for enhanced free calls
     * @returns {Promise<Bytes<Signature>>} The generated signature
     * @throws {Error} If required parameters are invalid or signing fails
     * @private
     */
    async _generateSignature(address, currentBlockNumber, tokenToMakeFreeCall) {
        logMessage('debug', 'FreeCallPaymentStrategy', 'Generating free call signature', {
            address,
            currentBlockNumber,
            hasToken: !!tokenToMakeFreeCall
        });

        const { orgId, serviceId, groupId } = this._serviceMetadata.getServiceDetails();
        if (!orgId || !serviceId || !groupId) {
            throw new Error('Missing service metadata details');
        }

        const baseData = [
            { t: "string", v: "__prefix_free_trial" },
            { t: "string", v: address },
            { t: "string", v: "" }, // TODO: user_id field. Add the mode to working with marketplace and fill this
            { t: "string", v: orgId },
            { t: "string", v: serviceId },
            { t: "string", v: groupId },
            { t: "uint256", v: currentBlockNumber }
        ];

        if (tokenToMakeFreeCall) {
            const normalizedToken = this._normalizeFreeCallToken(tokenToMakeFreeCall);
            baseData.push({ t: "bytes", v: normalizedToken });
        }

        try {
            return await this._account.signData(...baseData);
        } catch (error) {
            logMessage('error', 'FreeCallPaymentStrategy', 'Signature generation failed', { error });
            throw new Error(`Failed to generate signature: ${error.message}`);
        }
    }

    /**
     * Normalizes free call token format
     * @param {string} token - The input token
     * @returns {string} Normalized token without 0x prefix
     * @private
     */
    _normalizeFreeCallToken(token) {
        if (typeof token !== 'string') {
            throw new Error('Token must be a string');
        }
        return token.toLowerCase().startsWith('0x')
            ? token.substring(2)
            : token;
    }

    async _getFreeCallStateRequestProperties(address) {
        const currentBlockNumber = await this._account.getCurrentBlockNumber();
        await this._updateFreeCallsToken(address);
        const signature = await this._generateSignature(
            address,
            currentBlockNumber,
            this._freeCallToken.token
        );
        return {
            signature,
            currentBlockNumber: toBNString(currentBlockNumber),
        };
    }

    /**
     * helper. create the request for the free call state service grpc
     * @returns {FreeCallStateRequest}
     * @private
     */
    async _getFreeCallStateRequest(args) {
        logMessage('debug', 'FreeCallPaymentStrategy', `creating free call request with obtained before token for args=${args}`);
        const request = new this._freeCallStateMethodDescriptor.requestType();
        let signature;
        const currentBlockNumber = Number(await this._account.getCurrentBlockNumber());
        let token;
        let userId;

        if (typeof args === 'string' ) {
            const address = args; 
            
            ({ signature } = await this._getFreeCallStateRequestProperties(address));
            token = this._freeCallToken.token;
            request.setAddress(address);
        } else {
            ({ signature, userId, token } = args);
            request.setUserId(userId);
        }
        
        request.setFreeCallToken(hexStringToBytes(token));
        request.setSignature(signature);
        request.setCurrentBlock(currentBlockNumber);

        return request;
    }

    /**
     * helper. get available number of free calls for user
     * @param {*} address user wallet address (metamask, for example)
     * @returns {Promise<number>} number of available free calls
     */
    async _getFreeCallsAvailableWithFreeCallsToken(args) {
        const request = await this._getFreeCallStateRequest(args);
        const response = await wrapRpcToPromise(this._freeCallStateServiceClient, "getFreeCallsAvailable", request);
        return response.getFreeCallsAvailable();
    }

    /* /getFreeCallsAvailable helpers */

    /**
     * Fetch the free calls available data from daemon
     * @returns {Promise<number>}
     * @public
     */
    async getFreeCallsAvailable(options) {
        let args = options;
        if (isEmpty(options)) {
            var { address } = await this._getNecessaryFieldsForGetFreeCallsAvailable();
            await this._updateFreeCallsToken(address);
            args = address;
        }
        const availableFreeCalls = await this._getFreeCallsAvailableWithFreeCallsToken(args);
        logMessage('debug', 'FreeCallPaymentStrategy', `Available free calls=${availableFreeCalls}`);
        return availableFreeCalls;
    }

    /**
     * Check if there is any free calls left for x service.
     * @returns {Promise<boolean>}
     */
    async isFreeCallAvailable(options) {
        const freeCallsAvailable = await this.getFreeCallsAvailable(options);
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
