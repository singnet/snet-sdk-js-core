import blockChainEvents from '../utils/blockchainEvents';
import logger from '../utils/logger';

/**
 * @implements Identity
 */
class PrivateKeyIdentity {
  /**
     * @param {Config} config
     * @param {Web3} web3
     */
  constructor(config, web3) {
    this._web3 = web3;
    this._pk = config.privateKey;
    this._setupAccount();
  }

  get address() {
    return this._web3.eth.defaultAccount;
  }

  async getAddress() {
    try {
      return this._web3.eth.defaultAccount;
    } catch (error) {
      throw new Error('gettind address error: ', error);
    }
  }

  async signData(sha3Message) {
    try {
      const { signature } = this._web3.eth.accounts.sign(
        sha3Message,
        this._pk,
      );
      return signature;
    } catch (error) {
      throw new Error('signing data error: ', error);
    }
  }

  async sendTransaction(transactionObject) {
    try {
      const signedTransaction = await this._signTransaction(transactionObject);
      return new Promise((resolve, reject) => {
        const method = this._web3.eth.sendSignedTransaction(signedTransaction);
        method.once(
          blockChainEvents.CONFIRMATION,
          async (_confirmationNumber) => {
            logger.info(
              'blockchain confirmation count',
              _confirmationNumber,
              {
                tags: ['PrivateKeyIdentity'],
              },
            );
            logger.info(
              'blockchain confirmation receipt status',
              _confirmationNumber.receipt.status,
              {
                tags: ['PrivateKeyIdentity'],
              },
            );
            if(_confirmationNumber.receipt.status) {
              resolve(_confirmationNumber.receipt);
            } else {
              reject(_confirmationNumber.receipt);
            }
            // await method.off();
          },
        );
        method.on(blockChainEvents.ERROR, (error) => {
          logger.error(
            'blockchain error on sending transaction',
            error,
            {
              tags: ['PrivateKeyIdentity'],
            },
          );
          reject(error);
        });
        method.once(blockChainEvents.TRANSACTION_HASH, (hash) => {
          logger.info('waiting for blockchain txn', hash, {
            tags: ['PrivateKeyIdentity'],
          });
        });
        method.once(blockChainEvents.RECEIPT, (receipt) => {
          logger.info('blockchain receipt', receipt.status, {
            tags: ['PrivateKeyIdentity'],
          });
        });
      });
    } catch (error) {
      throw new Error('sending transaction error: ', error);
    }
  }

  async _signTransaction(txObject) {
    try {
      /* eslint-disable  no-param-reassign */
      delete txObject.chainId; // TODO check is it necessary
      const privateKey = Buffer.from(this._pk.slice(2), 'hex');
      const signedTx = await this._web3.eth.accounts.signTransaction(
        txObject,
        privateKey,
      );
      return signedTx.rawTransaction;
    } catch (error) {
      throw new Error('getting sined transaction error: ', error);
    }
  }

  _setupAccount() {
    const account = this._web3.eth.accounts.privateKeyToAccount(this._pk);
    this._web3.eth.accounts.wallet.add(account);
    this._web3.eth.defaultAccount = account.address;
  }
}

export default PrivateKeyIdentity;
