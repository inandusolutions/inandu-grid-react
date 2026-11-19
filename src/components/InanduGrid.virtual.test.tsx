import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InanduGrid } from './InanduGrid';
import type { InanduGridRow } from '../core';

/** Virtual scroll with many rows (review point C2): data that arrives late, a viewport that is resized, scroll set from code. */
const columns = [
  { field: 'id', headerText: 'ID', type: 'number' as const },
  { field: 'name', headerText: 'Name' },
];
const make = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Person ${i + 1}` }));

const body = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>('tbody tr[data-row-index]'));
const ids = (c: HTMLElement) => body(c).map(tr => Number(tr.getAttribute('data-row-index')) + 1);
const viewport = (c: HTMLElement) => c.querySelector('.inandu-grid-viewport') as HTMLElement;
const scrollTo = (c: HTMLElement, top: number) => fireEvent.scroll(viewport(c), { target: { scrollTop: top } });

const grid = (rows: InanduGridRow[], height = 200) => (
  <InanduGrid rows={rows} columns={columns} virtualScroll virtualRowHeight={20} height={height} overscan={2} />
);

describe('virtual scroll: many rows', () => {
  it('mounts only the window for 20,000 rows, and a spacer stands for the rest', () => {
    const { container } = render(grid(make(20000)));
    expect(body(container).length).toBeLessThanOrEqual(10 + 2);
    expect(ids(container)[0]).toBe(1);
    const spacer = container.querySelector<HTMLElement>('tbody tr[aria-hidden="true"] td');
    expect(spacer && parseInt(spacer.style.height, 10)).toBeGreaterThan(20 * 19000);
  });

  it('data that arrives after the first render fills the window', () => {
    const { container, rerender } = render(grid([]));
    expect(body(container)).toHaveLength(0);
    rerender(grid(make(5000)));
    expect(ids(container)[0]).toBe(1);
    expect(body(container).length).toBeGreaterThan(0);
    expect(body(container).length).toBeLessThan(20);
  });

  it('data replaced while scrolled far down shows a valid window, not an empty gap', () => {
    const { container, rerender } = render(grid(make(10000)));
    scrollTo(container, 20 * 9000);
    expect(ids(container)[0]).toBeGreaterThan(8900);
    rerender(grid(make(10000).slice(0, 30))); // far fewer rows than the scroll position
    scrollTo(container, 20 * 29); // what the browser reports once it has clamped the scroll to the new height
    expect(ids(container).at(-1)).toBe(30);
  });

  it('programmatic scroll to the last row mounts the last row, to the middle mounts the middle', () => {
    const { container } = render(grid(make(10000)));
    scrollTo(container, 20 * 9990);
    expect(ids(container).at(-1)).toBe(10000);
    scrollTo(container, 20 * 5000);
    const middle = ids(container);
    expect(middle[0]).toBeLessThanOrEqual(5001);
    expect(middle.at(-1)).toBeGreaterThanOrEqual(5001);
  });

  it('the window is contiguous at every scroll position (no gaps or repeats)', () => {
    const { container } = render(grid(make(3000)));
    for (const row of [0, 1, 7, 99, 1500, 2990, 2999, 3]) {
      scrollTo(container, row * 20);
      const w = ids(container);
      expect(w.every((v, i) => i === 0 || v === w[i - 1] + 1)).toBe(true);
    }
  });

  it('a taller viewport mounts more rows, a shorter one fewer', () => {
    const { container, rerender } = render(grid(make(1000), 200));
    const small = body(container).length;
    rerender(grid(make(1000), 800));
    expect(body(container).length).toBeGreaterThan(small);
    rerender(grid(make(1000), 100));
    expect(body(container).length).toBeLessThan(small);
  });

  it('keeps the viewport focusable by code, so focus has somewhere to wait when its row scrolls away', () => {
    const { container } = render(grid(make(100)));
    expect(viewport(container).getAttribute('tabindex')).toBe('-1');
  });
});
