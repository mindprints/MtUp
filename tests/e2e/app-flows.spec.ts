import { expect, test, type Page } from '@playwright/test';

type LoginOptions = {
  identity?: string;
  password?: string;
};

type SeedProposalOptions = {
  title: string;
  type?: 'event' | 'sejour';
  emoji?: string;
  specifics?: Record<string, unknown>;
};

type SupabaseTestContext = {
  accessToken: string;
  url: string;
  anonKey: string;
  userId: string;
  groupId: string;
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

  const identity = options.identity || (
    isSupabaseLogin ? process.env.E2E_EMAIL || 'alice@mtup.local' : process.env.E2E_USERNAME || 'Alice'
  );
  const password = options.password || process.env.E2E_PASSWORD || 'password';

  await nameInput.fill(identity);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('button', { name: 'Resolver', exact: true })).toBeVisible({
    timeout: 20000,
  });
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
}

async function getSupabaseTestContext(page: Page): Promise<SupabaseTestContext | null> {
  const accessToken = await page.evaluate(() => localStorage.getItem('mtup-supabase-access-token'));
  if (!accessToken) return null;

  const url = process.env.VITE_SUPABASE_URL || 'https://oakjtodrtvtpfjbtjrbc.supabase.co';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ha2p0b2RydHZ0cGZqYnRqcmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNDE5MzgsImV4cCI6MjA4NjkxNzkzOH0.Gi4NhuG4DSBUrw9k_jBoXCWd4SVElhP22OzkI_nC7AI';

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

  return {
    accessToken,
    url,
    anonKey,
    userId: user.id,
    groupId,
  };
}

