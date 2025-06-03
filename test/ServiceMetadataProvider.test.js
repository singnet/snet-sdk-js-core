import ServiceMetadataProvider from '../src/ServiceMetadataProvider';
import { BigNumber } from 'bignumber.js';
import { isEmpty } from 'lodash';
import { toBNString } from '../src/utils/bignumberHelper';
import { logMessage } from '../src/utils/logger';
import { PaymentMetadataGenerator } from '../src/utils/metadataUtils';

// Mock dependencies
jest.mock('../src/utils/bignumberHelper');
jest.mock('../src/utils/logger');
jest.mock('../src/utils/metadataUtils');

describe('ServiceMetadataProvider', () => {
    let provider;
    let mockOptions;
    let mockMpeContract;
    let mockGroup;
    let mockServiceMetadata;
    let mockOrgMetadata;

    beforeEach(() => {
        // Initialize mock data
        mockOptions = {
            endpoint: 'https://test.service.ai',
            concurrency: true
        };

        mockMpeContract = {
            address: '0x123456789'
        };

        mockGroup = {
            group_id: 'test-group',
            payment: {
                price_in_cogs: '1000000',
                payment_address: '0x987654321',
                payment_expiration_threshold: 1000
            },
            pricing: [
                { price_model: 'fixed_price', price_in_cogs: '1000000' }
            ],
            endpoints: ['https://default.service.ai']
        };

        mockServiceMetadata = {
            orgId: 'test-org',
            serviceId: 'test-service',
            version: '1.0.0'
        };

        mockOrgMetadata = {
            orgName: 'Test Org',
            assets: {}
        };

        // Mock utility functions
        toBNString.mockImplementation((x) => x.toString());
        logMessage.mockImplementation(() => {});
        
        const mockMetadataGenerator = {
            generateMetadata: jest.fn().mockReturnValue({ meta: 'data' })
        };
        PaymentMetadataGenerator.mockImplementation(() => mockMetadataGenerator);

        // Create provider instance
        provider = new ServiceMetadataProvider(
            'test-org',
            'test-service',
            mockServiceMetadata,
            mockOrgMetadata,
            mockMpeContract,
            mockGroup,
            mockOptions
        );
    });

    describe('constructor', () => {
        it('should initialize with provided parameters', () => {
            expect(provider._serviceMetadata).toEqual({
                orgId: 'test-org',
                serviceId: 'test-service',
                ...mockServiceMetadata
            });
            expect(provider._orgMetadata).toBe(mockOrgMetadata);
            expect(provider._mpeContract).toBe(mockMpeContract);
            expect(provider._options).toBe(mockOptions);
        });

        it('should enhance group info with additional fields', () => {
            expect(provider._group).toEqual({
                group_id_in_bytes: expect.any(Buffer),
                ...mockGroup,
                payment_address: mockGroup.payment.payment_address,
                payment_expiration_threshold: mockGroup.payment.payment_expiration_threshold
            });
        });

        it('should handle empty group', () => {
            const emptyProvider = new ServiceMetadataProvider(
                'test-org',
                'test-service',
                mockServiceMetadata,
                mockOrgMetadata,
                mockMpeContract,
                {},
                mockOptions
            );
            expect(isEmpty(emptyProvider._group)).toBe(true);
        });
    });

    describe('property getters', () => {
        it('should return concurrency flag from options', () => {
            expect(provider.concurrencyFlag).toBe(true);
            
            // Test default value
            const noConcurrencyProvider = new ServiceMetadataProvider(
                'test-org',
                'test-service',
                mockServiceMetadata,
                mockOrgMetadata,
                mockMpeContract,
                mockGroup,
                {}
            );
            expect(noConcurrencyProvider.concurrencyFlag).toBe(true);
        });

        it('should return mpeContract', () => {
            expect(provider.mpeContract).toBe(mockMpeContract);
        });

        it('should return service metadata', () => {
            expect(provider.serviceMetadata).toEqual({
                orgId: 'test-org',
                serviceId: 'test-service',
                ...mockServiceMetadata
            });
        });

        it('should return organization metadata', () => {
            expect(provider.organizationMetadata).toBe(mockOrgMetadata);
        });

        it('should return enhanced group', () => {
            expect(provider.group).toEqual(provider._group);
        });

        it('should return price per service call', () => {
            const price = provider.pricePerServiceCall;
            expect(price).toBeInstanceOf(BigNumber);
            expect(price.toString()).toBe('1000000');
        });

        it('should throw if no fixed pricing found', () => {
            const noFixedPricingProvider = new ServiceMetadataProvider(
                'test-org',
                'test-service',
                mockServiceMetadata,
                mockOrgMetadata,
                mockMpeContract,
                {
                    ...mockGroup,
                    pricing: [{ price_model: 'other_model' }]
                },
                mockOptions
            );
            expect(() => noFixedPricingProvider.pricePerServiceCall).toThrow();
        });
    });

    describe('getServiceDetails', () => {
        it('should return complete service details', () => {
            const details = provider.getServiceDetails();
            expect(details).toEqual({
                orgId: 'test-org',
                serviceId: 'test-service',
                groupId: 'test-group',
                groupIdInBytes: expect.any(Buffer),
                daemonEndpoint: expect.any(URL)
            });
        });
    });

    describe('getPaymentExpiryThreshold', () => {
        it('should return payment expiration threshold', () => {
            expect(provider.getPaymentExpiryThreshold()).toBe(1000);
        });

        it('should return 0 for empty group', () => {
            const emptyProvider = new ServiceMetadataProvider(
                'test-org',
                'test-service',
                mockServiceMetadata,
                mockOrgMetadata,
                mockMpeContract,
                {},
                mockOptions
            );
            expect(emptyProvider.getPaymentExpiryThreshold()).toBe(0);
        });

        it('should return 0 when threshold is missing', () => {
            const noThresholdProvider = new ServiceMetadataProvider(
                'test-org',
                'test-service',
                mockServiceMetadata,
                mockOrgMetadata,
                mockMpeContract,
                {
                    ...mockGroup,
                    payment: {}
                },
                mockOptions
            );
            expect(noThresholdProvider.getPaymentExpiryThreshold()).toBe(0);
        });
    });

    describe('defaultChannelExpiration', () => {
        it('should calculate expiration block', async () => {
            const expiration = await provider.defaultChannelExpiration(5000);
            expect(expiration).toBe('6000'); // 5000 + 1000
            expect(toBNString).toHaveBeenCalledWith(5000);
        });

        it('should throw on calculation error', async () => {
            toBNString.mockImplementationOnce(() => { throw new Error('conversion error') });
            await expect(provider.defaultChannelExpiration(5000)).rejects.toThrow(
                'getting default channel expiration error:'
            );
        });
    });

    describe('fetchPaymentMetadata', () => {
        const mockStrategy = {
            selectChannel: jest.fn().mockResolvedValue({
                channelId: 123,
                state: {
                    nonce: 5,
                    currentSignedAmount: new BigNumber(1000)
                }
            })
        };

        const mockPaidCallMetadataGenerator = jest.fn().mockResolvedValue({
            signatureBytes: Buffer.from('test-signature')
        });

        beforeEach(() => {
            provider._options.paidCallMetadataGenerator = mockPaidCallMetadataGenerator;
            provider.serviceClient = {
                _options: {
                    paidCallMetadataGenerator: mockPaidCallMetadataGenerator
                }
            };
        });

        it('should generate payment metadata with custom generator', async () => {
            const metadata = await provider.fetchPaymentMetadata(mockStrategy);

            expect(mockStrategy.selectChannel).toHaveBeenCalled();
            expect(logMessage).toHaveBeenCalledWith(
                'debug',
                'ServiceMetadataProvider',
                'Selecting PaymentChannel using the given strategy'
            );
            expect(logMessage).toHaveBeenCalledWith(
                'info',
                'ServiceMetadataProvider',
                'Using PaymentChannel[id: 123] with nonce: 5 and amount: 1001000'
            );
            expect(mockPaidCallMetadataGenerator).toHaveBeenCalledWith(
                123,
                expect.any(BigNumber),
                5
            );
            expect(metadata).toEqual({ meta: 'data' });
        });

        it('should use default metadata generator when no custom one provided', async () => {
            delete provider._options.paidCallMetadataGenerator;
            const metadata = await provider.fetchPaymentMetadata(mockStrategy);
            expect(metadata).toEqual({ meta: 'data' });
        });

        it('should throw on metadata generation error', async () => {
            mockStrategy.selectChannel.mockRejectedValueOnce(new Error('channel error'));
            await expect(provider.fetchPaymentMetadata(mockStrategy)).rejects.toThrow(
                'fetching payment serviceMetadata error:'
            );
        });
    });

    describe('_getServiceEndpoint', () => {
        it('should return custom endpoint from options', () => {
            const endpoint = provider._getServiceEndpoint();
            expect(endpoint.href).toBe('https://test.service.ai/');
        });

        it('should return first endpoint from group when no custom option', () => {
            provider._options = {};
            const endpoint = provider._getServiceEndpoint();
            expect(endpoint.href).toBe('https://default.service.ai/');
            expect(logMessage).toHaveBeenCalledWith(
                'debug',
                'ServiceMetadataProvider',
                'Service endpoint: https://default.service.ai'
            );
        });

        it('should throw when no endpoints available', () => {
            provider._options = {};
            provider._group.endpoints = [];
            expect(() => provider._getServiceEndpoint()).toThrow(
                'Service endpoints is empty'
            );
        });
    });

    describe('enhanceGroupInfo', () => {
        it('should return empty group if input is empty', () => {
            expect(provider.enhanceGroupInfo({})).toEqual({});
        });

        it('should enhance group with additional fields', () => {
            const enhanced = provider.enhanceGroupInfo(mockGroup);
            expect(enhanced).toEqual({
                group_id_in_bytes: expect.any(Buffer),
                ...mockGroup,
                payment_address: mockGroup.payment.payment_address,
                payment_expiration_threshold: mockGroup.payment.payment_expiration_threshold
            });
        });
    });
});