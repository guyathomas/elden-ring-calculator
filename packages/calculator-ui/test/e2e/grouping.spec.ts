import { test, expect, Page } from '@playwright/test';

// Helper to wait for app to fully load (weapons displayed)
async function waitForAppLoad(page: Page) {
  // Wait for loading to complete
  await expect(page.getByText('Loading weapon data...')).not.toBeVisible({ timeout: 30000 });
  // Wait for weapons table to be populated
  await expect(page.getByText('Uchigatana').first()).toBeVisible({ timeout: 10000 });
}

// Helper to get the desktop sidebar
function getSidebar(page: Page) {
  return page.locator('.hidden.lg\\:block').first();
}

test.describe('Weapon Grouping', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);
  });

  test('should display group by dropdown with no grouping by default', async ({ page }) => {
    const sidebar = getSidebar(page);

    // Verify the group by dropdown exists and defaults to "No grouping"
    const groupBySelect = sidebar.locator('label:has-text("Group by:")').locator('..').locator('select');
    await expect(groupBySelect).toBeVisible();
    await expect(groupBySelect).toHaveValue('none');
  });

  test('should not crash when changing to weapon type grouping', async ({ page }) => {
    const sidebar = getSidebar(page);
    const groupBySelect = sidebar.locator('label:has-text("Group by:")').locator('..').locator('select');

    // Change to weapon type grouping - this would crash before the fix
    await groupBySelect.selectOption('weapon-type');

    // Wait for the UI to update
    await page.waitForTimeout(500);

    // Verify app didn't crash - table should still be visible
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Verify weapons are still displayed (flat list sorted by category)
    await expect(page.getByText('Uchigatana').first()).toBeVisible({ timeout: 5000 });
  });

  test('should not crash when changing to affinity grouping', async ({ page }) => {
    const sidebar = getSidebar(page);
    const groupBySelect = sidebar.locator('label:has-text("Group by:")').locator('..').locator('select');

    // Change to affinity grouping
    await groupBySelect.selectOption('affinity');
    await page.waitForTimeout(500);

    // Verify app didn't crash - table should still be visible
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Verify weapons are still displayed (flat list sorted by affinity)
    await expect(page.getByText('Uchigatana').first()).toBeVisible({ timeout: 5000 });
  });

  test('should not crash when changing to weapon grouping', async ({ page }) => {
    const sidebar = getSidebar(page);
    const groupBySelect = sidebar.locator('label:has-text("Group by:")').locator('..').locator('select');

    // Change to weapon grouping
    await groupBySelect.selectOption('weapon');
    await page.waitForTimeout(500);

    // Verify app didn't crash - table should still be visible
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Verify weapons are still displayed (flat list sorted by weapon name)
    await expect(page.getByText('Uchigatana').first()).toBeVisible({ timeout: 5000 });
  });

  test('should switch between grouping modes without crashing', async ({ page }) => {
    const sidebar = getSidebar(page);
    const groupBySelect = sidebar.locator('label:has-text("Group by:")').locator('..').locator('select');
    const table = page.locator('table');

    // Cycle through all grouping modes
    await groupBySelect.selectOption('weapon-type');
    await page.waitForTimeout(300);
    await expect(table).toBeVisible();

    await groupBySelect.selectOption('affinity');
    await page.waitForTimeout(300);
    await expect(table).toBeVisible();

    await groupBySelect.selectOption('weapon');
    await page.waitForTimeout(300);
    await expect(table).toBeVisible();

    await groupBySelect.selectOption('none');
    await page.waitForTimeout(300);
    await expect(table).toBeVisible();

    // Table should still be functional
    await expect(page.getByText('Uchigatana').first()).toBeVisible();
  });
});
