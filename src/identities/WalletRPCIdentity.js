import Web3 from "web3";
import logger from "../utils/logger";

/**
 * @implements Identity
 */
class WalletRPCIdentity {
  /**
   * @param {Config} config
   * @param {Web3} web3
   */
  constructor(config, web3) {
    this._eth = new Web3(config.web3Provider);
    this._web3 = web3;
    this.setupAccount();
  }

  async getAddress() {
    const accounts = await this._web3.eth.getAccounts();
    return accounts[0];
  }

  async signData(sha3Message) {
    const address = await this.getAddress();
    return this._web3.eth.personal.sign(sha3Message, address, "");
  }

  async sendTransaction(transactionObject) {
    return new Promise((resolve, reject) => {
      this._web3.eth
        .sendTransaction(transactionObject)
        .on("transactionHash", (hash) => {
          logger.info(`Transaction hash: ${hash}`);
        })
        .on("error", (error) => {
          logger.error(`Couldn't send transaction. ${error}`);
          reject(error);
        })
        .then((receipt) => {
          if (receipt.status) {
            resolve(receipt);
          } else {
            reject(receipt);
          }
        });
    });
  }

  async setupAccount() {
    const accounts = await this._web3.eth.getAccounts();
    if (accounts.length > 0) {
      this._web3.eth.defaultAccount = accounts[0];
    } else {
      logger.error("No accounts found");
    }
  }
}

export default WalletRPCIdentity;
