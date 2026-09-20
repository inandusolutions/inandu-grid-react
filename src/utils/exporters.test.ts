import { describe, expect, it } from 'vitest';
import { buildCsv, buildExcelXml } from './exporters';

const columns = [
  { field: 'name', headerText: 'Name' },
  { field: 'amount', headerText: 'Amount', type: 'number' as const },
];

const rows = [
  { name: 'México', amount: 10 },
  { name: 'A, "B"', amount: 20 },
];

describe('buildCsv', () => {
  it('starts with a UTF-8 BOM and a header row', () => {
    const csv = buildCsv(rows, columns, 'en');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Name,Amount');
  });

  it('escapes values containing commas or quotes', () => {
    const csv = buildCsv(rows, columns, 'en');
    expect(csv).toContain('"A, ""B"""');
  });
});

describe('buildExcelXml', () => {
  it('types a numeric column as Number and a string column as String', () => {
    const xml = buildExcelXml(rows, columns, 'en');
    expect(xml).toContain('<Data ss:Type="Number">10</Data>');
    expect(xml).toContain('<Data ss:Type="String">México</Data>');
  });

  it('escapes markup-unsafe characters in string cells', () => {
    const xml = buildExcelXml([{ name: '<b>&"\'', amount: 1 }], columns, 'en');
    expect(xml).not.toContain('<b>');
    expect(xml).toContain('&lt;b&gt;');
  });
});
