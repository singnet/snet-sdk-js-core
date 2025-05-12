import AGIXTokenAbi from 'singularitynet-token-contracts/abi/SingularityNetToken';
import AGIXTokenNetworks from 'singularitynet-token-contracts/networks/SingularityNetToken';
import FETTokenAbi from 'singularitynet-token-contracts/abi/FetchToken';
import FETTokenNetworks from 'singularitynet-token-contracts/networks/FetchToken';
import { toBNString } from './utils/bignumber_helper';
import { logMessage, stringifyWithBigInt } from './utils/logger';

class Account {
    /**
     * @param {Web3} web3
     * @param {number} networkId
     * @param {string} token
     * @param {MPEContract} mpeContract
     * @param {IdentityProvider} identity
     */
    constructor(web3, networkId, token, mpeContract, identity) {
        this._identity = identity;
        this._web3 = web3;
        this._networkId = networkId;
        this._token = token;
        this._tokenContract = this._generateTokenContract();
        this._mpeContract = mpeContract;
    }

    /**
     * Returns the token balance available.
     * @returns {Promise.<BigNumber>}
     */
    async balance() {
        try {
            logMessage('debug', 'Account', 'Fetching account balance');
            const address = await this.getAddress();
            return this.tokenContract.methods.balanceOf(address).call();
        } catch (error) {
            throw new Error('get balance error ', error, error.message);
        }
    }

    /**
     * Returns the balance for the current account in MPE Account.
     * @returns {Promise.<BigNumber>}
     */
    async escrowBalance() {
        try {
            const address = await this.getAddress();
            return this._mpeContract.balance(address);
        } catch (error) {
            throw new Error('get escrow balance error ', error);
        }
    }

    /**
     * Approves the specified number of tokens for transfer if not already approved
     * and deposits the tokens to the MPE Account.
     * @param {BigNumber} amountInCogs - Tokens to transfer to MPE Account
     * @returns {Promise.<TransactionReceipt>}
     */
    async depositToEscrowAccount(amountInCogs) {
        try {
            const alreadyApprovedAmount = await this.allowance();
            if (amountInCogs > alreadyApprovedAmount) {
                await this.approveTransfer(amountInCogs);
            }

            return this._mpeContract.deposit(this, amountInCogs);
        } catch (error) {
            throw new Error('deposit to escrow error ', error);
        }
    }

    /**
     * Approves the specified tokens for transfer to MPE Account
     * @param {BigNumber} amountInCogs - Tokens for approval.
     * @returns {Promise.<TransactionReceipt>}
     */
    async approveTransfer(amountInCogs) {
        const amount = toBNString(amountInCogs);
        logMessage('info', 'Account', `Approving ${amount}cogs transfer to MPE address`);
        const approveOperation = this.tokenContract.methods.approve;
        return this.sendTransaction(
            this.tokenAddress,
            approveOperation,
            this._mpeContract.address,
            amount
        );
    }

    /**
     * Returns the already approved tokens for transfer to MPE Account.
     * @returns {Promise.<BigNumber>}
     */
    async allowance() {
        try {
            logMessage('debug', 'Account', 'Fetching already approved allowance');
            const address = await this.getAddress();
            return this.tokenContract.methods
                .allowance(address, this._mpeContract.address)
                .call();
        } catch (error) {
            throw new Error('allowance error ', error);
        }
    }

    /**
     * Withdraws the specified tokens from the MPE account.
     * @param {BigNumber} amountInCogs - Tokens to be withdrawn from the escrow account.
     * @returns {Promise.<TransactionReceipt>}
     */
    async withdrawFromEscrowAccount(amountInCogs) {
        return this._mpeContract.withdraw(this, amountInCogs);
    }

    /**
     * @type {string}
     */
    async getAddress() {
        return this._identity.getAddress();
    }

