/** Exercise Admin operations through real UI and storage; fixtures capture every browser error. */
import { test, expect } from './fixtures';

const writer = {
  id: 'writer', username: 'writer', displayName: 'Writer', password: 'dummy', role: 'user',
  createdAt: '2026-03-01T00:00:00.000Z',
};
const editor = { ...writer, id: 'editor', username: 'editor', displayName: 'Editor', role: 'admin' };
const posts = [1, 6, 2, 5, 3, 4].map((day) => ({
  id: String(day), title: `Admin entry ${day}`, content: `Plain text ${day}`,
  authorId: day === 6 ? 'editor' : 'writer', authorName: day === 6 ? 'Editor' : 'Writer',
  createdAt: `2026-03-0${day}T00:00:00.000Z`,
}));

/** Seed only once per tab so reload assertions cannot restore deleted records. */
async function seed(page) {
  await page.addInitScript(({ accounts, entries }) => {
    if (sessionStorage.getItem('admin-seeded')) return;
    sessionStorage.setItem('admin-seeded', 'yes');
    localStorage.setItem('writespace_users', JSON.stringify(accounts));
    localStorage.setItem('writespace_posts', JSON.stringify(entries));
    localStorage.removeItem('writespace_session');
  }, { accounts: [writer, editor], entries: posts });
}

/** Authenticate using the visible login form, never a fabricated session. */
async function login(page, username = 'admin', password = 'admin') {
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
}

/** Open responsive member links only when the hamburger is present. */
async function navigate(page, name) {
  const toggle = page.getByRole('button', { name: 'Toggle navigation' });
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
  await page.getByRole('navigation', { name: 'Member navigation' }).getByRole('link', { name, exact: true }).click();
}

/** Use the public dashboard CTA instead of programmatic route jumps. */
async function dashboard(page) {
  await page.getByRole('navigation', { name: 'Member navigation' }).getByRole('link', { name: 'WriteSpace' }).click();
  await page.getByRole('link', { name: 'Go to Dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
}

/** Logout through the active identity menu and reopen public login. */
async function logout(page, displayName) {
  await page.getByRole('button', { name: `Account for ${displayName}` }).click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login' }).click();
}

/** Choose the visible responsive account container. */
function accounts(page, testInfo) {
  return testInfo.project.name === 'mobile'
    ? page.getByLabel('Mobile accounts') : page.getByRole('table', { name: 'Local accounts' });
}

/** Read actual browser persistence after each mutation and reload. */
async function stored(page, key) {
  return page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey)), key);
}

/** Assert exact capitalization-sensitive dataset numbers. */
async function counts(page, values) {
  for (const [label, value] of Object.entries(values)) {
    await expect(page.getByRole('region', { name: label, exact: true }).getByText(String(value), { exact: true })).toBeVisible();
  }
}

