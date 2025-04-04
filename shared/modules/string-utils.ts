import BigNumber from 'bignumber.js';
import { StringNumber } from '../types/string-number';
import { ICsprng } from '../types/ICsprng';
import { uint8ArrayToHex } from '../modules/uint8array-extras';

export function capitalizeFirstLetter(input: string): string {
  return input.replace(/^./, (match) => match.toUpperCase());
}

export function hexStr(data: any): string | undefined {
  if (data === undefined) {
    return undefined;
  }
  if (typeof data === 'string' && data.startsWith('0x')) {
    return data;
  }

  if (data < 0) {
    return '-0x' + Math.abs(data).toString(16);
  }

  return '0x' + data.toString(16);
}

export function hexToDec(data: any): number {
  let negative = false;
  if ((data + '').startsWith('-')) {
    data = data.replace('-', '');
    negative = true;
  }

  if (typeof data === 'string' && data.startsWith('0x')) {
    data = new BigNumber(data).toNumber();
  }

  if (typeof data === 'string' && !data.startsWith('0x')) {
    data = new BigNumber('0x' + data).toNumber();
  }

  return negative ? data * -1 : data;
}

export async function generateUUID(csprng: ICsprng): Promise<string> {
  // Generate 16 random bytes using csprng
  const bytes = await csprng.randomBytes(16);

  // Format bytes into UUID string
  return [
    uint8ArrayToHex(bytes.slice(0, 4)),
    uint8ArrayToHex(bytes.slice(4, 6)),
    // Version 4 UUID - set bits according to RFC 4122
    ((bytes[6] & 0x0f) | 0x40).toString(16) + uint8ArrayToHex(bytes.slice(7, 8)),
    ((bytes[8] & 0x3f) | 0x80).toString(16) + uint8ArrayToHex(bytes.slice(9, 10)),
    uint8ArrayToHex(bytes.slice(10, 16)),
  ].join('-');
}

export function formatBalance(balance: StringNumber, decimals: number, decimalPlaces = 7): string {
  return new BigNumber(balance)
    .dividedBy(new BigNumber(10).pow(decimals))
    .toFixed(decimalPlaces)
    .replace(/\.?0+$/, '');
}
