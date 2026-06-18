/**
 * Post-build: install Freedesktop icon theme entries and fix the .desktop file.
 * Electrobun copies appIcon.png but references Icon=appIcon.png, which desktop
 * environments (e.g. Elementary) do not resolve — they expect a themed icon name.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ICON_SIZES = [16, 32, 48, 64, 128, 256, 512] as const;
const DISPLAY_NAME = 'Layerz Wallet';

const buildDir = process.env.ELECTROBUN_BUILD_DIR;
const bundleName = process.env.ELECTROBUN_APP_NAME;
const identifier = process.env.ELECTROBUN_APP_IDENTIFIER;
const targetOs = process.env.ELECTROBUN_OS;

if (targetOs !== 'linux' || !buildDir || !bundleName || !identifier) {
  process.exit(0);
}

const bundleRoot = join(buildDir, bundleName);
const iconSrc = join(bundleRoot, 'Resources', 'appIcon.png');

if (!existsSync(iconSrc)) {
  console.error(`[setup-linux-icons] Missing bundle icon: ${iconSrc}`);
  process.exit(1);
}

for (const size of ICON_SIZES) {
  const destDir = join(bundleRoot, 'share', 'icons', 'hicolor', `${size}x${size}`, 'apps');
  mkdirSync(destDir, { recursive: true });
  copyFileSync(iconSrc, join(destDir, `${identifier}.png`));
}

const desktopBasename = process.env.ELECTROBUN_APP_NAME?.replace(/-canary$/, '').replace(/-dev$/, '') ?? 'layerzwallet';
const desktopPath = join(bundleRoot, `${desktopBasename}.desktop`);

if (!existsSync(desktopPath)) {
  console.warn(`[setup-linux-icons] No desktop file at ${desktopPath}`);
  process.exit(0);
}

const bundleBin = join(bundleRoot, 'bin', 'launcher');
const iconThemeName = identifier;

let desktop = readFileSync(desktopPath, 'utf8');
desktop = desktop.replace(/^Name=.*$/m, `Name=${DISPLAY_NAME}`);
desktop = desktop.replace(/^Comment=.*$/m, `Comment=${DISPLAY_NAME}`);
desktop = desktop.replace(/^Icon=.*$/m, `Icon=${iconThemeName}`);
desktop = desktop.replace(/^Exec=.*$/m, `Exec=${bundleBin}`);
if (!desktop.includes('StartupNotify=')) {
  desktop = desktop.replace(/^StartupWMClass=.*$/m, (line) => `${line}\nStartupNotify=true`);
}

writeFileSync(desktopPath, desktop);

const applicationsDir = join(bundleRoot, 'share', 'applications');
mkdirSync(applicationsDir, { recursive: true });
writeFileSync(join(applicationsDir, `${identifier}.desktop`), desktop);

console.log(`[setup-linux-icons] Installed ${ICON_SIZES.length} icon sizes and updated ${desktopPath}`);
