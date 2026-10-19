import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      if (!sessionStorage.getItem('wtt-test-cleared')) {
        sessionStorage.setItem('wtt-test-cleared', '1');
        localStorage.clear();
      }
    } catch (_) {}
  });
});

test('loads the menu with valid, non-nested modals', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');

  await expect(page).toHaveTitle(/WTT Arena Pro/);
  await expect(page.locator('#start-modal')).toHaveClass(/is-open/);
  await expect(page.locator('#modal-settings')).not.toHaveClass(/is-open/);

  const structure = await page.evaluate(() => {
    const ids = Array.from(document.querySelectorAll('[id]')).map(el => el.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    const settings = document.getElementById('modal-settings');
    const howTo = document.getElementById('modal-how-to-play');
    const online = document.getElementById('online-modal');
    const match = document.getElementById('match-modal');
    return {
      duplicates: [...new Set(duplicates)],
      settingsInsideHowTo: howTo.contains(settings),
      howToInsideSettings: settings.contains(howTo),
      onlineInsideSettings: settings.contains(online),
      settingsParent: settings.parentElement.id,
      onlineParent: online.parentElement.id,
      matchParent: match.parentElement.id
    };
  });

  expect(structure.duplicates).toEqual([]);
  expect(structure.settingsInsideHowTo).toBe(false);
  expect(structure.howToInsideSettings).toBe(false);
  expect(structure.onlineInsideSettings).toBe(false);
  expect(structure.settingsParent).toBe('game-wrapper');
  expect(structure.onlineParent).toBe('game-wrapper');
  expect(structure.matchParent).toBe('game-wrapper');
  expect(errors).toEqual([]);
});

test('opens and closes settings and how-to-play dialogs', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /settings/i }).first().click();
  await expect(page.locator('#modal-settings')).toHaveClass(/is-open/);
  await expect(page.locator('#modal-settings')).toBeVisible();
  await page.getByRole('button', { name: 'Close settings' }).click();
  await expect(page.locator('#modal-settings')).not.toHaveClass(/is-open/);

  await page.locator('#menu-btn-how-to-play').click();
  await expect(page.locator('#modal-how-to-play')).toHaveClass(/is-open/);
  await expect(page.getByRole('heading', { name: 'HOW TO PLAY' })).toBeVisible();
  await page.getByRole('button', { name: 'Close how to play' }).click();
  await expect(page.locator('#modal-how-to-play')).not.toHaveClass(/is-open/);
});

test('starts a solo match and shows the in-game HUD', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /play solo match/i }).click();

  await expect(page.locator('#start-modal')).not.toHaveClass(/is-open/);
  await expect(page.locator('#top-hud')).not.toHaveClass(/is-menu/);
  await expect(page.locator('#table-canvas')).toBeVisible();
  await expect(page.locator('#btn-hud-pause')).toBeVisible();
  await expect(page.locator('#player-score')).toHaveText('0');
});

test('persists sound, haptics and speed-unit preferences', async ({ page }) => {
  await page.goto('/');

  const mute = page.locator('#menu-btn-sound');
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: /settings/i }).first().click();
  await page.locator('#setting-toggle-haptics').click();
  await expect(page.locator('#setting-toggle-haptics')).toHaveText('OFF');
  await page.locator('#setting-toggle-speed-unit').click();
  await expect(page.locator('#setting-toggle-speed-unit')).toHaveText('MPH');

  const stored = await page.evaluate(() => ({
    muted: localStorage.getItem('wtt-arena-muted'),
    haptics: localStorage.getItem('wtt-arena-haptics'),
    speed: localStorage.getItem('wtt-arena-speed-kmh')
  }));
  expect(stored).toEqual({ muted: 'true', haptics: 'false', speed: 'false' });

  await page.reload();
  await expect(page.locator('#menu-btn-sound')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#btn-mute')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /settings/i }).first().click();
  await expect(page.locator('#setting-toggle-haptics')).toHaveText('OFF');
  await expect(page.locator('#setting-toggle-speed-unit')).toHaveText('MPH');
});

