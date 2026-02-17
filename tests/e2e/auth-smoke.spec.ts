import { expect, test } from '@playwright/test';

test('login screen renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Schedule App')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});
