import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#basics');
});

const dataRows = (page: import('@playwright/test').Page) => page.locator('table.inandu-grid tbody tr:not(.inandu-grid-group-row)');
// selectable adds a leading checkbox column: Name is cell 1.
const nameCell = (row: import('@playwright/test').Locator) => row.locator('td').nth(1);

test('renders header, 8 data rows and the totals footer', async ({ page }) => {
  await expect(page.locator('table.inandu-grid thead th').filter({ hasText: 'Name' })).toBeVisible();
  await expect(dataRows(page)).toHaveCount(8);
  await expect(page.locator('tfoot .inandu-grid-totals-row')).toBeVisible();
});

test('formats number, date and boolean cells', async ({ page }) => {
  const first = dataRows(page).first();
  await expect(first).toContainText('Ada Lovelace');
  await expect(first).toContainText('90,000'); // number 1.0-0
  await expect(first).toContainText(/\d{2}\/\d{2}\/\d{4}/); // date DD/MM/YYYY
  await expect(first).toContainText('No'); // boolean Yes|No (index 0 is inactive)
});

test('sorting toggles ascending then descending', async ({ page }) => {
  const sort = page.locator('th[data-field="name"]');
  await sort.click();
  const asc = await nameCell(dataRows(page).first()).textContent();
  await sort.click();
  const desc = await nameCell(dataRows(page).first()).textContent();
  expect(asc).toBe('Ada Lovelace');
  expect(desc).not.toBe(asc);
});

test('descending sort puts the alphabetically last name first', async ({ page }) => {
  const sort = page.locator('th[data-field="name"]');
  await sort.click();
  await sort.click();
  await expect(nameCell(dataRows(page).first())).toHaveText('Vint Cerf');
});

test('numeric sort orders by value, not text', async ({ page }) => {
  const sort = page.locator('th[data-field="salary"]');
  await sort.click();
  const values = await dataRows(page).locator('td:nth-child(5)').allTextContents();
  const nums = values.map(v => Number(v.replace(/[^\d]/g, '')));
  expect(nums).toEqual([...nums].sort((a, b) => a - b));
});

test('search narrows rows and clearing it restores them', async ({ page }) => {
  const search = page.getByPlaceholder('Search').first();
  await search.fill('Turing');
  await expect(dataRows(page)).toHaveCount(1);
  await expect(dataRows(page).first()).toContainText('Alan Turing');
  await search.fill('');
  await expect(dataRows(page)).toHaveCount(8);
});

test('search with no match shows the empty state', async ({ page }) => {
  await page.getByPlaceholder('Search').first().fill('zzzz-no-match');
  await expect(page.getByText('No data')).toBeVisible();
});

test('pagination moves between pages and disables the edges', async ({ page }) => {
  const pager = page.locator('.inandu-grid-pagination');
  const prev = pager.getByRole('button', { name: /Previous page/ });
  const next = pager.getByRole('button', { name: /Next page/ });
  await expect(pager).toContainText('Page 1 of 3');
  await expect(prev).toBeDisabled();
  await next.click();
  await expect(pager).toContainText('Page 2 of 3');
  await next.click();
  await expect(pager).toContainText('Page 3 of 3');
  await expect(dataRows(page)).toHaveCount(4);
  await expect(next).toBeDisabled();
  await prev.click();
  await expect(pager).toContainText('Page 2 of 3');
});

test('select-all checks every row of the page; single toggle unchecks one', async ({ page }) => {
  await page.getByLabel('Select all rows').check();
  await expect(page.locator('tbody input[type=checkbox]:checked')).toHaveCount(8);
  await page.getByLabel('Select row 1').uncheck();
  await expect(page.locator('tbody input[type=checkbox]:checked')).toHaveCount(7);
});

test('column toggle hides and restores a column', async ({ page }) => {
  const header = page.locator('table.inandu-grid thead tr').first();
  await expect(header.getByText('Team', { exact: true })).toBeVisible();
  await page.locator('.inandu-grid-column-toggle summary').click();
  await page.getByLabel('Toggle Team').uncheck();
  await expect(header.getByText('Team', { exact: true })).toHaveCount(0);
  await page.getByLabel('Toggle Team').check();
  await expect(header.getByText('Team', { exact: true })).toBeVisible();
});

test('group-by groups rows under a header with a count', async ({ page }) => {
  await page.getByLabel('Group by').selectOption('team');
  await expect(page.locator('.inandu-grid-group-row')).toHaveCount(5);
  await expect(page.locator('.inandu-grid-group-row').first()).toContainText('(4)');
  await page.getByLabel('Group by').selectOption('');
  await expect(page.locator('.inandu-grid-group-row')).toHaveCount(0);
});

test('CSV export triggers a download with the rows', async ({ page }) => {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
});
