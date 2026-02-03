import type { IRGBAdapter, RGBSDK } from '@shared/class/wallets/rgb-wallet';

class RGBAdapter implements IRGBAdapter {
  private sdk: RGBSDK | undefined;

  async initialize(): Promise<RGBSDK> {
    if (this.sdk) {
      return this.sdk;
    }

    this.sdk = await import('rgb-sdk');
    return this.sdk;
  }
}

globalThis.rgbAdapter = new RGBAdapter();
