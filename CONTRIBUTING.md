# Contributing to Layerz Wallet

Thank you for your interest in contributing to Layerz Wallet! This document provides guidelines and information for contributors.

## Project Overview

Layerz Wallet is a Bitcoin wallet supporting multiple Layer 2 solutions including Rootstock, Botanix, Liquid, Arkade, Spark, and Lightning Network. It's built as a monorepo with:

- **Mobile app** (React Native + Expo)
- **Browser extension** (React)
- **Shared code** (cryptography, network logic, React hooks)

### Code Formatting

- **Prettier** configuration:
  - Single quotes
  - Print width: 200 characters
  - Trailing commas: ES5 style
  - Arrow function parentheses: always

- **ESLint** with Expo configuration and Prettier integration
- Run formatting: `npm run lint:fix` (from respective project directories)

### Commit Messages

Follow [Conventional Commits](https://conventionalcommits.org/) specification:

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example: `feat(wallet): add support for Taproot addresses`

## Project Structure

```
layerzwallet/
├── mobile/           # React Native app
│   ├── app/         # Expo Router screens
│   ├── components/  # Reusable UI components
│   ├── src/         # App-specific code
│   └── ...
├── ext/             # Browser extension
│   ├── src/         # Extension source
│   └── ...
├── shared/          # Shared code across platforms
│   ├── class/       # Core wallet classes
│   ├── hooks/       # React hooks
│   ├── models/      # Data models
│   ├── modules/     # Utility modules
│   └── types/       # TypeScript definitions
└── ...
```

## License

By contributing to Layerz Wallet, you agree that your contributions will be licensed under the MIT License.