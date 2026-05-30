# React + Vite Electrobun Template

A fast Electrobun desktop app template with React, plain CSS, and Vite for hot module replacement (HMR).

## Environment variables

Desktop is a **Vite** app: secrets are inlined when Vite **builds** or when the **dev server starts**. Electrobun’s Bun main process does not read `EXPO_PUBLIC_*` for the UI.

Set `EXPO_PUBLIC_BREEZ_API_KEY` (required for Liquid / Breez) in any of these places:

| Location | Notes |
|----------|--------|
| `desktop/.env` | Recommended for desktop-only work |
| `mobile/.env` | Loaded automatically (same monorepo key as mobile) |
| Shell before `bun run start` | `export EXPO_PUBLIC_BREEZ_API_KEY=...` |

```bash
cp desktop/.env.example desktop/.env
# edit desktop/.env and set EXPO_PUBLIC_BREEZ_API_KEY
```

After changing `.env`, restart Vite: stop `bun run hmr` / `bun run dev:hmr` and run again, or run `bun run start` so `vite build` picks up the new value.

## Getting Started

```bash
# Install dependencies
bun install

# Development without HMR (uses bundled assets)
bun run dev

# Development with HMR (recommended)
bun run dev:hmr

# Production build (stable)
bun run build

# Pre-release (canary)
bun run build:canary
```

## How HMR Works

When you run `bun run dev:hmr`:

1. **Vite dev server** starts on `http://localhost:5173` with HMR enabled
2. **Electrobun** starts and detects the running Vite server
3. The app loads from the Vite dev server instead of bundled assets
4. Changes to React components update instantly without full page reload

When you run `bun run dev` (without HMR):

1. Electrobun starts and loads from `views://mainview/index.html`
2. You need to rebuild (`bun run build`) to see changes

## Project Structure

```
├── src/
│   ├── bun/
│   │   └── index.ts        # Main process (Electrobun/Bun)
│   └── mainview/
│       ├── App.tsx         # React app component
│       ├── main.tsx        # React entry point
│       ├── index.html      # HTML template
│       └── index.css       # App styles
├── electrobun.config.ts    # Electrobun configuration
├── vite.config.ts          # Vite configuration
└── package.json
```

## Customizing

- **React components**: Edit files in `src/mainview/`
- **Styles**: Edit `src/mainview/index.css`
- **Vite settings**: Edit `vite.config.ts`
- **Window settings**: Edit `src/bun/index.ts`
- **App metadata**: Edit `electrobun.config.ts`
