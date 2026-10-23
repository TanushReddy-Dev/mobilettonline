import { test, expect } from '@playwright/test';

const PROGRESS_KEY = 'wtt-progress-v1';
const DEFAULT_STATE = {
  version: 1,
  wins: 0,
  losses: 0,
  currentStreak: 0,
  bestStreak: 0,
  selectedSkin: 'classic'
};

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

async function seedProgress(page, state) {
  await page.addInitScript(({ key, seed }) => {
    try {
      if (!sessionStorage.getItem('wtt-progress-seeded')) {
        sessionStorage.setItem('wtt-progress-seeded', '1');
        localStorage.setItem(key, JSON.stringify(seed));
      }
    } catch (_) {}
  }, { key: PROGRESS_KEY, seed: state });
}

test('progression module sanitizes records, unlocks skins and persists selection', async ({ page }) => {
  await page.goto('/');

  const result = await page.evaluate(() => {
    const P = window.PocketProgression;
    const memory = new Map();
    const storage = {
      getItem: key => (memory.has(key) ? memory.get(key) : null),
      setItem: (key, value) => memory.set(key, String(value))
    };

    const store = P.createStore(storage);
    const initial = store.getState();
    const winOne = store.recordMatch(true);
    const winTwo = store.recordMatch(true);
    const loss = store.recordMatch(false);
    const locked = store.selectSkin('gold');
    const unlocked = store.selectSkin('ink');
    const selected = store.getState();

    // Corrupt JSON must fall back to defaults without throwing.
    storage.setItem(P.STORAGE_KEY, '{ not valid json');
    const fallback = P.createStore(storage).getState();

    // A selected skin that is no longer unlocked must fall back to Classic.
    storage.setItem(P.STORAGE_KEY, JSON.stringify({ wins: 1, selectedSkin: 'gold' }));
    const recovered = P.createStore(storage).getState();

    // Keep this inside evaluate so the assertions run against the browser copy.
    return {
      storageKey: P.STORAGE_KEY,
      skinIds: P.SKINS.map(skin => skin.id),
      initial,
      winOne: {
        state: winOne.state,
        newlyUnlocked: winOne.newlyUnlocked.map(skin => skin.id),
        next: winOne.nextSkin && winOne.nextSkin.id
      },
      winTwo: {
        state: winTwo.state,
        newlyUnlocked: winTwo.newlyUnlocked.map(skin => skin.id),
        next: winTwo.nextSkin && winTwo.nextSkin.id
      },
      loss: loss.state,
      locked: { ok: locked.ok, reason: locked.reason },
      unlocked: { ok: unlocked.ok },
      selected,
      fallback,
      recovered
    };
  });

  expect(result.storageKey).toBe(PROGRESS_KEY);
  expect(result.skinIds).toEqual(['classic', 'ink', 'sage', 'rust', 'gold']);
  expect(result.initial).toEqual(DEFAULT_STATE);

  expect(result.winOne.state).toMatchObject({ wins: 1, losses: 0, currentStreak: 1, bestStreak: 1 });
  expect(result.winOne.newlyUnlocked).toEqual([]);
  expect(result.winOne.next).toBe('ink');

  expect(result.winTwo.state).toMatchObject({ wins: 2, losses: 0, currentStreak: 2, bestStreak: 2 });
  expect(result.winTwo.newlyUnlocked).toEqual(['ink']);
  expect(result.winTwo.next).toBe('sage');

  expect(result.loss).toMatchObject({ wins: 2, losses: 1, currentStreak: 0, bestStreak: 2 });
  expect(result.locked).toEqual({ ok: false, reason: 'locked' });
  expect(result.unlocked.ok).toBe(true);
  expect(result.selected.selectedSkin).toBe('ink');
  expect(result.fallback).toEqual(DEFAULT_STATE);
  expect(result.recovered.selectedSkin).toBe('classic');
});

test('shows the win record and locks paddle skins behind wins', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedProgress(page, {
    version: 1,
    wins: 2,
    losses: 3,
    currentStreak: 1,
    bestStreak: 4,
    selectedSkin: 'ink'
  });
  await page.goto('/');

  await expect(page.locator('#record-streak')).toHaveText('1');
  await expect(page.locator('#record-best')).toHaveText('4');
  await expect(page.locator('#record-wins')).toHaveText('2');
  await expect(page.locator('#paddle-skin-name')).toHaveText('Ink');

  const ink = page.locator('#paddle-skin-list [data-skin="ink"]');
  const sage = page.locator('#paddle-skin-list [data-skin="sage"]');
  const gold = page.locator('#paddle-skin-list [data-skin="gold"]');

  await expect(ink).toHaveAttribute('aria-pressed', 'true');
  await expect(ink).toHaveAttribute('aria-disabled', 'false');
  await expect(sage).toHaveAttribute('aria-disabled', 'true');
  await expect(gold).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('#paddle-skin-hint')).toContainText('4 wins');

  // A locked skin explains its threshold and never steals the selection.
  // Playwright refuses clicks on aria-disabled controls; force the tap because
  // real touch users can still press it and should get the explanation.
  await gold.click({ force: true });
  await expect(page.locator('#paddle-skin-name')).toHaveText('Ink');
  await expect(page.locator('#paddle-skin-hint')).toContainText('Gold unlocks at 12 wins');

  // Choose an unlocked skin and reload: the selection is persistent.
  await page.locator('#paddle-skin-list [data-skin="classic"]').click();
  await expect(page.locator('#paddle-skin-name')).toHaveText('Classic');
  let stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), PROGRESS_KEY);
  expect(stored.selectedSkin).toBe('classic');

  await page.reload();
  await expect(page.locator('#paddle-skin-name')).toHaveText('Classic');
  await expect(page.locator('#paddle-skin-list [data-skin="classic"]')).toHaveAttribute('aria-pressed', 'true');
});

