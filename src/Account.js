import AGITokenAbi from 'singularitynet-token-contracts/abi/SingularityNetToken';
import AGITokenNetworks from 'singularitynet-token-contracts/networks/SingularityNetToken';
import { BigNumber } from 'bignumber.js';
import logger from './utils/logger';

import { toBNString } from './utils/bignumber_helper';

class Account {
    /**
     * @param {Web3} web3
     * @param {number} networkId
     * @param {MPEContract} mpeContract
     * @param {IdentityProvider} identity
     */
    constructor(web3, networkId, mpeContract, identity) {
        this._identity = identity;
        this._web3 = web3;
        this._networkId = networkId;
        this._tokenContract = this._generateTokenContract();
        this._mpeContract = mpeContract;
    }

    /**
     * Returns the token balance available.
     * @returns {Promise.<BigNumber>}
     */
    async balance() {
        try {
            logger.debug('Fetching account balance', { tags: ['Account'] });
            const address = await this.getAddress();
            return this.tokenContract.methods.balanceOf(address).call();
        } catch (error) {
            throw new Error('get balance error ', error);
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
     * Approves the specified number of tokens for transfer if not already approved and deposits the tokens to the MPE Account.
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
        logger.info(`Approving ${amount}cogs transfer to MPE address`, {
            tags: ['Account'],
        });
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
            logger.debug('Fetching already approved allowance', {
                tags: ['Account'],
            });
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
     * @type {string}
     */
    async getSignerAddress() {
        return this.getAddress();
    }

    /**
     * @param {...(*|Object)} data
     * @param {string} data.(t|type) - Type of data. One of the following (string|uint256|int256|bool|bytes)
     * @param {string} data.(v|value) - Value
     * @returns {Buffer} - Signed binary data
     * @see {@link https://web3js.readthedocs.io/en/1.0/web3-utils.html#soliditysha3|data}
     */
    async signData(...data) {
        const sha3Message = this._web3.utils.soliditySha3(...data);
        const signature = await this._identity.signData(sha3Message);
        const stripped = signature.substring(2, signature.length);
        const byteSig = Buffer.from(stripped, 'hex');
        return Buffer.from(byteSig);
    }

    /**
     * Sends a transaction for the transaction object to the contract address
     * @param {string} to - The contract address to send the signed transaction to
     * @param {function} contractFn - The contract function for which the transaction needs to be sent
     * @param {...any} contractFnArgs - The args which will be sent to the contract function
     * @returns {Promise<TransactionReceipt>}
     */
    async sendTransaction(to, contractFn, ...contractFnArgs) {
        const operation = contractFn(...contractFnArgs);
        const txObject = await this._baseTransactionObject(operation, to);
        return this._identity.sendTransaction(txObject);
    }

    get tokenContract() {
        return this._tokenContract;
    }

    get tokenAddress() {
        return this._tokenContract.options.address;
    }

    _generateTokenContract() {
        return new this._web3.eth.Contract(
            AGITokenAbi,
            AGITokenNetworks[this._networkId].address
        );
    }

    async _baseTransactionObject(operation, to) {
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
    }

    async _getGas(operation) {
        const gasPrice = await this._web3.eth.getGasPrice();
        const address = await this.getAddress();
        const estimatedGas = await operation.estimateGas({ from: address });
        return { gasLimit: estimatedGas, gasPrice };
    }

    async _transactionCount() {
        const address = await this.getAddress();
        return this._web3.eth.getTransactionCount(address);
    }

    async _getChainId() {
        return this._web3.eth.net.getId();
    }
}

export default Account;
