import PaidCallPaymentStrategy from '../../src/paymentStrategies/PaidCallPaymentStrategy';
import BasePaidPaymentStrategy from '../../src/paymentStrategies/BasePaidPaymentStrategy';

// Mock the base class
jest.mock('../../src/paymentStrategies/BasePaidPaymentStrategy');

describe('PaidCallPaymentStrategy', () => {
    let strategy;
    let mockAccount;
    let mockServiceMetadata;
    const mockChannel = {
        channelId: 123,
        state: {
            currentSignedAmount: { toNumber: () => 100 },
            nonce: 5,
        },
    };

    beforeEach(() => {
        mockAccount = {
            signData: jest.fn().mockResolvedValue(Buffer.from('test-signature')),
        };

        mockServiceMetadata = {
            mpeContract: {
                address: '0x123',
            },
            pricePerServiceCall: {
                toNumber: () => 10,
            },
        };

        // Mock base class methods
        BasePaidPaymentStrategy.mockImplementation(() => {
            return {
                _selectChannel: jest.fn().mockResolvedValue(mockChannel),
                _account: mockAccount,
                _serviceMetadata: mockServiceMetadata,
                _blockOffset: 240,
                _callAllowance: 1,
            };
        });

        strategy = new PaidCallPaymentStrategy(
            mockAccount,
            mockServiceMetadata,
            240,
            1
        );
    });

    describe('constructor', () => {
        it('should initialize with provided parameters', () => {
            expect(BasePaidPaymentStrategy).toHaveBeenCalledWith(
                mockAccount,
                mockServiceMetadata,
                240,
                1
            );
        });
    });

    describe('getPaymentMetadata', () => {
        it('should return correct payment metadata', async () => {
            const result = await strategy.getPaymentMetadata();

            expect(strategy._selectChannel).toHaveBeenCalled();
            expect(mockAccount.signData).toHaveBeenCalledWith(
                { t: 'string', v: '__MPE_claim_message' },
                { t: 'address', v: '0x123' },
                { t: 'uint256', v: 123 },
                { t: 'uint256', v: 5 },
                { t: 'uint256', v: 110 } // 100 (current) + 10 (price)
            );
            expect(result).toEqual({
                type: 'escrow',
                channelId: 123,
                channelNonce: 5,
                channelAmount: 110,
                signatureBytes: Buffer.from('test-signature'),
            });
        });

        it('should use correct price calculation', async () => {
            mockServiceMetadata.pricePerServiceCall.toNumber = () => 20;
            const result = await strategy.getPaymentMetadata();

            expect(result.channelAmount).toBe(120); // 100 + 20
        });
    });

    describe('getTrainingPaymentMetadata', () => {
        it('should return correct training payment metadata', async () => {
            const modelId = 'model-123';
            const amount = 50;
            const result = await strategy.getTrainingPaymentMetadata(modelId, amount);

            expect(strategy._selectChannel).toHaveBeenCalledWith(undefined, amount);
            expect(mockAccount.signData).toHaveBeenCalledWith(
                { t: 'string', v: '__MPE_claim_message' },
                { t: 'address', v: '0x123' },
                { t: 'uint256', v: 123 },
                { t: 'uint256', v: 5 },
                { t: 'uint256', v: 150 } // 100 + 50
            );
            expect(result).toEqual({
                type: 'train-call',
                modelId: 'model-123',
                channelId: 123,
                channelNonce: 5,
                channelAmount: 150,
                signatureBytes: Buffer.from('test-signature'),
            });
        });

        it('should handle zero amount', async () => {
            const result = await strategy.getTrainingPaymentMetadata('model-123', 0);
            expect(result.channelAmount).toBe(100); // 100 + 0
        });
    });

    describe('_generateSignature', () => {
        it('should generate signature with correct parameters', async () => {
            const result = await strategy._generateSignature(123, 5, 100);

            expect(mockAccount.signData).toHaveBeenCalledWith(
                { t: 'string', v: '__MPE_claim_message' },
                { t: 'address', v: '0x123' },
                { t: 'uint256', v: 123 },
                { t: 'uint256', v: 5 },
                { t: 'uint256', v: 100 }
            );
            expect(result).toEqual(Buffer.from('test-signature'));
        });
    });

    describe('_getPrice', () => {
        it('should return price from service metadata', () => {
            mockServiceMetadata.pricePerServiceCall.toNumber = () => 15;
            const result = strategy._getPrice();
            expect(result).toBe(15);
        });

        it('should handle zero price', () => {
            mockServiceMetadata.pricePerServiceCall.toNumber = () => 0;
            const result = strategy._getPrice();
            expect(result).toBe(0);
        });
    });

    describe('error handling', () => {
        it('should propagate errors from _selectChannel', async () => {
            strategy._selectChannel = jest.fn().mockRejectedValue(new Error('Channel selection failed'));
            await expect(strategy.getPaymentMetadata()).rejects.toThrow('Channel selection failed');
        });

        it('should propagate errors from signData', async () => {
            mockAccount.signData = jest.fn().mockRejectedValue(new Error('Signing failed'));
            await expect(strategy.getPaymentMetadata()).rejects.toThrow('Signing failed');
        });
    });
});