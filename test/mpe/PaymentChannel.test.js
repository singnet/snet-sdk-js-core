import BigNumber from 'bignumber.js';
import PaymentChannel from '../../src/mpe/PaymentChannel';
import PaymentChannelProvider from '../../src/mpe/PaymentChannelProvider';
import { toBNString, uint8ArrayToBN } from '../../src/utils/bignumber_helper';

jest.mock('../../src/utils/bignumber_helper');
jest.mock('../../src/mpe/PaymentChannelProvider');

describe('PaymentChannel', () => {
    let mockMpeContract;
    let mockWeb3;
    let mockAccount;
    let mockServiceMetadata;
    let paymentChannel;
    const mockChannelId = new BigNumber(123);

    beforeEach(() => {
        mockMpeContract = {
            channelAddFunds: jest.fn().mockResolvedValue({ status: true }),
            channelExtend: jest.fn().mockResolvedValue({ status: true }),
            channelExtendAndAddFunds: jest.fn().mockResolvedValue({ status: true }),
            channelClaimTimeout: jest.fn().mockResolvedValue({ status: true }),
            channels: jest.fn().mockResolvedValue({
                nonce: new BigNumber(1),
                expiration: new BigNumber(2000),
                value: new BigNumber(1000),
            }),
        };

        mockWeb3 = {
            eth: {
                Contract: jest.fn(),
            },
        };

        mockAccount = {
            sendTransaction: jest.fn(),
            getAddress: jest.fn().mockResolvedValue('0xMockAddress'),
        };

        mockServiceMetadata = {
            serviceDetails: jest.fn(),
        };

        paymentChannel = new PaymentChannel(
            mockChannelId,
            mockWeb3,
            mockAccount,
            mockServiceMetadata,
            mockMpeContract
        );
    });

    describe('addFunds', () => {
        test('should add funds to the payment channel', async () => {
            const amount = new BigNumber(1000);
            const receipt = await paymentChannel.addFunds(amount);

            expect(mockMpeContract.channelAddFunds).toHaveBeenCalledWith(
                mockAccount,
                mockChannelId,
                amount
            );
            expect(receipt).toEqual({ status: true });
        });
    });

    describe('extendExpiry', () => {
        test('should extend the expiry of the payment channel', async () => {
            const expiry = new BigNumber(3000);
            const receipt = await paymentChannel.extendExpiry(expiry);

            expect(mockMpeContract.channelExtend).toHaveBeenCalledWith(
                mockAccount,
                mockChannelId,
                expiry
            );
            expect(receipt).toEqual({ status: true });
        });
    });

    describe('extendAndAddFunds', () => {
        test('should extend expiry and add funds to the payment channel', async () => {
            const expiry = new BigNumber(3000);
            const amount = new BigNumber(1000);
            const receipt = await paymentChannel.extendAndAddFunds(expiry, amount);

            expect(mockMpeContract.channelExtendAndAddFunds).toHaveBeenCalledWith(
                mockAccount,
                mockChannelId,
                expiry,
                amount
            );
            expect(receipt).toEqual({ status: true });
        });
    });

    describe('claimUnusedTokens', () => {
        test('should claim unused tokens from the payment channel', async () => {
            const receipt = await paymentChannel.claimUnusedTokens();

            expect(mockMpeContract.channelClaimTimeout).toHaveBeenCalledWith(
                mockAccount,
                mockChannelId
            );
            expect(receipt).toEqual({ status: true });
        });
    });

    describe('syncState', () => {
        test('should sync the state of the payment channel', async () => {
            toBNString.mockImplementation((value) => value.toString());
            PaymentChannelProvider.mockImplementation(() => ({
                getChannelState: jest.fn().mockResolvedValue({
                    toObject: jest.fn().mockReturnValue({
                        getCurrentNonce: new Uint8Array([2]),
                        getCurrentSignedAmount: new Uint8Array([100]),
                    }),
                    getCurrentNonce: jest.fn().mockReturnValue(new Uint8Array([2])),
                    getCurrentSignedAmount: jest.fn().mockReturnValue(new Uint8Array([100])),
                }),
            }));

            uint8ArrayToBN.mockImplementation((array) => new BigNumber(array[0]));

            const updatedChannel = await paymentChannel.syncState();

            expect(mockMpeContract.channels).toHaveBeenCalledWith(mockChannelId);
            expect(updatedChannel.state).toMatchObject({
                nonce: '1',
                currentNonce: new BigNumber(2),
                expiry: new BigNumber(2000),
                amountDeposited: new BigNumber(1000),
                currentSignedAmount: new BigNumber(100),
                availableAmount: 900,
            });
        });
    });

    describe('_currentChannelState', () => {
        test('should fetch the current channel state from the service daemon', async () => {
            PaymentChannelProvider.mockImplementation(() => ({
                getChannelState: jest.fn().mockResolvedValue({
                    toObject: jest.fn().mockReturnValue({
                        getCurrentNonce: new Uint8Array([2]),
                        getCurrentSignedAmount: new Uint8Array([100]),
                    }),
                    getCurrentNonce: jest.fn().mockReturnValue(new Uint8Array([2])),
                    getCurrentSignedAmount: jest.fn().mockReturnValue(new Uint8Array([100])),
                }),
            }));

            uint8ArrayToBN.mockImplementation((array) => new BigNumber(array[0]));

            const state = await paymentChannel._currentChannelState();

            expect(state).toMatchObject({
                nonce: new BigNumber(2),
                currentSignedAmount: new BigNumber(100),
            });
        });
    });
});
