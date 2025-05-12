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
test('should throw a TypeError if value cannot be converted to a number', () => {
  expect(() => toBNString('invalid')).toThrow(
    TypeError,
    "value can't be converted to number",
  );
});

// Test case for undefined input
test('should throw a TypeError if value is undefined', () => {
  expect(() => toBNString(undefined)).toThrow(
    TypeError,
    "value can't be converted to number",
  );
});

// Test case for null input
test('should throw a TypeError if value is null', () => {
  expect(() => toBNString(null)).toThrow(
    TypeError,
    "value can't be converted to number",
  );
});

// Test case for an empty string
test('should throw a TypeError if an empty string is passed', () => {
  expect(() => toBNString('')).toThrow(
    TypeError,
    "value can't be converted to number",
  );
});