test('recovers from corrupt stored progress without errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.addInitScript(key => {
    try { localStorage.setItem(key, '{"wins": "nope",'); } catch (_) {}
  }, PROGRESS_KEY);
  await page.goto('/');

  await expect(page.locator('#record-wins')).toHaveText('0');
  await expect(page.locator('#record-best')).toHaveText('0');
  await expect(page.locator('#paddle-skin-name')).toHaveText('Classic');
  await expect(page.locator('#paddle-skin-list [data-skin="classic"]')).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('records completed matches, unlocks a skin and resets the streak on a loss', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedProgress(page, {
    version: 1,
    wins: 1,
    losses: 0,
    currentStreak: 0,
    bestStreak: 0,
    selectedSkin: 'classic'
  });
  await page.goto('/?e2e=1');

  // Win: the second win unlocks Ink and keeps the streak at one.
  await page.getByRole('button', { name: /play solo match/i }).click();
  await page.waitForFunction(() => Boolean(window.__WTT_E2E__));
  expect(await page.evaluate(() => window.__WTT_E2E__.finishMatch(true))).toBe(true);

  await expect(page.locator('#match-modal')).toHaveClass(/is-open/, { timeout: 5000 });
  await expect(page.locator('#match-progress')).toBeVisible();
  await expect(page.locator('#match-progress-title')).toContainText('NEW PADDLE');
  await expect(page.locator('#match-progress-title')).toContainText('INK');

  let stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), PROGRESS_KEY);
  expect(stored).toMatchObject({ wins: 2, losses: 0, currentStreak: 1, bestStreak: 1, selectedSkin: 'classic' });

  await page.locator('#btn-match-menu').click();
  await expect(page.locator('#start-modal')).toHaveClass(/is-open/);
  await expect(page.locator('#record-wins')).toHaveText('2');
  await expect(page.locator('#record-streak')).toHaveText('1');
  await expect(page.locator('#record-best')).toHaveText('1');
  await expect(page.locator('#paddle-skin-list [data-skin="ink"]')).toHaveAttribute('aria-disabled', 'false');

  // Loss: the current streak resets, the best streak survives.
  await page.getByRole('button', { name: /play solo match/i }).click();
  await page.waitForFunction(() => Boolean(window.__WTT_E2E__));
  expect(await page.evaluate(() => window.__WTT_E2E__.finishMatch(false))).toBe(true);

  await expect(page.locator('#match-modal')).toHaveClass(/is-open/, { timeout: 5000 });
  await expect(page.locator('#match-progress-title')).toHaveText('STREAK RESET');
  stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), PROGRESS_KEY);
  expect(stored).toMatchObject({ wins: 2, losses: 1, currentStreak: 0, bestStreak: 1 });

  await page.locator('#btn-match-menu').click();
  await expect(page.locator('#record-streak')).toHaveText('0');
  await expect(page.locator('#record-best')).toHaveText('1');
  await expect(page.locator('#record-wins')).toHaveText('2');
});

test('keeps the record and paddle rail inside a 320px start screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');

  await expect(page.locator('#record-strip')).toBeVisible();
  // Primary actions must stay above the fold on a short phone; the secondary
  // locker follows them and remains reachable in the scrollable sheet.
  const actionsInSheet = await page.evaluate(() => {
    const sheet = document.querySelector('.start-sheet').getBoundingClientRect();
    const measure = id => {
      const r = document.getElementById(id).getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, sheetTop: sheet.top, sheetBottom: sheet.bottom };
    };
    return { primary: measure('btn-start-match'), online: measure('btn-open-online') };
  });
  expect(actionsInSheet.primary.top).toBeGreaterThanOrEqual(actionsInSheet.primary.sheetTop);
  expect(actionsInSheet.primary.bottom).toBeLessThanOrEqual(actionsInSheet.primary.sheetBottom + 1);
  expect(actionsInSheet.online.top).toBeGreaterThanOrEqual(actionsInSheet.online.sheetTop);
  expect(actionsInSheet.online.bottom).toBeLessThanOrEqual(actionsInSheet.online.sheetBottom + 1);

  await page.locator('#paddle-skin-list').scrollIntoViewIfNeeded();
  for (const id of ['classic', 'ink', 'sage', 'rust', 'gold']) {
    const box = await page.locator(`#paddle-skin-list [data-skin="${id}"]`).boundingBox();
    expect(box, id).not.toBeNull();
    expect(box.width, id).toBeGreaterThanOrEqual(44);
    expect(box.height, id).toBeGreaterThanOrEqual(44);
  }

  const overflow = await page.evaluate(() => {
    const sheet = document.querySelector('.start-sheet');
    return { scrollWidth: sheet.scrollWidth, clientWidth: sheet.clientWidth };
  });
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

  await page.locator('#btn-start-match').scrollIntoViewIfNeeded();
  await expect(page.locator('#btn-start-match')).toBeVisible();
});
