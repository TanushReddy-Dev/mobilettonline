import { test, expect } from '@playwright/test';

// This test uses the public PeerJS signaling service and real WebRTC between
// two browser contexts, so it depends on network access. Run it explicitly:
//
//   RUN_ONLINE_TESTS=1 npm test
//
// The regular suite stays offline and deterministic.
test.skip(process.env.RUN_ONLINE_TESTS !== '1', 'set RUN_ONLINE_TESTS=1 to run');

test('host and guest connect, serve, pause, restart and handle a disconnect', async ({ browser }) => {
  test.setTimeout(120_000);

  const hostContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await host.goto('/');
  await host.locator('#btn-open-online').click();
  await expect(host.locator('#online-status-text')).toContainText('Waiting for opponent', { timeout: 25_000 });
  const code = (await host.locator('#host-code-display').textContent()).trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);

  await guest.goto('/');
  await guest.locator('#btn-open-online').click();
  await guest.locator('#tab-join').click();
  await guest.locator('#input-room-code').fill(code);
  await guest.locator('#btn-join-room').click();

  await expect(host.locator('#top-hud')).not.toHaveClass(/is-menu/, { timeout: 30_000 });
  await expect(guest.locator('#top-hud')).not.toHaveClass(/is-menu/, { timeout: 30_000 });
  await expect(host.locator('#online-badge')).not.toHaveClass(/hidden/);
  await expect(guest.locator('#online-badge')).not.toHaveClass(/hidden/);

  // The old in-HUD difficulty switcher could restart an online match locally
  // and desync the score. Destructive actions must stay inside the pause hub.
  for (const page of [host, guest]) {
    expect(await page.locator('#top-hud .difficulty-btn').count()).toBe(0);
    expect(await page.locator('#top-hud #btn-restart').count()).toBe(0);
    expect(await page.locator('#top-hud #btn-practice').count()).toBe(0);
    expect(await page.locator('#top-hud #btn-online').count()).toBe(0);
  }

  // The host is the first server and serves through the explicit control.
  // The receiving guest never gets a local serve button.
  await expect(host.locator('#serve-action')).toBeVisible({ timeout: 10_000 });
  await expect(guest.locator('#serve-action')).toBeHidden();
  await host.locator('#serve-action').click();
  await expect(host.locator('#rally-count')).toHaveText('1', { timeout: 10_000 });
  await expect(guest.locator('#rally-count')).toHaveText('1', { timeout: 10_000 });

  // Pause is host-authoritative and must reach the guest.
  await host.locator('#btn-hud-pause').click();
  await expect(host.locator('#modal-pause')).toHaveClass(/is-open/);
  await expect(guest.locator('#modal-pause')).toHaveClass(/is-open/, { timeout: 10_000 });
  await host.locator('#pause-btn-resume').click();
  await expect(guest.locator('#modal-pause')).not.toHaveClass(/is-open/, { timeout: 10_000 });

  // A host restart must reset the guest's match too. Restart now lives inside
  // the pause hub so an accidental HUD tap cannot interrupt a match.
  await host.locator('#btn-hud-pause').click();
  await expect(guest.locator('#modal-pause')).toHaveClass(/is-open/, { timeout: 10_000 });
  await host.locator('#pause-btn-restart').click();
  await expect(host.locator('#rally-count')).toHaveText('0');
  await expect(guest.locator('#rally-count')).toHaveText('0', { timeout: 10_000 });
  await expect(guest.locator('#top-hud')).not.toHaveClass(/is-menu/);
  await expect(guest.locator('#modal-pause')).not.toHaveClass(/is-open/, { timeout: 10_000 });

  // A guest restart is a request; the host must remain authoritative.
  await guest.locator('#btn-hud-pause').click();
  await expect(guest.locator('#modal-pause')).toHaveClass(/is-open/, { timeout: 10_000 });
  await guest.locator('#pause-btn-restart').click();
  await expect(host.locator('#point-banner-text')).toContainText('OPPONENT REQUESTED A RESTART');
  // The request resumes both clients first, so the host re-opens pause to confirm.
  await host.locator('#btn-hud-pause').click();
  await expect(guest.locator('#modal-pause')).toHaveClass(/is-open/, { timeout: 10_000 });
  await host.locator('#pause-btn-restart').click();
  await expect(host.locator('#rally-count')).toHaveText('0');
  await expect(guest.locator('#rally-count')).toHaveText('0', { timeout: 10_000 });
  await expect(guest.locator('#top-hud')).not.toHaveClass(/is-menu/);

  // Closing the guest must end the match instead of silently falling back to AI.
  await guestContext.close();
  // A browser crash/close may not deliver a clean DataChannel close event, so
  // allow the 15s silent-link watchdog to detect it.
  await expect(host.locator('#match-modal')).toHaveClass(/is-open/, { timeout: 25_000 });
  await expect(host.locator('#match-result-title')).toHaveText('OPPONENT LEFT');
  await expect(host.locator('#btn-play-again-label')).toHaveText('MAIN MENU');
  await host.locator('#btn-play-again').click();
  await expect(host.locator('#start-modal')).toHaveClass(/is-open/);

  await hostContext.close();
});

