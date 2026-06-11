const CAP = 5;
const listeners = new Set<() => void>();
let lines: string[] = [];

export function pushMcpActivityLog(line: string): void {
  const t = line.trim();
  if (!t) return;
  lines = [...lines, t].slice(-CAP);
  for (const l of listeners) l();
}

export function subscribeMcpActivityLog(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function getMcpActivityLog(): string[] {
  return lines;
}

export function mcpActivityLogIsFull(lineCount: number): boolean {
  return lineCount === CAP;
}
