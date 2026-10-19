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

  // Tap the host canvas to serve. The host is the first server.
  const box = await host.locator('#table-canvas').boundingBox();
  await host.mouse.move(box.x + box.width / 2, box.y + box.height * 0.7);
  await host.mouse.down();
  await host.waitForTimeout(40);
  await host.mouse.up();
  await expect(host.locator('#rally-count')).toHaveText('1', { timeout: 10_000 });
  await expect(guest.locator('#rally-count')).toHaveText('1', { timeout: 10_000 });

  // Pause is host-authoritative and must reach the guest.
  await host.locator('#btn-hud-pause').click();
  await expect(host.locator('#modal-pause')).toHaveClass(/is-open/);
  await expect(guest.locator('#modal-pause')).toHaveClass(/is-open/, { timeout: 10_000 });
  await host.locator('#pause-btn-resume').click();
  await expect(guest.locator('#modal-pause')).not.toHaveClass(/is-open/, { timeout: 10_000 });

  // A host restart must reset the guest's match too.
  await host.locator('#btn-restart').click();
  await expect(host.locator('#rally-count')).toHaveText('0');
  await expect(guest.locator('#rally-count')).toHaveText('0', { timeout: 10_000 });
  await expect(guest.locator('#top-hud')).not.toHaveClass(/is-menu/);

  // A guest restart is a request; the host must remain authoritative.
  await guest.locator('#btn-restart').click();
  await expect(host.locator('#point-banner-text')).toContainText('OPPONENT REQUESTED A RESTART');
  await host.locator('#btn-restart').click();
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
