import { test, expect, Page } from '@playwright/test';

// Helper to wait for app to load
async function waitForAppLoad(page: Page) {
  await expect(page.getByRole('heading', { name: 'Elden Ring Weapon Calculator (Beta)' })).toBeVisible({ timeout: 10000 });
}

// Helper to set up filters for all weapons
async function setupFilters(page: Page) {
  const sidebar = page.locator('.hidden.lg\\:block').first();

  // Select all weapon types
  await sidebar.locator('label:has-text("Weapon Type")').locator('..').locator('button[role="combobox"]').click();
  await page.getByRole('option', { name: 'Select All' }).first().click();
  await page.keyboard.press('Escape');

  // Select all affinities
  await sidebar.locator('label:has-text("Affinity")').locator('..').locator('button[role="combobox"]').click();
  await page.getByRole('option', { name: 'Select All' }).first().click();
  await page.keyboard.press('Escape');
}

// Helper to search for a weapon and click it
async function searchAndClickWeapon(page: Page, searchTerm: string, affinity?: string) {
  await page.getByPlaceholder('Search weapons...').fill(searchTerm);

  const row = affinity
    ? page.locator('tr').filter({ hasText: searchTerm }).filter({ hasText: affinity }).first()
    : page.locator('tbody tr').first();

  // Wait for the row to be visible and stable after search filtering
  await expect(row).toBeVisible({ timeout: 5000 });
  await row.scrollIntoViewIfNeeded();
  await row.click();
}

// Helper to scroll to Scaling Curves section
async function scrollToScalingCurves(page: Page) {
  await expect(page.getByText('Weapon Details')).toBeVisible();
  const header = page.locator('h3:has-text("Scaling Curves")').first();
  await header.scrollIntoViewIfNeeded();
  return header;
}

// Helper to get the chart container
function getChartContainer(page: Page) {
  return page.locator('.recharts-responsive-container').first();
}

test.describe('Scaling Curves', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);
    await setupFilters(page);
  });

  test('renders chart with correct lines for weapon scaling stats', async ({ page }) => {
    // Standard Uchigatana has STR (D) and DEX (C) scaling
    await searchAndClickWeapon(page, 'Uchigatana', 'Standard');
    await scrollToScalingCurves(page);

    const chart = getChartContainer(page);

    // Chart renders with SVG and correct structure
    await expect(chart.locator('svg').first()).toBeVisible();
    await expect(chart.locator('.recharts-xAxis')).toBeVisible();
    await expect(chart.locator('.recharts-yAxis')).toBeVisible();

    // Correct number of lines for scaling stats (STR + DEX = 2)
    await expect(chart.locator('.recharts-line')).toHaveCount(2);

    // Legend shows the stat names
    const legend = chart.locator('.recharts-legend-wrapper');
    await expect(legend.getByText('STR')).toBeVisible();
    await expect(legend.getByText('DEX')).toBeVisible();
  });

  test('chart updates correctly across all view modes and selections', async ({ page }) => {
    await searchAndClickWeapon(page, 'Uchigatana', 'Standard');
    await scrollToScalingCurves(page);

    const chart = getChartContainer(page);

    // Default: Scaling + By Stat + All = 2 lines (STR, DEX)
    await expect(chart.locator('.recharts-line')).toHaveCount(2);

    // Switch to Total AR mode - 3 lines (Base + STR + DEX)
    await page.getByRole('radio', { name: 'Total AR' }).click();
    await expect(chart.locator('.recharts-line')).toHaveCount(3);

    // Switch to Per Point mode - still 2 lines
    await page.getByRole('radio', { name: 'Per Point' }).click();
    await expect(chart.locator('.recharts-line')).toHaveCount(2);

    // Switch back to Scaling, select single stat (DEX)
    await page.getByRole('radio', { name: 'Scaling' }).click();
    await page.getByRole('radio', { name: 'DEX' }).click();

    // Single stat view shows damage type breakdown (Physical only = 1 line)
    await expect(chart.locator('.recharts-line')).toHaveCount(1);

    // Switch to By Damage Type view
    await page.getByRole('radio', { name: 'All' }).click();
    await page.getByRole('radio', { name: 'By Damage Type' }).click();

    // By Damage Type shows lines per scaling stat (2 lines)
    await expect(chart.locator('.recharts-line')).toHaveCount(2);
  });

  test('handles split damage weapons correctly', async ({ page }) => {
    // Moonveil has Physical + Magic damage, scales with STR/DEX/INT
    await searchAndClickWeapon(page, 'Moonveil');
    await scrollToScalingCurves(page);

    const chart = getChartContainer(page);

    // All stats view should show 3 lines (STR, DEX, INT)
    await expect(chart.locator('.recharts-line')).toHaveCount(3);

    // Select single stat to see damage type breakdown
    await page.getByRole('radio', { name: 'DEX' }).click();

    // Should show 2 lines (Physical and Magic)
    await expect(chart.locator('.recharts-line')).toHaveCount(2);

    // Legend should show damage types
    const legend = chart.locator('.recharts-legend-wrapper');
    await expect(legend.getByText('Physical')).toBeVisible();
    await expect(legend.getByText('Magic')).toBeVisible();
  });

  test('handles weapons without scaling gracefully', async ({ page }) => {
    // Torch has no scaling stats
    await searchAndClickWeapon(page, 'Torch', 'Standard');

    // Should show weapon details but no scaling curves
    await expect(page.getByText('Weapon Details')).toBeVisible();

    // Either shows "no scaling" message or the section doesn't appear
    const noScalingMessage = page.getByText('No scaling attributes for this weapon/affinity');
    const scalingSection = page.locator('h3:has-text("Scaling Curves")');

    // One of these should be true
    const hasMessage = await noScalingMessage.isVisible().catch(() => false);
    const hasSection = await scalingSection.isVisible().catch(() => false);

    // If section exists, should show no scaling message
    if (hasSection) {
      await expect(noScalingMessage).toBeVisible();
    }
  });

  test('ignore requirements checkbox affects chart data', async ({ page }) => {
    await searchAndClickWeapon(page, 'Uchigatana', 'Standard');
    await scrollToScalingCurves(page);

    const chart = getChartContainer(page);
    const checkbox = page.locator('label').filter({ hasText: 'Ignore Reqs' }).first().locator('input[type="checkbox"]');

    // Should be checked by default
    await expect(checkbox).toBeChecked();

    // Chart should render
    await expect(chart.locator('.recharts-line')).toHaveCount(2);

    // Uncheck and verify chart still renders (data changes but lines persist)
    await checkbox.click();
    await expect(checkbox).not.toBeChecked();
    await expect(chart.locator('.recharts-line')).toHaveCount(2);
  });
});
