import { BigNumber } from 'bignumber.js';
import { isEmpty } from 'lodash';

export function toBNString(value) {
    if (value !== 0 && !Number(value)) {
        // throw new TypeError("value can't be converted to number");
        new BigNumber(0);
    }

    return new BigNumber(value).toFixed();
}

export function uint8ArrayToBN(uint8Array) {
    if (isEmpty(uint8Array)) {
        return new BigNumber(0);
    }

    const buffer = Buffer.from(uint8Array);
    const hex = `0x${buffer.toString('hex')}`;
    return new BigNumber(hex);
}
