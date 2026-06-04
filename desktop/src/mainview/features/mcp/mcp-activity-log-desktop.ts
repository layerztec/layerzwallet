/**
 * Single desktop entry for `@shared/features/mcp/modules/mcp-activity-log`.
 * UI must import from here so Vite does not duplicate the in-memory log store.
 */

export { getMcpActivityLog, mcpActivityLogIsFull, subscribeMcpActivityLog } from '@shared/features/mcp/modules/mcp-activity-log';
