const emptyBuffer = Buffer.alloc(0);

export const hexStringToBytes = (hex) => {
    let strippedHex = hex;
    if (strippedHex.substring(0, 2).toLowerCase() === '0x') {
        strippedHex = strippedHex.substring(2, strippedHex.length);
    }
    if (!strippedHex) {
        return emptyBuffer;
    }
    const regex = /^[0-9A-Fa-f]+$/g;
    if (!strippedHex.match(regex)) {
        throw new Error('invalid hex string');
    }
    const bytes = Buffer.from(strippedHex, 'hex');
    return Buffer.from(bytes);
}

export const utfStringToBytes = (string) => {
    if (!string) {
        return emptyBuffer;
    }
    const bytes = Buffer.from(string, 'UTF-8');
    return Buffer.from(bytes);
}
