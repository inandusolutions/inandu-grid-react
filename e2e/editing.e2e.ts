import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#editing');
});

const rows = (page: import('@playwright/test').Page) => page.locator('table.inandu-grid tbody tr:not(.inandu-grid-new-row)');

test('creating a row validates required and min before accepting it', async ({ page }) => {
  await page.getByRole('button', { name: 'Add row' }).click();
  const draft = page.locator('tr.inandu-grid-new-row');
  await expect(draft).toBeVisible();

  // Empty: Name is required.
  await draft.getByRole('button', { name: 'Save' }).click();
  await expect(draft.locator('.inandu-grid-field-error')).toContainText('This field is required');

  // Valid Name, negative Salary: min 0.
  await draft.locator('input[type=text]').first().fill('Widget E2E');
  await draft.locator('input[type=number]').fill('-5');
  await draft.getByRole('button', { name: 'Save' }).click();
  await expect(draft.locator('.inandu-grid-field-error')).toContainText('Must be at least 0');

  // Valid Salary: created.
  await draft.locator('input[type=number]').fill('100');
  await draft.getByRole('button', { name: 'Save' }).click();
  await expect(draft).toHaveCount(0);
  await expect(rows(page).filter({ hasText: 'Widget E2E' })).toHaveCount(1);
  await expect(page.getByTestId('log')).toHaveText('created:Widget E2E');
});

test('cancelling a new row discards it', async ({ page }) => {
  const before = await rows(page).count();
  await page.getByRole('button', { name: 'Add row' }).click();
  await page.locator('tr.inandu-grid-new-row').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('tr.inandu-grid-new-row')).toHaveCount(0);
  await expect(rows(page)).toHaveCount(before);
  await expect(page.getByRole('button', { name: 'Add row' })).toBeVisible();
});

test('editing a row saves the new value', async ({ page }) => {
  const row = rows(page).first();
  await row.getByRole('button', { name: 'Edit' }).click();
  const name = row.locator('input[type=text]').first();
  await name.fill('Ada Renamed');
  await row.getByRole('button', { name: 'Save' }).click();
  await expect(rows(page).first()).toContainText('Ada Renamed');
  await expect(page.getByTestId('log')).toHaveText('saved:Ada Renamed');
});

test('editing validates required on save and cancel restores the original', async ({ page }) => {
  const row = rows(page).first();
  await row.getByRole('button', { name: 'Edit' }).click();
  await row.locator('input[type=text]').first().fill('');
  await row.getByRole('button', { name: 'Save' }).click();
  await expect(row.locator('.inandu-grid-field-error')).toContainText('This field is required');
  await row.getByRole('button', { name: 'Cancel' }).click();
  await expect(rows(page).first()).toContainText('Ada Lovelace');
});

test('only one row can be edited at a time', async ({ page }) => {
  await rows(page).nth(0).getByRole('button', { name: 'Edit' }).click();
  await expect(rows(page).nth(1).getByRole('button', { name: 'Edit' })).toBeDisabled();
  await expect(rows(page).nth(1).getByRole('button', { name: 'Delete' })).toBeDisabled();
});

test('deleting a row removes it', async ({ page }) => {
  const before = await rows(page).count();
  await rows(page).first().getByRole('button', { name: 'Delete' }).click();
  await expect(rows(page)).toHaveCount(before - 1);
  await expect(rows(page).filter({ hasText: 'Ada Lovelace' })).toHaveCount(0);
  await expect(page.getByTestId('log')).toHaveText('deleted:Ada Lovelace');
});
