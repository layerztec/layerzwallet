import * as sdk from 'rgb-sdk-rn';

import type { IRGBAdapter, RGBSDK } from '@shared/class/wallets/rgb-wallet';

class RGBAdapter implements IRGBAdapter {
  async initialize(): Promise<RGBSDK> {
    // TODO: remove this typecast when both web and rn are using the same sdk API
    return sdk as unknown as RGBSDK;
  }
}

globalThis.rgbAdapter = new RGBAdapter();
