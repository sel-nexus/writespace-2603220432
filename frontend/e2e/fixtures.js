/** Capture browser errors before every journey, including its initial navigation. */
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  browserErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await use(errors);
    expect(errors, 'No console errors or uncaught page errors').toEqual([]);
  }, { auto: true }],
});
export { expect };
