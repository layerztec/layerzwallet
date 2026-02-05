import type { IRGBAdapter, RGBSDK } from '@shared/class/wallets/rgb-wallet';

class RGBAdapter implements IRGBAdapter {
  private sdk: RGBSDK | undefined;
  private _dataDir: string = 'rgb-data';

  async initialize(): Promise<RGBSDK> {
    if (this.sdk) {
      return this.sdk;
    }

    this.sdk = await import('@utexo/rgb-sdk');
    return this.sdk;
  }

  getDataDir(): string {
    return this._dataDir;
  }
}

globalThis.rgbAdapter = new RGBAdapter();
