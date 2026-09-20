import { InanduGridRow, downloadBlob, escapeCsvValue, escapeMarkup, formatCellValue, truncatePdfText } from '../core';
import { InanduGridColumn } from '../hooks/useInanduGrid';

function headerLabel(column: InanduGridColumn): string {
  return column.headerText || column.field;
}

function cellValue(column: InanduGridColumn, row: InanduGridRow, locale: string): string {
  return formatCellValue(row[column.field], column.type ?? 'string', column.format ?? '', locale);
}

/**
 * Ported from grid-angular's `exportCsv()` — same column/row source, same formatted-value rule,
 * same UTF-8 BOM (so Excel opens accented text as UTF-8 instead of Latin-1).
 */
export function buildCsv(rows: InanduGridRow[], columns: InanduGridColumn[], locale: string): string {
  const lines = [
    columns.map(column => escapeCsvValue(headerLabel(column))).join(','),
    ...rows.map(row => columns.map(column => escapeCsvValue(cellValue(column, row, locale))).join(',')),
  ];
  return '﻿' + lines.join('\r\n');
}

export function exportCsv(rows: InanduGridRow[], columns: InanduGridColumn[], locale: string, filenameBase = 'inandu-grid'): void {
  downloadBlob(buildCsv(rows, columns, locale), `${filenameBase}-export.csv`, 'text/csv;charset=utf-8;');
}

/**
 * Ported from grid-angular's `exportExcel()` — dependency-free SpreadsheetML XML that Excel 2003+,
 * LibreOffice and Google Sheets all open natively. A numeric column stays genuinely numeric-typed
 * in the sheet; everything else is a formatted string. A real binary `.xlsx` is a grid-pro feature.
 */
export function buildExcelXml(rows: InanduGridRow[], columns: InanduGridColumn[], locale: string): string {
  const numericCellValue = (column: InanduGridColumn, row: InanduGridRow): number | undefined => {
    const raw = row[column.field];
    return column.type === 'number' && typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
  };
  const dataCell = (column: InanduGridColumn, row: InanduGridRow): string => {
    const num = numericCellValue(column, row);
    return num !== undefined
      ? `<Cell><Data ss:Type="Number">${num}</Data></Cell>`
      : `<Cell><Data ss:Type="String">${escapeMarkup(cellValue(column, row, locale))}</Data></Cell>`;
  };
  const headerRow = `<Row ss:StyleID="header">${columns
    .map(column => `<Cell><Data ss:Type="String">${escapeMarkup(headerLabel(column))}</Data></Cell>`)
    .join('')}</Row>`;
  const dataRows = rows.map(row => `<Row>${columns.map(column => dataCell(column, row)).join('')}</Row>`).join('');

  return (
    '<?xml version="1.0"?>' +
    '<?mso-application progid="Excel.Sheet"?>' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
    '<Styles><Style ss:ID="header"><Font ss:Bold="1"/></Style></Styles>' +
    '<Worksheet ss:Name="Sheet1"><Table>' +
    headerRow +
    dataRows +
    '</Table></Worksheet></Workbook>'
  );
}

export function exportExcel(rows: InanduGridRow[], columns: InanduGridColumn[], locale: string, filenameBase = 'inandu-grid'): void {
  downloadBlob(buildExcelXml(rows, columns, locale), `${filenameBase}-export.xls`, 'application/vnd.ms-excel');
}

/**
 * Ported from grid-angular's `exportPdf()` — one simple table drawn with jsPDF's low-level
 * text/line primitives (not the `autotable` plugin), single-line cells truncated with an ellipsis,
 * header redrawn on every new page. Columns split the page width evenly (grid-angular instead
 * weights by each column's live pixel width — not meaningful yet here, no column-resize feature).
 * `jspdf` is dynamically imported so a grid that never exports to PDF never pays to load it.
 */
export async function exportPdf(
  rows: InanduGridRow[],
  columns: InanduGridColumn[],
  locale: string,
  filenameBase = 'inandu-grid',
): Promise<void> {
  const { jsPDF: JsPdf } = await import('jspdf');
  const headerValues = columns.map(headerLabel);

  const doc = new JsPdf({ orientation: 'landscape' });
  const marginX = 10;
  const marginY = 10;
  const rowHeight = 8;
  const pageWidth = doc.internal.pageSize.getWidth() - marginX * 2;
  const pageHeight = doc.internal.pageSize.getHeight() - marginY;
  const colWidth = pageWidth / (columns.length || 1);

  let y = marginY;
  const drawRow = (values: string[], bold: boolean): void => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    let x = marginX;
    values.forEach(value => {
      doc.text(truncatePdfText(doc, value, colWidth - 4), x + 2, y + 6);
      x += colWidth;
    });
    y += rowHeight;
  };

  drawRow(headerValues, true);
  for (const row of rows) {
    if (y + rowHeight > pageHeight) {
      doc.addPage();
      y = marginY;
      drawRow(headerValues, true);
    }
    drawRow(
      columns.map(column => cellValue(column, row, locale)),
      false,
    );
  }

  downloadBlob(doc.output('blob'), `${filenameBase}-export.pdf`);
}
