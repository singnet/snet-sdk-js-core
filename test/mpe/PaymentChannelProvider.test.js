import PaymentChannelProvider from '../../src/mpe/PaymentChannelProvider';
import { toBNString } from '../../src/utils/bignumberHelper';
import { logMessage } from '../../src/utils/logger';

// Mock dependencies
jest.mock('../../src/utils/bignumberHelper');
jest.mock('../../src/utils/logger');

describe('PaymentChannelProvider', () => {
    let provider;
    let mockAccount;
    let mockServiceMetadata;
    let mockChannelModelProvider;
    let mockMpeContract;

    beforeEach(() => {
        mockAccount = {
            getCurrentBlockNumber: jest.fn(),
            signData: jest.fn(),
        };

        mockMpeContract = {
            address: '0x123',
            getPastOpenChannels: jest.fn(),
            openChannel: jest.fn(),
            depositAndOpenChannel: jest.fn(),
        };

        mockChannelModelProvider = {
            getChannelStateRequestMethodDescriptor: jest.fn(),
            generatePaymentChannelStateServiceClient: jest.fn(),
        };

        mockServiceMetadata = {
            _options: {},
            mpeContract: mockMpeContract,
            group: { id: 'test-group' },
            ChannelModelProvider: mockChannelModelProvider,
        };

        provider = new PaymentChannelProvider(mockAccount, mockServiceMetadata);
    });

    describe('constructor', () => {
        it('should initialize with provided parameters', () => {
            expect(provider.account).toBe(mockAccount);
            expect(provider.mpeContract).toBe(mockMpeContract);
            expect(provider.group).toEqual(mockServiceMetadata.group);
            expect(provider.serviceMetadata).toBe(mockServiceMetadata);
            expect(provider.paymentChannels).toEqual([]);
            expect(provider.ChannelModelProvider).toBe(mockChannelModelProvider);
        });
    });

    describe('_channelStateRequestProperties', () => {
        it('should use channelStateRequestSigner when provided in options', async () => {
            const mockSigner = jest.fn().mockResolvedValue({
                currentBlockNumber: 100,
                signatureBytes: 'signature-from-signer',
            });
            provider.options.channelStateRequestSigner = mockSigner;

            const result = await provider._channelStateRequestProperties(123);

            expect(mockSigner).toHaveBeenCalledWith(123);
            expect(result).toEqual({
                currentBlockNumber: 100,
                signatureBytes: 'signature-from-signer',
            });
        });

        it('should generate signature when no signer is provided', async () => {
            mockAccount.getCurrentBlockNumber.mockResolvedValue(100);
            mockAccount.signData.mockResolvedValue('generated-signature');
            toBNString.mockImplementation((x) => x.toString());

            const result = await provider._channelStateRequestProperties(123);

            expect(mockAccount.getCurrentBlockNumber).toHaveBeenCalled();
            expect(mockAccount.signData).toHaveBeenCalledWith(
                { t: 'string', v: '__get_channel_state' },
                { t: 'address', v: '0x123' },
                { t: 'uint256', v: '123' },
                { t: 'uint256', v: '100' }
            );
            expect(result).toEqual({
                currentBlockNumber: 100,
                signatureBytes: 'generated-signature',
            });
        });

        it('should throw error when signature generation fails', async () => {
            mockAccount.getCurrentBlockNumber.mockRejectedValue(new Error('block error'));

            await expect(provider._channelStateRequestProperties(123)).rejects.toThrow(
                'channel state request properties generating error:'
            );
        });
    });

    describe('_channelStateRequest', () => {
        it('should create a channel state request', async () => {
            const mockMethodDescriptor = {
                setChannelId: jest.fn(),
                setSignature: jest.fn(),
                setCurrentBlock: jest.fn(),
            };
            mockChannelModelProvider.getChannelStateRequestMethodDescriptor.mockReturnValue(mockMethodDescriptor);
            mockAccount.getCurrentBlockNumber.mockResolvedValue(100);
            mockAccount.signData.mockResolvedValue('test-signature');
            toBNString.mockImplementation((x) => x.toString());

            const result = await provider._channelStateRequest(123);

            expect(mockChannelModelProvider.getChannelStateRequestMethodDescriptor).toHaveBeenCalled();
            expect(mockMethodDescriptor.setChannelId).toHaveBeenCalled();
            expect(mockMethodDescriptor.setSignature).toHaveBeenCalledWith('test-signature');
            expect(mockMethodDescriptor.setCurrentBlock).toHaveBeenCalledWith('100');
            expect(result).toBe(mockMethodDescriptor);
        });
    });

    describe('_getNewlyOpenedChannel', () => {
        it('should return the first open channel', async () => {
            const mockChannel = { channelId: 123 };
            mockMpeContract.getPastOpenChannels.mockResolvedValue([mockChannel]);

            const result = await provider._getNewlyOpenedChannel();

            expect(mockMpeContract.getPastOpenChannels).toHaveBeenCalledWith(
                mockAccount,
                mockServiceMetadata,
                mockServiceMetadata.group
            );
            expect(logMessage).toHaveBeenCalledWith(
                'info',
                'PaymentChannelProvider',
                'New PaymentChannel[id: 123] opened'
            );
            expect(result).toBe(mockChannel);
        });

        it('should throw error when getting channels fails', async () => {
            mockMpeContract.getPastOpenChannels.mockRejectedValue(new Error('network error'));

            await expect(provider._getNewlyOpenedChannel()).rejects.toThrow(
                'getting newly opened channel error:'
            );
        });
    });

    describe('getChannelState', () => {
        it('should get channel state from service client', async () => {
            const mockRequest = {};
            const mockResponse = { state: 'test' };
            const mockClient = {
                getChannelState: jest.fn((req, callback) => callback(null, mockResponse)),
            };
            provider._channelStateRequest = jest.fn().mockResolvedValue(mockRequest);
            mockChannelModelProvider.generatePaymentChannelStateServiceClient.mockReturnValue(mockClient);

            const result = await provider.getChannelState(123);

            expect(provider._channelStateRequest).toHaveBeenCalledWith(123);
            expect(result).toBe(mockResponse);
        });

        it('should reject when service client returns error', async () => {
            const mockRequest = {};
            const mockClient = {
                getChannelState: jest.fn((req, callback) => callback(new Error('service error'), null)),
            };
            provider._channelStateRequest = jest.fn().mockResolvedValue(mockRequest);
            mockChannelModelProvider.generatePaymentChannelStateServiceClient.mockReturnValue(mockClient);

            await expect(provider.getChannelState(123)).rejects.toThrow('service error');
        });
    });

    describe('loadOpenChannels', () => {
        it('should load and merge open channels', async () => {
            const existingChannels = [{ channelId: 1 }];
            const newChannels = [{ channelId: 2 }, { channelId: 3 }];
            provider.paymentChannels = existingChannels;
            mockMpeContract.getPastOpenChannels.mockResolvedValue(newChannels);

            const result = await provider.loadOpenChannels();

            expect(mockMpeContract.getPastOpenChannels).toHaveBeenCalledWith(
                mockAccount,
                mockServiceMetadata,
                mockServiceMetadata.group
            );
            expect(logMessage).toHaveBeenCalledWith(
                'debug',
                'PaymentChannelProvider',
                'Found 2 payment channel open events'
            );
            expect(result).toEqual([...existingChannels, ...newChannels]);
            expect(provider.paymentChannels).toEqual([...existingChannels, ...newChannels]);
        });
    });

    describe('findPreselectChannel', () => {
        it('should find channel by id', () => {
            const channels = [
                { channelId: 1, name: 'channel1' },
                { channelId: 2, name: 'channel2' },
            ];

            const result = provider.findPreselectChannel(channels, 2);

            expect(result).toEqual({ channelId: 2, name: 'channel2' });
        });

        it('should return undefined when channel not found', () => {
            const channels = [
                { channelId: 1, name: 'channel1' },
                { channelId: 2, name: 'channel2' },
            ];

            const result = provider.findPreselectChannel(channels, 3);

            expect(result).toBeUndefined();
        });
    });

    describe('updateChannelState', () => {
        it('should update state of preselect channel', async () => {
            const channels = [
                { channelId: 1, syncState: jest.fn() },
                { channelId: 2, syncState: jest.fn() },
            ];
            provider.loadOpenChannels = jest.fn().mockResolvedValue(channels);

            const result = await provider.updateChannelState(2);

            expect(provider.loadOpenChannels).toHaveBeenCalled();
            expect(channels[1].syncState).toHaveBeenCalled();
            expect(result).toBe(channels);
        });

        it('should update state of first channel when no preselect', async () => {
            const channels = [
                { channelId: 1, syncState: jest.fn() },
                { channelId: 2, syncState: jest.fn() },
            ];
            provider.loadOpenChannels = jest.fn().mockResolvedValue(channels);

            const result = await provider.updateChannelState();

            expect(channels[0].syncState).toHaveBeenCalled();
            expect(result).toBe(channels);
        });

        it('should log update action', async () => {
            provider.loadOpenChannels = jest.fn().mockResolvedValue([]);

            await provider.updateChannelState();

            expect(logMessage).toHaveBeenCalledWith(
                'info',
                'PaymentChannelProvider',
                'Updating payment channel state'
            );
        });
    });

    describe('openChannel', () => {
        it('should open channel and return newly opened channel', async () => {
            const mockChannel = { channelId: 123 };
            mockMpeContract.openChannel.mockResolvedValue(true);
            provider._getNewlyOpenedChannel = jest.fn().mockResolvedValue(mockChannel);

            const result = await provider.openChannel(100, 1000);

            expect(mockMpeContract.openChannel).toHaveBeenCalledWith(
                mockAccount,
                mockServiceMetadata.group,
                100,
                1000
            );
            expect(result).toBe(mockChannel);
        });

        it('should throw error when opening fails', async () => {
            mockMpeContract.openChannel.mockRejectedValue(new Error('open error'));

            await expect(provider.openChannel(100, 1000)).rejects.toThrow(
                'opening channel states error:'
            );
        });
    });

    describe('depositAndOpenChannel', () => {
        it('should deposit, open channel and return newly opened channel', async () => {
            const mockChannel = { channelId: 123 };
            mockMpeContract.depositAndOpenChannel.mockResolvedValue(true);
            provider._getNewlyOpenedChannel = jest.fn().mockResolvedValue(mockChannel);

            const result = await provider.depositAndOpenChannel(100, 1000);

            expect(mockMpeContract.depositAndOpenChannel).toHaveBeenCalledWith(
                mockAccount,
                mockServiceMetadata.group,
                100,
                1000
            );
            expect(result).toBe(mockChannel);
        });

        it('should throw error when deposit and opening fails', async () => {
            mockMpeContract.depositAndOpenChannel.mockRejectedValue(new Error('deposit error'));

            await expect(provider.depositAndOpenChannel(100, 1000)).rejects.toThrow(
                'depositing and opening channel states error:'
            );
        });
    });
});