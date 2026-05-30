let adaptersLoaded = false;

export async function ensureWalletAdapters(): Promise<void> {
  if (adaptersLoaded) {
    return;
  }
  adaptersLoaded = true;
  await import("./breeze-adapter");
  await import("./spark-adapter");
}