async function seedProposalInLocalStorage(page: Page, options: SeedProposalOptions): Promise<string> {
  return page.evaluate((payload) => {
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

    const proposalId = `proposal-${Date.now()}`;
    const nextData = {
      users,
      proposals: [
        ...(parsed?.proposals || []),
        {
          id: proposalId,
          title: payload.title,
          type: payload.type || 'event',
          emoji: payload.emoji || '🎉',
          createdBy: '1',
          authoredBy: '1',
          createdAt: new Date().toISOString(),
          status: 'proposed',
          specifics: payload.specifics || {},
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
    return proposalId;
  }, options);
}

async function seedProposalViaSupabase(page: Page, options: SeedProposalOptions): Promise<string> {
  const context = await getSupabaseTestContext(page);
  if (!context) {
    throw new Error('Missing Supabase access token after login.');
  }

  const proposalResponse = await page.request.post(`${context.url}/rest/v1/proposals`, {
    headers: {
      apikey: context.anonKey,
      Authorization: `Bearer ${context.accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data: {
      title: options.title,
      type: options.type || 'event',
      emoji: options.emoji || '🎉',
      created_by: context.userId,
      authored_by: context.userId,
      status: 'proposed',
      group_id: context.groupId,
      specifics_json: options.specifics || {},
    },
  });
  expect(proposalResponse.ok()).toBe(true);
  const rows = (await proposalResponse.json()) as Array<{ id: string }>;
  expect(rows[0]?.id).toBeTruthy();
  return rows[0].id;
}

async function seedProposalComment(page: Page, proposalId: string, text: string): Promise<void> {
  const context = await getSupabaseTestContext(page);
  const createdAt = new Date().toISOString();

  if (context) {
    const commentResponse = await page.request.post(`${context.url}/rest/v1/comments`, {
      headers: {
        apikey: context.anonKey,
        Authorization: `Bearer ${context.accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      data: {
        id: `comment-${Date.now()}`,
        group_id: context.groupId,
        proposal_id: proposalId,
        user_id: context.userId,
        text,
        created_at: createdAt,
      },
    });
    expect(commentResponse.ok()).toBe(true);
    return;
  }

  await page.evaluate(
    ({ targetProposalId, nextText, nextCreatedAt }) => {
      const storageKey = 'schedule-app-data';
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed) return;
      parsed.proposals = (parsed.proposals || []).map((proposal: any) => {
        if (proposal.id !== targetProposalId) return proposal;
        return {
          ...proposal,
          comments: [
            ...(proposal.comments || []),
            {
              id: `comment-${Date.now()}`,
              proposalId: targetProposalId,
              userId: parsed.currentUserId || '1',
              text: nextText,
              createdAt: nextCreatedAt,
            },
          ],
        };
      });
      localStorage.setItem(storageKey, JSON.stringify(parsed));
    },
    { targetProposalId: proposalId, nextText: text, nextCreatedAt: createdAt }
  );
}

async function seedProposalDateAlternative(page: Page, proposalId: string, dateText: string): Promise<void> {
  const createdAt = new Date().toISOString();
  const contributionId = `contribution-${Date.now()}`;
  const auditContributionId = `contribution-audit-${Date.now()}`;
  const context = await getSupabaseTestContext(page);

  if (context) {
    const contributionResponse = await page.request.post(
      `${context.url}/rest/v1/proposal_contributions`,
      {
        headers: {
          apikey: context.anonKey,
          Authorization: `Bearer ${context.accessToken}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        data: [
          {
            id: contributionId,
            group_id: context.groupId,
            proposal_id: proposalId,
            user_id: context.userId,
            kind: 'field_change',
            field: 'date',
            value_json: {
              dateText,
              impliedAvailability: 'available_for_suggested_dates',
              impliedDates: [dateText],
            },
            created_at: createdAt,
            provenance: 'manual_entry',
          },
          {
            id: auditContributionId,
            group_id: context.groupId,
            proposal_id: proposalId,
            user_id: context.userId,
            kind: 'availability',
            field: 'date',
            value_json: {
              status: 'available',
              source: 'date_suggestion',
              dateText,
              dates: [dateText],
            },
            created_at: createdAt,
            provenance: 'inferred_from_delta',
          },
        ],
      }
    );
    expect(contributionResponse.ok()).toBe(true);
    return;
  }

  await page.evaluate(
    ({ targetProposalId, targetDateText, nextCreatedAt, nextContributionId, nextAuditContributionId }) => {
      const storageKey = 'mtup-proposal-contributions-v1';
      const currentUserId = JSON.parse(localStorage.getItem('schedule-app-data') || '{}')?.currentUserId || '1';
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
      parsed.push(
        {
          id: nextContributionId,
          proposalId: targetProposalId,
          userId: currentUserId,
          kind: 'field_change',
          field: 'date',
          value: {
            dateText: targetDateText,
            impliedAvailability: 'available_for_suggested_dates',
            impliedDates: [targetDateText],
          },
          createdAt: nextCreatedAt,
          provenance: 'manual_entry',
        },
        {
          id: nextAuditContributionId,
          proposalId: targetProposalId,
          userId: currentUserId,
          kind: 'availability',
          field: 'date',
          value: {
            status: 'available',
            source: 'date_suggestion',
            dateText: targetDateText,
            dates: [targetDateText],
          },
          createdAt: nextCreatedAt,
          provenance: 'inferred_from_delta',
        }
      );
      localStorage.setItem(storageKey, JSON.stringify(parsed));
    },
    {
      targetProposalId: proposalId,
      targetDateText: dateText,
      nextCreatedAt: createdAt,
      nextContributionId: contributionId,
      nextAuditContributionId: auditContributionId,
    }
  );
}

async function seedProposal(page: Page, options: SeedProposalOptions): Promise<string> {
  const supabaseContext = await getSupabaseTestContext(page);
  if (supabaseContext) {
    return seedProposalViaSupabase(page, options);
  }
  return seedProposalInLocalStorage(page, options);
}

test.describe('App Flows', () => {
  test.describe.configure({ mode: 'serial' });

  test('can sign in and reach dashboard', async ({ page }) => {
    await loginAsDefaultUser(page);
    await expect(page.getByText(/^Welcome,\s+/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Snooky' })).toBeVisible();
  });

  test('seeded event proposal is visible after reload', async ({ page }) => {
    await loginAsDefaultUser(page);

    const proposalTitle = `E2E Proposal ${Date.now()}`;
    await seedProposal(page, {
      title: proposalTitle,
      type: 'event',
      specifics: {
        date: '2026-03-21',
        time: '18:00',
        location: 'Cafe A',
      },
    });

    await page.reload();
    await expect(page.getByText(proposalTitle)).toBeVisible({ timeout: 30000 });
  });

  test('seeded sejour proposal is visible after reload', async ({ page }) => {
    await loginAsDefaultUser(page);

    const proposalTitle = `E2E Sejour ${Date.now()}`;
    await seedProposal(page, {
      title: proposalTitle,
      type: 'sejour',
      specifics: {
        date: '2026-06-01 to 2026-06-03',
        location: 'Tallinn',
      },
    });

    await page.reload();
    await expect(page.getByText(proposalTitle)).toBeVisible({ timeout: 30000 });
  });

  test('availability affirmation persists after reload', async ({ page }) => {
    await loginAsDefaultUser(page);

    const proposalTitle = `Availability E2E ${Date.now()}`;
    await seedProposal(page, {
      title: proposalTitle,
      type: 'event',
      specifics: {
        date: '2026-03-22',
        time: '19:00',
        location: 'Vasaparken',
      },
    });

    await page.reload();
    const proposalCard = page
      .getByText(proposalTitle, { exact: true })
      .first()
      .locator('xpath=ancestor::div[contains(@class,"snap-start")][1]');
    await expect(proposalCard).toBeVisible({ timeout: 30000 });

    const availabilityWrite = page.waitForResponse(
      (response) =>
        response.url().includes('/rest/v1/availabilities') &&
        ['POST', 'PATCH'].includes(response.request().method()) &&
        response.status() < 400,
      { timeout: 30000 }
    );

    await proposalCard.getByRole('button', { name: "I'm available as proposed" }).click();
    await availabilityWrite;

    await page.reload();
    const reloadedProposalCard = page
      .getByText(proposalTitle, { exact: true })
      .first()
      .locator('xpath=ancestor::div[contains(@class,"snap-start")][1]');
    await expect(
      reloadedProposalCard.getByRole('button', { name: "I'm available as proposed" })
    ).toHaveCount(0, { timeout: 30000 });
  });

  test('proposal visibility for second user matches configured expectation', async ({ page }) => {
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
    await seedProposal(page, {
      title: proposalTitle,
      type: 'event',
      specifics: {
        date: '2026-03-25',
      },
    });

    await page.reload();
    await expect(page.getByText(proposalTitle)).toBeVisible({ timeout: 15000 });

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

  test('admin can delete all proposals from Admin dashboard', async ({ page }) => {
    await loginAsDefaultUser(page);

    const proposalTitle = `Admin Delete E2E ${Date.now()}`;
    await seedProposal(page, {
      title: proposalTitle,
      type: 'event',
      specifics: {
        date: '2026-03-28',
      },
    });

    await page.reload();
    await expect(page.getByText(proposalTitle)).toBeVisible({ timeout: 15000 });

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Admin' }).click();
    await expect(page.getByText('Admin Dashboard')).toBeVisible({ timeout: 10000 });

    const deleteAllButton = page.getByRole('button', { name: 'Delete All' });
    await expect(deleteAllButton).toBeEnabled();
    await deleteAllButton.click();

    await expect(page.getByText('All events deleted.')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('No events found.')).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'Activities' }).click();
    await expect(page.getByText(proposalTitle)).toHaveCount(0);
  });

  test('proposal calendar modal opens from the current Snooky card', async ({ page }) => {
    await loginAsDefaultUser(page);

    const proposalTitle = `Calendar Modal E2E ${Date.now()}`;
    await seedProposal(page, {
      title: proposalTitle,
      type: 'event',
      specifics: {
        date: '2026-04-03',
        time: '18:30',
        location: 'Cafe Calendar',
      },
    });

    await page.reload();
    const proposalCard = page
      .getByText(proposalTitle, { exact: true })
      .first()
      .locator('xpath=ancestor::div[contains(@class,"snap-start")][1]');
    await expect(proposalCard).toBeVisible({ timeout: 30000 });

    await proposalCard.getByRole('button', { name: 'Calendar', exact: true }).click();
    await expect(page.getByText(`${proposalTitle} calendar`)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Original dates (top line)')).toBeVisible({ timeout: 15000 });
  });

  test('suggested alternatives persist after reload', async ({ page }) => {
    await loginAsDefaultUser(page);

    const proposalTitle = `Alt Suggest E2E ${Date.now()}`;
    await seedProposal(page, {
      title: proposalTitle,
      type: 'event',
      specifics: {
        date: '2026-04-05',
        time: '19:00',
        location: 'Original Place',
      },
    });

    await page.reload();
    const proposalCard = page
      .getByText(proposalTitle, { exact: true })
      .first()
      .locator('xpath=ancestor::div[contains(@class,"snap-start")][1]');
    await expect(proposalCard).toBeVisible({ timeout: 30000 });

    await proposalCard.getByRole('button', { name: 'Suggest Alternatives' }).click();
    await proposalCard.getByLabel('Alternative date').fill('2026-04-06');
    await proposalCard.getByLabel('Alternative time').fill('20:15');
    await proposalCard.getByPlaceholder('Place: neighborhood / venue').fill('Alternative Cafe');
    await proposalCard.getByRole('button', { name: 'Add Alternatives' }).click();

    await expect(proposalCard.getByText('2026-04-06')).toBeVisible({ timeout: 15000 });
    await expect(proposalCard.getByText('Alternative Cafe')).toBeVisible({ timeout: 15000 });

    await page.reload();
    const reloadedProposalCard = page
      .getByText(proposalTitle, { exact: true })
      .first()
      .locator('xpath=ancestor::div[contains(@class,"snap-start")][1]');
    await expect(reloadedProposalCard.getByText('2026-04-06')).toBeVisible({ timeout: 15000 });
    await expect(reloadedProposalCard.getByText('Alternative Cafe')).toBeVisible({ timeout: 15000 });
  });

  test('sequential date alternatives stay distinct in resolver after reload', async ({ page }) => {
    await loginAsDefaultUser(page);

    const proposalTitle = `Resolver Alt Dates E2E ${Date.now()}`;
    await seedProposal(page, {
      title: proposalTitle,
      type: 'event',
      specifics: {
        date: '2026-04-10',
      },
    });

    await page.reload();
    const proposalCard = page
      .getByText(proposalTitle, { exact: true })
      .first()
      .locator('xpath=ancestor::div[contains(@class,"snap-start")][1]');
    await expect(proposalCard).toBeVisible({ timeout: 30000 });

    await proposalCard.getByRole('button', { name: 'Suggest Alternatives' }).click();
    await proposalCard.getByLabel('Alternative date').fill('2026-04-11');
    await proposalCard.getByRole('button', { name: 'Add Alternatives' }).click();
    await proposalCard.getByRole('button', { name: 'Suggest Alternatives' }).click();
    await proposalCard.getByLabel('Alternative date').fill('2026-04-12');
    await proposalCard.getByRole('button', { name: 'Add Alternatives' }).click();

    await expect(proposalCard.getByText('2026-04-11')).toBeVisible({ timeout: 15000 });
    await expect(proposalCard.getByText('2026-04-12')).toBeVisible({ timeout: 15000 });

    await page.reload();

    const reloadedProposalCard = page
      .getByText(proposalTitle, { exact: true })
      .first()
      .locator('xpath=ancestor::div[contains(@class,"snap-start")][1]');
    await expect(reloadedProposalCard.getByText('2026-04-11')).toBeVisible({ timeout: 15000 });
    await expect(reloadedProposalCard.getByText('2026-04-12')).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'Resolver', exact: true }).click();
    const queueCard = page.locator('button').filter({ hasText: proposalTitle }).first();
    await expect(queueCard).toBeVisible({ timeout: 20000 });
    await queueCard.click();

    const workspace = page.locator('section:visible').filter({ hasText: 'Resolver Actions' }).first();
    await expect(workspace).toBeVisible({ timeout: 15000 });
    await expect(workspace.getByText('2026-04-10', { exact: true }).first()).toBeVisible({ timeout: 15000 });
    await expect(workspace.getByText('2026-04-11', { exact: true }).first()).toBeVisible({ timeout: 15000 });
    await expect(workspace.getByText('2026-04-12', { exact: true }).first()).toBeVisible({ timeout: 15000 });
  });

  test('finalizing in resolver marks activity as confirmed in activities', async ({ page }) => {
    await loginAsDefaultUser(page);

    const proposalTitle = `Finalize Confirmed E2E ${Date.now()}`;
    await seedProposal(page, {
      title: proposalTitle,
      type: 'event',
      specifics: {
        date: '2026-04-15',
        time: '18:00',
        location: 'Finalize Cafe',
      },
    });

    await page.reload();
    await page.getByRole('button', { name: 'Resolver', exact: true }).click();
    const queueCard = page.locator('button').filter({ hasText: proposalTitle }).first();
    await expect(queueCard).toBeVisible({ timeout: 20000 });
    await queueCard.click();

    const workspace = page.locator('section:visible').filter({ hasText: 'Resolver Actions' }).first();
    await expect(workspace).toBeVisible({ timeout: 15000 });

    const finalizeButton = workspace.getByRole('button', { name: 'Finalize + Notify' });
    await expect(finalizeButton).toBeEnabled({ timeout: 15000 });
    await finalizeButton.click();

    await expect(workspace).toContainText('Finalized activity and posted a notice', {
      timeout: 20000,
    });

    await page.getByRole('button', { name: 'Snooky', exact: true }).click();
    const proposalCard = page
      .getByText(proposalTitle, { exact: true })
      .first()
      .locator('xpath=ancestor::div[contains(@class,"snap-start")][1]');

    await expect(proposalCard).toBeVisible({ timeout: 20000 });
    await expect(proposalCard.getByText('Confirmed', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(proposalCard.getByText('[Finalized notice]', { exact: false })).toBeVisible({
      timeout: 15000,
    });
  });

  test('admin membership CRUD works from the dashboard', async ({ page }) => {
    test.setTimeout(90000);
    await loginAsDefaultUser(page);
    await page.reload();
    await page.getByRole('button', { name: 'Admin', exact: true }).click();
    await expect(page.getByText('Admin Dashboard')).toBeVisible({ timeout: 10000 });

    const noActiveGroupMessage = page.getByText('No active group selected.', { exact: true });
    if (await noActiveGroupMessage.isVisible().catch(() => false)) {
      await page.reload();
      await page.getByRole('button', { name: 'Admin', exact: true }).click();
      await expect(page.getByText('Admin Dashboard')).toBeVisible({ timeout: 10000 });
    }
    const membersSection = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Members', exact: true }) })
      .first();
    await expect(membersSection.getByText('Alice (You)', { exact: true })).toBeVisible({
      timeout: 15000,
    });

    const memberName = `CRUD Smoke ${Date.now()}`;
    const renamedMemberName = `${memberName} Renamed`;

    await membersSection.getByPlaceholder('Name').fill(memberName);
    await membersSection.getByPlaceholder('Password').fill('password');
    await membersSection.getByRole('button', { name: 'Add Member', exact: true }).click();

    const getMemberRow = (name: string) =>
      membersSection
        .getByText(name, { exact: true })
        .first()
        .locator('xpath=ancestor::div[.//button[contains(., "Edit") or contains(., "Save")]][1]');

    let memberRow = getMemberRow(memberName);
    await expect(memberRow).toBeVisible({ timeout: 15000 });

    await memberRow.getByRole('button', { name: 'Edit', exact: true }).dispatchEvent('click');
    const memberNameInput = membersSection.locator(`input[value="${memberName}"]`).first();
    await expect(memberNameInput).toBeVisible({ timeout: 15000 });
    await memberNameInput.fill(renamedMemberName);
    await membersSection.getByRole('button', { name: 'Save', exact: true }).first().dispatchEvent('click');
    await expect(page.getByText('Member updated.', { exact: true })).toBeVisible({ timeout: 15000 });

    memberRow = getMemberRow(renamedMemberName);
    await expect(memberRow).toBeVisible({ timeout: 15000 });

    await memberRow.getByRole('button', { name: 'Promote', exact: true }).dispatchEvent('click');
    await expect(page.getByText('Member role updated.', { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(memberRow.getByText('Admin', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(memberRow.getByRole('button', { name: 'Demote', exact: true })).toBeVisible({
      timeout: 15000,
    });

    await memberRow.getByRole('button', { name: 'Demote', exact: true }).dispatchEvent('click');
    await expect(page.getByText('Member role updated.', { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(memberRow.getByText('Member', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(memberRow.getByRole('button', { name: 'Promote', exact: true })).toBeVisible({
      timeout: 15000,
    });

    page.once('dialog', (dialog) => dialog.accept());
    await memberRow.getByRole('button', { name: 'Remove', exact: true }).dispatchEvent('click');
    await expect(page.getByText('Member removed.', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(membersSection.getByText(renamedMemberName, { exact: true })).toHaveCount(0);
  });

  test('reloading twice keeps proposals notes and alternatives visible', async ({ page }) => {
    await loginAsDefaultUser(page);

    const proposalTitle = 'Night on the town';
    const noteText = `Reload note ${Date.now()}`;
    let proposalCard = page
      .getByText(proposalTitle, { exact: true })
      .first()
      .locator('xpath=ancestor::div[contains(@class,"snap-start")][1]');
    await expect(proposalCard).toBeVisible({ timeout: 30000 });
    await proposalCard.getByPlaceholder('Add a note').fill(noteText);
    await proposalCard.getByRole('button', { name: 'Add Note', exact: true }).click();
    await expect(proposalCard.getByText(noteText, { exact: true })).toBeVisible({ timeout: 15000 });

    await page.reload();
    await page.reload();

    proposalCard = page
      .getByText(proposalTitle, { exact: true })
      .first()
      .locator('xpath=ancestor::div[contains(@class,"snap-start")][1]');
    await expect(proposalCard).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: 'Resolver', exact: true }).click();
    const queueCard = page.locator('button').filter({ hasText: proposalTitle }).first();
    await expect(queueCard).toContainText('notes', { timeout: 15000 });
    await expect(queueCard).toContainText('2 alternatives', { timeout: 15000 });
    await queueCard.click();

    const workspace = page.locator('section:visible').filter({ hasText: 'Resolver Actions' }).first();
    await expect(workspace).toBeVisible({ timeout: 15000 });
    await expect(workspace.getByText('2026-03-19', { exact: true }).first()).toBeVisible({
      timeout: 15000,
    });
    await expect(workspace.getByText('2026-03-20', { exact: true }).first()).toBeVisible({
      timeout: 15000,
    });
  });
});
