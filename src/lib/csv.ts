/** Neutralise spreadsheet formula injection and quote CSV cells. */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(rows: unknown[][]): string {
  return `﻿${rows.map((r) => r.map(csvCell).join(",")).join("\r\n")}`;
}
