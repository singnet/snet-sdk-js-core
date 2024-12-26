import EncodingUtils from '../../src/utils/encodingUtils';

const encodingUtils = new EncodingUtils();
test('should convert a valid hex string to a byte buffer', () => {
  const hex = '0x48656c6c6f'; // Hex for 'Hello'
  const result = encodingUtils.hexStringToBytes(hex);
  expect(result.toString('utf-8')).toBe('Hello');
});

test('should convert a hex string wtesthout "0x" prefix to a byte buffer', () => {
  const hex = '48656c6c6f'; // Hex for 'Hello' wtesthout '0x' prefix
  const result = encodingUtils.hexStringToBytes(hex);
  expect(result.toString('utf-8')).toBe('Hello');
});

test('should handle an empty hex string and return an empty buffer', () => {
  const hex = '';
  const result = encodingUtils.hexStringToBytes(hex);
  expect(result.length).toBe(0);
});

test('should throw an error for an invalid hex string', () => {
  const invalidHex = '0x123xyz';
  expect(() => encodingUtils.hexStringToBytes(invalidHex)).toThrow(Error);
});

test('should convert a UTF-8 string to a byte buffer', () => {
  const string = 'Hello';
  const result = encodingUtils.utfStringToBytes(string);
  expect(result.toString('utf-8')).toBe('Hello');
});

test('should handle an empty UTF-8 string and return an empty buffer', () => {
  const string = '';
  const result = encodingUtils.utfStringToBytes(string);
  expect(result.length).toBe(0);
});

test('should convert a string wtesth special characters to bytes', () => {
  const string = 'こんにちは'; // Japanese greeting "Hello"
  const result = encodingUtils.utfStringToBytes(string);
  expect(result.toString('utf-8')).toBe('こんにちは');
});
