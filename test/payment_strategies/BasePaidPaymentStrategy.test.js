import BasePaidPaymentStrategy from '../../src/payment_strategies/BasePaidPaymentStrategy';
import PaymentChannelProvider from '../../src/mpe/PaymentChannelProvider';

// Mock dependencies
jest.mock('../../src/mpe/PaymentChannelProvider');

const createMockChannel = ({ availableAmount, expiry, methods = {} }) => {
    return {
        channelId: 1,
        state: {
            availableAmount,
            expiry,
        },
        extendExpiry: jest.fn().mockResolvedValue(undefined),
        addFunds: jest.fn().mockResolvedValue(undefined),
        extendAndAddFunds: jest.fn().mockResolvedValue(undefined),
        ...methods,
    };
};

describe('BasePaidPaymentStrategy', () => {
    let strategy;
    let mockAccount;
    let mockServiceMetadata;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock account methods
        mockAccount = {
            escrowBalance: jest.fn().mockResolvedValue(1000),
            getCurrentBlockNumber: jest.fn().mockResolvedValue(100),
        };

        // Mock service metadata
        mockServiceMetadata = {
            defaultChannelExpiration: jest.fn().mockResolvedValue(150),
        };

        strategy = new BasePaidPaymentStrategy(mockAccount, mockServiceMetadata);
        // Override _getPrice for testing
        strategy._getPrice = jest.fn().mockReturnValue(100);
    });

    test('should select an existing valid payment channel with sufficient funds', async () => {
        const mockChannel = createMockChannel({ availableAmount: 200, expiry: 200 });

        // Mock PaymentChannelProvider instance and its methods
        PaymentChannelProvider.mockImplementation(() => {
            return {
                updateChannelStates: jest.fn().mockResolvedValue([mockChannel]),
                paymentChannels: [mockChannel],
            };
        });

        const result = await strategy._selectChannel(null, 100);

        expect(result).toBe(mockChannel);
        expect(mockChannel.extendExpiry).not.toHaveBeenCalled();
        expect(mockChannel.addFunds).not.toHaveBeenCalled();
        expect(mockChannel.extendAndAddFunds).not.toHaveBeenCalled();
    });

    test('should open a new channel if no existing channels are available', async () => {
        const newChannel = createMockChannel({ availableAmount: 200, expiry: 200 });

        PaymentChannelProvider.mockImplementation(() => {
            return {
                updateChannelStates: jest.fn().mockResolvedValue([]),
                paymentChannels: [],
                openChannel: jest.fn().mockResolvedValue(newChannel),
            };
        });

        const result = await strategy._selectChannel(null, 100);

        expect(result).toBe(newChannel);
    });

    test('should extend expiry if funds are sufficient but channel is invalid', async () => {
        const mockChannel = createMockChannel({ availableAmount: 200, expiry: 100 }); // expiry < defaultExpiry (150)

        PaymentChannelProvider.mockImplementation(() => {
            return {
                updateChannelStates: jest.fn().mockResolvedValue([mockChannel]),
                paymentChannels: [mockChannel],
            };
        });

        const result = await strategy._selectChannel(null, 100);

        expect(result).toBe(mockChannel);
        expect(mockChannel.extendExpiry).toHaveBeenCalled();
    });

    test('should add funds if funds are insufficient but channel is valid', async () => {
        const mockChannel = createMockChannel({ availableAmount: 50, expiry: 200 });

        PaymentChannelProvider.mockImplementation(() => {
            return {
                updateChannelStates: jest.fn().mockResolvedValue([mockChannel]),
                paymentChannels: [mockChannel],
            };
        });

        const result = await strategy._selectChannel(null, 100);

        expect(result).toBe(mockChannel);
        expect(mockChannel.addFunds).toHaveBeenCalled();
    });

    test('should extend and add funds if funds are insufficient and channel is invalid', async () => {
        const mockChannel = createMockChannel({ availableAmount: 50, expiry: 100 });

        PaymentChannelProvider.mockImplementation(() => {
            return {
                updateChannelStates: jest.fn().mockResolvedValue([mockChannel]),
                paymentChannels: [mockChannel],
            };
        });

        const result = await strategy._selectChannel(null, 100);

        expect(result).toBe(mockChannel);
        expect(mockChannel.extendAndAddFunds).toHaveBeenCalled();
    });

    test('should use preselected channel if it exists', async () => {
        const preselectedChannel = createMockChannel({ availableAmount: 200, expiry: 200 });

        PaymentChannelProvider.mockImplementation(() => {
            return {
                updateChannelStates: jest.fn().mockResolvedValue([preselectedChannel]),
                paymentChannels: [preselectedChannel],
            };
        });

        const result = await strategy._selectChannel(1, 100);

        expect(result).toBe(preselectedChannel);
    });
});
