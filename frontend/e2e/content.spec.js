/** Exercise real local content journeys; shared fixture rejects console and page errors. */
import { test, expect } from './fixtures';

const writer = {
  id: 'writer', username: 'writer', displayName: 'Writer', password: 'demo', role: 'user',
  createdAt: '2026-03-01T00:00:00Z',
};
const other = { ...writer, id: 'other', username: 'other', displayName: 'Other' };
const editor = { ...writer, id: 'editor', username: 'editor', displayName: 'Editor', role: 'admin' };
const accounts = [writer, other, editor];
const original = {
  id: 'post', title: 'Original entry', content: '  Original\n\nPlain text', authorId: 'writer', authorName: 'Saved Writer',
  createdAt: '2026-03-02T00:00:00Z',
};

/** Seed once per browser context so reload assertions do not reset mutations. */
async function seed(page, name = null, posts = [original]) {
  await page.addInitScript(({ users, records, identity }) => {
    if (localStorage.getItem('content-fixture-ready')) return;
    localStorage.setItem('content-fixture-ready', 'true');
    localStorage.setItem('writespace_users', JSON.stringify(users));
    localStorage.setItem('writespace_posts', JSON.stringify(records));
    if (identity) localStorage.setItem('writespace_session', JSON.stringify(identity));
  }, {
    users: accounts,
    records: posts,
    identity: name === 'admin'
      ? { userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin' }
      : name ? {
        userId: name, username: name, displayName: accounts.find((account) => account.id === name).displayName,
        role: name === 'editor' ? 'admin' : 'user',
      } : null,
  });
}

/** Read the actual persisted collection, not application state or intercepted traffic. */
async function stored(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
}

/** Open responsive member navigation if necessary and follow a real link. */
async function followNav(page, name) {
  const link = page.getByRole('navigation', { name: 'Member navigation' }).getByRole('link', { name, exact: true });
  if (!(await link.isVisible())) await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await link.click();
}

/** Fill required editor controls with unescaped plain text. */
async function fill(page, title, content) {
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Content', { exact: true }).fill(content);
}

for (const name of ['writer', 'admin', 'editor']) {
  test(`${name} logs in, creates, reads, edits, cancels and confirms deletion with persistence`, async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
    await page.getByLabel('Username', { exact: true }).fill(name);
    await page.getByLabel('Password', { exact: true }).fill(name === 'admin' ? 'admin' : 'demo');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    if (name !== 'writer') {
      await expect(page).toHaveURL(/\/admin$/);
      await expect(page.getByRole('heading', { name: 'Admin Dashboard', exact: true })).toBeVisible();
      await followNav(page, 'All Blogs');
    }
    await expect(page).toHaveURL(/\/blogs$/);
    await followNav(page, 'Write');
    await expect(page.getByRole('heading', { name: 'Write a Blog' })).toBeVisible();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Title is required.', { exact: true })).toBeVisible();
    await expect(page.getByText('Content is required.', { exact: true })).toBeVisible();
    expect(await stored(page)).toEqual([original]);
    const title = '<img src=x onerror=alert(1)> My local entry';
    const content = '  Opening\n\n<script>alert(1)</script>\n  End';
    await fill(page, title, content);
    await expect(page.getByText(`${content.length} characters`, { exact: true })).toBeVisible();
    expect(await page.getByLabel('Content').evaluate((element) => parseFloat(getComputedStyle(element).minHeight))).toBeGreaterThanOrEqual(256);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    const created = (await stored(page))[1];
    expect(created).toEqual({
      id: expect.stringMatching(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i),
      title, content, createdAt: expect.any(String), authorId: name,
      authorName: name === 'admin' ? 'Admin' : name === 'editor' ? 'Editor' : 'Writer',
    });
    expect(new Date(created.createdAt).toISOString()).toBe(created.createdAt);
    await expect(page).toHaveURL(new RegExp(`/blog/${created.id}$`));
    expect(await page.getByRole('article').locator('p').evaluate((element) => element.textContent)).toBe(content);
    await expect(page.locator('main img, main script')).toHaveCount(0);
    await page.reload();
    expect(await stored(page)).toEqual([original, created]);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await expect(page.getByLabel('Title')).toHaveValue(title);
    await expect(page.getByLabel('Content')).toHaveValue(content);
    await fill(page, 'Unsaved changes', 'Do not save this');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/blog/${created.id}$`));
    expect(await stored(page)).toEqual([original, created]);
    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await fill(page, 'Edited local entry', '  Edited\n\nText');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const updated = { ...created, title: 'Edited local entry', content: '  Edited\n\nText' };
    await expect(page.getByRole('heading', { name: updated.title, exact: true })).toBeVisible();
    expect(await stored(page)).toEqual([original, updated]);
    await page.reload();
    expect(await stored(page)).toEqual([original, updated]);
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain(updated.title);
      await dialog.dismiss();
    });
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/blog/${created.id}$`));
    expect(await stored(page)).toEqual([original, updated]);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    expect(await stored(page)).toEqual([original]);
    await expect(page.getByRole('heading', { name: updated.title, exact: true })).toHaveCount(0);
    await page.reload();
    expect(await stored(page)).toEqual([original]);
    await expect(page.getByRole('heading', { name: original.title, exact: true })).toBeVisible();
  });
}

