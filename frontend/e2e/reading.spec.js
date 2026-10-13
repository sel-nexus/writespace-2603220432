/** Exercise member reading with real local records; shared fixtures capture browser errors. */
import { test, expect } from './fixtures';

const users = [
  { id: 'writer', username: 'writer', displayName: 'Writer', password: 'demo', role: 'user', createdAt: '2026-03-01T00:00:00Z' },
  { id: 'editor', username: 'editor', displayName: 'Editor', password: 'demo', role: 'admin', createdAt: '2026-03-01T00:00:00Z' },
];
const posts = [1, 5, 2, 4, 3].map((day) => ({
  id: String(day), title: `Local entry ${day}`, content: `  Opening ${day}\n\n<script>plain text</script>\n${'x'.repeat(150)}`,
  createdAt: `2026-03-0${day}T12:00:00Z`, authorId: day === 5 ? 'writer' : day === 4 ? 'editor' : 'deleted',
  authorName: day === 5 ? 'Writer' : day === 4 ? 'Editor' : 'Saved author',
}));

/** Seed the actual local contract once before initial navigation, without intercepting app services. */
async function seed(page, role = null, records = posts) {
  await page.addInitScript(({ accounts, entries, identity }) => {
    localStorage.setItem('writespace_users', JSON.stringify(accounts));
    localStorage.setItem('writespace_posts', JSON.stringify(entries));
    if (identity) localStorage.setItem('writespace_session', JSON.stringify(identity));
  }, {
    accounts: users,
    entries: records,
    identity: role === 'admin'
      ? { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' }
      : role === 'user' ? { userId: 'writer', username: 'writer', displayName: 'Writer', role: 'user' } : null,
  });
}

/** Open mobile navigation only when the configured project uses its hamburger. */
async function navigation(page, testInfo) {
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
  }
  return page.getByRole('navigation', { name: 'Member navigation' });
}

for (const path of ['/blogs', '/blog/5', '/write', '/edit/5', '/admin', '/users']) {
  test(`guest direct entry ${path} goes to login and leaves records intact`, async ({ page }) => {
    await seed(page);
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible();
    await expect(page.getByRole('navigation')).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts);
    await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Public navigation' })).toBeVisible();
  });
}

for (const role of ['user', 'admin']) {
  for (const path of ['/blogs', '/blog/5', '/write', '/edit/5', '/admin', '/users', '/login', '/register']) {
    test(`${role} direct entry ${path} observes the finished route matrix`, async ({ page }, testInfo) => {
      await seed(page, role);
      await page.goto(path);
      const authPage = ['/login', '/register'].includes(path);
      const adminPage = ['/admin', '/users'].includes(path);
      const destination = authPage ? (role === 'admin' ? '/admin' : '/blogs')
        : adminPage && role === 'user' ? '/blogs' : path;
      await expect(page).toHaveURL(new RegExp(`${destination}$`));
      const headings = {
        '/admin': 'Admin Dashboard', '/users': 'Manage Users', '/write': 'Write a Blog',
        '/edit/5': 'Edit Blog', '/blog/5': 'Local entry 5', '/blogs': 'All Blogs',
      };
      await expect(page.getByRole('heading', { level: 1, name: headings[destination], exact: true })).toBeVisible();
      if (destination === '/edit/5') await expect(page.getByLabel('Title')).toHaveValue('Local entry 5');
      const nav = await navigation(page, testInfo);
      await expect(nav.getByRole('link', { name: 'Write', exact: true })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Users', exact: true })).toHaveCount(role === 'admin' ? 1 : 0);
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts);
    });
  }
}

