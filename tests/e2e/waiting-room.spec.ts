import { test, expect } from '@playwright/test';

const neon = process.env.NEON_URL ?? 'http://localhost:5173/neon/';
const paper = process.env.PAPER_URL ?? 'http://localhost:5174/paper/';

test('waiting room shows readiness without a blocking overlay and disbands when a player exits', async ({ browser }) => {
  const a = await browser.newContext(), b = await browser.newContext();
  const host = await a.newPage(), guest = await b.newPage();
  try {
    await host.goto(neon); await guest.goto(paper);
    await host.getByLabel('Callsign').fill('Host');
    await host.getByRole('button', { name: 'Create a room' }).click();
    const code = await host.getByTestId('room-code').innerText();
    await expect(host.locator('.field-overlay')).toHaveCount(0);
    await expect(host.getByTestId('ready-player-0')).toContainText('Not ready');
    await expect(host.getByTestId('ready-player-1')).toContainText('Waiting for a player');
    await host.getByRole('button', { name: 'Ready up', exact: true }).click();
    await expect(host.getByTestId('ready-player-0')).toContainText('✓ Ready');
    await expect(host.getByRole('button', { name: 'Leave room · Back to lobby' })).toBeVisible();
    await guest.getByLabel('Callsign').fill('Guest');
    await guest.getByLabel('Room code', { exact: true }).fill(code);
    await guest.getByRole('button', { name: 'Join →' }).click();
    await expect(guest.getByTestId('ready-player-0')).toContainText('✓ Ready');
    await expect(host.getByTestId('ready-player-1')).toContainText('Guest');
    await expect(host.getByTestId('ready-player-1')).toContainText('Not ready');
    await host.getByRole('button', { name: 'Cancel ready' }).click();
    await expect(guest.getByTestId('ready-player-0')).toContainText('Not ready');
    await host.screenshot({ path: 'test-results/neon-waiting-room.png', fullPage: true });
    await guest.screenshot({ path: 'test-results/paper-waiting-room.png', fullPage: true });
    await host.getByRole('button', { name: 'Leave room · Back to lobby' }).click();
    await expect(host.getByRole('button', { name: 'Create a room' })).toBeVisible();
    await expect(guest.getByRole('heading', { name: 'Room disbanded' })).toBeVisible();
    await expect(guest.locator('.field-overlay')).toHaveCount(0);
    await guest.getByRole('button', { name: 'Back to lobby', exact: true }).click();
    await guest.getByLabel('Room code', { exact: true }).fill(code);
    await guest.getByRole('button', { name: 'Join →' }).click();
    await expect(guest.getByRole('status')).toContainText('Room unavailable');
    await guest.getByRole('button', { name: 'Create a room' }).click();
    await expect(guest.getByTestId('room-code')).not.toHaveText(code);
    await guest.getByRole('button', { name: 'Leave room · Back to lobby' }).click();
  } finally { await a.close(); await b.close(); }
});

test('a host can ready, cancel, and leave before anybody joins', async ({ page }) => {
  await page.goto(neon);
  await page.getByRole('button', { name: 'Create a room' }).click();
  const code = await page.getByTestId('room-code').innerText();
  await page.getByRole('button', { name: 'Ready up', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel ready' }).click();
  await expect(page.getByTestId('ready-player-0')).toContainText('Not ready');
  await page.getByRole('button', { name: 'Leave room · Back to lobby' }).click();
  await expect(page.getByRole('button', { name: 'Create a room' })).toBeVisible();
  await page.getByLabel('Room code', { exact: true }).fill(code);
  await page.getByRole('button', { name: 'Join →' }).click();
  await expect(page.getByRole('status')).toContainText('Room unavailable');
});
