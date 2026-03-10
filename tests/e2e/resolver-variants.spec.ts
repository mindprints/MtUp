import { expect, test, type Page } from '@playwright/test';

type LoginOptions = {
  identity?: string;
  password?: string;
};

async function loginAsDefaultUser(page: Page, options: LoginOptions = {}) {
  await page.addInitScript(() => {
    localStorage.setItem('mtup-primary-tab', 'workspace');
  });

  await page.goto('/');

  const nameInput = page.locator('#name');
  await expect(nameInput).toBeVisible();

  const placeholder = (await nameInput.getAttribute('placeholder')) || '';
  const isSupabaseLogin = placeholder.toLowerCase().includes('email');

  const identity =
    options.identity ||
    (isSupabaseLogin ? process.env.E2E_EMAIL || 'alice@mtup.local' : process.env.E2E_USERNAME || 'Alice');
  const password = options.password || process.env.E2E_PASSWORD || 'password';

  await nameInput.fill(identity);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Resolver' })).toBeVisible({ timeout: 20000 });
}

async function createProposalInLocalStorage(page: Page, title: string) {
  await page.evaluate(({ title }) => {
    const storageKey = 'schedule-app-data';
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : null;
    const users =
      parsed?.users ||
      [
        { id: '1', name: 'Alice', email: 'alice@mtup.local', password: 'password', isAdmin: true },
        { id: '2', name: 'Bob', email: 'bob@mtup.local', password: 'password', isAdmin: false },
        { id: '3', name: 'Charlie', email: 'charlie@mtup.local', password: 'password', isAdmin: false },
        { id: '4', name: 'Diana', email: 'diana@mtup.local', password: 'password', isAdmin: false },
        { id: '5', name: 'Eve', email: 'eve@mtup.local', password: 'password', isAdmin: false },
      ];

    const nextData = {
      users,
      proposals: [
        ...(parsed?.proposals || []),
        {
          id: `proposal-${Date.now()}`,
          title,
          type: 'event',
          emoji: '🎲',
          createdBy: '1',
          authoredBy: '1',
          createdAt: new Date().toISOString(),
          status: 'proposed',
          specifics: {
            requirements: 'Quiet table',
          },
        },
      ],
      availabilities: parsed?.availabilities || [],
      decisionConfigs: parsed?.decisionConfigs || [],
      decisionOptions: parsed?.decisionOptions || [],
      decisionVotes: parsed?.decisionVotes || [],
      decisionConfirmations: parsed?.decisionConfirmations || [],
      currentUserId: parsed?.currentUserId || '1',
    };

    localStorage.setItem(storageKey, JSON.stringify(nextData));
  }, { title });
}

async function createProposalViaSupabase(page: Page, title: string) {
  const accessToken = await page.evaluate(() => localStorage.getItem('mtup-supabase-access-token'));
  const url = process.env.VITE_SUPABASE_URL || 'https://oakjtodrtvtpfjbtjrbc.supabase.co';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ha2p0b2RydHZ0cGZqYnRqcmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNDE5MzgsImV4cCI6MjA4NjkxNzkzOH0.Gi4NhuG4DSBUrw9k_jBoXCWd4SVElhP22OzkI_nC7AI';

  if (!accessToken) {
    throw new Error('Missing Supabase access token after login.');
  }

  const authHeaders = {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
  };

  const userResponse = await page.request.get(`${url}/auth/v1/user`, {
    headers: authHeaders,
  });
  expect(userResponse.ok()).toBe(true);
  const user = (await userResponse.json()) as { id: string };

  const membershipResponse = await page.request.get(
    `${url}/rest/v1/group_memberships?select=group_id&user_id=eq.${user.id}&limit=1`,
    {
      headers: authHeaders,
    }
  );
  expect(membershipResponse.ok()).toBe(true);
  const memberships = (await membershipResponse.json()) as Array<{ group_id: string }>;
  const groupId = memberships[0]?.group_id;
  expect(groupId).toBeTruthy();

  const proposalResponse = await page.request.post(`${url}/rest/v1/proposals`, {
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data: {
      title,
      type: 'event',
      emoji: '🎲',
      created_by: user.id,
      authored_by: user.id,
      status: 'proposed',
      group_id: groupId,
      specifics_json: {
        requirements: 'Quiet table',
      },
    },
  });
  if (!proposalResponse.ok()) {
    throw new Error(
      `Supabase proposal insert failed: ${proposalResponse.status()} ${await proposalResponse.text()}`
    );
  }
}

test.describe('Resolver variants smoke', () => {
  test('creator can create capped variants and duplicate creation is suppressed', async ({ page }) => {
    test.setTimeout(90000);
    await loginAsDefaultUser(page);

    const proposalTitle = `Resolver Variant E2E ${Date.now()}`;
    const supabaseToken = await page.evaluate(() => localStorage.getItem('mtup-supabase-access-token'));
    if (supabaseToken) {
      await createProposalViaSupabase(page, proposalTitle);
    } else {
      await createProposalInLocalStorage(page, proposalTitle);
    }
    await page.reload();

    await page.getByRole('button', { name: 'Resolver' }).click();
    const queueCard = page.locator('button').filter({ hasText: proposalTitle }).first();
    await expect(queueCard).toBeVisible({ timeout: 20000 });
    await queueCard.click();

    const workspace = page.locator('section').filter({ hasText: 'Resolver Actions' }).first();
    await expect(workspace).toBeVisible();

    const timeInput = page.getByPlaceholder('Add time option').first();
    await timeInput.fill('18:00');
    await page.getByRole('button', { name: 'Add' }).nth(0).click();
    await timeInput.fill('20:00');
    await page.getByRole('button', { name: 'Add' }).nth(0).click();

    const placeInput = page.getByPlaceholder('Add place option').first();
    await placeInput.fill('Cafe A');
    await page.getByRole('button', { name: 'Add' }).nth(1).click();
    await placeInput.fill('Cafe B');
    await page.getByRole('button', { name: 'Add' }).nth(1).click();

    await expect(workspace.getByText('2 variant paths ready')).toBeVisible({ timeout: 15000 });

    const createVariantsButton = workspace.getByRole('button', { name: 'Create Variants' });
    await expect(createVariantsButton).toBeEnabled();
    await createVariantsButton.click();

    await expect(workspace).toContainText('Created 2 variant proposals.', { timeout: 20000 });

    await expect(page.getByText('Variant A').first()).toBeVisible();
    await expect(page.getByText('Variant B').first()).toBeVisible();
    await expect(createVariantsButton).toBeDisabled();
  });
});
