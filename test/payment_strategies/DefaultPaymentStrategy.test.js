import {DefaultPaymentStrategy} from "../../src/payment_strategies";
import FreeCallPaymentStrategy from '../../src/payment_strategies/FreeCallPaymentStrategy';
import PaidCallPaymentStrategy from '../../src/payment_strategies/PaidCallPaymentStrategy';
import PrepaidPaymentStrategy from "../../src/payment_strategies/PrepaidPaymentStrategy";

jest.mock('../../src/payment_strategies/FreeCallPaymentStrategy');
jest.mock('../../src/payment_strategies/PrepaidPaymentStrategy');
jest.mock('../../src/payment_strategies/PaidCallPaymentStrategy');

describe('DefaultPaymentStrategy', () => {
    let account;
    let serviceMetadata;

    beforeEach(() => {
        account = {};
        serviceMetadata = {
            concurrencyFlag: false,
        };
    });

    describe('getPaymentMetadata', () => {
        test('should return metadata from FreeCallPaymentStrategy if free calls are available', async () => {

            const mockFreeCallPaymentStrategy = {
                isFreeCallAvailable: jest.fn().mockResolvedValue(true),
                getPaymentMetadata: jest.fn().mockResolvedValue(['free-call-metadata']),
            };
            FreeCallPaymentStrategy.mockImplementation(() => mockFreeCallPaymentStrategy);

            const paymentStrategy = new DefaultPaymentStrategy(account);
            const result = await paymentStrategy.getPaymentMetadata(serviceMetadata);

            expect(mockFreeCallPaymentStrategy.isFreeCallAvailable).toHaveBeenCalled();
            expect(mockFreeCallPaymentStrategy.getPaymentMetadata).toHaveBeenCalled();
            expect(result).toEqual(['free-call-metadata']);
        });

        test('should return metadata from PrepaidPaymentStrategy if concurrencyFlag is set', async () => {
            // Устанавливаем isFreeCallAvailable в false для теста, чтобы избежать использования FreeCallPaymentStrategy
            const mockFreeCallPaymentStrategy = {
                isFreeCallAvailable: jest.fn().mockResolvedValue(false), // Бесплатные звонки недоступны
            };
            FreeCallPaymentStrategy.mockImplementation(() => mockFreeCallPaymentStrategy);

            // Подготавливаем мок для PrepaidPaymentStrategy
            const mockPrepaidPaymentStrategy = {
                getPaymentMetadata: jest.fn().mockResolvedValue([
                    { 'snet-payment-type': 'credit' },
                ]),
            };
            PrepaidPaymentStrategy.mockImplementation(() => mockPrepaidPaymentStrategy);

            // Устанавливаем serviceMetadata.concurrencyFlag в true для выбора PrepaidPaymentStrategy
            serviceMetadata.concurrencyFlag = true;

            const paymentStrategy = new DefaultPaymentStrategy(account);
            const result = await paymentStrategy.getPaymentMetadata(serviceMetadata);

            // Проверяем, что метод getPaymentMetadata у PrepaidPaymentStrategy был вызван
            expect(mockPrepaidPaymentStrategy.getPaymentMetadata).toHaveBeenCalled();
            expect(result).toEqual([
                { 'snet-payment-type': 'credit' },
            ]);
        });

        test('should return metadata from PaidCallPaymentStrategy if free calls are not available and concurrencyFlag is not set', async () => {
            // Устанавливаем isFreeCallAvailable в false для теста
            const mockFreeCallPaymentStrategy = {
                isFreeCallAvailable: jest.fn().mockResolvedValue(false), // Бесплатные звонки недоступны
            };
            FreeCallPaymentStrategy.mockImplementation(() => mockFreeCallPaymentStrategy);

            // Подготавливаем мок для PaidCallPaymentStrategy
            const mockPaidCallPaymentStrategy = {
                getPaymentMetadata: jest.fn().mockResolvedValue([
                    { 'snet-payment-type': 'credit' },
                ]),
            };
            PaidCallPaymentStrategy.mockImplementation(() => mockPaidCallPaymentStrategy);

            // Сервис метаданных без флага конкуренции
            serviceMetadata.concurrencyFlag = false;

            const paymentStrategy = new DefaultPaymentStrategy(account);
            const result = await paymentStrategy.getPaymentMetadata(serviceMetadata);

            // Проверяем, что метод getPaymentMetadata у PaidCallPaymentStrategy был вызван
            expect(mockPaidCallPaymentStrategy.getPaymentMetadata).toHaveBeenCalled();
            expect(result).toEqual([
                { 'snet-payment-type': 'credit' },
            ]);
        });
    });

    describe('getConcurrencyTokenAndChannelId', () => {
        test('should return channelId and concurrencyToken from PrepaidPaymentStrategy', async () => {
            const mockPrepaidPaymentStrategy = {
                _selectChannel: jest.fn().mockResolvedValue({ channelId: '123' }),
                getConcurrencyToken: jest.fn().mockResolvedValue('token123'),
            };
            PrepaidPaymentStrategy.mockImplementation(() => mockPrepaidPaymentStrategy);

            const paymentStrategy = new DefaultPaymentStrategy(account);
            const result = await paymentStrategy.getConcurrencyTokenAndChannelId(serviceMetadata);

            expect(mockPrepaidPaymentStrategy._selectChannel).toHaveBeenCalled();
            expect(mockPrepaidPaymentStrategy.getConcurrencyToken).toHaveBeenCalled();
            expect(result).toEqual({ channelId: '123', concurrencyToken: 'token123' });
        });
    });
});
