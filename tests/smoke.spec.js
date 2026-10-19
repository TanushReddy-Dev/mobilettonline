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
