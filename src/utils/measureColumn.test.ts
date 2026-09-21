import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { measureColumnContentWidth } from './measureColumn';

// jsdom has no real layout engine — offsetWidth/getComputedStyle can't report a genuine rendered
// text width. This stubs offsetWidth as proportional to textContent length, so the *surrounding*
// logic (which cells get measured, the header/cell padding reserved, the "nothing to measure"
// case) is verified without pretending the actual pixel measurement is meaningful here — see this
// module's own doc comment for why the measurement itself is trusted rather than tested.
let originalOffsetWidth: PropertyDescriptor | undefined;

beforeEach(() => {
  originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return (this.textContent ?? '').length * 10;
    },
  });
});

afterEach(() => {
  if (originalOffsetWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
});

function buildHost(cellTexts: string[]): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = `
    <table>
      <thead><tr><th data-field="name">Name</th></tr></thead>
      <tbody>
        ${cellTexts.map(text => `<tr><td data-field="name">${text}</td></tr>`).join('')}
      </tbody>
    </table>
  `;
  document.body.appendChild(host);
  return host;
}

describe('measureColumnContentWidth', () => {
  it('returns the widest of the header and every rendered cell, plus reserved space', () => {
    const host = buildHost(['Ana', 'Beatriz Elizabeth']); // a short cell and a long one; the long one should win over the header
    const width = measureColumnContentWidth(host, 'name', 'Name');
    // "Beatriz Elizabeth" (17 chars) * 10 = 170, + padding (jsdom's UA stylesheet gives <td> 1px each side = 2) + 2 border slack.
    expect(width).toBe(174);
  });

  it('gives the header extra reserved space for the sort button and resize handle', () => {
    const host = buildHost(['A']); // trivially short cell; header should win
    const width = measureColumnContentWidth(host, 'name', 'Name');
    // "Name" (4 chars) * 10 = 40, + 44 reserved.
    expect(width).toBe(84);
  });

  it('returns 0 when the column has no rendered header or cell to measure', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    expect(measureColumnContentWidth(host, 'missing', 'Missing')).toBe(0);
  });

  it('collapses internal whitespace before measuring a cell', () => {
    const host = buildHost(['  a   b  \n c ']);
    const width = measureColumnContentWidth(host, 'name', 'Name');
    // Collapsed to "a b c" (5 chars) * 10 = 50 + 2, still less than the header's 84 — header wins.
    expect(width).toBe(84);
  });
});
