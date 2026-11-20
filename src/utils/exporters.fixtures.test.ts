import { describe, expect, it, vi } from 'vitest';
import type { InanduGridRow } from '@inandu-solutions/grid-core';
import type { InanduGridColumn } from '../hooks/useInanduGrid';

const downloads: { content: unknown; filename: string; type?: string }[] = [];
vi.mock('@inandu-solutions/grid-core', async importOriginal => ({
  ...(await importOriginal<typeof import('@inandu-solutions/grid-core')>()),
  downloadBlob: (content: unknown, filename: string, type?: string) => downloads.push({ content, filename, type }),
}));

const { buildCsv, buildExcelXml, exportPdf } = await import('./exporters');

/**
 * Deterministic fixtures for the three export formats: the same rows every time, checked against what a spreadsheet or a PDF
 * reader would actually do with them. Written for the review's point C1 (Unicode, dates, currency, spreadsheet-formula
 * injection, many rows / pages).
 */
const columns: InanduGridColumn[] = [
  { field: 'name', headerText: 'Name' },
  { field: 'amount', headerText: 'Amount', type: 'number', format: '1.2-2' },
  { field: 'when', headerText: 'When', type: 'date', format: 'YYYY-MM-DD' },
  { field: 'ok', headerText: 'OK', type: 'boolean' },
];

const rows: InanduGridRow[] = [
  { name: 'Ñandú', amount: 1234.5, when: new Date(2024, 1, 29), ok: true },
  { name: '日本語 🚀 العربية', amount: -0.5, when: new Date(2019, 7, 3), ok: false },
  { name: 'line one\nline two', amount: 0, when: null, ok: null },
];

const parseXml = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

