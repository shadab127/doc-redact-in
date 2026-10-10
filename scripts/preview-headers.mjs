// GNU Affero General Public License v3.0 or later; Copyright (C) 2026 Shadab Khan. See LICENSE.
export function headersForPath(template, pathname) {
  const headers = {};
  let matches = false;
  for (const line of template.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      const pattern = line.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      matches = new RegExp(`^${pattern}$`).test(pathname);
      continue;
    }
    if (!matches) continue;
    const match = line.trim().match(/^([A-Za-z0-9-]+):\s*(.+)$/);
    if (!match) throw new Error('Invalid preview header');
    const name = match[1].toLowerCase();
    headers[name] = headers[name] ? `${headers[name]}, ${match[2]}` : match[2];
  }
  return headers;
}
