import { fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InanduGrid } from './InanduGrid';
import type { InanduGridRow } from '@inandu-solutions/grid-core';

/**
 * Where focus goes on a virtual grid when the window moves under it (review of the C PR): a keyboard jump that cannot finish must not take
 * focus away later, and a parked focus returns to the same *record*, not to the same position.
 */
const columns = [
  { field: 'id', headerText: 'ID', type: 'number' as const },
  { field: 'name', headerText: 'Name' },
];
const make = (n: number): InanduGridRow[] => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Person ${i + 1}` }));

const grid = (rows: InanduGridRow[], extra: Record<string, unknown> = {}) => (
  <div>
    <input aria-label="elsewhere" />
    <InanduGrid rows={rows} columns={columns} virtualScroll virtualRowHeight={20} height={200} overscan={2} {...extra} />
  </div>
);
const viewportOf = (c: HTMLElement) => c.querySelector('.inandu-grid-viewport') as HTMLElement;
const cellOf = (c: HTMLElement, rowIndex: number, col = 1) =>
  c.querySelectorAll<HTMLElement>(`tbody tr[data-row-index="${rowIndex}"] td[role="gridcell"]`)[col];
const focusCell = (c: HTMLElement, rowIndex: number, col = 1) => {
  const cell = cellOf(c, rowIndex, col);
  cell.tabIndex = 0;
  cell.focus();
  return cell;
};
const scrollTo = (c: HTMLElement, top: number) => fireEvent.scroll(viewportOf(c), { target: { scrollTop: top } });

/** A container that is not laid out (display: none, a hidden tab) ignores writes to scrollTop, so a keyboard jump cannot finish. */
function makeUnscrollable(viewport: HTMLElement) {
  let top = 0;
  Object.defineProperty(viewport, 'scrollTop', { get: () => top, set: () => undefined, configurable: true });
  return (value: number) => {
    top = value;
    fireEvent.scroll(viewport);
  };
}

afterEach(() => vi.restoreAllMocks());

describe('a keyboard jump that has to wait for its row', () => {
  it('never takes focus away from another field when the row finally appears', () => {
    const { container } = render(grid(make(500)));
    const scrollUnscrollable = makeUnscrollable(viewportOf(container));
    fireEvent.keyDown(focusCell(container, 0), { key: 'End', ctrlKey: true }); // wants row 499, which cannot be reached
    const input = container.querySelector('input[aria-label="elsewhere"]') as HTMLInputElement;
    input.focus();
    scrollUnscrollable(20 * 495); // the target row is now in the window
    expect(document.activeElement).toBe(input);
  });

  it('is forgotten when the rows change in the meantime (a filter, new data)', () => {
    const { container, rerender } = render(grid(make(500)));
    const scrollUnscrollable = makeUnscrollable(viewportOf(container));
    fireEvent.keyDown(focusCell(container, 0), { key: 'End', ctrlKey: true });
    rerender(grid(make(500))); // same size, new rows: row 499 is no longer "the" row that was asked for
    scrollUnscrollable(20 * 495);
    expect(document.activeElement?.textContent).not.toBe('Person 500');
  });

  it('is forgotten when it has waited too long', () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    const { container } = render(grid(make(500)));
    const scrollUnscrollable = makeUnscrollable(viewportOf(container));
    fireEvent.keyDown(focusCell(container, 0), { key: 'End', ctrlKey: true });
    now.mockReturnValue(1_000_000 + 2000);
    scrollUnscrollable(20 * 495);
    expect(document.activeElement?.textContent).not.toBe('Person 500');
  });

  it('still lands when the row arrives promptly (the normal case)', () => {
    const { container } = render(grid(make(500)));
    fireEvent.keyDown(focusCell(container, 0), { key: 'End', ctrlKey: true });
    expect(document.activeElement?.textContent).toBe('Person 500');
  });
});

describe('focus parked on the viewport while its row is out of the window', () => {
  const park = (c: HTMLElement) => {
    focusCell(c, 2); // "Person 3"
    scrollTo(c, 20 * 80); // its row unmounts: focus waits on the viewport
    expect(document.activeElement).toBe(viewportOf(c));
  };

  it('returns to the same record after the data was re-ordered, not to the same position', () => {
    const rows = make(100);
    const { container, rerender } = render(grid(rows));
    park(container);
    rerender(grid([...rows].reverse())); // Person 3 is now at position 97
    scrollTo(container, 20 * 95);
    expect(document.activeElement?.textContent).toBe('Person 3');
  });

  it('returns to the same record after a sort that moved it', () => {
    const rows = make(100);
    const { container, rerender } = render(grid(rows));
    park(container);
    const sorted = [...rows].sort((a, b) => String(a['name']).localeCompare(String(b['name'])));
    rerender(grid(sorted));
    const position = sorted.findIndex(r => r['id'] === 3); // sorted as text, "Person 3" moves from position 2 to about 23
    expect(position).toBeGreaterThan(10);
    scrollTo(container, 20 * (position - 3));
    expect(document.activeElement?.textContent).toBe('Person 3');
  });

  it('gives focus to nobody when that record is gone, and keeps it on the viewport', () => {
    const rows = make(100);
    const { container, rerender } = render(grid(rows));
    park(container);
    rerender(grid(rows.filter(r => r['id'] !== 3)));
    scrollTo(container, 0);
    expect(document.activeElement).toBe(viewportOf(container));
  });

  it('is forgotten when the user moves focus somewhere else', () => {
    const { container } = render(grid(make(100)));
    park(container);
    const input = container.querySelector('input[aria-label="elsewhere"]') as HTMLInputElement;
    input.focus();
    scrollTo(container, 0);
    expect(document.activeElement).toBe(input);
  });

  it('follows a row identified by rowId when the objects are replaced by fresh ones with the same ids', () => {
    const { container, rerender } = render(grid(make(100), { rowId: 'id' }));
    park(container);
    rerender(grid(make(100), { rowId: 'id' })); // an API refresh: new objects, same ids
    scrollTo(container, 0);
    expect(document.activeElement?.textContent).toBe('Person 3');
  });

  it('with no id at all, fresh objects are different records: focus is not handed to a look-alike', () => {
    const noId = (n: number): InanduGridRow[] => Array.from({ length: n }, (_, i) => ({ name: `Person ${i + 1}` }));
    const cols = [{ field: 'name', headerText: 'Name' }];
    const view = (rows: InanduGridRow[]) => <InanduGrid rows={rows} columns={cols} virtualScroll virtualRowHeight={20} height={200} overscan={2} />;
    const { container, rerender } = render(view(noId(100)));
    const cell = container.querySelectorAll<HTMLElement>('tbody tr[data-row-index="2"] td[role="gridcell"]')[0];
    cell.tabIndex = 0;
    cell.focus();
    scrollTo(container, 20 * 80);
    expect(document.activeElement).toBe(viewportOf(container));
    rerender(view(noId(100)));
    scrollTo(container, 0);
    expect(document.activeElement).toBe(viewportOf(container));
  });
});
