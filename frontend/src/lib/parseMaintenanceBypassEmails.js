/** Parse comma/semicolon/newline-separated bypass list for Sacred Home maintenance mode. */
export function parseMaintenanceBypassEmails(raw) {
  return String(raw || '')
    .split(/[,;\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.includes('@'));
}
