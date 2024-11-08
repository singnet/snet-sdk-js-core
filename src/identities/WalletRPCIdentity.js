import { error, info } from 'loglevel';
import Web3 from 'web3';

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
        try {
            const accounts = await this._web3.eth.getAccounts();
            return accounts[0];
        } catch (error) {
            throw new Error('gettind address error: ', error);
        }
    }

    async signData(sha3Message) {
        try {
            const address = await this.getAddress();
            return this._web3.eth.personal.sign(sha3Message, address, '');
        } catch (error) {
            throw new Error('signing data error: ', error);
        }
    }

    async sendTransaction(transactionObject) {
        try {
            return new Promise((resolve, reject) => {
                this._web3.eth
                    .sendTransaction(transactionObject)
                    .on('transactionHash', (hash) => {
                        info(`Transaction hash: ${hash}`);
                    })
                    .on('error', (txError) => {
                        error(`Couldn't send transaction. ${txError}`);
                        reject(txError);
                    })
                    .then((receipt) => {
                        if (receipt.status) {
                            resolve(receipt);
                        } else {
                            reject(receipt);
                        }
                    });
            });
        } catch (error) {
            throw new Error('sending transaction error: ', error);
        }
    }

    async setupAccount() {
        try {
            const accounts = await this._web3.eth.getAccounts();
            if (accounts.length > 0) {
                this._web3.eth.defaultAccount = accounts[0];
            } else {
                error('No accounts found');
            }
        } catch (error) {
            throw new Error('gettind account error: ', error);
        }
    }
}

export default WalletRPCIdentity;
