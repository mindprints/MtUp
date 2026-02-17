import { expect, test, type Page } from '@playwright/test';

type LoginOptions = {
  identity?: string;
  password?: string;
};

async function loginAsDefaultUser(page: Page, options: LoginOptions = {}) {
  await page.goto('/');

  const nameInput = page.locator('#name');
  await expect(nameInput).toBeVisible();

  const placeholder = (await nameInput.getAttribute('placeholder')) || '';
  const isSupabaseLogin = placeholder.toLowerCase().includes('email');

  const identity = options.identity || (isSupabaseLogin
    ? process.env.E2E_EMAIL || 'alice@mtup.local'
    : process.env.E2E_USERNAME || 'Alice');
  const password = options.password || process.env.E2E_PASSWORD || 'password';

  await nameInput.fill(identity);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('button', { name: '+ New Proposal' })).toBeVisible({
    timeout: 20000,
  });
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
}

test.describe('App Flows', () => {
  test.describe.configure({ mode: 'serial' });

  test('can sign in and reach dashboard', async ({ page }) => {
    await loginAsDefaultUser(page);
    await expect(page.getByText('Welcome, Me')).toBeVisible();
  });

  test('can create a proposal and keep it after reload', async ({ page }) => {
    await loginAsDefaultUser(page);

    const proposalTitle = `E2E Proposal ${Date.now()}`;

    await page.getByRole('button', { name: '+ New Proposal' }).click();
    await expect(page.getByText('Create Activity Proposal')).toBeVisible();

    await page.locator('#title').fill(proposalTitle);
    await page.getByRole('button', { name: 'Create Proposal' }).click();

    await expect(page.getByText(proposalTitle)).toBeVisible({ timeout: 30000 });

    await page.reload();
    await expect(page.getByText(proposalTitle)).toBeVisible({ timeout: 30000 });
  });

  test('admin can trigger cleanup dialog with Delete All', async ({ page }) => {
    await loginAsDefaultUser(page);

    const deleteAllButton = page.getByRole('button', { name: /Delete All/ });
    if (!(await deleteAllButton.isVisible())) {
      test.skip(true, 'Current user is not admin, skipping cleanup test.');
      return;
    }

    page.on('dialog', (dialog) => dialog.accept());
    await deleteAllButton.click();

    await expect(page.getByRole('button', { name: '+ New Proposal' })).toBeVisible();
  });

  test('availability persists after reload (Supabase-backed)', async ({ page }) => {
    await loginAsDefaultUser(page);

    const proposalTitle = `Coffee E2E ${Date.now()}`;

    await page.getByRole('button', { name: '+ New Proposal' }).click();
    await page.locator('#title').fill(proposalTitle);
    await page.getByRole('button', { name: 'Create Proposal' }).click();
    await expect(page.getByText(proposalTitle)).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: 'year' }).click();

    const firstEnabledYearDayButton = page
      .locator('div.grid.grid-cols-7 button:enabled')
      .first();

    const availabilityWrite = page.waitForResponse(
      (response) =>
        response.url().includes('/rest/v1/availabilities') &&
        ['POST', 'PATCH'].includes(response.request().method()) &&
        response.status() < 400,
      { timeout: 30000 }
    );

    await firstEnabledYearDayButton.click();
    await availabilityWrite;

    const availabilityReadAfterReload = page.waitForResponse(
      (response) =>
        response.url().includes('/rest/v1/availabilities') &&
        response.request().method() === 'GET' &&
        response.status() < 400,
      { timeout: 30000 }
    );
    await page.reload();
    const availabilityResponse = await availabilityReadAfterReload;
    const bodyText = await availabilityResponse.text();
    expect(bodyText).toContain('proposal_id');
  });

  test('ctrl/cmd remove availability persists after reload', async ({ page, browserName }) => {
    test.setTimeout(60000);
    await loginAsDefaultUser(page);

    const proposalTitle = `RemoveAvail E2E ${Date.now()}`;

    await page.getByRole('button', { name: '+ New Proposal' }).click();
    await page.locator('#title').fill(proposalTitle);
    await page.getByRole('button', { name: 'Create Proposal' }).click();
    await expect(page.getByText(proposalTitle)).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: 'year' }).click();
    const targetButton = page.locator('div.grid.grid-cols-7 button:enabled').first();

    const addWrite = page.waitForResponse(
      (response) =>
        response.url().includes('/rest/v1/availabilities') &&
        ['POST', 'PATCH'].includes(response.request().method()) &&
        response.status() < 400,
      { timeout: 30000 }
    );
    await targetButton.click();
    await addWrite;

    const removeWrite = page.waitForResponse(
      (response) =>
        response.url().includes('/rest/v1/availabilities') &&
        ['POST', 'PATCH'].includes(response.request().method()) &&
        response.status() < 400,
      { timeout: 7000 }
    );

    await targetButton.dispatchEvent('click', {
      ctrlKey: process.platform !== 'darwin',
      metaKey: process.platform === 'darwin',
      bubbles: true,
      cancelable: true,
    });

    await Promise.race([
      removeWrite,
      page.waitForTimeout(1200),
    ]);

    const proposalsRead = page.waitForResponse(
      (response) =>
        response.url().includes('/rest/v1/proposals') &&
        response.request().method() === 'GET' &&
        response.status() < 400,
      { timeout: 30000 }
    );
    const availabilitiesRead = page.waitForResponse(
      (response) =>
        response.url().includes('/rest/v1/availabilities') &&
        response.request().method() === 'GET' &&
        response.status() < 400,
      { timeout: 30000 }
    );

    await page.reload();
    const [proposalsRes, availabilitiesRes] = await Promise.all([
      proposalsRead,
      availabilitiesRead,
    ]);

    const proposals = (await proposalsRes.json()) as Array<{ id: string; title: string }>;
    const availabilities = (await availabilitiesRes.json()) as Array<{
      proposal_id: string;
      dates_json: string[] | null;
    }>;
    const proposal = proposals.find((p) => p.title === proposalTitle);
    expect(proposal).toBeTruthy();

    const matching = availabilities.filter((a) => a.proposal_id === proposal!.id);
    expect(
      matching.length === 0 ||
        matching.every((row) => (row.dates_json || []).length === 0)
    ).toBe(true);
  });

  test('clicking a marked month event lane opens Activity Details modal', async ({ page }) => {
    test.setTimeout(60000);
    await loginAsDefaultUser(page);

    const proposalTitle = `LaneModal E2E ${Date.now()}`;

    await page.getByRole('button', { name: '+ New Proposal' }).click();
    await page.locator('#title').fill(proposalTitle);
    await page.getByRole('button', { name: 'Create Proposal' }).click();
    await expect(page.getByText(proposalTitle)).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: proposalTitle }).click();
    await page.getByRole('button', { name: 'month' }).click();
    const monthCell = page
      .locator('div.relative.min-h-\\[100px\\].cursor-pointer')
      .first();

    const availabilityWrite = page.waitForResponse(
      (response) =>
        response.url().includes('/rest/v1/availabilities') &&
        ['POST', 'PATCH'].includes(response.request().method()) &&
        response.status() < 400,
      { timeout: 30000 }
    );
    await monthCell.click();
    await availabilityWrite;

    const lane = page.locator(`div[title^="${proposalTitle}:"]`).first();
    await expect(lane).toBeVisible({ timeout: 30000 });
    await lane.click();
    await expect(page.getByText('Activity Details')).toBeVisible({ timeout: 10000 });
  });

  test('proposal visibility for second user matches configured expectation', async ({
    page,
  }) => {
    const primaryIdentity = process.env.E2E_PRIMARY_EMAIL || process.env.E2E_EMAIL || 'alice@mtup.local';
    const primaryPassword = process.env.E2E_PRIMARY_PASSWORD || process.env.E2E_PASSWORD || 'password';
    const secondaryIdentity = process.env.E2E_SECONDARY_EMAIL || 'bob@mtup.local';
    const secondaryPassword = process.env.E2E_SECONDARY_PASSWORD || process.env.E2E_PASSWORD || 'password';
    const expectVisible = (process.env.E2E_EXPECT_PROPOSAL_VISIBLE || 'true') === 'true';

    await loginAsDefaultUser(page, {
      identity: primaryIdentity,
      password: primaryPassword,
    });

    const proposalTitle = `CrossUser E2E ${Date.now()}`;
    await page.getByRole('button', { name: '+ New Proposal' }).click();
    await page.locator('#title').fill(proposalTitle);
    await page.getByRole('button', { name: 'Create Proposal' }).click();
    await expect(page.getByText(proposalTitle)).toBeVisible();

    await signOut(page);

    await loginAsDefaultUser(page, {
      identity: secondaryIdentity,
      password: secondaryPassword,
    });

    if (expectVisible) {
      await expect(page.getByText(proposalTitle)).toBeVisible({ timeout: 15000 });
    } else {
      await expect(page.getByText(proposalTitle)).not.toBeVisible();
    }
  });
});
