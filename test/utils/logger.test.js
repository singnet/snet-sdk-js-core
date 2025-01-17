import { debug, info, error } from 'loglevel';
import { logMessage, stringifyWithBigInt } from '../../src/utils/logger';

jest.mock('loglevel', () => ({
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
}));

describe('logMessage', () => {
    it('logs debug messages correctly', () => {
        const level = 'debug';
        const moduleName = 'TestModule';
        const message = 'This is a debug message';

        logMessage(level, moduleName, message);

        expect(debug).toHaveBeenCalledWith(expect.stringContaining(`[DEBUG] [${moduleName}] ${message}`));
    });

    it('logs info messages correctly', () => {
        const level = 'info';
        const moduleName = 'TestModule';
        const message = 'This is an info message';

        logMessage(level, moduleName, message);

        expect(info).toHaveBeenCalledWith(expect.stringContaining(`[INFO] [${moduleName}] ${message}`));
    });

    it('logs error messages correctly', () => {
        const level = 'error';
        const moduleName = 'TestModule';
        const message = 'This is an error message';

        logMessage(level, moduleName, message);

        expect(error).toHaveBeenCalledWith(expect.stringContaining(`[ERROR] [${moduleName}] ${message}`));
    });

    it('defaults to info level for unknown levels', () => {
        const level = 'unknown';
        const moduleName = 'TestModule';
        const message = 'This is a default message';

        logMessage(level, moduleName, message);

        expect(info).toHaveBeenCalledWith(expect.stringContaining(`[INFO] [${moduleName}] ${message}`));
    });
});

describe('stringifyWithBigInt', () => {
    it('converts BigInt values to strings in objects', () => {
        const input = { id: BigInt(123456789), name: 'Test' };
        const result = stringifyWithBigInt(input);

        expect(result).toBe('{\n  "id": "123456789",\n  "name": "Test"\n}');
    });

    it('converts BigInt values to strings in arrays of objects', () => {
        const input = [
            { id: BigInt(123456789), name: 'Test1' },
            { id: BigInt(987654321), name: 'Test2' },
        ];
        const result = stringifyWithBigInt(input);

        expect(result).toBe(
            '{\n  "id": "123456789",\n  "name": "Test1"\n}, {\n  "id": "987654321",\n  "name": "Test2"\n}'
        );
    });

    it('handles objects without BigInt values correctly', () => {
        const input = { id: 123, name: 'Test' };
        const result = stringifyWithBigInt(input);

        expect(result).toBe('{\n  "id": 123,\n  "name": "Test"\n}');
    });
});
