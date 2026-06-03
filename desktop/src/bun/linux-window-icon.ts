import { existsSync } from "fs";
import { join, resolve } from "path";
import { dlopen, FFIType, suffix } from "bun:ffi";

/** Set GTK / _NET_WM_ICON from the bundled appIcon.png (Elementary dock, task switcher). */
export function applyLinuxWindowIcon(windowPtr: unknown): void {
  if (process.platform !== "linux" || !windowPtr) {
    return;
  }

  const iconPath = resolve(process.cwd(), "../Resources/appIcon.png");
  if (!existsSync(iconPath)) {
    console.warn(`[linux-window-icon] Icon not found: ${iconPath}`);
    return;
  }

  const libPath = join(process.cwd(), `libNativeWrapper.${suffix}`);
  try {
    const lib = dlopen(libPath, {
      setWindowIcon: {
        args: [FFIType.ptr, FFIType.cstring],
        returns: FFIType.void,
      },
    });
    lib.symbols.setWindowIcon(windowPtr, Buffer.from(`${iconPath}\0`));
  } catch (error) {
    console.warn("[linux-window-icon] setWindowIcon failed:", error);
  }
}
