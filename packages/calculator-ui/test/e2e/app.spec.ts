import { test, expect, Page } from '@playwright/test';

// Helper to wait for app to load
async function waitForAppLoad(page: Page) {
  await expect(page.getByRole('heading', { name: 'Elden Ring Weapon Calculator (Beta)' })).toBeVisible({ timeout: 10000 });
}

// Helper to set up filters for a specific weapon type and affinity
async function setupFilters(page: Page, weaponType: string, affinity?: string) {
  // Find the desktop sidebar (hidden lg:block means it's visible on lg+ screens)
  const sidebar = page.locator('.hidden.lg\\:block').first();

  // Open Weapon Type dropdown and select the type
  // Find the button under "Weapon Type" label
  const typeSection = sidebar.locator('label:has-text("Weapon Type")').locator('..');
  const typeButton = typeSection.locator('button[role="combobox"]');
  await typeButton.click();

  // Wait for popover to open
  await page.waitForTimeout(100);

  // First click "Select All" to select everything, making all weapon types visible
  const selectAllType = page.getByRole('option', { name: 'Select All' }).first();
  await selectAllType.click();

  // Close the popover by clicking elsewhere
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);

  // Now open Affinity dropdown and select all affinities too
  if (affinity) {
    const affinitySection = sidebar.locator('label:has-text("Affinity")').locator('..');
    const affinityButton = affinitySection.locator('button[role="combobox"]');
    await affinityButton.click();

    await page.waitForTimeout(100);

    // Select All affinities
    const selectAllAffinity = page.getByRole('option', { name: 'Select All' }).first();
    await selectAllAffinity.click();

    await page.keyboard.press('Escape');
  }

  await page.waitForTimeout(300);
}

// Helper to search for a weapon and click the first matching row
async function searchAndClickWeapon(page: Page, searchTerm: string, affinity?: string) {
  // Type in search box to filter weapons
  const searchBox = page.getByPlaceholder('Search weapons...');
  await searchBox.fill(searchTerm);

  // Wait for results to filter
  await page.waitForTimeout(300);

  // Find and click the row
  let row;
  if (affinity) {
    row = page.locator('tr').filter({ hasText: searchTerm }).filter({ hasText: affinity }).first();
  } else {
    row = page.locator('tbody tr').first();
  }
  await row.scrollIntoViewIfNeeded();
  await row.click();
}

test.describe('App Loading', () => {
  test('should load the application and display the title', async ({ page }) => {
    await page.goto('/');

    // Check page title
    await expect(page).toHaveTitle('Elden Ring Weapon Calculator (Beta)');

    // Check main heading is visible
    await expect(page.getByRole('heading', { name: 'Elden Ring Weapon Calculator (Beta)' })).toBeVisible();
  });

  test('should show loading state then load weapon data', async ({ page }) => {
    await page.goto('/');

    // Wait for loading to complete (loading text should disappear)
    await expect(page.getByText('Loading weapon data...')).not.toBeVisible({ timeout: 10000 });

    // After loading, the main heading should be visible
    await expect(page.getByRole('heading', { name: 'Elden Ring Weapon Calculator (Beta)' })).toBeVisible();
  });

  test('should display weapon list after loading', async ({ page }) => {
    await page.goto('/');

    // Wait for weapons to load
    await expect(page.getByText('Uchigatana').first()).toBeVisible({ timeout: 10000 });
  });

  test('should display stat input panel with stat labels', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Check stat inputs are present
    await expect(page.getByText('STR').first()).toBeVisible();
    await expect(page.getByText('DEX').first()).toBeVisible();
  });

  test('should not show error state on successful load', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Error message should not be visible
    await expect(page.getByText('Error loading data')).not.toBeVisible();
  });
});

