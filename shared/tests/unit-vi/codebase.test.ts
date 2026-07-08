import fs from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';
import assert from 'assert';
import { SETTINGS_CONFIG } from '../../hooks/SettingsContext';

const SUBPROJECTS = ['ext', 'mobile', 'desktop'] as const;

function readPackageJson(subproject: (typeof SUBPROJECTS)[number]) {
  return JSON.parse(fs.readFileSync(resolve(__dirname, `../../../${subproject}/package.json`), 'utf8'));
}

function getDependencyVersion(packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }, dependency: string) {
  return packageJson.dependencies?.[dependency] ?? packageJson.devDependencies?.[dependency];
}

/** Dependencies that must use the same version string in every subproject package.json */
const SYNCED_DEPENDENCIES = [
  '@buildonspark/spark-sdk',
  '@arkade-os/sdk',
  '@arkade-os/boltz-swap',
  '@atomiqlabs/sdk',
  '@atomiqlabs/chain-evm',
  '@breeztech/breez-sdk-liquid', // @breeztech/breez-sdk-liquid-react-native is mobile-only
  '@flashnet/sdk',
  'bitcoinjs-lib',
  'ecpair',
  '@noble/secp256k1',
  '@bitcoinerlab/secp256k1',
] as const;

describe('codebase', function () {
  /**
   * could not isolate shared vitest config, always some weird errors, so we keep identical copies
   * and just check if the files are the same
   */
  it('vitest config files are the same', async function () {
    const extVitestConfig = fs.readFileSync(resolve(__dirname, '../../../ext/vitest.config.mts'), 'utf8');
    const mobileVitestConfig = fs.readFileSync(resolve(__dirname, '../../../mobile/vitest.config.mts'), 'utf8');

    assert.strictEqual(extVitestConfig, mobileVitestConfig);
  });

  it('prettier config files are the same', async function () {
    const extPrettierConfig = fs.readFileSync(resolve(__dirname, '../../../ext/.prettierrc'), 'utf8');
    const mobilePrettierConfig = fs.readFileSync(resolve(__dirname, '../../../mobile/.prettierrc'), 'utf8');
    const sharedPrettierConfig = fs.readFileSync(resolve(__dirname, '../../../shared/.prettierrc'), 'utf8');

    assert.strictEqual(extPrettierConfig, mobilePrettierConfig);
    assert.strictEqual(extPrettierConfig, sharedPrettierConfig);
  });

  it('shared dependency versions are the same across subprojects', function () {
    const packages = Object.fromEntries(SUBPROJECTS.map((name) => [name, readPackageJson(name)]));

    for (const dependency of SYNCED_DEPENDENCIES) {
      const versions = SUBPROJECTS.map((name) => ({
        subproject: name,
        version: getDependencyVersion(packages[name], dependency),
      }));

      const [first, ...rest] = versions;
      assert.ok(first.version, `${dependency} is missing in ${first.subproject}/package.json`);

      for (const { subproject, version } of rest) {
        assert.ok(version, `${dependency} is missing in ${subproject}/package.json`);
        assert.strictEqual(version, first.version, `${dependency} version mismatch: ${first.subproject} has ${first.version}, ${subproject} has ${version}`);
      }
    }
  });

  it('subproject versions are the same', async function () {
    const extPckg = readPackageJson('ext');
    const mobilePckg = readPackageJson('mobile');
    const mobileAppjson = JSON.parse(fs.readFileSync(resolve(__dirname, '../../../mobile/app.json'), 'utf8'));
    const desktopPckg = readPackageJson('desktop');
    const desktopElectrobunConfig = fs.readFileSync(resolve(__dirname, '../../../desktop/electrobun.config.ts'), 'utf8');
    const desktopElectrobunVersion = desktopElectrobunConfig.match(/version:\s*['"]([^'"]+)['"]/)?.[1];

    assert.ok(extPckg.version);

    assert.strictEqual(extPckg.version, mobilePckg.version);
    assert.strictEqual(extPckg.version, mobileAppjson.expo.version);
    assert.strictEqual(extPckg.version, desktopPckg.version);
    assert.ok(desktopElectrobunVersion, 'desktop electrobun.config.ts must define app.version');
    assert.strictEqual(extPckg.version, desktopElectrobunVersion);
  });

  it('all SETTINGS_CONFIG default values are among possible options', function () {
    Object.entries(SETTINGS_CONFIG).forEach(([key, config]) => {
      const defaultValue = config.default;
      const options = config.options as readonly any[];

      assert(options.includes(defaultValue), `Setting "${key}" has default value "${defaultValue}" which is not among the possible options: [${options.join(', ')}]`);
    });
  });
});
