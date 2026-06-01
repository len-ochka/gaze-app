
import { test, expect } from '@playwright/test';

test('verify guest login and ui refinement', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Wait for landing screen
  await expect(page.locator('#screen-landing')).toBeVisible();

  // Click start
  await page.click('#btn-landing-start');

  // Wait for auth screen
  await expect(page.locator('#screen-auth')).toBeVisible();

  // Verify Guest Login button is in footer and has correct text
  const guestBtn = page.locator('.auth-footer #btn-guest-login');
  await expect(guestBtn).toBeVisible();
  await expect(guestBtn).toHaveText('Войти как гость');

  // Click Guest Login
  await guestBtn.click();

  // Verify it goes to home screen
  await expect(page.locator('#screen-home')).toBeVisible();
  await expect(page.locator('#home-username')).toHaveText('Гость');

  // Screenshot
  await page.screenshot({ path: 'guest_login_verify.png' });
});
