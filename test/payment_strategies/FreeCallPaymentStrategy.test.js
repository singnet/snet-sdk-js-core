import FreeCallPaymentStrategy from '../../src/payment_strategies/FreeCallPaymentStrategy';
import { logMessage } from '../../src/utils/logger';

jest.mock('../../src/utils/logger', () => ({
    logMessage: jest.fn(),
}));

jest.mock('../../src/utils/encodingUtils');
jest.mock('../../src/utils/metadataUtils');

import EncodingUtils from '../../src/utils/encodingUtils';
import { FreecallMetadataGenerator } from '../../src/utils/metadataUtils';
import { toBNString } from '../../src/utils/bignumber_helper';

jest.mock('../../src/utils/bignumber_helper', () => ({
    toBNString: jest.fn().mockImplementation((n) => `bn-${n}`),
}));

describe('FreeCallPaymentStrategy', () => {
    let mockAccount;
    let mockServiceMetadata;
    let strategy;
    let encodingInstance;
    let metadataGeneratorInstance;

    beforeEach(() => {
        mockAccount = {
            getCurrentBlockNumber: jest.fn().mockResolvedValue(123),
            signData: jest.fn().mockResolvedValue('signed-signature'),
        };

        mockServiceMetadata = {
            getFreeCallConfig: jest.fn().mockReturnValue({
                email: 'user@example.com',
                tokenToMakeFreeCall: '0xabc123',
                tokenExpiryDateBlock: 789,
            }),
            getServiceDetails: jest.fn().mockReturnValue({
                orgId: 'org1',
                serviceId: 'svc1',
                groupId: 'grp1',
            }),
            _getServiceEndpoint: jest.fn().mockReturnValue({ host: 'localhost' }),
        };

        encodingInstance = {
            hexStringToBytes: jest.fn().mockReturnValue(Uint8Array.from([1, 2, 3])),
        };

        metadataGeneratorInstance = {
            generateMetadata: jest.fn().mockReturnValue([{ 'snet-payment-type': 'free-call' }]),
        };

        EncodingUtils.mockImplementation(() => encodingInstance);
        FreecallMetadataGenerator.mockImplementation(() => metadataGeneratorInstance);

        strategy = new FreeCallPaymentStrategy(mockAccount, mockServiceMetadata);
    });

    describe('isFreeCallAvailable', () => {
        it('should return true when free calls > 0', async () => {
            strategy.getFreeCallsAvailable = jest.fn().mockResolvedValue(2);
            const result = await strategy.isFreeCallAvailable();
            expect(result).toBe(true);
        });

        it('should return false when free calls = 0', async () => {
            strategy.getFreeCallsAvailable = jest.fn().mockResolvedValue(0);
            const result = await strategy.isFreeCallAvailable();
            expect(result).toBe(false);
        });

        it('should return false and log error on exception', async () => {
            strategy.getFreeCallsAvailable = jest.fn().mockRejectedValue(new Error('error'));
            const result = await strategy.isFreeCallAvailable();
            expect(result).toBe(false);
            expect(logMessage).toHaveBeenCalledWith('error', 'FreeCallPaymentStrategy', 'is freecall available error');
        });
    });

    describe('getPaymentMetadata', () => {
        it('should generate metadata with correct values', async () => {
            const result = await strategy.getPaymentMetadata();

            expect(mockAccount.getCurrentBlockNumber).toHaveBeenCalled();
            expect(mockAccount.signData).toHaveBeenCalled();
            expect(encodingInstance.hexStringToBytes).toHaveBeenCalledWith('0xabc123');
            expect(metadataGeneratorInstance.generateMetadata).toHaveBeenCalledWith({
                type: 'free-call',
                userId: 'user@example.com',
                currentBlockNumber: 123,
                freecallAuthToken: Uint8Array.from([1, 2, 3]),
                freecallTokenExpiryBlock: 789,
                signatureBytes: 'signed-signature',
            });
            expect(result).toEqual([{ 'snet-payment-type': 'free-call' }]);
        });
    });

    describe('_generateSignature', () => {
        it('should return a signed signature for valid input', async () => {
            const result = await strategy._generateSignature(123);
            expect(result).toBe('signed-signature');
        });

        it('should throw error on invalid token/email', async () => {
            mockServiceMetadata.getFreeCallConfig.mockReturnValue({
                email: '',
                tokenToMakeFreeCall: '',
                tokenExpiryDateBlock: 0,
            });

            await expect(strategy._generateSignature(123)).rejects.toThrow('invalid entries');
        });
    });

    describe('getFreeCallsAvailable', () => {
        it('should return number of available free calls from response', async () => {
            const mockRequest = {};
            const mockResponse = {
                getFreeCallsAvailable: jest.fn().mockReturnValue(5),
            };

            strategy._getFreeCallStateRequest = jest.fn().mockResolvedValue(mockRequest);
            strategy._freeCallStateServiceClient = {
                getFreeCallsAvailable: (req, cb) => cb(null, mockResponse),
            };

            const result = await strategy.getFreeCallsAvailable();
            expect(result).toBe(5);
        });

        it('should return 0 if no response', async () => {
            strategy._getFreeCallStateRequest = jest.fn().mockResolvedValue({});
            strategy._freeCallStateServiceClient = {
                getFreeCallsAvailable: (req, cb) => cb(null, null),
            };

            const result = await strategy.getFreeCallsAvailable();
            expect(result).toBe(0);
        });

        it('should throw error if RPC fails', async () => {
            strategy._getFreeCallStateRequest = jest.fn().mockResolvedValue({});
            strategy._freeCallStateServiceClient = {
                getFreeCallsAvailable: (req, cb) => cb(new Error('RPC failed')),
            };

            await expect(strategy.getFreeCallsAvailable()).rejects.toThrow('RPC failed');
        });
    });

    describe('_getFreeCallStateRequest', () => {
        it('should return a properly constructed request', async () => {
            const mockRequestInstance = {
                setUserId: jest.fn(),
                setTokenForFreeCall: jest.fn(),
                setTokenExpiryDateBlock: jest.fn(),
                setSignature: jest.fn(),
                setCurrentBlock: jest.fn(),
            };

            strategy._freeCallStateMethodDescriptor = {
                requestType: jest.fn().mockImplementation(() => function () { return mockRequestInstance; }),
            };

            strategy._freeCallStateMethodDescriptor.requestType = function () {
                return mockRequestInstance;
            };

            strategy._getFreeCallStateRequestProperties = jest.fn().mockResolvedValue({
                userId: 'user@example.com',
                tokenForFreeCall: '0xabc123',
                tokenExpiryDateBlock: 789,
                signature: 'signed-signature',
                currentBlockNumber: 'bn-123',
            });

            const result = await strategy._getFreeCallStateRequest();

            expect(mockRequestInstance.setUserId).toHaveBeenCalledWith('user@example.com');
            expect(mockRequestInstance.setTokenForFreeCall).toHaveBeenCalledWith(Uint8Array.from([1, 2, 3]));
            expect(mockRequestInstance.setTokenExpiryDateBlock).toHaveBeenCalledWith(789);
            expect(mockRequestInstance.setSignature).toHaveBeenCalledWith('signed-signature');
            expect(mockRequestInstance.setCurrentBlock).toHaveBeenCalledWith('bn-123');
            expect(result).toBe(mockRequestInstance);
        });

        it('should return undefined if token is empty', async () => {
            strategy._getFreeCallStateRequestProperties = jest.fn().mockResolvedValue({
                userId: 'user@example.com',
                tokenForFreeCall: null,
                tokenExpiryDateBlock: 789,
                signature: 'signed-signature',
                currentBlockNumber: 'bn-123',
            });

            strategy._freeCallStateMethodDescriptor = {
                requestType: function () {
                    // simulate constructor throwing error
                    throw new Error('Request constructor error');
                },
            };

            await expect(strategy._getFreeCallStateRequest()).rejects.toThrow(Error);
        });
    });
});
