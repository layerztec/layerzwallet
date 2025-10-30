import { useCallback } from 'react';
import * as FileSystem from 'expo-file-system';
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
const MAX_TOTAL_SIZE = MAX_SCREENSHOTS_CACHE * 500 * 1024;
const SCREENSHOT_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000;

const getScreenshotDir = (): string | null => {
  const base = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory;
  if (!base || !base.startsWith('file://')) return null;
  return `${base.endsWith('/') ? base : base + '/'}browser_screens/`;
};

const isValidFileUri = (uri: string): boolean => uri?.startsWith('file://');

export const useWebViewPreviewManager = (onError?: (reason: string) => void) => {
  const loadManifest = useCallback(async (): Promise<ScreenshotManifest> => {
    try {
      const manifestJson = await AsyncStorage.getItem(SCREENSHOT_MANIFEST_KEY);
      return manifestJson ? JSON.parse(manifestJson) : {};
    } catch {
      return {};
    }
  }, []);

  const saveManifest = useCallback(async (manifest: ScreenshotManifest) => {
    try {
      await AsyncStorage.setItem(SCREENSHOT_MANIFEST_KEY, JSON.stringify(manifest));
    } catch {}
  }, []);

  const ensureDirectory = useCallback(async () => {
    try {
      const dir = getScreenshotDir();
      if (!dir) return;
      const directory = new FileSystem.Directory(dir);
      if (!directory.exists) await directory.create();
    } catch {}
  }, []);

  const deleteFile = async (key: string) => {
    try {
      await new FileSystem.File(key).delete();
    } catch {}
  };

  const pruneCache = useCallback(async (manifest: ScreenshotManifest, newSize: number = 0): Promise<ScreenshotManifest> => {
    const now = Date.now();
    const entries = Object.entries(manifest);
    const pruned: ScreenshotManifest = {};
    let totalSize = 0;

    // Remove expired entries
    const validEntries = entries.filter(([, entry]) => {
      const isExpired = now - entry.timestamp > SCREENSHOT_EXPIRE_MS;
      if (isExpired) {
        deleteFile(entry.key);
        return false;
      }
      totalSize += entry.size;
      return true;
    });

    // Check if pruning is needed
    if (validEntries.length < MAX_SCREENSHOTS_CACHE && totalSize + newSize <= MAX_TOTAL_SIZE) {
      return Object.fromEntries(validEntries);
    }

    // Remove LRU entries
    validEntries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

    for (const [id, entry] of validEntries) {
      if (Object.keys(pruned).length >= MAX_SCREENSHOTS_CACHE || totalSize + newSize > MAX_TOTAL_SIZE) {
        deleteFile(entry.key);
        totalSize -= entry.size;
      } else {
        pruned[id] = entry;
      }
    }

    return pruned;
  }, []);

  const save = useCallback(
    async (tabId: string, screenshotData: string): Promise<string | null> => {
      try {
        let manifest = await loadManifest();
        await ensureDirectory();

        // Delete previous screenshot
        if (manifest[tabId]?.key) await deleteFile(manifest[tabId].key);

        const base64 = screenshotData.startsWith('data:') ? screenshotData.split(',')[1] || '' : screenshotData;
        const dir = getScreenshotDir();
        if (!dir) return null;

        const fileUri = `${dir}tab_${tabId}_${Date.now()}.png`;
        if (!isValidFileUri(fileUri)) return null;

        const estimatedSize = Math.floor(base64.length * 0.75);

        // Prune cache before saving
        manifest = await pruneCache(manifest, estimatedSize);

        // Write file
        await new FileSystem.File(fileUri).write(base64, { encoding: 'base64' });

        // Update manifest
        const now = Date.now();
        manifest[tabId] = { key: fileUri, size: estimatedSize, timestamp: now, lastAccessed: now };
        await saveManifest(manifest);

        return fileUri;
      } catch {
        onError?.('saveScreenshot error');
        return null;
      }
    },
    [loadManifest, saveManifest, ensureDirectory, pruneCache, onError]
  );

  const load = useCallback(
    async (tabId: string): Promise<string | null> => {
      try {
        const manifest = await loadManifest();
        const entry = manifest[tabId];

        if (!entry || !isValidFileUri(entry.key)) return null;

        const now = Date.now();
        const isExpired = now - entry.timestamp > SCREENSHOT_EXPIRE_MS;
        const file = new FileSystem.File(entry.key);

        if (isExpired || !file.exists) {
          await deleteFile(entry.key);
          delete manifest[tabId];
          await saveManifest(manifest);
          return null;
        }

        // Update last accessed time (don't await to avoid blocking)
        entry.lastAccessed = now;
        saveManifest(manifest);

        return entry.key;
      } catch {
        return null;
      }
    },
    [loadManifest, saveManifest]
  );

  const remove = useCallback(
    async (tabId: string) => {
      try {
        const manifest = await loadManifest();
        const entry = manifest[tabId];
        if (entry?.key) {
          await deleteFile(entry.key);
          delete manifest[tabId];
          await saveManifest(manifest);
        }
      } catch {}
    },
    [loadManifest, saveManifest]
  );

  const capture = useCallback(
    async (containerRef: React.RefObject<any>, tabId: string): Promise<string | null> => {
      if (!containerRef?.current) return null;

      try {
        const base64 = await captureRef(containerRef.current, {
          format: 'png',
          quality: 0.6,
          result: 'base64',
          width: 360,
        });
        const dataUrl = `data:image/png;base64,${base64}`;
        return (await save(tabId, dataUrl)) || dataUrl;
      } catch {
        return null;
      }
    },
    [save]
  );

  return { save, load, remove, capture, ensureDirectory };
};
