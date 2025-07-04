import { router } from 'expo-router';
import WebView, { WebViewMessageEvent } from 'react-native-webview';

import { LayerzStorage } from '@/src/class/layerz-storage';
import { BackgroundExecutor } from '@/src/modules/background-executor';
import { Messenger } from '@/src/modules/messenger';
import { processRPC } from '@shared/modules/rpc-controller';
import { Eip1193CustomEventRequest } from '@shared/types/eip1193-custom-event';

/**
 * BrowserBridge class serves as a bridge between the WebView and the native layer.
 * It handles sending messages to the WebView and processing messages from it.
 */
export class BrowserBridge {
  private webview: WebView;

  // Static instance for global access
  static instance: BrowserBridge | null = null;

  constructor(webview: WebView) {
    this.webview = webview;
    BrowserBridge.instance = this;
  }

  sendMessage = (message: any) => {
    console.info('>>> bridge:', message);
    const messageJson = JSON.stringify(message);
    this.webview.injectJavaScript(`
      document.dispatchEvent(
        new CustomEvent('LayerzWalletExtension', {
          detail: JSON.stringify(${messageJson}),
        })
      );
      true;  // Required for iOS
    `);
  };

  handleMessage = async (event: WebViewMessageEvent) => {
    const args = JSON.parse(event.nativeEvent.data) as Eip1193CustomEventRequest;

    if (args.for !== 'contentScript') {
      // Ignore messages intended for the webpage
      return;
    }

    console.info('<<< bridge:', args);

    await processRPC(LayerzStorage, BackgroundExecutor, args.method, args.params, args.id, args.from, Messenger);
  };

  openActionScreen = (method: string, params: any[], from: string, id: string | number) => {
    const params2 = JSON.stringify(params);
    router.push(`/Action?method=${method}&params=${params2}&from=${from}&id=${id}`);
  };

  refresh = () => {
    this.webview.reload();
  };

  // Static method to get the current instance
  static getInstance(): BrowserBridge | null {
    return BrowserBridge.instance;
  }
}
