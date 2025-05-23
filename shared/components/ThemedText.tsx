// This file is only for mobile/native. For web/ext, use ThemedText.web.tsx.
// To avoid module resolution errors in web/ext, export an empty object.
export {};
// For web/ext, re-export the web implementation so imports work without .web extension
export * from './ThemedText.web';
