import { test, expect, type Locator, type Page } from '@playwright/test';

const body = (page: Page) => page.locator('table.inandu-grid tbody tr');
const header = (page: Page, field: string) => page.locator(`th[data-field="${field}"]`);
const cellOf = (row: Locator, field: string) => row.locator(`td[data-field="${field}"]`);
const fieldOrder = (page: Page) => page.locator('table.inandu-grid thead tr').first().locator('th[data-field]').evaluateAll(els => els.map(e => e.getAttribute('data-field')));

test.describe('column filters (basics grid)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#basics');
  });

  test('text filter is case-insensitive and narrows the rows', async ({ page }) => {
    await page.getByLabel('Filter Name', { exact: true }).fill('lOVELACE');
    await expect(body(page)).toHaveCount(1);
    await expect(body(page).first()).toContainText('Ada Lovelace');
  });

  test('number filter supports min, max and both', async ({ page }) => {
    await page.getByLabel('Filter Salary Min').fill('150000');
    const n = await body(page).count();
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(8);
    for (const t of await page.locator('tbody td[data-field="salary"]').allTextContents()) {
      expect(Number(t.replace(/[^\d]/g, ''))).toBeGreaterThanOrEqual(150000);
    }
    await page.getByLabel('Filter Salary Max').fill('160000');
    for (const t of await page.locator('tbody td[data-field="salary"]').allTextContents()) {
      const v = Number(t.replace(/[^\d]/g, ''));
      expect(v).toBeGreaterThanOrEqual(150000);
      expect(v).toBeLessThanOrEqual(160000);
    }
  });

  test('boolean filter keeps only the chosen value', async ({ page }) => {
    await page.getByLabel('Filter Active', { exact: true }).selectOption('false');
    const cells = await page.locator('tbody td[data-field="active"]').allTextContents();
    expect(cells.length).toBeGreaterThan(0);
    for (const c of cells) expect(c.trim()).toBe('No');
  });

  test('date filter narrows by range', async ({ page }) => {
    await page.getByLabel('Filter Joined From').fill('2020-01-01');
    await page.getByLabel('Filter Joined To').fill('2022-12-31');
    const cells = await page.locator('tbody td[data-field="joined"]').allTextContents();
    expect(cells.length).toBeGreaterThan(0);
    for (const c of cells) {
      const year = Number(c.trim().slice(-4));
      expect(year).toBeGreaterThanOrEqual(2020);
      expect(year).toBeLessThanOrEqual(2022);
    }
  });

  test('filters combine with the search box', async ({ page }) => {
    await page.getByLabel('Filter Team', { exact: true }).fill('Research');
    const before = await body(page).count();
    await page.getByPlaceholder('Search').first().fill('Ada');
    await expect(body(page)).toHaveCount(1);
    expect(before).toBeGreaterThan(1);
  });

  test('filtering resets pagination to page 1 and updates the page count', async ({ page }) => {
    await page.locator('.inandu-grid-pagination').getByRole('button', { name: /Next page/ }).click();
    await expect(page.locator('.inandu-grid-pagination')).toContainText('Page 2');
    await page.getByLabel('Filter Team', { exact: true }).fill('Research');
    await expect(page.locator('.inandu-grid-pagination')).toContainText('Page 1 of 1');
  });

  test('shift-click adds a secondary sort and shows priorities', async ({ page }) => {
    await header(page, 'team').click();
    await header(page, 'name').click({ modifiers: ['Shift'] });
    await expect(header(page, 'team').locator('sup, .inandu-grid-sort-priority')).toHaveText('1');
    await expect(header(page, 'name').locator('sup, .inandu-grid-sort-priority')).toHaveText('2');
    const teams = await page.locator('tbody td[data-field="team"]').allTextContents();
    expect(teams).toEqual([...teams].sort());
  });
});

