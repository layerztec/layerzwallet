import React, { useSyncExternalStore } from "react";

import {
  getMcpActivityLog,
  mcpActivityLogIsFull,
  subscribeMcpActivityLog,
} from "../../features/mcp/mcp-activity-log-desktop";

import "./McpActivityLog.css";

/** Desktop port of the MCP action log in mobile `McpTunnelStatusRow`. */
export const McpActivityLog: React.FC = () => {
  const activityLines = useSyncExternalStore(
    subscribeMcpActivityLog,
    getMcpActivityLog,
    getMcpActivityLog,
  );
  const activityLogFull = mcpActivityLogIsFull(activityLines.length);

  if (activityLines.length === 0) {
    return null;
  }

  return (
    <div
      className="mcp-activity-log"
      aria-live="polite"
      aria-label="MCP activity log"
    >
      {activityLines.map((line, index) => {
        const last = index === activityLines.length - 1;
        const oldestFading = activityLogFull && index === 0;
        const lineClass = last
          ? "mcp-activity-line--latest"
          : oldestFading
            ? "mcp-activity-line--fading"
            : "mcp-activity-line--older";
        return (
          <p
            key={`${index}-${line}`}
            className={`mcp-activity-line ${lineClass}`}
          >
            {line}
          </p>
        );
      })}
    </div>
  );
};
