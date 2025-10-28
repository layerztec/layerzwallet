import { useCallback, useRef } from 'react';
import * as FileSystem from 'expo-file-system';
import { File as ExpoFsFile, Directory } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureRef } from 'react-native-view-shot';

interface ScreenshotManifestEntry {
  key: string;
  size: number;
  timestamp: number;
  lastAccessed: number;
}

type ScreenshotManifest = { [tabId: string]: ScreenshotManifestEntry };

const SCREENSHOT_MANIFEST_KEY = '@browser_screenshot_manifest';
const MAX_SCREENSHOTS_CACHE = 20;
const SCREENSHOT_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000;

const getScreenshotDir = (): string | null => {
  try {
    const cacheDir = (FileSystem as any).cacheDirectory;
    const docDir = (FileSystem as any).documentDirectory;

    const base = cacheDir || docDir;

    if (!base || typeof base !== 'string') {
      return null;
    }

    if (!base.startsWith('file://')) {
      return null;
    }

    const dir = `${base.endsWith('/') ? base : base + '/'}browser_screens/`;
    return dir;
  } catch (error) {
    console.error('[WebViewPreviewManager] Error getting screenshot directory', error);
    return null;
  }
};

const isValidFileUri = (uri: string): boolean => {
  return typeof uri === 'string' && uri.length > 0 && uri.startsWith('file://');
};

