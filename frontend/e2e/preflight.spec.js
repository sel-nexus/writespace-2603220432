/** Capture representative rendered structure for source-guided review and human screenshots. */
import { test, expect } from './fixtures';
import { writeFile } from 'node:fs/promises';

/** Save the text APIs and screenshot of a meaningful rendered state. */
async function capture(page, testInfo, name) {
  const structure = {
    accessibility: await page.accessibility.snapshot(),
    styles: await page.evaluate(() => ({
      font: getComputedStyle(document.body).fontFamily,
      background: getComputedStyle(document.body).backgroundColor,
      headings: [...document.querySelectorAll('h1,h2')].map((heading) => ({
        text: heading.textContent,
        font: getComputedStyle(heading).fontFamily,
        size: getComputedStyle(heading).fontSize,
      })),
      overflow: document.documentElement.scrollWidth > innerWidth,
    })),
  };
  await writeFile(testInfo.outputPath(`${name}.json`), JSON.stringify(structure, null, 2));
  await writeFile(testInfo.outputPath(`${name}.html`), await page.content());
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
  expect(structure.styles.overflow).toBe(false);
}

test('representative landing, errors, populated reader and member navigation retain hierarchy', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'WriteSpace', exact: true })).toBeVisible();
  await capture(page, testInfo, 'landing-empty');
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await capture(page, testInfo, 'login-error');
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  await capture(page, testInfo, 'admin-empty');
  await page.getByRole('link', { name: 'Write New Post' }).click();
  await page.getByLabel('Title', { exact: true }).fill('A place for complete thoughts');
  await page.getByLabel('Content', { exact: true }).fill('First paragraph.\n\nA second paragraph, with room to breathe.');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A place for complete thoughts' })).toBeVisible();
  await capture(page, testInfo, 'reader-populated');
  await page.getByRole('link', { name: 'Back to All Posts' }).click();
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
  }
  await capture(page, testInfo, 'member-navigation');
});
