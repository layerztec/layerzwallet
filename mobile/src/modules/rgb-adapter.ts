import * as sdk from '@utexo/rgb-sdk-rn';
import { Paths } from 'expo-file-system';

import type { IRGBAdapter, RGBSDK } from '@shared/class/wallets/rgb-wallet';

class RGBAdapter implements IRGBAdapter {
  private _dataDir: string | undefined;

  async initialize(): Promise<RGBSDK> {
    return sdk as unknown as RGBSDK;
    // return sdk as unknown as RGBSDK;
  }

  getDataDir(): string {
    if (!this._dataDir) {
      this._dataDir = `${Paths.document.uri}rgb-data`;
    }
    return this._dataDir;
  }
}

globalThis.rgbAdapter = new RGBAdapter();