test.describe('localisation', () => {
  test('lang="es" translates the built-in chrome', async ({ page }) => {
    await page.goto('/#es');
    await expect(page.getByRole('button', { name: 'Exportar CSV' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agregar fila' })).toBeVisible();
    await expect(page.getByPlaceholder('Buscar').first()).toBeVisible();
    await page.getByPlaceholder('Buscar').first().fill('zzzz-no-match');
    await expect(page.getByText('Sin datos')).toBeVisible();
  });

  test('es validation messages are translated', async ({ page }) => {
    await page.goto('/#es');
    await page.getByRole('button', { name: 'Agregar fila' }).click();
    const draft = page.locator('tr.inandu-grid-new-row');
    await draft.getByRole('button', { name: 'Guardar' }).click();
    await expect(draft.locator('.inandu-grid-field-error')).toContainText('Este campo es obligatorio');
    await expect(draft.getByRole('button', { name: 'Cancelar' })).toBeVisible();
  });

});

test.describe('column layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#interactions');
  });

  test('dragging a header onto another reorders the columns', async ({ page }) => {
    expect(await fieldOrder(page)).toEqual(['name', 'team', 'role', 'salary', 'joined']);
    await header(page, 'role').dragTo(header(page, 'team'));
    expect(await fieldOrder(page)).toEqual(['name', 'role', 'team', 'salary', 'joined']);
  });

  test('dragging the resize handle widens the column', async ({ page }) => {
    const th = header(page, 'team');
    const before = (await th.boundingBox())!.width;
    const handle = th.locator('.inandu-grid-resize-handle');
    const hb = (await handle.boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2 + 80, hb.y + hb.height / 2, { steps: 6 });
    await page.mouse.up();
    const after = (await th.boundingBox())!.width;
    expect(after).toBeGreaterThan(before + 20);
  });

  test('double-clicking the handle autosizes to the content', async ({ page }) => {
    const th = header(page, 'team');
    const before = (await th.boundingBox())!.width;
    await th.locator('.inandu-grid-resize-handle').dblclick();
    const after = (await th.boundingBox())!.width;
    expect(after).toBeLessThan(before);
  });

  test('a column pinned left stays in view while the grid scrolls horizontally', async ({ page }) => {
    const scroller = page.locator('table.inandu-grid').locator('xpath=ancestor::*[contains(@style,"overflow") or self::div][1]');
    const nameCell = cellOf(body(page).first(), 'name');
    const before = (await nameCell.boundingBox())!.x;
    await page.locator('table.inandu-grid').evaluate(t => {
      let el: HTMLElement | null = t.parentElement;
      while (el && el.scrollWidth <= el.clientWidth) el = el.parentElement;
      (el ?? document.scrollingElement as HTMLElement).scrollLeft = 400;
    });
    const joined = cellOf(body(page).first(), 'joined');
    await expect.poll(async () => (await joined.boundingBox())!.x).toBeLessThan(before + 1500);
    const after = (await nameCell.boundingBox())!.x;
    expect(Math.abs(after - before)).toBeLessThan(2);
    void scroller;
  });
});

test.describe('row reorder', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#interactions');
  });

  test('each row exposes a drag handle', async ({ page }) => {
    await expect(page.locator('.inandu-grid-row-drag-handle')).toHaveCount(6);
  });

  test('dragging a row onto another reports the new order', async ({ page }) => {
    await page.locator('.inandu-grid-row-drag-handle').nth(0).dragTo(body(page).nth(3));
    const log = await page.getByTestId('log').textContent();
    expect(log).toMatch(/^order:/);
    expect(log).not.toBe('order:1,2,3,4,5,6');
    await expect(cellOf(body(page).first(), 'name')).not.toContainText('Ada Lovelace');
  });
});

test.describe('range selection and clipboard', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test.beforeEach(async ({ page }) => {
    await page.goto('/#interactions');
  });

  const readClipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText()).then(t => t.split(String.fromCharCode(13)).join(''));

  async function drag(page: Page, from: Locator, to: Locator) {
    const a = (await from.boundingBox())!;
    const b = (await to.boundingBox())!;
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
    await page.mouse.up();
  }

  test('dragging highlights a rectangle of cells', async ({ page }) => {
    await drag(page, cellOf(body(page).nth(0), 'name'), cellOf(body(page).nth(1), 'team'));
    await expect(page.locator('.inandu-cell-range-selected')).toHaveCount(4);
  });

  test('a plain click collapses the selection to one cell', async ({ page }) => {
    await drag(page, cellOf(body(page).nth(0), 'name'), cellOf(body(page).nth(1), 'team'));
    await cellOf(body(page).nth(3), 'role').click();
    await expect(page.locator('.inandu-cell-range-selected')).toHaveCount(1);
  });

  test('Ctrl+C copies the selected range as tab/newline separated text', async ({ page }) => {
    await drag(page, cellOf(body(page).nth(0), 'name'), cellOf(body(page).nth(1), 'team'));
    await page.keyboard.press('Control+C');
    await expect.poll(() => readClipboard(page)).toBe('Ada Lovelace\tResearch\nAlan Turing\tPlatform');
  });

  test('Ctrl+C on a single cell copies its formatted value', async ({ page }) => {
    await cellOf(body(page).nth(2), 'salary').click();
    await page.keyboard.press('Control+C');
    await expect.poll(() => readClipboard(page)).toMatch(/^\d[\d,.]*$/);
  });

  test('Ctrl+V pastes a clipboard matrix starting at the focused cell', async ({ page }) => {
    await page.evaluate(() => navigator.clipboard.writeText('Pasted One\nPasted Two'));
    await cellOf(body(page).nth(1), 'name').click();
    await page.keyboard.press('Control+V');
    await expect(page.getByTestId('log')).toHaveText(/^paste:\d+$/);
    await expect(cellOf(body(page).nth(1), 'name')).toContainText('Pasted One');
    await expect(cellOf(body(page).nth(2), 'name')).toContainText('Pasted Two');
  });
});
