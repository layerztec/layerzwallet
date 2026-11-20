# Debugging the Extension with Chrome DevTools MCP

This guide explains how to set up Chrome DevTools MCP so that Claude Code (or other AI coding agents) can interact with, debug, and take screenshots of the Layerz Wallet Chrome extension.

## Why Chrome for Testing?

Chrome 137+ removed `--load-extension` and related flags from branded Chrome builds for security reasons. Extensions cannot be loaded into automated Chrome sessions. **Chrome for Testing** is a dedicated build that retains all automation-friendly flags and is the recommended solution.

## Prerequisites

- Node.js v20.19+
- npm
- Claude Code (or another MCP-compatible client)

## Step 1: Install Chrome for Testing

From the `ext/` directory:

```bash
cd ext
npx @puppeteer/browsers install chrome@stable
```

This downloads Chrome for Testing into `ext/chrome/`. The binary path will be printed, e.g.:

```
chrome@145.0.7632.46 /Users/<you>/z/layerzwallet/ext/chrome/mac_arm-145.0.7632.46/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing
```

Save this path for the next step.

> **Note:** The `ext/chrome/` directory is gitignored.

## Step 2: Build the Extension

Make sure you have a fresh build:

```bash
cd ext
npm start    # dev server (watches for changes)
# or
npm run build  # one-time production build
```

The built extension lives in `ext/build/`.

## Step 3: Configure Chrome DevTools MCP

Add the MCP server to Claude Code (user-scoped so it works across projects):

```bash
claude mcp add chrome-devtools --scope user -- npx chrome-devtools-mcp@latest \
  --executable-path="/Users/<you>/z/layerzwallet/ext/chrome/mac_arm-<version>/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" \
  --chrome-arg=--enable-unsafe-extension-debugging \
  --chrome-arg=--disable-extensions-except=/Users/<you>/z/layerzwallet/ext/build \
  --chrome-arg=--load-extension=/Users/<you>/z/layerzwallet/ext/build \
  --chrome-arg=--window-size=400,600
```

Replace `<you>` and `<version>` with your actual username and Chrome for Testing version.

Or manually edit `~/.claude.json` and add to the `mcpServers` section:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "chrome-devtools-mcp@latest",
        "--executable-path=/Users/<you>/z/layerzwallet/ext/chrome/mac_arm-<version>/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
        "--chrome-arg=--enable-unsafe-extension-debugging",
        "--chrome-arg=--disable-extensions-except=/Users/<you>/z/layerzwallet/ext/build",
        "--chrome-arg=--load-extension=/Users/<you>/z/layerzwallet/ext/build",
        "--chrome-arg=--window-size=400,600"
      ],
      "env": {}
    }
  }
}
```

### Config Explained

| Flag | Purpose |
|------|---------|
| `--executable-path` | Points to Chrome for Testing binary instead of branded Chrome |
| `--enable-unsafe-extension-debugging` | Re-enables extension loading in automated Chrome |
| `--disable-extensions-except` | Whitelists only the Layerz Wallet extension |
| `--load-extension` | Auto-loads the extension from `ext/build/` on startup |
| `--window-size=400,600` | Sets viewport to approximate the extension popup size |

## Step 4: Restart Claude Code

After changing the MCP config, restart Claude Code for the changes to take effect.

## Step 5: Use It

Once configured, Claude Code can:

- **Navigate** to the extension popup: `chrome-extension://jfkjdddajnobopldmhfpgblcidgohkak/popup.html`
- **Take screenshots** of the extension UI
- **Read console errors** and network requests
- **Execute JavaScript** in the extension context
- **Click buttons**, fill forms, and interact with the UI
- **Record performance traces**

### Example Prompts

```
Open the Layerz Wallet extension and take a screenshot
```

```
Check for console errors in the extension
```

```
Navigate to the send screen and inspect the network requests
```

## Troubleshooting

### Extension not loading (list empty on chrome://extensions)

- Make sure you're using **Chrome for Testing**, not branded Chrome
- Verify `ext/build/` exists and contains `manifest.json` and `popup.html`
- Each `--chrome-arg` must be a **separate** array entry (don't combine multiple flags into one string)

### `--chrome-arg` not working

Test with a simple visual flag like `--chrome-arg=--window-size=400,600`. If the window size doesn't change, the args aren't being passed.

### Extension ID different than expected

When loading an unpacked extension, Chrome assigns the ID based on the extension's path. The ID `jfkjdddajnobopldmhfpgblcidgohkak` is stable as long as the `ext/build/` path stays the same. If the ID changes, navigate to `chrome://extensions` to find the new one.

### Branded Chrome won't load extensions

This is expected on Chrome 137+. Use Chrome for Testing as described above. See the [Chromium RFC](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/aEHdhDZ-V0E) for background.

### Updating Chrome for Testing

To update to a newer version:

```bash
cd ext
npx @puppeteer/browsers install chrome@stable
```

Then update the `--executable-path` in your MCP config to point to the new version.
