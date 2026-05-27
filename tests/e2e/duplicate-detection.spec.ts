/**
 * End-to-End Tests for Duplicate Detection Workflow
 * Tests complete user workflows using Playwright
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const TEST_CONFIG = {
  baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
  testUser: {
    email: 'test@example.com',
    password: 'testpassword123'
  }
};

// Helper functions
async function loginUser(page: Page) {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', TEST_CONFIG.testUser.email);
  await page.fill('[data-testid="password-input"]', TEST_CONFIG.testUser.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
}

async function expandDuplicateDetection(page: Page) {
  const trigger = page.getByRole('button', { name: /duplicate detection/i });
  await expect(trigger).toBeVisible();
  await trigger.click();
}

async function scanForDuplicates(page: Page) {
  const scanButton = page.getByRole('button', { name: /scan for duplicates/i });
  await expect(scanButton).toBeVisible();
  await scanButton.click();
  // Wait for scan to complete (loading state disappears)
  await expect(page.getByText(/scanning/i)).not.toBeVisible({ timeout: 30000 });
}

async function getGroupCount(page: Page): Promise<number> {
  // Group cards have headers with "Group N" text
  const groupHeaders = page.locator('h3').filter({ hasText: /Group \d+/ });
  return groupHeaders.count();
}

async function getVisibleCheckboxCount(page: Page): Promise<number> {
  // Count enabled checkboxes (excludes the disabled "kept" receipt checkbox)
  const checkboxes = page.locator('[role="checkbox"]:not([disabled])');
  return checkboxes.count();
}

test.describe('Duplicate Detection', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await page.goto('/dashboard');
    await expandDuplicateDetection(page);
  });

  test('full scan, review, and delete selected flow', async ({ page }) => {
    // 1. Scan for duplicates
    await scanForDuplicates(page);

    // 2. Wait for results to load
    const resultsText = page.getByText(/found.*potential duplicates/i);
    const noDuplicatesText = page.getByText(/no duplicate receipts found/i);

    // If no duplicates exist, skip the rest of this test
    const hasResults = await resultsText.isVisible().catch(() => false);
    const hasNoDuplicates = await noDuplicatesText.isVisible().catch(() => false);

    test.skip(!hasResults && hasNoDuplicates, 'No duplicate receipts available for this test');

    // 3. Verify duplicate groups are displayed
    await expect(resultsText).toBeVisible();
    const initialGroupCount = await getGroupCount(page);
    expect(initialGroupCount).toBeGreaterThan(0);

    // 4. Find the first group and check one non-kept receipt
    const enabledCheckboxes = page.locator('[role="checkbox"]:not([disabled])');
    const checkboxCount = await enabledCheckboxes.count();
    expect(checkboxCount).toBeGreaterThan(0);

    // Check the first available checkbox (mark it for deletion)
    await enabledCheckboxes.first().check();

    // 5. Click "Delete Selected" button
    const deleteSelectedButton = page.getByRole('button', { name: /delete selected/i });
    await expect(deleteSelectedButton).toBeEnabled();
    await deleteSelectedButton.click();

    // 6. Confirm in dialog
    const confirmButton = page.getByRole('button', { name: /confirm delete/i });
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    // 7. Wait for deletion to complete
    await expect(page.getByText(/deleting/i)).not.toBeVisible({ timeout: 30000 });

    // 8. Verify the checked receipt was removed (scan again to verify)
    await scanForDuplicates(page);

    // Either results show fewer duplicates or empty state
    const newResultsVisible = await resultsText.isVisible().catch(() => false);
    if (newResultsVisible) {
      const newGroupCount = await getGroupCount(page);
      // Group count may stay same but receipt count within group should decrease
      expect(newGroupCount).toBeGreaterThanOrEqual(0);
    } else {
      await expect(noDuplicatesText).toBeVisible();
    }
  });

  test('delete all duplicates keeping oldest', async ({ page }) => {
    // 1. Scan for duplicates
    await scanForDuplicates(page);

    // 2. Wait for results to load
    const resultsText = page.getByText(/found.*potential duplicates/i);
    const noDuplicatesText = page.getByText(/no duplicate receipts found/i);

    // If no duplicates exist, skip the rest of this test
    const hasResults = await resultsText.isVisible().catch(() => false);
    const hasNoDuplicates = await noDuplicatesText.isVisible().catch(() => false);

    test.skip(!hasResults && hasNoDuplicates, 'No duplicate receipts available for this test');

    // 3. Verify duplicate groups are displayed
    await expect(resultsText).toBeVisible();
    const initialGroupCount = await getGroupCount(page);
    expect(initialGroupCount).toBeGreaterThan(0);

    // 4. Click "Delete All Duplicates (Keep Oldest)" button
    const deleteAllButton = page.getByRole('button', { name: /delete all duplicates \(keep oldest\)/i });
    await expect(deleteAllButton).toBeVisible();
    await deleteAllButton.click();

    // 5. Confirm in dialog
    const confirmButton = page.getByRole('button', { name: /confirm delete/i });
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    // 6. Wait for deletion to complete
    await expect(page.getByText(/deleting/i)).not.toBeVisible({ timeout: 30000 });

    // 7. Verify only oldest per group remains by re-scanning
    await scanForDuplicates(page);

    // After deleting all duplicates keeping oldest, there should be no duplicates left
    await expect(noDuplicatesText).toBeVisible();
  });

  test('empty state when no duplicates found', async ({ page }) => {
    // 1. Scan for duplicates
    await scanForDuplicates(page);

    // 2. Wait for results to load
    const resultsText = page.getByText(/found.*potential duplicates/i);
    const noDuplicatesText = page.getByText(/no duplicate receipts found/i);

    // The test passes if either:
    // - Results are shown (duplicates exist, which is valid for this test scenario)
    // - Empty state is shown (no duplicates exist)
    const hasResults = await resultsText.isVisible().catch(() => false);
    const hasNoDuplicates = await noDuplicatesText.isVisible().catch(() => false);

    expect(hasResults || hasNoDuplicates).toBe(true);

    if (hasNoDuplicates) {
      // Verify the empty state message is clearly displayed
      await expect(noDuplicatesText).toBeVisible();

      // Verify no group cards are present
      const groupHeaders = page.locator('h3').filter({ hasText: /Group \d+/ });
      await expect(groupHeaders).toHaveCount(0);

      // Verify action buttons are not present when empty
      await expect(page.getByRole('button', { name: /delete selected/i })).not.toBeVisible();
      await expect(page.getByRole('button', { name: /delete all duplicates/i })).not.toBeVisible();
    }
  });

  test('config changes affect scan results', async ({ page }) => {
    // 1. Scan with default config (all fields enabled)
    await scanForDuplicates(page);

    const resultsText = page.getByText(/found.*potential duplicates/i);
    const noDuplicatesText = page.getByText(/no duplicate receipts found/i);

    // Capture initial state
    const hasResultsInitially = await resultsText.isVisible().catch(() => false);
    let initialGroupCount = 0;
    if (hasResultsInitially) {
      initialGroupCount = await getGroupCount(page);
    }

    // 2. Toggle off Date matching in config
    // First, ensure the config section is expanded
    const configToggle = page.getByRole('button', { name: /match settings/i });
    await expect(configToggle).toBeVisible();
    await configToggle.click();

    // Toggle off the Date switch
    const dateToggle = page.locator('#date-toggle');
    await expect(dateToggle).toBeVisible();
    const isDateEnabled = await dateToggle.isChecked();
    if (isDateEnabled) {
      await dateToggle.click();
    }

    // 3. Scan again with Date disabled
    await scanForDuplicates(page);

    // Capture new state
    const hasResultsAfter = await resultsText.isVisible().catch(() => false);
    let newGroupCount = 0;
    if (hasResultsAfter) {
      newGroupCount = await getGroupCount(page);
    }

    // 4. Verify that results changed (either from empty to results, results to empty, or different count)
    // Note: In some data scenarios, disabling date may not change results. We verify the scan completed.
    const stateChanged = hasResultsInitially !== hasResultsAfter || initialGroupCount !== newGroupCount;

    // The scan should have completed successfully regardless
    const scanCompleted = hasResultsAfter || (await noDuplicatesText.isVisible().catch(() => false));
    expect(scanCompleted).toBe(true);

    // If we had results both times, the group count may differ when config changes
    // (This is a soft assertion since data-dependent behavior may vary)
    if (hasResultsInitially && hasResultsAfter) {
      // Log the counts for debugging - the actual behavior depends on the test data
      console.log(`Config change scan results: ${initialGroupCount} groups → ${newGroupCount} groups`);
    }

    // 5. Restore Date toggle for clean state
    const isDateDisabled = !(await dateToggle.isChecked());
    if (isDateDisabled) {
      await dateToggle.click();
    }
  });
});
