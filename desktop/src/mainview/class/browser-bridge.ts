export class BrowserBridge {
  private static instance: BrowserBridge | undefined;

  static getInstance(): BrowserBridge | undefined {
    return BrowserBridge.instance;
  }
}
