import { escapeAttributeSelectorValue } from '../core';

/**
 * Widest rendered value in a column (its header and every currently-rendered data cell), measured
 * against that column's own computed font, plus the cell's horizontal padding. Reads only what's
 * in the DOM right now — one page, or the virtual window — so it's O(visible rows). Returns `0` if
 * the column has no rendered cell to measure. Ported verbatim from grid-angular's
 * `measureColumnContentWidth()` (`onResizeHandleDblClick`'s autosize).
 *
 * Genuinely needs a real layout engine to return anything meaningful — `offsetWidth`/
 * `getComputedStyle` are always `0`/defaults in jsdom, so this can't be *end-to-end* verified in a
 * unit test the way the rest of the port is. What test coverage there is stubs `offsetWidth`
 * itself and checks the surrounding logic (which cells get measured, the padding/reserved-space
 * math, the `0` "nothing to measure" case) — the measurement call itself is trusted to work in a
 * real browser, same as any other `getBoundingClientRect()`-dependent code would be.
 */
export function measureColumnContentWidth(host: HTMLElement, field: string, headerText: string): number {
  const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(field) : escapeAttributeSelectorValue(field);
  const cells = Array.from(host.querySelectorAll<HTMLElement>(`td[data-field="${escaped}"]`));
  const headerCell = host.querySelector<HTMLElement>(`th[data-field="${escaped}"]`);
  const sample = cells[0] ?? headerCell ?? host;
  const cs = getComputedStyle(sample);

  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;white-space:pre;pointer-events:none';
  probe.style.font = cs.font || `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`;
  probe.style.letterSpacing = cs.letterSpacing;
  document.body.appendChild(probe);

  const padding = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) + 2; // + border slack
  let widest = 0;

  // header text needs extra room for the sort button and the resize handle it lives next to
  probe.textContent = headerText || field;
  widest = Math.max(widest, probe.offsetWidth + 44);

  for (const cell of cells) {
    probe.textContent = (cell.textContent ?? '').replace(/\s+/g, ' ').trim();
    widest = Math.max(widest, probe.offsetWidth + padding);
  }

  probe.remove();
  return cells.length || headerCell ? Math.ceil(widest) : 0;
}