test.describe('Weapon Detail Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);
    // Select all weapon types and affinities to ensure all weapons are visible
    await setupFilters(page, 'all', 'all');
  });

  // Uchigatana - Standard (physical only, DEX scaling)
  test('should open weapon details for Uchigatana Standard', async ({ page }) => {
    await searchAndClickWeapon(page, 'Uchigatana', 'Standard');

    // Verify detail panel opens
    await expect(page.getByText('Weapon Details')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Uchigatana' })).toBeVisible();
    await expect(page.getByText('Attack Rating').first()).toBeVisible();
  });

  // Uchigatana - Flame Art (fire damage, FAI scaling)
  test('should open weapon details for Uchigatana Flame Art', async ({ page }) => {
    await searchAndClickWeapon(page, 'Uchigatana', 'Flame Art');

    await expect(page.getByText('Weapon Details')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Uchigatana' })).toBeVisible();
    await expect(page.getByText('Flame Art').first()).toBeVisible();
  });

  // Uchigatana - Cold (frost/magic, INT scaling)
  test('should open weapon details for Uchigatana Cold', async ({ page }) => {
    await searchAndClickWeapon(page, 'Uchigatana', 'Cold');

    await expect(page.getByText('Weapon Details')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Uchigatana' })).toBeVisible();
    await expect(page.getByText('Cold').first()).toBeVisible();
  });

  // Greatsword - Heavy (STR scaling, colossal weapon)
  test('should open weapon details for Greatsword Heavy', async ({ page }) => {
    await searchAndClickWeapon(page, 'Greatsword', 'Heavy');

    await expect(page.getByText('Weapon Details')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Greatsword' })).toBeVisible();
    await expect(page.getByText('Heavy').first()).toBeVisible();
    await expect(page.getByText('Colossal Sword').first()).toBeVisible();
  });

  // Moonveil - Unique weapon (magic katana, INT scaling)
  test('should open weapon details for Moonveil', async ({ page }) => {
    await searchAndClickWeapon(page, 'Moonveil');

    await expect(page.getByText('Weapon Details')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Moonveil' })).toBeVisible();
    await expect(page.getByText('Katana').first()).toBeVisible();
  });

  // Rivers of Blood - Unique weapon (bleed/arcane)
  test('should open weapon details for Rivers of Blood', async ({ page }) => {
    await searchAndClickWeapon(page, 'Rivers of Blood');

    await expect(page.getByText('Weapon Details')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Rivers of Blood' })).toBeVisible();
  });

  // Blasphemous Blade - Unique greatsword (fire, FAI)
  test('should open weapon details for Blasphemous Blade', async ({ page }) => {
    await searchAndClickWeapon(page, 'Blasphemous Blade');

    await expect(page.getByText('Weapon Details')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Blasphemous Blade' })).toBeVisible();
  });

  // Carian Regal Scepter - Staff (sorcery scaling)
  test('should open weapon details for Carian Regal Scepter', async ({ page }) => {
    await searchAndClickWeapon(page, 'Carian Regal Scepter');

    await expect(page.getByText('Weapon Details')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Carian Regal Scepter' })).toBeVisible();
    await expect(page.getByText('Glintstone Staff').first()).toBeVisible();
  });

  // Godslayer's Seal - Seal (incantation scaling)
  test('should open weapon details for Godslayer\'s Seal', async ({ page }) => {
    await searchAndClickWeapon(page, "Godslayer's Seal");

    await expect(page.getByText('Weapon Details')).toBeVisible();
    await expect(page.getByRole('heading', { name: "Godslayer's Seal" })).toBeVisible();
    await expect(page.getByText('Sacred Seal').first()).toBeVisible();
  });

  // Longbow - Standard (ranged weapon)
  test('should open weapon details for Longbow Standard', async ({ page }) => {
    await searchAndClickWeapon(page, 'Longbow', 'Standard');

    await expect(page.getByText('Weapon Details')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Longbow' })).toBeVisible();
    await expect(page.getByText('Bow').first()).toBeVisible();
  });

  // Claymore - Quality (balanced STR/DEX)
  test('should open weapon details for Claymore Quality', async ({ page }) => {
    await searchAndClickWeapon(page, 'Claymore', 'Quality');

    await expect(page.getByText('Weapon Details')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Claymore' })).toBeVisible();
    await expect(page.getByText('Quality').first()).toBeVisible();
  });

  // Nagakiba - Keen (long katana, DEX focused)
  test('should open weapon details for Nagakiba Keen', async ({ page }) => {
    await searchAndClickWeapon(page, 'Nagakiba', 'Keen');

    await expect(page.getByText('Weapon Details')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Nagakiba' })).toBeVisible();
    await expect(page.getByText('Keen').first()).toBeVisible();
  });

  // Winged Scythe - Unique (holy damage, FAI)
  test('should open weapon details for Winged Scythe', async ({ page }) => {
    await searchAndClickWeapon(page, 'Winged Scythe');

    await expect(page.getByText('Weapon Details')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Winged Scythe' })).toBeVisible();
    await expect(page.getByText('Reaper').first()).toBeVisible();
  });

  // Starscourge Greatsword - Colossal paired weapon
  test('should open weapon details for Starscourge Greatsword', async ({ page }) => {
    await searchAndClickWeapon(page, 'Starscourge Greatsword');

    await expect(page.getByText('Weapon Details')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Starscourge Greatsword' })).toBeVisible();
  });

  // Hand of Malenia - Unique katana
  test('should open weapon details for Hand of Malenia', async ({ page }) => {
    await searchAndClickWeapon(page, 'Hand of Malenia');

    await expect(page.getByText('Weapon Details')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Hand of Malenia' })).toBeVisible();
  });
});

test.describe('Weapon Category Filtering', () => {
  test('should show no weapons when all weapon types are deselected', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Wait for weapons to load initially
    await expect(page.getByText('Uchigatana').first()).toBeVisible({ timeout: 10000 });

    // Find the desktop sidebar
    const sidebar = page.locator('.hidden.lg\\:block').first();

    // Open Weapon Type dropdown
    const typeSection = sidebar.locator('label:has-text("Weapon Type")').locator('..');
    const typeButton = typeSection.locator('button[role="combobox"]');
    await typeButton.click();

    // Wait for popover to open
    await page.waitForTimeout(100);

    // Click "Clear All" to deselect all weapon types
    const clearAllType = page.getByRole('option', { name: 'Clear All' }).first();
    await clearAllType.click();

    // Close the popover
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Verify no weapons are shown (table body should be empty or show "no results" message)
    // The weapon count should show 0
    await expect(sidebar.getByText(/^0 \//)).toBeVisible();

    // Uchigatana should no longer be visible
    await expect(page.getByText('Uchigatana').first()).not.toBeVisible();
  });

  test('should not auto-reselect weapon types after clearing all', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Wait for weapons to load initially
    await expect(page.getByText('Uchigatana').first()).toBeVisible({ timeout: 10000 });

    // Find the desktop sidebar
    const sidebar = page.locator('.hidden.lg\\:block').first();

    // Open Weapon Type dropdown and clear all
    const typeSection = sidebar.locator('label:has-text("Weapon Type")').locator('..');
    const typeButton = typeSection.locator('button[role="combobox"]');
    await typeButton.click();
    await page.waitForTimeout(100);

    const clearAllType = page.getByRole('option', { name: 'Clear All' }).first();
    await clearAllType.click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Verify count is 0
    await expect(sidebar.getByText(/^0 \//)).toBeVisible();

    // Wait a bit to ensure no auto-reselection happens
    await page.waitForTimeout(500);

    // Count should still be 0 (no auto-reselection)
    await expect(sidebar.getByText(/^0 \//)).toBeVisible();

    // Weapons should still not be visible
    await expect(page.getByText('Uchigatana').first()).not.toBeVisible();
  });
});

test.describe('Weapon Detail Panel - Close Behavior', () => {
  test('should close weapon details when clicking X button', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    await searchAndClickWeapon(page, 'Uchigatana', 'Standard');
    await expect(page.getByText('Weapon Details')).toBeVisible();

    // Click close button
    await page.getByRole('button', { name: 'Close' }).click();

    // Detail panel should be hidden
    await expect(page.getByText('Weapon Details')).not.toBeVisible();
  });

  test('should close weapon details when clicking backdrop', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    await searchAndClickWeapon(page, 'Uchigatana', 'Standard');
    await expect(page.getByText('Weapon Details')).toBeVisible();

    // Click backdrop on the left side (the panel takes 60% from the right, so click at 20% from left)
    // The backdrop has z-40, panel has z-50, so we need to click outside the panel area
    const viewportSize = page.viewportSize();
    const clickX = viewportSize ? viewportSize.width * 0.15 : 100; // Click at 15% from left edge
    const clickY = viewportSize ? viewportSize.height * 0.5 : 300; // Click at vertical center
    await page.mouse.click(clickX, clickY);

    // Detail panel should be hidden
    await expect(page.getByText('Weapon Details')).not.toBeVisible();
  });
});
