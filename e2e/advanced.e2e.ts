import { test, expect } from '@playwright/test';

test.describe('tree data', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#tree');
  });

  const bodyRows = (page: import('@playwright/test').Page) => page.locator('table.inandu-grid tbody tr');

  test('expanding a node reveals its children, collapsing hides them', async ({ page }) => {
    const initial = await bodyRows(page).count();
    const hopper = bodyRows(page).filter({ hasText: 'Grace Hopper' });
    await hopper.locator('.inandu-grid-tree-toggle').click();
    await expect(bodyRows(page).filter({ hasText: 'Ada Lovelace' })).toHaveCount(1);
    await expect(bodyRows(page).filter({ hasText: 'Alan Turing' })).toHaveCount(1);
    expect(await bodyRows(page).count()).toBeGreaterThan(initial);
    await hopper.locator('.inandu-grid-tree-toggle').click();
    await expect(bodyRows(page).filter({ hasText: 'Ada Lovelace' })).toHaveCount(0);
  });

  test('nested levels expand independently', async ({ page }) => {
    await bodyRows(page).filter({ hasText: 'Grace Hopper' }).locator('.inandu-grid-tree-toggle').click();
    await bodyRows(page).filter({ hasText: 'Ada Lovelace' }).locator('.inandu-grid-tree-toggle').click();
    await expect(bodyRows(page).filter({ hasText: 'Researcher 1' })).toHaveCount(1);
    await expect(bodyRows(page).filter({ hasText: 'Platform Eng 1' })).toHaveCount(0);
  });
});

test.describe('virtual scroll (10,000 rows)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#virtual');
  });

  test('keeps only a small window of rows in the DOM', async ({ page }) => {
    const count = await page.locator('table.inandu-grid tbody tr').count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(100);
  });

  test('scrolling swaps the rendered window', async ({ page }) => {
    const viewport = page.locator('.inandu-grid-viewport');
    await expect(page.locator('table.inandu-grid tbody')).toContainText('Ada');
    await viewport.evaluate(el => { el.scrollTop = 40 * 5000; });
    await expect.poll(async () => {
      const ids = await page.locator('table.inandu-grid tbody td[data-field="id"]').allTextContents();
      return ids.length > 0 && ids.every(v => Number(v.replace(/[^\d]/g, '')) > 4900);
    }).toBe(true);
    const count = await page.locator('table.inandu-grid tbody tr').count();
    expect(count).toBeLessThan(100);
  });

  test('search still works over all 10,000 rows', async ({ page }) => {
    await page.getByPlaceholder('Search').first().fill('Ada Lovelace');
    await expect(page.locator('table.inandu-grid tbody tr').first()).toContainText('Ada');
    const count = await page.locator('table.inandu-grid tbody tr').count();
    expect(count).toBeLessThan(100);
  });
});

test.describe('custom cells and master/detail', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#detail');
  });

  test('renderCell output replaces the plain text', async ({ page }) => {
    await expect(page.getByTestId('pill')).toHaveCount(8);
  });

  test('expanding a row shows its detail and collapsing hides it', async ({ page }) => {
    await expect(page.getByTestId('detail')).toHaveCount(0);
    await page.getByRole('button', { name: 'Expand row details' }).first().click();
    await expect(page.getByTestId('detail')).toHaveCount(1);
    await expect(page.getByTestId('detail')).toContainText('Order #1');
    await page.getByRole('button', { name: 'Collapse row details' }).first().click();
    await expect(page.getByTestId('detail')).toHaveCount(0);
  });
});
