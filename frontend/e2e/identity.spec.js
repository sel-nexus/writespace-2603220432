/** Exercise public and local identity journeys; later slices own reading and admin pages. */
import { test, expect } from './fixtures';

/** Enter valid demo writer values through accessible labels. */
async function fillWriter(page, username = 'jane') {
  await page.getByLabel('Display Name', { exact: true }).fill(' Jane Doe ');
  await page.getByLabel('Username', { exact: true }).fill(` ${username} `);
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByLabel('Confirm Password', { exact: true }).fill('demo-only');
}

test('guest discovery, validation, registration and reload preserve the exact local identity', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'WriteSpace', exact: true })).toBeVisible();
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  await expect(page.getByText('Your thoughts. Your space. Beautifully simple.')).toBeVisible();
  await page.getByRole('link', { name: 'Get Started Free', exact: true }).click();
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByLabel('Display Name', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Confirm Password is required.', { exact: true })).toBeVisible();
  await fillWriter(page);
  await page.getByLabel('Confirm Password', { exact: true }).fill('mismatch');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByText('Passwords must match.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBeNull();
  await page.getByLabel('Confirm Password', { exact: true }).fill('demo-only');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', '/blogs');
  const state = await page.evaluate(() => ({
    users: JSON.parse(localStorage.getItem('writespace_users')),
    session: JSON.parse(localStorage.getItem('writespace_session')),
  }));
  expect(state.users).toHaveLength(1);
  expect(state.users[0]).toEqual({ id: expect.stringMatching(/^[0-9a-f-]{36}$/), displayName: 'Jane Doe',
    username: 'jane', password: 'demo-only', role: 'user', createdAt: expect.any(String) });
  expect(state.session).toEqual({ userId: state.users[0].id, username: 'jane', displayName: 'Jane Doe', role: 'user' });
  await page.reload();
  await expect(page.getByText('Jane Doe', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(state.users);
  await page.getByRole('navigation', { name: 'Footer navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Go to Dashboard' })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await page.screenshot({ path: testInfo.outputPath('identity-persisted.png'), fullPage: true });
  const tree = await page.accessibility.snapshot();
  expect(tree).not.toBeNull();
});

test('guest reading CTA, invalid login and built-in admin login survive reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText(/Built-in demo account:/)).toContainText('username admin, password admin');
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid username or password.');
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute('href', '/admin');
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual({
    userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin',
  });
  expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBeNull();
});

test('reserved usernames do not create accounts and login/register links stay usable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Get Started' }).click();
  await fillWriter(page, 'admin');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Username is already taken.');
  expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBeNull();
  await page.getByRole('link', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('link', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
});

test('newest local previews are limited to three and guests follow their guarded links', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('writespace_posts', JSON.stringify([1, 4, 2, 3].map((day) => ({
      id: String(day), title: `Local entry ${day}`, content: 'A browser-local sentence.',
      createdAt: `2026-03-0${day}T12:00:00.000Z`, authorId: 'admin', authorName: 'Admin',
    }))));
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 3 })).toHaveText(['Local entry 4', 'Local entry 3', 'Local entry 2']);
  await page.getByRole('link', { name: /Local entry 4/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')).length)).toBe(4);
});

for (const key of ['writespace_users', 'writespace_session']) {
  test(`registration reports denied ${key} persistence without redirecting`, async ({ page }) => {
    // Inject an environmental storage denial, not a mock of the auth service.
    await page.addInitScript((deniedKey) => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (name === deniedKey) throw new DOMException('Storage unavailable', 'QuotaExceededError');
        return original.call(this, name, value);
      };
    }, key);
    await page.goto('/');
    await page.getByRole('link', { name: 'Get Started Free', exact: true }).click();
    await fillWriter(page);
    await page.getByRole('button', { name: 'Register', exact: true }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole('alert')).toContainText(key === 'writespace_users'
      ? 'Unable to save data' : 'Your account was saved, but your session could not be saved.');
    await expect(page.getByLabel('Display Name', { exact: true })).toHaveValue(' Jane Doe ');
    expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
    const users = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')));
    if (key === 'writespace_users') expect(users).toBeNull();
    else expect(users).toHaveLength(1);
  });
}

test('direct guest protected entry and corrupt storage fail closed without crashing', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('writespace_session', '{broken');
    localStorage.setItem('writespace_posts', '{broken');
    localStorage.setItem('writespace_users', '{broken');
  });
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login' })).toBeVisible();
});
