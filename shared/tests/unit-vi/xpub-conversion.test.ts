import { expect, test } from 'vitest';
import { WatchOnlyWallet } from '../../class/wallets/watch-only-wallet';

const zpub = 'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs';
const ypub = 'ypub6XR9pJPUsVBFKweLeV85HtwdxjjmKEuUr6djm9mNdkh47X7ASsD6byaXFotRAKByFoWgSzCuoTjaYdrv2yoJroLAPtBuHFjVm5vNmhyNehE';
const xpub = 'xpub6CatWdiZiodmUeTDp8LT5or8nmbKNcuyvz7WyksVFkKB4RHwCD3XyuvPEbvqAQY3rAPshWcMLoP2fMFMKHPJ4ZeZXYVUhLv1VMrjPC7PW6V';

test('extended public key prefix conversions', () => {
  const w = new WatchOnlyWallet();
  expect(w._zpubToXpub(zpub)).toBe(xpub);
  expect(w._xpubToZpub(xpub)).toBe(zpub);
  expect(w._xpubToYpub(xpub)).toBe(ypub);
  expect(WatchOnlyWallet._ypubToXpub(ypub)).toBe(xpub);
  expect(() => WatchOnlyWallet._ypubToXpub(zpub)).toThrow('Not a valid ypub extended key!');
});
