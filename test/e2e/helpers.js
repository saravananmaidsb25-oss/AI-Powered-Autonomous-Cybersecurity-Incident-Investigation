import {expect} from '@playwright/test';

export async function enterDemoWorkspace(page, url = '/') {
  await page.goto(url);
  const demo = page.getByRole('button', {name: 'Enter demo workspace'});
  if (await demo.isVisible()) await demo.click();
  await expect(page.locator('.sidebar__title')).toContainText('SENTINEL');
}
