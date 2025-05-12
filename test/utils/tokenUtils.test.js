import { 
    cogsToToken, 
    tokenToCogs, 
    formatTokenDecimal, 
    TOKEN_NAMES 
  } from '../../src/utils/tokenUtils';
  
  describe('Token Conversion Utilities', () => {
    describe('cogsToToken', () => {
      test('converts FET cogs to tokens correctly', () => {
        expect(cogsToToken('1000000000000000000', TOKEN_NAMES.FET)).toBe('1.000000000000000000');
        expect(cogsToToken('123456789123456789', TOKEN_NAMES.FET)).toBe('0.123456789123456789');
      });
  
      test('converts AGIX cogs to tokens correctly', () => {
        expect(cogsToToken('100000000', TOKEN_NAMES.AGIX)).toBe('1.00000000');
        expect(cogsToToken('12345678', TOKEN_NAMES.AGIX)).toBe('0.12345678');
      });
  
      test('handles very large numbers', () => {
        const hugeCogs = '1' + '0'.repeat(30);
        expect(cogsToToken(hugeCogs, TOKEN_NAMES.FET)).toBe('10000000000.000000000000000000');
      });
  
      test('handles decimal cogs input (rounds down)', () => {
        expect(cogsToToken('123.456', TOKEN_NAMES.FET)).toBe('0.000000000000000123');
        expect(cogsToToken('123.999', TOKEN_NAMES.AGIX)).toBe('0.00000123');
      });
  
      test('throws on invalid token name', () => {
        expect(() => cogsToToken('100', 'INVALID')).toThrow('Unsupported token');
      });
  
      test('throws on null/undefined inputs', () => {
        expect(() => cogsToToken(null, TOKEN_NAMES.FET)).toThrow('must be a valid number');
        expect(() => cogsToToken(undefined, TOKEN_NAMES.FET)).toThrow('must be a valid number');
        expect(() => cogsToToken('100', null)).toThrow('Unsupported token');
      });
    });
  
    describe('tokenToCogs', () => {
      test('converts FET tokens to cogs correctly', () => {
        expect(tokenToCogs('1', TOKEN_NAMES.FET)).toBe('1000000000000000000');
        expect(tokenToCogs('0.123456789123456789', TOKEN_NAMES.FET)).toBe('123456789123456789');
      });
  
      test('converts AGIX tokens to cogs correctly', () => {
        expect(tokenToCogs('1', TOKEN_NAMES.AGIX)).toBe('100000000');
        expect(tokenToCogs('0.12345678', TOKEN_NAMES.AGIX)).toBe('12345678');
      });
  
      test('handles very large token amounts', () => {
        const hugeTokens = '1' + '0'.repeat(10);
        expect(tokenToCogs(hugeTokens, TOKEN_NAMES.FET)).toBe('10000000000000000000000000000');
      });
  
      test('rounds down fractional cogs', () => {
        expect(tokenToCogs('0.1234567891234567899', TOKEN_NAMES.FET)).toBe('123456789123456789');
        expect(tokenToCogs('0.000000001', TOKEN_NAMES.AGIX)).toBe('0');
      });
  
      test('throws on invalid inputs', () => {
        expect(() => tokenToCogs('not-a-number', TOKEN_NAMES.FET)).toThrow('must be a valid number');
        expect(() => tokenToCogs('1', 'INVALID')).toThrow('Unsupported token');
      });
    });
  
    describe('formatTokenDecimal', () => {
      test('formats FET tokens correctly', () => {
        expect(formatTokenDecimal('1.234567891234567891', TOKEN_NAMES.FET)).toBe('1.234567891234567891');
        expect(formatTokenDecimal('0.000000000000000001', TOKEN_NAMES.FET)).toBe('0.000000000000000001');
      });
  
      test('formats AGIX tokens correctly', () => {
        expect(formatTokenDecimal('1.23456789', TOKEN_NAMES.AGIX)).toBe('1.23456789');
        expect(formatTokenDecimal('0.00000001', TOKEN_NAMES.AGIX)).toBe('0.00000001');
      });
  
      test('rounds down to token decimals', () => {
        expect(formatTokenDecimal('1.234567891234567891', TOKEN_NAMES.AGIX)).toBe('1.23456789');
        expect(formatTokenDecimal('0.999999999', TOKEN_NAMES.AGIX)).toBe('0.99999999');
      });
  
      test('handles very large numbers', () => {
        const hugeNumber = '1' + '0'.repeat(10) + '.123456789123456789';
        expect(formatTokenDecimal(hugeNumber, TOKEN_NAMES.FET)).toBe('10000000000.123456789123456789');
      });
  
      test('throws on invalid inputs', () => {
        expect(() => formatTokenDecimal(null, TOKEN_NAMES.FET)).toThrow('must be a valid number');
        expect(() => formatTokenDecimal('invalid', TOKEN_NAMES.AGIX)).toThrow('must be a valid number');
      });
    });
  });