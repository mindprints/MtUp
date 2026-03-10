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

async function seedProposal(page: Page, title: string) {
  const accessToken = await page.evaluate(() => localStorage.getItem('mtup-supabase-access-token'));
  if (accessToken) {
    const url = process.env.VITE_SUPABASE_URL || 'https://oakjtodrtvtpfjbtjrbc.supabase.co';
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ha2p0b2RydHZ0cGZqYnRqcmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNDE5MzgsImV4cCI6MjA4NjkxNzkzOH0.Gi4NhuG4DSBUrw9k_jBoXCWd4SVElhP22OzkI_nC7AI';
    const authHeaders = {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    };
    const userResponse = await page.request.get(`${url}/auth/v1/user`, { headers: authHeaders });
    expect(userResponse.ok()).toBe(true);
    const user = (await userResponse.json()) as { id: string };
    const membershipResponse = await page.request.get(
      `${url}/rest/v1/group_memberships?select=group_id&user_id=eq.${user.id}&limit=1`,
      { headers: authHeaders }
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
        emoji: '🎯',
        created_by: user.id,
        authored_by: user.id,
        status: 'proposed',
        group_id: groupId,
        specifics_json: {},
      },
    });
    expect(proposalResponse.ok()).toBe(true);
    return;
  }

  await page.evaluate(({ title }) => {
    const storageKey = 'schedule-app-data';
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : null;
    const currentUserId = parsed?.currentUserId || '3';
    const nextData = {
      ...(parsed || {}),
      proposals: [
        ...((parsed?.proposals || []) as any[]),
        {
          id: `proposal-${Date.now()}`,
          title,
          type: 'event',
          emoji: '🎯',
          createdBy: currentUserId,
          authoredBy: currentUserId,
          createdAt: new Date().toISOString(),
          status: 'proposed',
          specifics: {},
        },
      ],
    };
    localStorage.setItem(storageKey, JSON.stringify(nextData));
  }, { title });
}

test('resolver can lock in majority selections', async ({ page }) => {
  test.setTimeout(90000);
  await loginAsDefaultUser(page, {
    identity: process.env.E2E_RESOLVER_EMAIL || 'charlie@mtup.local',
    password: process.env.E2E_RESOLVER_PASSWORD || process.env.E2E_PASSWORD || 'password',
  });

  const proposalTitle = `Resolver Majority E2E ${Date.now()}`;
  await seedProposal(page, proposalTitle);
  await page.reload();

  await page.getByRole('button', { name: 'Resolver' }).click();
  const queueCard = page.locator('button').filter({ hasText: proposalTitle }).first();
  await expect(queueCard).toBeVisible({ timeout: 20000 });
  await queueCard.click();

  const workspace = page.locator('section:visible').filter({ hasText: 'Resolver Actions' }).first();
  await expect(workspace).toBeVisible();

  const timePanel = page.locator('section:visible').filter({ has: page.getByRole('heading', { name: 'Time' }) }).first();
  const placePanel = page.locator('section:visible').filter({ has: page.getByRole('heading', { name: 'Place' }) }).first();

  const timeInput = timePanel.getByPlaceholder('Add time option');
  await timeInput.fill('18:00');
  await timePanel.getByRole('button', { name: 'Add' }).click();

  const placeInput = placePanel.getByPlaceholder('Add place option');
  await placeInput.fill('Cafe A');
  await placePanel.getByRole('button', { name: 'Add' }).click();

  await expect(workspace).toContainText('18:00', { timeout: 15000 });
  await expect(workspace).toContainText('Cafe A', { timeout: 15000 });

  const lockButton = workspace.getByRole('button', { name: 'Lock In Majority' });
  await expect(lockButton).toBeEnabled();
  await lockButton.click();

  await expect(workspace).toContainText('Locked in majority selections for 2 dimensions.', {
    timeout: 20000,
  });
});
