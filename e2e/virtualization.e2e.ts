import { test, expect, type Page } from '@playwright/test';

/**
 * Virtual scroll under stress (10,000 rows, a fixed 40px row height): the keyboard keeps working across the window, programmatic scroll
 * lands where it should, quick filter changes leave a sane window, and a cell that had focus does not strand the keyboard user when it
 * scrolls out of the DOM and back.
 */
const rows = (page: Page) => page.locator('table.inandu-grid tbody tr[data-row-index]');
const idOf = async (page: Page, cell = page.locator('table.inandu-grid td:focus')) =>
  Number((await cell.locator('xpath=..').locator('td[data-field="id"]').first().textContent())!.replace(/[^\d]/g, ''));
const viewport = (page: Page) => page.locator('.inandu-grid-viewport');

test.beforeEach(async ({ page }) => {
  await page.goto('/#virtual');
  await expect(rows(page).first()).toBeVisible();
  await page.locator('table.inandu-grid td[data-field="id"]').first().focus();
});

test('arrow keys walk far past the first window and the focus stays on a cell', async ({ page }) => {
  for (let i = 0; i < 120; i += 1) await page.keyboard.press('ArrowDown');
  await expect(page.locator('table.inandu-grid td:focus')).toHaveCount(1);
  expect(await idOf(page)).toBe(121);
  expect(await rows(page).count()).toBeLessThan(100);
});

test('PageDown moves ten rows each time, over and over, without losing the focus', async ({ page }) => {
  const first = await idOf(page);
  for (let i = 0; i < 25; i += 1) await page.keyboard.press('PageDown');
  await expect(page.locator('table.inandu-grid td:focus')).toHaveCount(1);
  expect(await idOf(page)).toBe(first + 250);
});

test('ArrowUp walks back to the top', async ({ page }) => {
  for (let i = 0; i < 60; i += 1) await page.keyboard.press('ArrowDown');
  for (let i = 0; i < 60; i += 1) await page.keyboard.press('ArrowUp');
  expect(await idOf(page)).toBe(1);
});

test('scrolling programmatically to the very end shows the last row', async ({ page }) => {
  await viewport(page).evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect(page.locator('table.inandu-grid td[data-field="id"]').last()).toHaveText(/10[,.]?000/);
  expect(await rows(page).count()).toBeLessThan(100);
});

test('scrolling to the middle and back keeps the window consistent (no gaps, no duplicates)', async ({ page }) => {
  for (const top of [40 * 5000, 40 * 9990, 0, 40 * 123]) {
    await viewport(page).evaluate((el, t) => { el.scrollTop = t; }, top);
    await expect.poll(async () => {
      const ids = (await page.locator('table.inandu-grid td[data-field="id"]').allTextContents()).map(v => Number(v.replace(/[^\d]/g, '')));
      return ids.length > 0 && ids.every((v, i) => i === 0 || v === ids[i - 1] + 1);
    }).toBe(true);
  }
});

test('a burst of filter changes ends on the right rows and a bounded window', async ({ page }) => {
  const search = page.getByPlaceholder('Search').first();
  await viewport(page).evaluate(el => { el.scrollTop = 40 * 4000; });
  for (const text of ['A', 'Ad', 'Ada', 'Ad', 'Ada L', 'zzzz', '', 'Ada Lovelace']) await search.fill(text);
  await expect(rows(page).first()).toContainText('Ada');
  expect(await rows(page).count()).toBeLessThan(100);
  await search.fill('');
  await expect.poll(() => rows(page).count()).toBeGreaterThan(0);
  expect(await rows(page).count()).toBeLessThan(100);
});

test('a filter with no match shows the empty state and clearing it restores the window at the top', async ({ page }) => {
  const search = page.getByPlaceholder('Search').first();
  await viewport(page).evaluate(el => { el.scrollTop = 40 * 4000; });
  await search.fill('no such person');
  await expect(rows(page)).toHaveCount(0);
  await search.fill('');
  await expect(rows(page).first()).toBeVisible();
  expect(await viewport(page).evaluate(el => el.scrollTop)).toBeLessThan(40 * 4000);
});

test.describe('focus and the virtual window', () => {
  test('focus is not dropped when its row scrolls out of the window: it waits on the grid and returns to the cell', async ({ page }) => {
    const grid = page.locator('table.inandu-grid');
    await expect(grid.locator('td:focus')).toHaveCount(1);
    await viewport(page).evaluate(el => { el.scrollTop = 40 * 5000; });
    await expect.poll(async () => Number((await grid.locator('td[data-field="id"]').first().textContent())!.replace(/[^\d]/g, ''))).toBeGreaterThan(4900);
    // The row that had focus is no longer in the DOM; focus must not have fallen back to <body> (where Tab restarts from the top of the page).
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
    expect(await page.evaluate(() => !!document.activeElement?.closest('.inandu-grid-viewport') || document.activeElement?.classList.contains('inandu-grid-viewport'))).toBe(true);
    await viewport(page).evaluate(el => { el.scrollTop = 0; });
    await expect(grid.locator('td:focus')).toHaveCount(1); // back on the cell it had
    expect(await idOf(page)).toBe(1);
  });

  test('Ctrl+End goes to the last row of the data, not just the last mounted one', async ({ page }) => {
    await page.keyboard.press('Control+End');
    await expect.poll(() => idOf(page).catch(() => 0)).toBe(10000);
  });

  test('after Ctrl+End, ArrowUp walks back through the rows above', async ({ page }) => {
    await page.keyboard.press('Control+End');
    await expect.poll(() => idOf(page).catch(() => 0)).toBe(10000);
    for (let i = 0; i < 15; i += 1) await page.keyboard.press('ArrowUp');
    expect(await idOf(page)).toBe(9985);
  });

  test('Ctrl+Home goes to the header, as it does without virtualization', async ({ page }) => {
    for (let i = 0; i < 80; i += 1) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Control+Home');
    await expect(page.locator('table.inandu-grid th:focus')).toHaveCount(1);
  });
});
