import { test, expect, Page } from '@playwright/test';

// Helper to wait for app to load
async function waitForAppLoad(page: Page) {
  await expect(page.getByRole('heading', { name: 'Elden Ring Weapon Calculator (Beta)' })).toBeVisible({ timeout: 10000 });
}

test.describe('Filter Popover', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);
  });

  test('should keep popover open when typing in range filter input', async ({ page }) => {
    // Find a filter icon in the table header - look for the Weight column filter
    // The filter icons are small Filter icons (lucide) next to column headers
    const weightHeader = page.locator('th').filter({ hasText: 'Weight' });

    // Click the filter icon within the Weight header
    const filterButton = weightHeader.locator('button').filter({ has: page.locator('svg') });
    await filterButton.click();

    // Wait for popover to open - it should show "Filter" label and Min/Max inputs
    const popover = page.locator('[data-slot="popover-content"]');
    await expect(popover).toBeVisible({ timeout: 2000 });
    await expect(popover.getByText('Filter')).toBeVisible();

    // Find the Min input field
    const minInput = popover.locator('input[type="number"]').first();
    await expect(minInput).toBeVisible();

    // Type a value - this is where the bug occurs
    // The popover closes after typing the first character
    await minInput.fill('3');

    // The popover should still be open after typing
    await expect(popover).toBeVisible({ timeout: 1000 });

    // Continue typing to simulate entering "30"
    await minInput.fill('30');

    // Popover should still be open
    await expect(popover).toBeVisible({ timeout: 1000 });
  });

  test('should keep popover open when typing causes table to re-filter', async ({ page }) => {
    // This test specifically checks if the popover survives a table rerender

    // Find the Total AR column filter (this will definitely cause filtering)
    const totalARHeader = page.locator('th').filter({ hasText: 'Total' }).first();
    const filterButton = totalARHeader.locator('button').filter({ has: page.locator('svg') });
    await filterButton.click();

    // Wait for popover
    const popover = page.locator('[data-slot="popover-content"]');
    await expect(popover).toBeVisible({ timeout: 2000 });

    // Get initial row count
    const initialRowCount = await page.locator('tbody tr').count();

    // Type a high minimum value that will filter out most weapons
    const minInput = popover.locator('input[type="number"]').first();
    await minInput.focus();

    // Type character by character to simulate real user input
    await minInput.pressSequentially('500', { delay: 100 });

    // Wait a moment for the filter to apply
    await page.waitForTimeout(500);

    // Check that filtering actually happened (fewer rows)
    const newRowCount = await page.locator('tbody tr').count();
    expect(newRowCount).toBeLessThan(initialRowCount);

    // Most importantly: the popover should still be open!
    await expect(popover).toBeVisible();
  });

  test('should allow closing popover by clicking outside', async ({ page }) => {
    // Find and open a filter
    const weightHeader = page.locator('th').filter({ hasText: 'Weight' });
    const filterButton = weightHeader.locator('button').filter({ has: page.locator('svg') });
    await filterButton.click();

    const popover = page.locator('[data-slot="popover-content"]');
    await expect(popover).toBeVisible({ timeout: 2000 });

    // Click outside the popover to close it
    await page.mouse.click(10, 10);

    // Popover should close
    await expect(popover).not.toBeVisible({ timeout: 2000 });
  });

  test('should allow closing popover with Escape key', async ({ page }) => {
    // Find and open a filter
    const weightHeader = page.locator('th').filter({ hasText: 'Weight' });
    const filterButton = weightHeader.locator('button').filter({ has: page.locator('svg') });
    await filterButton.click();

    const popover = page.locator('[data-slot="popover-content"]');
    await expect(popover).toBeVisible({ timeout: 2000 });

    // Press Escape to close
    await page.keyboard.press('Escape');

    // Popover should close
    await expect(popover).not.toBeVisible({ timeout: 2000 });
  });
});
