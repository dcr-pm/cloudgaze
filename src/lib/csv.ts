import { expenseCategoryTile } from '../../shared/constants';
import type { ExpenseEntry, FamilyState, Kid, Parent } from '../../shared/types';
import { otherOwesCents } from './balance';

/**
 * Export runs entirely in the browser — the client already holds every expense,
 * so a server round trip would buy nothing and wouldn't work offline.
 */

function escapeCell(value: string): string {
  // A leading =, +, - or @ makes a spreadsheet treat the cell as a formula.
  // Prefix those so a description like "-5 refund" can't execute anything.
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${guarded.replace(/"/g, '""')}"`;
}

function toCsv(rows: readonly (readonly string[])[]): string {
  // The BOM makes Excel read UTF-8 correctly instead of mangling accented names.
  return '﻿' + rows.map((r) => r.map(escapeCell).join(',')).join('\r\n');
}

export function expensesToCsv(
  expenses: readonly ExpenseEntry[],
  parents: readonly [Parent, Parent],
  kids: readonly Kid[],
): string {
  const parentName = (id: string) =>
    parents.find((p) => p.id === id)?.name ?? 'Unknown';
  const kidNames = (ids: readonly string[]) =>
    ids
      .map((id) => kids.find((k) => k.id === id)?.name)
      .filter(Boolean)
      .join('; ');

  const header = [
    'Date',
    'Description',
    'Category',
    'Kids',
    'Amount',
    'Paid by',
    'Split',
    'Other parent owes',
    'Settled',
    'Added by',
    'Added on',
  ];

  const rows = [...expenses]
    .filter((e) => !e.deletedAt)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => [
      e.date,
      e.description,
      expenseCategoryTile(e.category).label,
      kidNames(e.kidIds),
      // Plain decimals, no currency symbol — spreadsheets sum these.
      (e.amountCents / 100).toFixed(2),
      parentName(e.paidByParentId),
      e.split.type === 'even'
        ? '50/50'
        : e.split.type === 'all_mine'
          ? 'Not billed'
          : `${e.split.otherOwesPercent}% to other parent`,
      (otherOwesCents(e) / 100).toFixed(2),
      e.reimbursed ? 'Yes' : 'No',
      parentName(e.createdByParentId),
      e.createdAt.slice(0, 10),
    ]);

  return toCsv([header, ...rows]);
}

/** Triggers a download of `content` as `filename`. */
export function downloadFile(
  filename: string,
  content: string,
  mime = 'text/csv;charset=utf-8',
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Full JSON backup. This is the only recovery path if the family code is lost,
 * so it deliberately includes everything, not just expenses.
 */
export function backupJson(state: FamilyState): string {
  return JSON.stringify(
    { exportedAt: new Date().toISOString(), ...state },
    null,
    2,
  );
}