    /**
     * @param {...(*|Object)} data
     * @param {string} data.(t|type) - Type of data. One of the following (string|uint256|int256|bool|bytes)
     * @param {string} data.(v|value) - Value
     * @returns {Buffer} - Signed binary data
     * @see {@link https://web3js.readthedocs.io/en/1.0/web3-utils.html#soliditysha3|data}
     */
    async signData(...data) {
        try {
            logMessage('info', 'Account', `signing message: ${stringifyWithBigInt(data)}`);
            const sha3Message = this._web3.utils.soliditySha3(...data);
            const signature = await this._identity.signData(sha3Message);
            const stripped = signature.substring(2, signature.length);
            const byteSig = Buffer.from(stripped, 'hex');
            return Buffer.from(byteSig);
        } catch (error) {
            throw new Error('sign data error: ', error);
        }
    }

    /**
     * Sends a transaction for the transaction object to the contract address
     * @param {string} to - The contract address to send the signed transaction to
     * @param {function} contractFn - The contract function for which the transaction needs to be sent
     * @param {...any} contractFnArgs - The args which will be sent to the contract function
     * @returns {Promise<TransactionReceipt>}
     */
    async sendTransaction(to, contractFn, ...contractFnArgs) {
        try {
            const operation = contractFn(...contractFnArgs);
            const txObject = await this._baseTransactionObject(operation, to);
            return this._identity.sendTransaction(txObject);
        } catch (error) {
            throw new Error('send transaction error: ', error);
        }
    }

    get tokenContract() {
        return this._tokenContract;
    }

    get tokenAddress() {
        return this._tokenContract.options.address;
    }

    _generateTokenContract() {
        const contractsByToken = {
          FET: {
            abi: FETTokenAbi,
            networks: FETTokenNetworks
          },
          AGIX: {
            abi: AGIXTokenAbi,
            networks: AGIXTokenNetworks
          }
        }
        const tokenContract = contractsByToken[this._token];
        return new this._web3.eth.Contract(tokenContract.abi, tokenContract.networks[this._networkId].address);
      }

    async _baseTransactionObject(operation, to) {
        try {
            const { gasLimit, gasPrice } = await this._getGas(operation);
            const nonce = await this._transactionCount();
            const chainId = await this._getChainId();
            return {
                nonce: this._web3.utils.toHex(nonce),
                gas: this._web3.utils.toHex(gasLimit),
                gasPrice: this._web3.utils.toHex(gasPrice),
                to,
                data: operation.encodeABI(),
                chainId,
            };
        } catch (error) {
            throw new Error('generate base transaction object error: ', error);
        }
    }

    async _getGas(operation) {
        try {
            let gasPrice = await this._web3.eth.getGasPrice();
            gasPrice = BigInt(gasPrice);

            if (gasPrice <= 15000000000n) {
                gasPrice += gasPrice / 3n;
            } else if (gasPrice > 15000000000n && gasPrice <= 50000000000n) {
                gasPrice += gasPrice / 5n;
            } else if (gasPrice > 50000000000n && gasPrice <= 150000000000n) {
                gasPrice += 7000000000n;
            } else if (gasPrice > 150000000000n) {
                gasPrice += gasPrice / 10n;
            }

            const address = await this.getAddress();
            const estimatedGas = await operation.estimateGas({ from: address });

            return { gasLimit: estimatedGas, gasPrice };
        } catch (error) {
            throw new Error(`get gas error: ${error.message}`);
        }
    }


    async _transactionCount() {
        try {
            const address = await this.getAddress();
            return this._web3.eth.getTransactionCount(address);
        } catch (error) {
            throw new Error('counting transaction error: ', error);
        }
    }

    async _getChainId() {
        try {
            return await this._web3.eth.net.getId();
        } catch (error) {
            throw new Error('get chain id error: ', error);
        }
    }

    /**
     * find the current blocknumber
     * @returns {Promise<number>}
     */
    async getCurrentBlockNumber() {
        try {
            return await this._web3.eth.getBlockNumber();
        } catch (error) {
            throw new Error('getting current block number error: ', error);
        }
    }
}

export default Account;