describe('CSV fixtures', () => {
  const csv = buildCsv(rows, columns, 'en');
  const lines = csv.replace('﻿', '').split('\r\n');

  it('keeps Unicode intact: accents, CJK, emoji and right-to-left text', () => {
    expect(csv).toContain('Ñandú');
    expect(csv).toContain('日本語 🚀 العربية');
  });

  it('puts a line break inside a cell in quotes, so it stays one record', () => {
    expect(csv).toContain('"line one\nline two"');
  });

  it('formats numbers, dates and empty cells the way the grid shows them', () => {
    expect(lines[1]).toContain('1,234.50');
    expect(lines[1]).toContain('2024-02-29');
    expect(lines[3]).toMatch(/,0\.00,,/); // null date and null boolean are empty, not "null"
    expect(csv).not.toMatch(/null|undefined|NaN/);
  });

  it('uses the locale for the numbers, and quotes what then contains the separator', () => {
    // 12,345.5, not 1,234.5: Spanish does not group a four-digit number (minimum grouping digits is 2).
    const es = buildCsv([{ name: 'a', amount: 12345.5 }], [columns[0], columns[1]], 'es');
    expect(es).toMatch(/"12\.345,50"/);
  });

  it('is only the header for no rows', () => {
    expect(buildCsv([], columns, 'en')).toBe('﻿Name,Amount,When,OK');
  });

  it.each(['=1+1', '+1+1', '-1+1', '@SUM(A1)', '\t=1+1', '\r=1+1'])('neutralizes the formula %j', value => {
    const out = buildCsv([{ name: value }], [columns[0]], 'en').split('\r\n')[1];
    expect(out.replace(/^"/, '')).toMatch(/^'/);
  });

  it('neutralizes a formula in a header too', () => {
    const out = buildCsv([], [{ field: 'x', headerText: '=HYPERLINK("http://example.test")' }], 'en');
    expect(out.replace('﻿', '').replace(/^"/, '')).toMatch(/^'/);
  });

  it('does not touch a negative number that is a number column', () => {
    const out = buildCsv([{ amount: -0.5 }], [columns[1]], 'en').split('\r\n')[1];
    expect(out).toBe("-0.50");
  });

  it('writes 5,000 rows with one record per row', () => {
    const many = Array.from({ length: 5000 }, (_, i) => ({ name: `row ${i}`, amount: i }));
    const out = buildCsv(many, [columns[0], columns[1]], 'en');
    expect(out.split('\r\n')).toHaveLength(5001);
  });
});

describe('Excel (SpreadsheetML) fixtures', () => {
  it('is well-formed XML with one Row per record plus the header', () => {
    const doc = parseXml(buildExcelXml(rows, columns, 'en'));
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(doc.getElementsByTagName('Row')).toHaveLength(rows.length + 1);
    for (const row of Array.from(doc.getElementsByTagName('Row'))) {
      expect(row.getElementsByTagName('Cell')).toHaveLength(columns.length);
    }
  });

  it('survives text that is dangerous in XML and in a spreadsheet', () => {
    const nasty = [
      { name: '<script>alert(1)</script>', amount: 1 },
      { name: ']]></Data><Cell>', amount: 2 },
      { name: 'a\u0000b\u0008c\u000bd', amount: 3 }, // control characters XML 1.0 cannot carry
      { name: '=cmd|\' /C calc\'!A0', amount: 4 },
    ];
    const xml = buildExcelXml(nasty, [columns[0], columns[1]], 'en');
    const doc = parseXml(xml);
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(doc.getElementsByTagName('Row')).toHaveLength(nasty.length + 1);
    expect(xml).not.toContain('<script>');
  });

  it('writes a string that looks like a formula as a String cell, which a spreadsheet never evaluates', () => {
    const doc = parseXml(buildExcelXml([{ name: '=1+1' }], [columns[0]], 'en'));
    const data = doc.getElementsByTagName('Data');
    expect(data[1].getAttribute('ss:Type')).toBe('String');
    expect(data[1].textContent).toBe('=1+1');
  });

  it('types real numbers as Number and everything else as String', () => {
    const doc = parseXml(buildExcelXml(rows, columns, 'en'));
    const cells = Array.from(doc.getElementsByTagName('Data'));
    const types = cells.slice(columns.length, columns.length * 2).map(c => c.getAttribute('ss:Type'));
    expect(types).toEqual(['String', 'Number', 'String', 'String']);
    expect(cells[columns.length + 1].textContent).toBe('1234.5'); // the number itself, not "1,234.50"
  });

  it.each([NaN, Infinity, -Infinity])('never writes %s as a number (Excel would reject the file)', bad => {
    const xml = buildExcelXml([{ amount: bad }], [columns[1]], 'en');
    expect(xml).not.toMatch(/ss:Type="Number">(NaN|Infinity|-Infinity)/);
    expect(parseXml(xml).getElementsByTagName('parsererror')).toHaveLength(0);
  });

  it('keeps a very large and a very small number readable by a spreadsheet', () => {
    const xml = buildExcelXml([{ amount: 1e21 }, { amount: 1e-7 }], [columns[1]], 'en');
    for (const m of xml.matchAll(/ss:Type="Number">([^<]*)</g)) expect(Number.isFinite(Number(m[1]))).toBe(true);
  });

  it('keeps Unicode and line breaks', () => {
    const doc = parseXml(buildExcelXml(rows, columns, 'en'));
    const text = Array.from(doc.getElementsByTagName('Data')).map(d => d.textContent);
    expect(text).toContain('日本語 🚀 العربية');
    expect(text).toContain('line one\nline two');
  });

  it('writes the dates as the grid formats them, as text', () => {
    const text = Array.from(parseXml(buildExcelXml(rows, columns, 'en')).getElementsByTagName('Data')).map(d => d.textContent);
    expect(text).toContain('2024-02-29');
    expect(text).toContain('2019-08-03');
  });
});

describe('PDF fixtures', () => {
  const decode = async () => {
    const blob = downloads.at(-1)!.content as Blob;
    return new TextDecoder('latin1').decode(await blob.arrayBuffer());
  };
  const pageCount = (pdf: string) => (pdf.match(/\/Type\s*\/Page\b(?!s)/g) ?? []).length;

  it('produces a PDF file named after the grid', async () => {
    await exportPdf(rows, columns, 'en', 'fixture');
    expect(downloads.at(-1)!.filename).toBe('fixture-export.pdf');
    expect((await decode()).startsWith('%PDF-')).toBe(true);
  });

  it('fits a few rows on one page', async () => {
    await exportPdf(rows, columns, 'en');
    expect(pageCount(await decode())).toBe(1);
  });

  it('adds pages for many rows, and the count follows the rows', async () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `row ${i}`, amount: i, when: new Date(2024, 0, 1), ok: true }));
    await exportPdf(many(100), columns, 'en');
    const small = pageCount(await decode());
    await exportPdf(many(400), columns, 'en');
    const big = pageCount(await decode());
    expect(small).toBeGreaterThan(1);
    expect(big).toBeGreaterThan(small);
  });

  it('does not throw for an empty grid, or for text jsPDF cannot encode', async () => {
    await expect(exportPdf([], columns, 'en')).resolves.toBeUndefined();
    await expect(exportPdf(rows, columns, 'en')).resolves.toBeUndefined();
  });
});
