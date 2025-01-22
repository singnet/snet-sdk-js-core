import { toBNString, uint8ArrayToBN } from '../../src/utils/bignumber_helper';
import BigNumber from 'bignumber.js';

test('toBNString should return BigNumber string for valid number values', () => {
  const result = toBNString(10);
  expect(result).toBe('10');
});

test('toBNString should return "0" for undefined value', () => {
  const result = toBNString(undefined);
  expect(result).toBe('0');
});

test('toBNString should return "0" for null value', () => {
  const result = toBNString(null);
  expect(result).toBe('0');
});

test('toBNString should return "0" for empty string', () => {
  const result = toBNString('');
  expect(result).toBe('0');
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
