import PrepaidPaymentStrategy from '../../src/paymentStrategies/PrepaidPaymentStrategy';
import BasePaidPaymentStrategy from '../../src/paymentStrategies/BasePaidPaymentStrategy';
import { utfStringToBytes } from '../../src/utils';

// Mock dependencies
jest.mock('../../src/paymentStrategies/BasePaidPaymentStrategy');
jest.mock('..../../src/utils/encodingUtils');

describe('PrepaidPaymentStrategy', () => {
    let strategy;
    let mockAccount;
    let mockServiceMetadata;
    let mockConcurrencyManager;
    const mockChannel = {
        channelId: 123,
        state: {
            nonce: 5,
        },
    };

    beforeEach(() => {
        mockAccount = {};
        mockConcurrencyManager = {
            getToken: jest.fn().mockResolvedValue('test-token'),
            concurrentCalls: 2,
        };
        mockServiceMetadata = {
            concurrencyManager: mockConcurrencyManager,
            pricePerServiceCall: {
                toNumber: () => 10,
            },
        };

        // Mock base class
        BasePaidPaymentStrategy.mockImplementation(() => ({
            _selectChannel: jest.fn().mockResolvedValue(mockChannel),
            _account: mockAccount,
            _serviceMetadata: mockServiceMetadata,
            _blockOffset: 240,
            _callAllowance: 1,
        }));

        // Mock encoding utility
        utfStringToBytes.mockImplementation((str) => Buffer.from(str));

        strategy = new PrepaidPaymentStrategy(
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
            expect(strategy._concurrencyManager).toBe(mockConcurrencyManager);
        });
    });

    describe('getPaymentMetadata', () => {
        it('should return correct payment metadata', async () => {
            const result = await strategy.getPaymentMetadata();

            expect(strategy._selectChannel).toHaveBeenCalled();
            expect(mockConcurrencyManager.getToken).toHaveBeenCalledWith(
                mockChannel,
                20 // 10 (price) * 2 (concurrent calls)
            );
            expect(utfStringToBytes).toHaveBeenCalledWith('test-token');
            expect(result).toEqual({
                type: 'prepaid-call',
                channelId: 123,
                channelNonce: 5,
                prepaidAuthTokenBytes: Buffer.from('test-token'),
            });
        });

        it('should use preselect channel ID when provided', async () => {
            await strategy.getPaymentMetadata(456);
            expect(strategy._selectChannel).toHaveBeenCalledWith(456);
        });

        it('should throw error when concurrency manager is missing', async () => {
            strategy._concurrencyManager = null;
            await expect(strategy.getPaymentMetadata()).rejects.toThrow(
                'concurrency manager not found!'
            );
        });

        it('should handle zero concurrent calls', async () => {
            mockConcurrencyManager.concurrentCalls = 0;
            const result = await strategy.getPaymentMetadata();
            expect(mockConcurrencyManager.getToken).toHaveBeenCalledWith(
                mockChannel,
                0
            );
            expect(result.channelNonce).toBe(5);
        });
    });

    describe('getConcurrencyToken', () => {
        it('should return concurrency token', async () => {
            const result = await strategy.getConcurrencyToken(mockChannel);

            expect(mockConcurrencyManager.getToken).toHaveBeenCalledWith(
                mockChannel,
                20 // 10 * 2
            );
            expect(result).toBe('test-token');
        });

        it('should handle zero price', async () => {
            mockConcurrencyManager.concurrentCalls = 0;
            const result = await strategy.getConcurrencyToken(mockChannel);
            expect(result).toBe('test-token');
            expect(mockConcurrencyManager.getToken).toHaveBeenCalledWith(
                mockChannel,
                0
            );
        });
    });

    describe('_getPrice', () => {
        it('should calculate price based on concurrent calls', () => {
            mockServiceMetadata.pricePerServiceCall.toNumber = () => 15;
            mockConcurrencyManager.concurrentCalls = 3;
            const result = strategy._getPrice();
            expect(result).toBe(45); // 15 * 3
        });

        it('should return 0 when no concurrency manager', () => {
            strategy._concurrencyManager = null;
            const result = strategy._getPrice();
            expect(result).toBe(0);
        });

        it('should return 0 when no concurrent calls', () => {
            mockConcurrencyManager.concurrentCalls = 0;
            const result = strategy._getPrice();
            expect(result).toBe(0);
        });

        it('should handle zero price per call', () => {
            mockServiceMetadata.pricePerServiceCall.toNumber = () => 0;
            mockConcurrencyManager.concurrentCalls = 2;
            const result = strategy._getPrice();
            expect(result).toBe(0);
        });
    });

    describe('error handling', () => {
        it('should propagate errors from _selectChannel', async () => {
            strategy._selectChannel = jest.fn().mockRejectedValue(new Error('Channel error'));
            await expect(strategy.getPaymentMetadata()).rejects.toThrow('Channel error');
        });

        it('should propagate errors from getToken', async () => {
            mockConcurrencyManager.getToken = jest.fn().mockRejectedValue(new Error('Token error'));
            await expect(strategy.getPaymentMetadata()).rejects.toThrow('Token error');
        });
    });
});