test('writer reads persisted plain text, toggles mobile navigation and logs out without losing records', async ({ page }, testInfo) => {
  await seed(page, 'user');
  await page.goto('/blogs');
  await expect(page.getByRole('article').getByRole('heading')).toHaveText([
    'Local entry 5', 'Local entry 4', 'Local entry 3', 'Local entry 2', 'Local entry 1',
  ]);
  const first = page.getByRole('article').first();
  await expect(first.getByText(posts.find((post) => post.id === '5').content.slice(0, 120), { exact: true })).toBeVisible();
  await expect(first.getByText('Mar 05, 2026')).toBeVisible();
  await expect(page.getByRole('link', { name: /^Edit / })).toHaveCount(1);
  await expect(page.getByRole('article').nth(1).getByRole('img', { name: 'Admin avatar' })).toBeVisible();
  await expect(page.getByRole('article').nth(2).getByRole('img', { name: 'user avatar' })).toBeVisible();
  const nav = await navigation(page, testInfo);
  await expect(nav.getByRole('link', { name: 'All Blogs', exact: true })).toHaveAttribute('aria-current', 'page');
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await expect(nav.getByRole('link', { name: 'Write', exact: true })).toBeHidden();
  }
  await first.getByRole('link', { name: /^Local entry 5/ }).click();
  await expect(page).toHaveURL(/\/blog\/5$/);
  const body = page.getByRole('article').locator('p');
  await expect(body).toHaveText(posts.find((post) => post.id === '5').content);
  expect(await body.evaluate((element) => element.textContent)).toBe(posts.find((post) => post.id === '5').content);
  await expect(body).toHaveCSS('white-space', 'pre-wrap');
  await expect(page.locator('main script')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to All Posts' }).click();
  await page.getByRole('article').nth(1).getByRole('link', { name: /^Local entry 4/ }).click();
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to All Posts' }).click();
  await page.getByRole('button', { name: 'Account for Writer' }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(users);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts);
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill('writer');
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(5);
});

test('admin reads, edits then cancels, manages users and opens a fresh writing form', async ({ page }, testInfo) => {
  await seed(page, 'admin');
  await page.goto('/blogs');
  await expect(page.getByRole('link', { name: /^Edit / })).toHaveCount(5);
  await page.getByRole('article').first().getByRole('link', { name: /^Local entry 5/ }).click();
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page).toHaveURL(/\/edit\/5$/);
  await expect(page.getByLabel('Title')).toHaveValue('Local entry 5');
  await expect(page.getByLabel('Content')).toHaveValue(posts.find((post) => post.id === '5').content);
  await page.getByLabel('Title').fill('Unsaved title');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/\/blog\/5$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts);
  let nav = await navigation(page, testInfo);
  await nav.getByRole('link', { name: 'Users', exact: true }).click();
  await expect(page).toHaveURL(/\/users$/);
  await expect(page.getByRole('heading', { name: 'Create User' })).toBeVisible();
  nav = await navigation(page, testInfo);
  await nav.getByRole('link', { name: 'Write', exact: true }).click();
  await expect(page).toHaveURL(/\/write$/);
  await expect(page.getByLabel('Title')).toHaveValue('');
  await expect(page.getByLabel('Content')).toHaveValue('');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/\/users$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(users);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts);
});

test('missing reader offers back navigation to an empty collection', async ({ page }) => {
  await seed(page, 'user', []);
  await page.goto('/blog/missing');
  await expect(page.getByRole('heading', { name: 'Post not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to All Posts' }).click();
  await expect(page.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  await page.getByRole('link', { name: 'Write a Blog' }).click();
  await expect(page).toHaveURL(/\/write$/);
  await expect(page.getByRole('heading', { name: 'Write a Blog' })).toBeVisible();
  await expect(page.getByLabel('Title')).toHaveValue('');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([]);
});

test('logout denial remains an inline error without clearing session or records', async ({ page }) => {
  await seed(page, 'user');
  await page.addInitScript(() => {
    const original = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      if (key === 'writespace_session') throw new DOMException('Denied', 'SecurityError');
      return original.call(this, key);
    };
  });
  await page.goto('/blogs');
  await page.getByRole('button', { name: 'Account for Writer' }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.getByRole('alert')).toHaveText('Unable to clear your session in this browser. Please try again.');
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')).userId)).toBe('writer');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(users);
});