test('online host and guest persist the authoritative result exactly once', async ({ browser }) => {
  test.setTimeout(120_000);

  const hostContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await hostContext.addInitScript(() => {
    try {
      localStorage.setItem('wtt-progress-v1', JSON.stringify({
        version: 1, wins: 0, losses: 0, currentStreak: 0, bestStreak: 0, selectedSkin: 'classic'
      }));
    } catch (_) {}
  });
  await guestContext.addInitScript(() => {
    try {
      localStorage.setItem('wtt-progress-v1', JSON.stringify({
        version: 1, wins: 3, losses: 0, currentStreak: 2, bestStreak: 3, selectedSkin: 'classic'
      }));
    } catch (_) {}
  });

  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await host.goto('/?e2e=1');
  await host.locator('#btn-open-online').click();
  await expect(host.locator('#online-status-text')).toContainText('Waiting for opponent', { timeout: 25_000 });
  const code = (await host.locator('#host-code-display').textContent()).trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);

  await guest.goto('/');
  await guest.locator('#btn-open-online').click();
  await guest.locator('#tab-join').click();
  await guest.locator('#input-room-code').fill(code);
  await guest.locator('#btn-join-room').click();

  await expect(host.locator('#top-hud')).not.toHaveClass(/is-menu/, { timeout: 30_000 });
  await expect(guest.locator('#top-hud')).not.toHaveClass(/is-menu/, { timeout: 30_000 });

  const progress = page => page.evaluate(() =>
    JSON.parse(localStorage.getItem('wtt-progress-v1')));

  // Both pages start with their seeded, distinct records.
  expect(await progress(host)).toMatchObject({ wins: 0, currentStreak: 0 });
  expect(await progress(guest)).toMatchObject({ wins: 3, currentStreak: 2, bestStreak: 3 });

  // Only the authoritative host exposes a usable finish hook. The guest's
  // loss must arrive through the host's GAME_OVER snapshot instead.
  expect(await guest.evaluate(() => Boolean(window.__WTT_E2E__))).toBe(false);
  expect(await host.evaluate(() => window.__WTT_E2E__.finishMatch(true))).toBe(true);

  await expect(host.locator('#match-modal')).toHaveClass(/is-open/, { timeout: 10_000 });
  await expect(guest.locator('#match-modal')).toHaveClass(/is-open/, { timeout: 10_000 });

  // The guest's progress card appears only after the authoritative snapshot.
  await expect(guest.locator('#match-progress-title')).toHaveText('STREAK RESET', { timeout: 10_000 });
  await expect(host.locator('#match-progress-title')).toHaveText('WIN STREAK STARTED');
  await expect(host.locator('#match-progress-detail')).toContainText('Next paddle at 2 wins');

  const hostResult = await progress(host);
  const guestResult = await progress(guest);
  expect(hostResult).toMatchObject({
    wins: 1, losses: 0, currentStreak: 1, bestStreak: 1, selectedSkin: 'classic'
  });
  expect(guestResult).toMatchObject({
    wins: 3, losses: 1, currentStreak: 0, bestStreak: 3, selectedSkin: 'classic'
  });

  // Repeated GAME_OVER snapshots must not double-count on the guest.
  await guest.waitForTimeout(600);
  expect(await progress(guest)).toMatchObject({
    wins: 3, losses: 1, currentStreak: 0, bestStreak: 3
  });

  await hostContext.close();
  await guestContext.close();
});
