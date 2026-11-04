import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * axe-core over the basics grid (selectable, sortable, with a totals footer) for the structural /
 * ARIA rules the grid is responsible for. Colour contrast is left out on purpose: it depends on the
 * theme a consumer picks, not on the grid's markup.
 */
const RULES = [
  'aria-allowed-attr',
  'aria-required-attr',
  'aria-required-children',
  'aria-required-parent',
  'aria-valid-attr',
  'aria-valid-attr-value',
  'aria-roles',
  'aria-hidden-focus',
  'button-name',
  'label',
  'scope-attr-valid',
  'th-has-data-cells',
  'td-headers-attr',
  'duplicate-id-aria',
];

test.beforeEach(async ({ page }) => {
  await page.goto('/#basics');
  await expect(page.locator('table.inandu-grid tbody tr').first()).toBeVisible();
});

test('the basics grid has no ARIA or structure violations', async ({ page }) => {
  const results = await new AxeBuilder({ page }).include('table.inandu-grid').withRules(RULES).analyze();
  expect(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target.join(' ')).slice(0, 3) }))).toEqual([]);
});

test('sorting exposes aria-sort', async ({ page }) => {
  const name = page.locator('th[data-field="name"]');
  await expect(name).toHaveAttribute('aria-sort', 'none');
  await name.click();
  await expect(name).toHaveAttribute('aria-sort', 'ascending');
  await name.click();
  await expect(name).toHaveAttribute('aria-sort', 'descending');
});

test('selecting a row exposes aria-selected', async ({ page }) => {
  const row = page.locator('table.inandu-grid tbody tr[aria-selected]').first();
  await expect(row).toHaveAttribute('aria-selected', 'false');
  await row.locator('input[type="checkbox"]').check();
  await expect(row).toHaveAttribute('aria-selected', 'true');
});