test('Admin login, overview, both-role creation, recent controls and preserved deleted authors survive reload', async ({ page }, testInfo) => {
  await seed(page);
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login' }).click();
  await login(page);
  await expect(page).toHaveURL(/\/admin$/);
  await counts(page, { 'Total Posts': 6, 'Total Users': 3, 'Total Admins': 2, 'Total users': 1 });
  await expect(page.getByRole('region', { name: 'Recent Posts' }).getByRole('heading', { level: 3 })).toHaveText([
    'Admin entry 6', 'Admin entry 5', 'Admin entry 4', 'Admin entry 3', 'Admin entry 2',
  ]);
  await page.getByRole('link', { name: 'Edit Admin entry 6' }).click();
  await expect(page.getByLabel('Title')).toHaveValue('Admin entry 6');
  await page.getByLabel('Title').fill('Unsaved change');
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect(await stored(page, 'writespace_posts')).toEqual(posts);
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('link', { name: 'Manage Users' }).click();
  const listing = accounts(page, testInfo);
  await expect(listing).toBeVisible();
  await expect(listing.getByRole('button', { name: 'Delete admin' })).toBeDisabled();
  await expect(listing.getByRole('button', { name: 'Delete admin' })).toHaveAttribute('title', 'Default admin cannot be deleted.');
  await expect(listing.getByText('Built-in', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create User', exact: true }).click();
  await expect(page.getByText('Display Name is required.')).toBeVisible();
  expect(await stored(page, 'writespace_users')).toEqual([writer, editor]);
  for (const role of ['user', 'admin']) {
    await page.getByLabel('Display Name').fill(`New ${role}`);
    await page.getByLabel('Username', { exact: true }).fill('admin');
    await page.getByLabel('Password', { exact: true }).fill('dummy');
    await page.getByLabel('Role', { exact: true }).selectOption(role);
    await page.getByRole('button', { name: 'Create User', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Username is already taken.');
    await page.getByLabel('Username', { exact: true }).fill(`new-${role}`);
    await page.getByRole('button', { name: 'Create User', exact: true }).click();
    const saved = (await stored(page, 'writespace_users')).find((account) => account.username === `new-${role}`);
    expect(saved).toMatchObject({ displayName: `New ${role}`, password: 'dummy', role });
    expect(saved.id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);
    expect(new Date(saved.createdAt).toISOString()).toBe(saved.createdAt);
    await expect(listing.getByRole('button', { name: `Delete new-${role}` })).toBeVisible();
  }
  const created = await stored(page, 'writespace_users');
  await page.reload();
  expect(await stored(page, 'writespace_users')).toEqual(created);
  await dashboard(page);
  await counts(page, { 'Total Posts': 6, 'Total Users': 5, 'Total Admins': 3, 'Total users': 2 });
  await page.getByRole('link', { name: 'Write New Post' }).click();
  await expect(page.getByRole('heading', { name: 'Write a Blog' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete Admin entry 6' }).click();
  expect(await stored(page, 'writespace_posts')).toEqual(posts);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete Admin entry 6' }).click();
  const keptPosts = posts.filter((post) => post.id !== '6');
  expect(await stored(page, 'writespace_posts')).toEqual(keptPosts);
  await counts(page, { 'Total Posts': 5, 'Total Users': 5, 'Total Admins': 3, 'Total users': 2 });
  await expect(page.getByRole('link', { name: 'Admin entry 1', exact: true })).toBeVisible();
  await page.reload();
  expect(await stored(page, 'writespace_posts')).toEqual(keptPosts);
  await navigate(page, 'Users');
  for (const username of ['new-user', 'new-admin', 'writer', 'editor']) {
    const before = await stored(page, 'writespace_users');
    page.once('dialog', (dialog) => dialog.dismiss());
    await accounts(page, testInfo).getByRole('button', { name: `Delete ${username}` }).click();
    expect(await stored(page, 'writespace_users')).toEqual(before);
    page.once('dialog', (dialog) => dialog.accept());
    await accounts(page, testInfo).getByRole('button', { name: `Delete ${username}` }).click();
    expect(await stored(page, 'writespace_users')).toEqual(before.filter((account) => account.username !== username));
    expect(await stored(page, 'writespace_posts')).toEqual(keptPosts);
  }
  await page.reload();
  expect(await stored(page, 'writespace_users')).toEqual([]);
  await dashboard(page);
  await counts(page, { 'Total Posts': 5, 'Total Users': 1, 'Total Admins': 1, 'Total users': 0 });
  await page.getByRole('link', { name: 'Admin entry 5', exact: true }).click();
  await expect(page.getByRole('article').getByText('Writer', { exact: true })).toBeVisible();
  await expect(page.getByRole('article').getByRole('img', { name: 'user avatar' })).toBeVisible();
  await logout(page, 'Admin');
  await login(page, 'writer', 'dummy');
  await expect(page.getByRole('alert')).toHaveText('Invalid username or password.');
  await login(page);
  await expect(page).toHaveURL(/\/admin$/);
});

for (const route of ['/admin', '/users', '/edit/6']) {
  test(`writer direct entry ${route} rejects access without changing accounts or posts`, async ({ page }) => {
    await page.addInitScript(({ accounts, entries, identity }) => {
      localStorage.setItem('writespace_users', JSON.stringify(accounts));
      localStorage.setItem('writespace_posts', JSON.stringify(entries));
      localStorage.setItem('writespace_session', JSON.stringify(identity));
    }, {
      accounts: [writer, editor], entries: posts,
      identity: { userId: writer.id, username: writer.username, displayName: writer.displayName, role: writer.role },
    });
    await page.goto(route);
    await expect(page).toHaveURL(/\/blogs$/);
    await expect(page.getByRole('heading', { name: 'All Blogs' })).toBeVisible();
    expect(await stored(page, 'writespace_posts')).toEqual(posts);
    expect(await stored(page, 'writespace_users')).toEqual([writer, editor]);
  });
}

test('stored Admin self protection and deleted-session reload use canonical accounts', async ({ page }, testInfo) => {
  await seed(page);
  await page.goto('/login');
  await login(page, 'editor', 'dummy');
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('link', { name: 'Manage Users' }).click();
  await expect(accounts(page, testInfo).getByRole('button', { name: 'Delete editor' })).toBeDisabled();
  await expect(accounts(page, testInfo).getByRole('button', { name: 'Delete editor' })).toHaveAttribute(
    'title', 'You cannot delete your own account.',
  );
  await logout(page, 'Editor');
  await login(page, 'writer', 'dummy');
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
  expect(await stored(page, 'writespace_posts')).toEqual(posts);
  expect(await stored(page, 'writespace_users')).toEqual([writer, editor]);
  // Simulate another tab deleting this identity; reload must not trust the remaining session record.
  await page.evaluate(() => {
    const current = JSON.parse(localStorage.getItem('writespace_users'));
    localStorage.setItem('writespace_users', JSON.stringify(current.filter((account) => account.id !== 'writer')));
  });
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  expect(await stored(page, 'writespace_posts')).toEqual(posts);
  await login(page, 'writer', 'dummy');
  await expect(page.getByRole('alert')).toHaveText('Invalid username or password.');
});
