import { expect, test, type Page } from '@playwright/test';

async function openReadyWorkstation(page: Page): Promise<void> {
  await page.goto('./');
  await expect(page.locator('#viewport canvas')).toBeVisible();
  await expect(page.locator('#planHeading')).toHaveText('轨迹就绪');
  await expect(page.getByRole('button', { name: '开始制作' })).toBeEnabled();
}

async function finishAndCheckResult(page: Page, strokeCount: number): Promise<void> {
  await page.getByRole('button', { name: '俯视工件' }).click();
  await page.getByLabel('机械臂', { exact: true }).uncheck();
  await page.getByLabel('目标辅助线').uncheck();
  const canvas = page.locator('#viewport canvas');
  const before = await canvas.screenshot();
  await page.getByLabel('播放速度').selectOption('4');
  await page.getByRole('button', { name: '开始制作' }).click();
  await expect(page.locator('#planHeading')).toHaveText('制作完成');
  await expect(page.locator('#drawnCount')).toHaveText(`已绘笔画 ${strokeCount} / ${strokeCount}`);
  await expect(page.locator('#progress')).toHaveJSProperty('value', 1);
  const after = await canvas.screenshot();
  expect(after.equals(before)).toBe(false);
}

test('生产页面能加载三维视图并完成默认规划', async ({ page }) => {
  await openReadyWorkstation(page);
  await expect(page.locator('#workspaceName')).toHaveText('笔绘工作站');
});

test('笔绘完成后显示实际笔迹', async ({ page }) => {
  await openReadyWorkstation(page);
  await page.getByRole('button', { name: /汉字「中」/ }).click();
  await expect(page.locator('#planHeading')).toHaveText('轨迹就绪');
  await expect(page.locator('#resultLegend')).toHaveText('实际笔迹');
  await finishAndCheckResult(page, 4);
});

test('奶油裱花完成后显示奶油条带', async ({ page }) => {
  await openReadyWorkstation(page);
  await page.getByRole('button', { name: /奶油裱花/ }).click();
  await page.getByRole('button', { name: /汉字「中」/ }).click();
  await expect(page.locator('#planHeading')).toHaveText('轨迹就绪');
  await expect(page.locator('#workspaceName')).toHaveText('奶油裱花工作站');
  await expect(page.locator('#resultLegend')).toHaveText('奶油条带');
  await finishAndCheckResult(page, 4);
});
