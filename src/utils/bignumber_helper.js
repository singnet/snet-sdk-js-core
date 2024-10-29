import { BigNumber } from 'bignumber.js';

export function toBNString(value) {
  if(value !== 0 && !Number(value)) {
    throw new TypeError("value can't be converted to number");
  }

  return new BigNumber(value).toFixed();
}