export const useWebViewPreviewManager = (onError?: (reason: string) => void) => {
  const loadManifest = useCallback(async (): Promise<ScreenshotManifest> => {
    try {
      const manifestJson = await AsyncStorage.getItem(SCREENSHOT_MANIFEST_KEY);
      if (!manifestJson) return {};
      return JSON.parse(manifestJson);
    } catch (error) {
      console.error('[WebViewPreviewManager] Failed to load manifest:', error);
      onError?.('loadManifest error');
      return {};
    }
  }, [onError]);

  const saveManifest = useCallback(
    async (manifest: ScreenshotManifest) => {
      try {
        await AsyncStorage.setItem(SCREENSHOT_MANIFEST_KEY, JSON.stringify(manifest));
      } catch (error) {
        console.error('[WebViewPreviewManager] Failed to save manifest:', error);
        onError?.('saveManifest error');
      }
    },
    [onError]
  );

  const ensureDirectory = useCallback(async () => {
    try {
      const dir = getScreenshotDir();
      if (!dir) {
        return;
      }
      const directory = new Directory(dir);
      if (!directory.exists) {
        await directory.create();
        console.debug('[WebViewPreviewManager] Created directory', { dir });
      }
    } catch (e) {
      console.error('[WebViewPreviewManager] Failed to ensure directory:', e);
    }
  }, []);

  const pruneExpired = useCallback(async (manifest: ScreenshotManifest): Promise<ScreenshotManifest> => {
    const now = Date.now();
    const entries = Object.entries(manifest);
    const pruned: ScreenshotManifest = {};

    for (const [id, entry] of entries) {
      const isExpired = now - entry.timestamp > SCREENSHOT_EXPIRE_MS;
      if (isExpired) {
        console.debug('[WebViewPreviewManager] Pruning expired screenshot', { tabId: id });
        try {
          const file = new ExpoFsFile(entry.key);
          await file.delete();
        } catch {}
      } else {
        pruned[id] = entry;
      }
    }

    return pruned;
  }, []);

  const pruneLRU = useCallback(async (manifest: ScreenshotManifest, maxSize: number): Promise<ScreenshotManifest> => {
    const entries = Object.entries(manifest);
    let totalSize = entries.reduce((acc, [, entry]) => acc + entry.size, 0);
    const MAX_TOTAL_SIZE = MAX_SCREENSHOTS_CACHE * 500 * 1024;

    if (entries.length < MAX_SCREENSHOTS_CACHE && totalSize <= MAX_TOTAL_SIZE) {
      return manifest;
    }

    entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

    const pruned: ScreenshotManifest = {};
    const toDelete: string[] = [];

    for (const [id, entry] of entries) {
      if (entries.length - toDelete.length > MAX_SCREENSHOTS_CACHE || totalSize + maxSize > MAX_TOTAL_SIZE) {
        console.debug('[WebViewPreviewManager] Pruning LRU screenshot', { tabId: id });
        toDelete.push(entry.key);
        totalSize -= entry.size;
      } else {
        pruned[id] = entry;
      }
    }

    for (const key of toDelete) {
      try {
        const file = new ExpoFsFile(key);
        await file.delete();
      } catch {}
    }

    return pruned;
  }, []);

  const save = useCallback(
    async (tabId: string, screenshotData: string): Promise<string | null> => {
      try {
        let manifest = await loadManifest();
        await ensureDirectory();

        const previous = manifest[tabId];
        if (previous?.key) {
          try {
            const file = new ExpoFsFile(previous.key);
            await file.delete();
          } catch {}
        }

        const base64 = screenshotData.startsWith('data:') ? screenshotData.split(',')[1] || '' : screenshotData;
        const dir = getScreenshotDir();
        if (!dir) {
          return null;
        }

        const filename = `tab_${tabId}_${Date.now()}.png`;
        const fileUri = dir + filename;

        if (!isValidFileUri(fileUri)) {
          return null;
        }

        const estimatedSize = Math.floor(base64.length * 0.75);

        manifest = await pruneExpired(manifest);
        manifest = await pruneLRU(manifest, estimatedSize);

        const screenshotFile = new ExpoFsFile(fileUri);
        await screenshotFile.write(base64, { encoding: 'base64' as const });

        const now = Date.now();
        manifest[tabId] = {
          key: fileUri,
          size: estimatedSize,
          timestamp: now,
          lastAccessed: now,
        };

        await saveManifest(manifest);

        console.debug('[WebViewPreviewManager] Screenshot saved', {
          tabId,
          size: estimatedSize,
          cacheCount: Object.keys(manifest).length,
        });

        return fileUri;
      } catch (error: any) {
        console.error('[WebViewPreviewManager] Failed to save screenshot:', error);
        onError?.('saveScreenshot error');
        return null;
      }
    },
    [loadManifest, saveManifest, ensureDirectory, pruneExpired, pruneLRU, onError]
  );

  const load = useCallback(
    async (tabId: string): Promise<string | null> => {
      try {
        const manifest = await loadManifest();
        const entry = manifest[tabId];

        if (!entry) {
          return null;
        }

        if (!isValidFileUri(entry.key)) {
          delete manifest[tabId];
          await saveManifest(manifest);
          return null;
        }

        const now = Date.now();
        if (now - entry.timestamp > SCREENSHOT_EXPIRE_MS) {
          console.debug('[WebViewPreviewManager] Screenshot expired', { tabId });
          try {
            const file = new ExpoFsFile(entry.key);
            await file.delete();
          } catch {}
          delete manifest[tabId];
          await saveManifest(manifest);
          return null;
        }

        const file = new ExpoFsFile(entry.key);
        if (!file.exists) {
          console.debug('[WebViewPreviewManager] Screenshot file missing', { tabId });
          delete manifest[tabId];
          await saveManifest(manifest);
          return null;
        }

        entry.lastAccessed = now;
        manifest[tabId] = entry;
        await saveManifest(manifest);

        return entry.key;
      } catch (error) {
        console.error('[WebViewPreviewManager] Failed to load screenshot:', error);
        onError?.('loadScreenshot error');
        return null;
      }
    },
    [loadManifest, saveManifest, onError]
  );

  const remove = useCallback(
    async (tabId: string) => {
      try {
        const manifest = await loadManifest();
        const entry = manifest[tabId];

        if (entry) {
          if (isValidFileUri(entry.key)) {
            try {
              const file = new ExpoFsFile(entry.key);
              await file.delete();
            } catch (deleteError) {}
          }

          delete manifest[tabId];
          await saveManifest(manifest);
        }
      } catch (error) {
        console.error('[WebViewPreviewManager] Failed to delete screenshot:', error);
        onError?.('deleteScreenshot error');
      }
    },
    [loadManifest, saveManifest, onError]
  );

  const capture = useCallback(
    async (containerRef: React.RefObject<any>, tabId: string): Promise<string | null> => {
      if (!containerRef?.current) {
        console.debug('[WebViewPreviewManager] Capture skipped - no container', { tabId });
        return null;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      try {
        const base64 = await captureRef(containerRef.current, {
          format: 'png',
          quality: 0.6,
          result: 'base64',
          width: 360,
        });
        const dataUrl = `data:image/png;base64,${base64}`;

        const fileUri = await save(tabId, dataUrl);
        return fileUri || dataUrl;
      } catch (error: any) {
        if (error?.code !== 'EUNSPECIFIED') {
        }
        return null;
      }
    },
    [save]
  );

  return {
    save,
    load,
    remove,
    capture,
    ensureDirectory,
  };
};