for (const path of ['/write', '/edit/post']) {
  test(`guest direct-entry guard ${path} preserves content and reaches login`, async ({ page }) => {
    await seed(page);
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
    expect(await stored(page)).toEqual([original]);
  });
  test(`direct-entry Cancel on ${path} falls back to blogs without saving`, async ({ page }) => {
    await seed(page, 'writer');
    await page.goto(path);
    await fill(page, 'Unsaved', 'Unsaved content');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    expect(await stored(page)).toEqual([original]);
  });
}

test('another writer direct edit redirects; reader exposes only back navigation', async ({ page }) => {
  await seed(page, 'other');
  await page.goto('/edit/post');
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('link', { name: /^Edit / })).toHaveCount(0);
  await page.getByRole('article').getByRole('link', { name: /^Original entry/ }).click();
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to All Posts' }).click();
  expect(await stored(page)).toEqual([original]);
});

for (const name of ['admin', 'editor']) {
  test(`${name} edits and deletes another author's post without changing authorship`, async ({ page }) => {
    await seed(page, name);
    await page.goto('/blogs');
    await page.getByRole('link', { name: 'Edit Original entry', exact: true }).click();
    await fill(page, 'Admin revision', 'Revised plain text');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { name: 'Admin revision' })).toBeVisible();
    expect(await stored(page)).toEqual([{ ...original, title: 'Admin revision', content: 'Revised plain text' }]);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    expect(await stored(page)).toEqual([]);
    await expect(page.getByRole('heading', { name: 'No blogs yet. Be the first to write one!' })).toBeVisible();
  });
}

test('missing direct editor never creates a replacement and offers back navigation', async ({ page }) => {
  await seed(page, 'writer');
  await page.goto('/edit/missing');
  await expect(page.getByRole('heading', { name: 'Post not found' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to All Posts' }).click();
  expect(await stored(page)).toEqual([original]);
});

test('quota-full post save keeps editor and reader intact, then succeeds after freeing space', async ({ page }) => {
  await seed(page, 'writer');
  await page.goto('/blog/post');
  const identityBefore = await page.evaluate(() => ({
    users: localStorage.getItem('writespace_users'), session: localStorage.getItem('writespace_session'),
  }));
  await page.evaluate(() => {
    const key = 'content-quota';
    let value = '';
    localStorage.setItem(key, value);
    for (let size = 65536; size >= 1; size = Math.floor(size / 2)) {
      while (true) {
        const next = value + 'x'.repeat(size);
        try {
          localStorage.setItem(key, next);
          value = next;
        } catch (error) {
          if (error.name !== 'QuotaExceededError') throw error;
          break;
        }
      }
    }
  });
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  // The update must grow the stored collection; quota does not prevent smaller replacements.
  const title = 'Not saved while storage is full';
  const content = 'Not saved content. '.repeat(100);
  await fill(page, title, content);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('alert')).toHaveText('Unable to save data in this browser. Please try again.');
  await expect(page).toHaveURL(/\/edit\/post$/);
  await expect(page.getByLabel('Title')).toHaveValue(title);
  await expect(page.getByLabel('Content')).toHaveValue(content);
  expect(await stored(page)).toEqual([original]);
  expect(await page.evaluate(() => ({
    users: localStorage.getItem('writespace_users'), session: localStorage.getItem('writespace_session'),
  }))).toEqual(identityBefore);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/\/blog\/post$/);
  await expect(page.getByRole('heading', { name: original.title, exact: true })).toBeVisible();
  expect(await page.getByRole('article').locator('p').evaluate((element) => element.textContent)).toBe(original.content);
  expect(await stored(page)).toEqual([original]);
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await fill(page, title, content);
  await page.evaluate(() => localStorage.removeItem('content-quota'));
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/blog\/post$/);
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  expect(await stored(page)).toEqual([{ ...original, title, content }]);
  // Synthetic delete-write denial belongs in Reading.test.jsx; shrinking a collection can succeed at quota.
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await stored(page)).toEqual([]);
  expect(await page.evaluate(() => ({
    users: localStorage.getItem('writespace_users'), session: localStorage.getItem('writespace_session'),
  }))).toEqual(identityBefore);
});

test('same-tab ownership drift rejects save and confirmed delete using current storage', async ({ page }) => {
  await seed(page, 'writer');
  await page.goto('/blog/post');
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await fill(page, 'Rejected edit', 'Rejected content');
  const fresh = { ...original, authorId: 'other', authorName: 'Other' };
  await page.evaluate((record) => localStorage.setItem('writespace_posts', JSON.stringify([record])), fresh);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('alert')).toHaveText('You do not have permission to change this post.');
  await expect(page).toHaveURL(/\/edit\/post$/);
  expect(await stored(page)).toEqual([fresh]);
  // Restore ownership before navigation, then change it inside the confirm interaction.
  await page.evaluate((record) => localStorage.setItem('writespace_posts', JSON.stringify([record])), original);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.evaluate((record) => localStorage.setItem('writespace_posts', JSON.stringify([record])), fresh);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('alert')).toHaveText('You do not have permission to change this post.');
  await expect(page).toHaveURL(/\/blog\/post$/);
  expect(await stored(page)).toEqual([fresh]);
});

test('stale session at save fails closed without redirecting or writing', async ({ page }) => {
  await seed(page, 'writer');
  await page.goto('/write');
  await fill(page, 'Rejected create', 'Rejected content');
  await page.evaluate(() => localStorage.removeItem('writespace_session'));
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('alert')).toHaveText('Please log in again before changing posts.');
  await expect(page).toHaveURL(/\/write$/);
  expect(await stored(page)).toEqual([original]);
});
