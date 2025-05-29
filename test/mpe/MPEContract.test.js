import { BigNumber } from 'bignumber.js';
import { toBNString } from '../../src/utils/bignumber_helper';
import MPEContract from '../../src/mpe/MPEContract';

jest.mock('../../src/utils/bignumber_helper');

describe('MPEContract', () => {
    let mockWeb3;
    let mockAccount;
    let mpeContract;
    let networkId;
    let rpcEndpoint;

    beforeEach(() => {
        networkId = 11155111;
        rpcEndpoint = '';

        mockWeb3 = {
            eth: {
                Contract: jest.fn().mockImplementation(() => ({
                    methods: {
                        balances: jest.fn().mockReturnValue({
                            call: jest.fn().mockResolvedValue('1000'),
                        }),
                        deposit: jest.fn().mockReturnValue({
                            encodeABI: jest.fn().mockReturnValue('0xEncodedDepositData'),
                        }),
                        withdraw: jest.fn().mockReturnValue({
                            encodeABI: jest.fn().mockReturnValue('0xEncodedWithdrawData'),
                        }),
                        openChannel: jest.fn().mockReturnValue({
                            encodeABI: jest.fn().mockReturnValue('0xEncodedOpenChannelData'),
                        }),
                        channelAddFunds: jest.fn().mockReturnValue({
                            encodeABI: jest.fn().mockReturnValue('0xEncodedAddFundsData'),
                        }),
                        channelExtend: jest.fn().mockReturnValue({
                            encodeABI: jest.fn().mockReturnValue('0xEncodedExtendData'),
                        }),
                        channelExtendAndAddFunds: jest.fn().mockReturnValue({
                            encodeABI: jest.fn().mockReturnValue('0xEncodedExtendAddFundsData'),
                        }),
                        channelClaimTimeout: jest.fn().mockReturnValue({
                            encodeABI: jest.fn().mockReturnValue('0xEncodedClaimTimeoutData'),
                        }),
                        channels: jest.fn().mockReturnValue({
                            call: jest.fn().mockResolvedValue({ sender: '0xSender', recipient: '0xRecipient' }),
                        }),
                    },
                    options: {
                        address: '0x0000000000000000000000000000000000000001',
                    },
                    getPastEvents: jest.fn().mockResolvedValue([]),
                })),
                getTransactionReceipt: jest.fn().mockResolvedValue({ blockNumber: 1000 }),
            },
        };

        mockAccount = {
            sendTransaction: jest.fn().mockResolvedValue({ status: true }),
            getAddress: jest.fn().mockResolvedValue('0x0000000000000000000000000000000000000002'),
            allowance: jest.fn().mockResolvedValue(0),
            approveTransfer: jest.fn().mockResolvedValue(true),
            depositToEscrowAccount: jest.fn().mockResolvedValue(true),
        };

        mpeContract = new MPEContract(mockWeb3, networkId, rpcEndpoint);
    });

    describe('balance', () => {
        test('should fetch the account balance from MPE contract', async () => {
            const balance = await mpeContract.balance('0xMockAddress');
            expect(balance).toEqual('1000');
            expect(mpeContract.contract.methods.balances).toHaveBeenCalledWith('0xMockAddress');
        });
    });

    describe('deposit', () => {
        test('should deposit tokens to the MPE account', async () => {
            toBNString.mockReturnValue('1000');
            const receipt = await mpeContract.deposit(mockAccount, new BigNumber(1000));

            expect(toBNString).toHaveBeenCalledWith(new BigNumber(1000));
            expect(mockAccount.sendTransaction).toHaveBeenCalledWith(
                mpeContract.address,
                expect.any(Function),
                '1000'
            );
            expect(receipt).toEqual({ status: true });
        });
    });

    describe('withdraw', () => {
        test('should withdraw tokens from the MPE account', async () => {
            toBNString.mockReturnValue('1000');
            const receipt = await mpeContract.withdraw(mockAccount, new BigNumber(1000));

            expect(toBNString).toHaveBeenCalledWith(new BigNumber(1000));
            expect(mockAccount.sendTransaction).toHaveBeenCalledWith(
                mpeContract.address,
                expect.any(Function),
                '1000'
            );
            expect(receipt).toEqual({ status: true });
        });
    });

    describe('openChannel', () => {
        test('should open a payment channel', async () => {
            toBNString.mockReturnValue('1000');
            const group = {
                payment_address: '0x0000000000000000000000000000000000000003',
                group_id_in_bytes: '0xMockGroupId',
            };
            const receipt = await mpeContract.openChannel(mockAccount, group, new BigNumber(1000), new BigNumber(2000));

            expect(toBNString).toHaveBeenCalledWith(new BigNumber(1000));
            expect(toBNString).toHaveBeenCalledWith(new BigNumber(2000));
            expect(mockAccount.sendTransaction).toHaveBeenCalled();
            expect(receipt).toEqual({ status: true });
        });
    });

    describe('channelAddFunds', () => {
        test('should add funds to a payment channel', async () => {
            toBNString.mockReturnValue('1000');
            const receipt = await mpeContract.channelAddFunds(mockAccount, new BigNumber(123), new BigNumber(1000));

            expect(toBNString).toHaveBeenCalledWith(new BigNumber(123));
            expect(toBNString).toHaveBeenCalledWith(new BigNumber(1000));
            expect(mockAccount.sendTransaction).toHaveBeenCalled();
            expect(receipt).toEqual({ status: true });
        });
    });

    describe('channelExtend', () => {
        test('should extend a payment channel', async () => {
            toBNString.mockReturnValue('2000');
            const receipt = await mpeContract.channelExtend(mockAccount, new BigNumber(123), new BigNumber(2000));

            expect(toBNString).toHaveBeenCalledWith(new BigNumber(123));
            expect(toBNString).toHaveBeenCalledWith(new BigNumber(2000));
            expect(mockAccount.sendTransaction).toHaveBeenCalled();
            expect(receipt).toEqual({ status: true });
        });
    });

    describe('channelExtendAndAddFunds', () => {
        test('should extend and add funds to a payment channel', async () => {
            toBNString.mockReturnValue('1000');
            const receipt = await mpeContract.channelExtendAndAddFunds(
                mockAccount,
                new BigNumber(123),
                new BigNumber(2000),
                new BigNumber(1000)
            );

            expect(toBNString).toHaveBeenCalledWith(new BigNumber(123));
            expect(toBNString).toHaveBeenCalledWith(new BigNumber(2000));
            expect(toBNString).toHaveBeenCalledWith(new BigNumber(1000));
            expect(mockAccount.sendTransaction).toHaveBeenCalled();
            expect(receipt).toEqual({ status: true });
        });
    });

    describe('channelClaimTimeout', () => {
        test('should claim unused tokens from an expired channel', async () => {
            toBNString.mockReturnValue('123');
            const receipt = await mpeContract.channelClaimTimeout(mockAccount, new BigNumber(123));

            expect(toBNString).toHaveBeenCalledWith(new BigNumber(123));
            expect(mockAccount.sendTransaction).toHaveBeenCalled();
            expect(receipt).toEqual({ status: true });
        });
    });

    describe('channels', () => {
        test('should fetch the state of a payment channel', async () => {
            const state = await mpeContract.channels(new BigNumber(123));
            expect(mpeContract.contract.methods.channels).toHaveBeenCalledWith('123');
            expect(state).toEqual({ sender: '0xSender', recipient: '0xRecipient' });
        });
    });

    describe('getPastOpenChannels', () => {
        test('should fetch all past open channels', async () => {
            mpeContract.contract.getPastEvents.mockResolvedValue([
                {
                    returnValues: { channelId: '1' },
                },
            ]);

            const group = {
                payment_address: '0x0000000000000000000000000000000000000003',
                group_id: Buffer.from('MockGroupId', 'utf-8').toString('base64'),
            };
            const channels = await mpeContract.getPastOpenChannels(mockAccount, {}, group, 0);

            expect(mpeContract.contract.getPastEvents).toHaveBeenCalled();
            expect(channels).toHaveLength(1);
        });
    });
});
