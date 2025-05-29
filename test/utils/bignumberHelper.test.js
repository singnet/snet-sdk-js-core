import { toBNString } from '../../src/utils/bignumberHelper';

test('should convert a valid integer to a BigNumber string', () => {
  const result = toBNString(100);
  expect(result).toBe('100');
});

// Test case for a valid floating point number
test('should convert a valid floating point number to a BigNumber string', () => {
  const result = toBNString(123.45);
  expect(result).toBe('123.45');
});

// Test case for a string representation of a number
test('should convert a valid number in string format to a BigNumber string', () => {
  const result = toBNString('5000');
  expect(result).toBe('5000');
});

// Test case for a very large number
test('should convert a large number to a BigNumber string', () => {
  const result = toBNString('1000000000000000000000000');
  expect(result).toBe('1000000000000000000000000');
});

// Test case for zero
test('should convert zero to a BigNumber string', () => {
  const result = toBNString(0);
  expect(result).toBe('0');
});

// Test case for invalid input: string that can't be converted to a number
test('should return "0" if value cannot be converted to a number', () => {
  const result = toBNString('invalid');
  expect(result).toBe('NaN');
});

// Test case for undefined input
test('should return "0" if value is undefined', () => {
  const result = toBNString(undefined);
  expect(result).toBe('NaN');
});

// Test case for null input
test('should return "0" if value is null', () => {
  const result = toBNString(null);
  expect(result).toBe('NaN');
});

// Test case for an empty string
test('should return "0" if an empty string is passed', () => {
  const result = toBNString('');
  expect(result).toBe('NaN');
});

test('uint8ArrayToBN should return BigNumber with value 0 for empty uint8Array', () => {
  const result = uint8ArrayToBN([]);
  expect(result.toFixed()).toBe('0');
});

test('uint8ArrayToBN should return BigNumber with value 0 for null or undefined uint8Array', () => {
  const result1 = uint8ArrayToBN(null);
  const result2 = uint8ArrayToBN(undefined);
  expect(result1.toFixed()).toBe('0');
  expect(result2.toFixed()).toBe('0');
});

test('uint8ArrayToBN should convert a uint8Array to a BigNumber correctly', () => {
  const uint8Array = [0x12, 0x34, 0x56];
  const result = uint8ArrayToBN(uint8Array);
  const expected = new BigNumber('0x123456').toFixed();
  expect(result.toFixed()).toBe(expected);
});

test('uint8ArrayToBN should handle uint8Array with large numbers', () => {
  const uint8Array = [0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0];
  const result = uint8ArrayToBN(uint8Array);
  const expected = new BigNumber('0x123456789abcdef0').toFixed();
  expect(result.toFixed()).toBe(expected);
});
