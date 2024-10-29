import { BigNumber } from 'bignumber.js';
import Account from '../src/Account';
import logger, { toBNString } from '../src/utils/bignumber_helper';

jest.mock('../src/utils/bignumber_helper');
jest.mock(logger);

const testWalletAddress = '0xTestWalletAddress';
const networkId = 11155111;

describe('Account', () => {
  let mockWeb3;
  let mockMpeContract;
  let mockIdentityProvider;
  let account;

  beforeEach(() => {
    mockWeb3 = {
      eth: {
        Contract: jest.fn().mockImplementation(() => ({
          methods: {
            balanceOf: jest.fn().mockReturnValue({
              call: jest.fn().mockResolvedValue('1000'),
            }),
            approve: jest.fn(),
            allowance: jest.fn().mockReturnValue({
              call: jest.fn().mockResolvedValue('500'),
            }),
          },
          options: { address: testWalletAddress },
        })),
        getGasPrice: jest.fn().mockResolvedValue('20000000000'),
        getTransactionCount: jest.fn().mockResolvedValue(1),
        net: { getId: jest.fn().mockResolvedValue(1) },
        utils: {
          toHex: jest.fn((value) => `0x${value.toString(16)}`),
          soliditySha3: jest.fn(),
        },
      },
    };

    mockMpeContract = {
      address: '0xMpeContractAddress',
      balance: jest.fn().mockResolvedValue('1000'),
      deposit: jest.fn().mockResolvedValue({ status: true }),
      withdraw: jest.fn().mockResolvedValue({ status: true }),
    };

    mockIdentityProvider = {
      getAddress: jest.fn().mockResolvedValue(testWalletAddress),
      signData: jest.fn().mockResolvedValue('0xSignature'),
      sendTransaction: jest.fn().mockResolvedValue({ status: true }),
    };

    account = new Account(
      mockWeb3,
      networkId,
      mockMpeContract,
      mockIdentityProvider,
    );
  });

  describe('balance', () => {
    test('should fetch the account balance', async () => {
      const balance = await account.balance();
      expect(balance).toEqual('1000');
    });
  });

  describe('escrowBalance', () => {
    test('should fetch the escrow balance from MPE contract', async () => {
      const balance = await account.escrowBalance();
      expect(balance).toEqual('1000');
    });
  });

  describe('depositToEscrowAccount', () => {
    test('should approve and deposit to the escrow account if needed', async () => {
      toBNString.mockReturnValue('1000');
      // mockWeb3.eth.Contract().methods.approve.mockReturnValue({
      //     encodeABI: jest.fn(),
      // });

      const receipt = await account.depositToEscrowAccount(new BigNumber(1000));
      expect(toBNString).toHaveBeenCalledWith(new BigNumber(1000));
      expect(mockMpeContract.deposit).toHaveBeenCalledWith(
        account,
        new BigNumber(1000),
      );
      expect(receipt).toEqual({ status: true });
    });
  });

  describe('approveTransfer', () => {
    test('should approve the specified tokens for transfer', async () => {
      toBNString.mockReturnValue('500');
      const receipt = await account.approveTransfer(new BigNumber(500));

      expect(toBNString).toHaveBeenCalledWith(new BigNumber(500));
      expect(mockWeb3.eth.Contract().methods.approve).toHaveBeenCalledWith(
        '0xMpeContractAddress',
        '500',
      );
      expect(mockIdentityProvider.sendTransaction).toHaveBeenCalled();
      expect(receipt).toEqual({ status: true });
    });
  });

  describe('allowance', () => {
    test('should fetch the already approved allowance', async () => {
      const allowance = await account.allowance();
      expect(mockWeb3.eth.Contract().methods.allowance).toHaveBeenCalledWith(
        testWalletAddress,
        '0xMpeContractAddress',
      );
      expect(allowance).toEqual('500');
    });
  });

  describe('withdrawFromEscrowAccount', () => {
    test('should withdraw the specified tokens from the MPE account', async () => {
      const receipt = await account.withdrawFromEscrowAccount(
        new BigNumber(500),
      );
      expect(mockMpeContract.withdraw).toHaveBeenCalledWith(
        account,
        new BigNumber(500),
      );
      expect(receipt).toEqual({ status: true });
    });
  });

  describe('signData', () => {
    test('should sign data using identity provider', async () => {
      mockWeb3.utils.soliditySha3.mockReturnValue('0xSha3Message');
      const data = [{ t: 'string', v: 'test' }];
      const signature = await account.signData(...data);

      expect(mockWeb3.utils.soliditySha3).toHaveBeenCalledWith(...data);
      expect(mockIdentityProvider.signData).toHaveBeenCalledWith(
        '0xSha3Message',
      );
      expect(signature.toString('hex')).toEqual('Signature');
    });
  });
});