test('creates a six-character online room code', async ({ page }) => {
  await page.route('**/unpkg.com/**', route => route.abort());
  await page.route('**/cdn.jsdelivr.net/**', route => route.abort());

  await page.goto('/');
  await page.locator('#btn-open-online').click();

  await expect(page.locator('#online-modal')).toHaveClass(/is-open/);
  await expect(page.locator('#host-code-display')).toHaveText(/^[A-Z0-9]{6}$/);
  await expect(page.locator('#start-modal')).not.toHaveClass(/is-open/);

  await page.getByRole('button', { name: 'Close online arena' }).click();
  await expect(page.locator('#online-modal')).not.toHaveClass(/is-open/);
  await expect(page.locator('#start-modal')).toHaveClass(/is-open/);
});

test('keeps keyboard focus inside the open dialog', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /settings/i }).first().click();
  await expect(page.locator('#modal-settings')).toHaveClass(/is-open/);

  const inside = await expect.poll(async () => {
    return page.evaluate(() => {
      const dialog = document.getElementById('modal-settings');
      return dialog.contains(document.activeElement);
    });
  }).toBe(true);

  await page.keyboard.press('Escape');
  await expect(page.locator('#modal-settings')).not.toHaveClass(/is-open/);
});

test('keeps HUD controls inside the app frame with touch-sized targets', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/');
  await page.getByRole('button', { name: /play solo match/i }).click();
  await expect(page.locator('#top-hud')).not.toHaveClass(/is-menu/);

  const metrics = await page.evaluate(() => {
    const wrapper = document.getElementById('game-wrapper').getBoundingClientRect();
    const hud = document.getElementById('top-hud');
    const buttons = Array.from(hud.querySelectorAll('button')).map(b => {
      const r = b.getBoundingClientRect();
      return {
        id: b.id,
        width: r.width,
        height: r.height,
        inside: r.left >= wrapper.left - 1 && r.right <= wrapper.right + 1 &&
                r.top >= wrapper.top - 1 && r.bottom <= wrapper.bottom + 1
      };
    });
    return { buttons, clipped: hud.scrollWidth > hud.clientWidth + 1 };
  });

  expect(metrics.clipped).toBe(false);
  expect(metrics.buttons.length).toBeGreaterThanOrEqual(3);
  for (const button of metrics.buttons) {
    expect(button.inside, button.id).toBe(true);
    expect(button.width, button.id).toBeGreaterThanOrEqual(43.5);
    expect(button.height, button.id).toBeGreaterThanOrEqual(43.5);
  }
});

test('keeps difficulty and destructive actions out of the HUD', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#start-modal .difficulty-btn')).toHaveCount(3);

  await page.getByRole('button', { name: /play solo match/i }).click();
  await expect(page.locator('#top-hud')).not.toHaveClass(/is-menu/);

  await expect(page.locator('#top-hud .difficulty-btn')).toHaveCount(0);
  await expect(page.locator('#top-hud #btn-restart')).toHaveCount(0);
  await expect(page.locator('#top-hud #btn-practice')).toHaveCount(0);
  await expect(page.locator('#player-serve-badge')).toBeVisible();

  // Restart is still available, but only through the pause hub.
  await page.locator('#btn-hud-pause').click();
  await expect(page.locator('#modal-pause')).toHaveClass(/is-open/);
  await expect(page.locator('#pause-btn-restart')).toHaveText(/RESTART MATCH/);
});

test('prompts portrait play in a short landscape viewport', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');

  await expect(page.locator('#rotate-overlay')).toBeVisible();
  await page.getByRole('button', { name: /continue anyway/i }).click();
  await expect(page.locator('#rotate-overlay')).toBeHidden();
  await expect(page.locator('#start-modal')).toHaveClass(/is-open/);
});

test('hints that how-to-play scrolls on small screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.locator('#menu-btn-how-to-play').click();

  const hint = page.locator('#howto-more-btn');
  await expect(hint).toHaveClass(/visible/);
  await hint.click();
  await expect(hint).not.toHaveClass(/visible/);
  await expect.poll(() => page.evaluate(() => {
    const scroller = document.getElementById('howto-scroll');
    return scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 6;
  })).toBe(true);
});

test('toggles the speed unit from the HUD readout', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /play solo match/i }).click();

  const speed = page.locator('#speed-readout');
  await expect(speed).toHaveText(/KM\/H/);
  await speed.click();
  await expect(speed).toHaveText(/MPH/);
  await speed.click();
  await expect(speed).toHaveText(/KM\/H/);
});
