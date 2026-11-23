const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const root = path.resolve(__dirname, '..');
const pageUrl = file => pathToFileURL(path.join(root, file)).href;

test('employee pulse is legible and completes four answers plus optional prompt', async ({ page }) => {
  await page.goto(pageUrl('zaposleni/index.html'));
  await expect(page.getByText('Vaš nedeljni puls.')).toBeVisible();
  for (let n=1; n<=4; n++) {
    await expect(page.getByText('Pitanje '+n+' od 4')).toBeVisible();
    await page.locator('input[name="answer"]').nth(3).check();
    await page.locator('#next').click();
  }
  await expect(page.getByText('Šta bi Vam najviše olakšalo rad naredne nedelje?')).toBeVisible();
  await page.locator('#optionalComment').fill('Jasniji prioriteti.');
  await page.locator('#optionalBack').click();
  await expect(page.getByText('Pitanje 4 od 4')).toBeVisible();
  await page.locator('#next').click();
  await expect(page.locator('#optionalComment')).toHaveValue('Jasniji prioriteti.');
  await page.locator('#optionalFinish').click();
  await expect(page.getByText('Hvala na izdvojenom vremenu.')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('employee-complete.png'), fullPage: true });
});

test('manager action persists across reload, edits and status changes', async ({ page }) => {
  await page.goto(pageUrl('rukovodilac/index.html'));
  await expect(page.locator('#manager')).toBeVisible();
  // Manager guided demo begins with a scenario; enter dashboard using its visible flow.
  for (let i=0;i<3;i++) {
    const choices=page.locator('[data-choice]');
    await expect(choices.first()).toBeVisible();
    await choices.first().click();
    await page.locator('#aureaSimNext').click();
  }
  await page.locator('#v35analyze').click();
  for (let i=0;i<2;i++) await page.locator('#nextManager').click();
  await page.locator('#actionText').fill('Uskladiti prioritete na nedeljnom sastanku');
  await page.locator('#due').fill('2026-12-10');
  await page.locator('#saveAction').click();
  await expect(page.getByText('Vaš plan za naredni period')).toBeVisible();
  await page.reload();
  await page.locator('#v35activities').click();
  await expect(page.getByText('Uskladiti prioritete na nedeljnom sastanku')).toBeVisible();
  await page.locator('#v35status').click();
  await expect(page.getByText('Završeno')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('manager-activities.png'), fullPage: true });
});

test('premium integration entry keeps roles separate', async ({ page }) => {
  await page.goto(pageUrl('index.html'));
  await expect(page.getByRole('link',{name:/Iskustvo zaposlenog/})).toBeVisible();
  await expect(page.getByRole('link',{name:/Iskustvo rukovodioca/})).toBeVisible();
  await expect(page.locator('.role-emblem')).toHaveCount(2);
  await page.screenshot({ path: test.info().outputPath('premium-entry.png'), fullPage: true });
});


test('both role experiences have in-app back arrow and matching emblem', async ({ page }) => {
  for (const role of ['zaposleni','rukovodilac']) {
    await page.goto(pageUrl(role+'/index.html'));
    await expect(page.getByRole('link',{name:/Nazad na početnu stranicu Puls tima/})).toBeVisible();
    await expect(page.locator('.hero .aurea-role-signature svg')).toBeVisible();
    await expect(page.locator('.hero')).toBeVisible();
    await expect(page.getByText('Interaktivna demonstracija')).toBeVisible();
    await page.getByRole('link',{name:/Nazad na početnu stranicu Puls tima/}).click();
    await expect(page.getByRole('link',{name:/Iskustvo zaposlenog/})).toBeVisible();
  }
});
