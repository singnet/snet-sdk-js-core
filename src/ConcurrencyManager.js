import { toBNString } from './utils/bignumber_helper';
import logger from './utils/logger';

class ConcurrencyManager {
  constructor(serviceClient, concurrentCalls = 1) {
    this._concurrentCalls = concurrentCalls;
    this._serviceClient = serviceClient;
    this._tokenServiceClient = this._generateTokenServiceClient();
  }

  get concurrentCalls() {
    return this._concurrentCalls;
  }

  async getToken(channel, serviceCallPrice) {
    const currentSignedAmount = channel.state.currentSignedAmount.toNumber();
    if(currentSignedAmount !== 0) {
      const { plannedAmount, usedAmount, token } = await this._getTokenForAmount(channel, currentSignedAmount);
      if(usedAmount < plannedAmount) {
        return token;
      }
    }
    const newAmountToBeSigned = currentSignedAmount + serviceCallPrice;
    return this._getNewToken(channel, newAmountToBeSigned);
  }

  /**
     * @param {ServiceClient} serviceClient
     * @param {PaymentChannel} channel
     * @param {number} amount
     * @returns {Promise<string | undefined>} token
     * @private
     */
  async _getNewToken(channel, amount) {
    const tokenResponse = await this._getTokenForAmount(channel, amount);
    const { token } = tokenResponse;
    return token;
  }

  async _getTokenServiceRequest(channel, amount) {
    const { nonce } = channel.state;
    const currentBlockNumber = await this._serviceClient.getCurrentBlockNumber();

    const mpeSignature = await this._generateMpeSignature(
      parseInt(channel.channelId, 10),
      parseInt(nonce, 10),
      amount,
    );
    const tokenSignature = await this._generateTokenSignature(
      mpeSignature,
      currentBlockNumber,
    );
    const Request = this._tokenServiceClient.getToken.requestType;
    const request = new Request();

    request.setChannelId(parseInt(channel.channelId, 10));
    request.setCurrentNonce(parseInt(nonce, 10));
    request.setSignedAmount(amount);
    request.setSignature(tokenSignature);
    request.setCurrentBlock(toBNString(currentBlockNumber));
    request.setClaimSignature(mpeSignature);
    return request;
  }

  /**
     * Get token for the given amount
     * @param {ServiceClient} serviceClient
     * @param {PaymentChannel} channel
     * @param {number} amount
     * @returns {Promise<string>} token
     * @private
     */
  async _getTokenForAmount(channel, amount) {
    const request = await this._getTokenServiceRequest(channel, amount);
    return new Promise((resolve, reject) => {
      this._tokenServiceClient.getToken(request, (error) => {
        if(error) {
          logger.error('token grpc error', error);
          reject(error);
        } else {
          resolve({
            plannedAmount: this._plannedAmount,
            usedAmount: this._usedAmount,
            token: this._token,
          });
        }
      });
    });
  }

  async _generateTokenSignature(mpeSignature, currentBlockNumber) {
    const mpeSignatureHex = mpeSignature.toString('hex');
    return this._serviceClient.signData(
      { t: 'bytes', v: mpeSignatureHex },
      { t: 'uint256', v: currentBlockNumber },
    );
  }

  async _generateMpeSignature(channelId, nonce, signedAmount) {
    return this._serviceClient.signData(
      { t: 'string', v: '__MPE_claim_message' },
      { t: 'address', v: this._serviceClient.mpeContract.address },
      { t: 'uint256', v: channelId },
      { t: 'uint256', v: nonce },
      { t: 'uint256', v: signedAmount },
    );
  }
}

export default ConcurrencyManager;
