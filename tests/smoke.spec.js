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

  await expect(page).toHaveTitle(/Pocket Table Tennis/);
  await expect(page.locator('#start-modal')).toHaveClass(/is-open/);
  const brandLogo = page.locator('#start-modal .brand-tile img');
  await expect(brandLogo).toBeVisible();
  await expect.poll(() => brandLogo.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(page.locator('#modal-settings')).not.toHaveClass(/is-open/);
  await expect(page.locator('#pause-remote-request')).toHaveClass(/hidden/);
  await expect(page.locator('#match-remote-request')).toHaveClass(/hidden/);

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

test('centers the start-screen utility icons and exposes fullscreen state', async ({ page }) => {
  await page.goto('/');

  const layout = await page.evaluate(() => {
    const measure = (id) => {
      const button = document.getElementById(id);
      const icon = button.querySelector('svg:not(.hidden)');
      const b = button.getBoundingClientRect();
      const i = icon.getBoundingClientRect();
      const enter = button.querySelector('.menu-fullscreen-enter');
      const exit = button.querySelector('.menu-fullscreen-exit');
      return {
        display: getComputedStyle(button).display,
        dx: (i.left + i.width / 2) - (b.left + b.width / 2),
        dy: (i.top + i.height / 2) - (b.top + b.height / 2),
        unavailable: button.classList.contains('is-unavailable'),
        label: button.getAttribute('aria-label'),
        enterHidden: enter ? enter.classList.contains('hidden') : null,
        exitHidden: exit ? exit.classList.contains('hidden') : null
      };
    };
    return { sound: measure('menu-btn-sound'), fullscreen: measure('menu-btn-fullscreen') };
  });

  for (const control of [layout.sound, layout.fullscreen]) {
    if (control.unavailable) continue;
    expect(control.display).toMatch(/flex/);
    expect(Math.abs(control.dx)).toBeLessThan(0.75);
    expect(Math.abs(control.dy)).toBeLessThan(0.75);
  }
  if (!layout.fullscreen.unavailable) {
    expect(layout.fullscreen.label).toMatch(/fullscreen/i);
    expect(layout.fullscreen.enterHidden).toBe(false);
    expect(layout.fullscreen.exitHidden).toBe(true);
  }
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
  await expect(page.locator('#serve-action')).toBeVisible();
  await expect(page.locator('#player-score')).toHaveText('0');
});

test('serves again with keyboard Space after a point', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /play solo match/i }).click();

  // A point is played out without returning the serve; whichever player wins,
  // the server stays the same after the first point. The next Space press must
  // start a fresh rally, not be ignored by the old "already served" guard.
  await page.keyboard.press('Space');
  await page.waitForFunction(() => {
    const player = Number(document.getElementById('player-score').textContent);
    const ai = Number(document.getElementById('ai-score').textContent);
    return player + ai > 0;
  }, null, { timeout: 15000 });

  await expect(page.locator('#rally-count')).toHaveText('0', { timeout: 5000 });
  await page.keyboard.press('Space');
  await expect.poll(async () => Number(await page.locator('#rally-count').textContent()), {
    timeout: 3000
  }).toBeGreaterThan(0);
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

test('keeps the narrow-phone HUD free of overlap', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.getByRole('button', { name: /play solo match/i }).click();
  await expect(page.locator('#top-hud')).not.toHaveClass(/is-menu/);

  const layout = await page.evaluate(() => {
    const badge = document.getElementById('player-serve-badge');
    const center = document.querySelector('.hud-score-center').getBoundingClientRect();
    const badgeBox = badge.getBoundingClientRect();
    return {
      badgeDisplay: getComputedStyle(badge).display,
      overlap: badgeBox.right > center.left,
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth
    };
  });

  expect(layout.badgeDisplay).toBe('none');
  expect(layout.overlap).toBe(false);
  expect(layout.pageOverflow).toBe(false);
});

test('keeps HUD geometry stable when serve and streak badges change', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /play solo match/i }).click();
  await expect(page.locator('#top-hud')).not.toHaveClass(/is-menu/);

  const snapshot = () => page.evaluate(() => {
    const box = id => {
      const r = document.getElementById(id).getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    const scoreboard = document.querySelector('.hud-scoreboard').getBoundingClientRect();
    const canvas = document.getElementById('table-canvas').getBoundingClientRect();
    return {
      hudHeight: document.getElementById('top-hud').getBoundingClientRect().height,
      scoreboardHeight: scoreboard.height,
      canvasTop: canvas.top,
      playerScore: box('player-score'),
      aiScore: box('ai-score'),
      meta: box('hud-meta'),
      pageOverflow: document.documentElement.scrollWidth > innerWidth
    };
  });
  const expectStable = (actual, expected, label) => {
    expect(Math.abs(actual - expected), label).toBeLessThan(0.75);
  };

  const baseline = await snapshot();

  // Switch the service indicator without waiting for a real point. The score
  // digits must not slide sideways as the badge changes.
  await page.evaluate(() => {
    document.getElementById('player-serve-badge').classList.add('is-serve-hidden');
    document.getElementById('ai-serve-badge').classList.remove('is-serve-hidden');
  });
  await page.waitForTimeout(250);
  const aiServe = await snapshot();

  // The transient online/streak telemetry is overlaid, not added to the
  // scoreboard's flow, so the canvas must not move down when it appears.
  await page.evaluate(() => {
    document.getElementById('online-badge').classList.remove('hidden');
    const streak = document.getElementById('streak-badge');
    streak.textContent = '3★ HAT TRICK';
    streak.classList.remove('hidden');
  });
  await page.waitForTimeout(250);
  const telemetry = await snapshot();

  for (const [name, state] of [['ai serve', aiServe], ['telemetry', telemetry]]) {
    expectStable(state.hudHeight, baseline.hudHeight, `${name}: HUD height`);
    expectStable(state.scoreboardHeight, baseline.scoreboardHeight, `${name}: scoreboard height`);
    expectStable(state.canvasTop, baseline.canvasTop, `${name}: canvas top`);
    expectStable(state.playerScore.left, baseline.playerScore.left, `${name}: player score x`);
    expectStable(state.aiScore.left, baseline.aiScore.left, `${name}: AI score x`);
    expect(state.pageOverflow, `${name}: page overflow`).toBe(false);
  }
  expect(telemetry.meta.left).toBeGreaterThanOrEqual(0);
  expect(telemetry.meta.right).toBeLessThanOrEqual(390);

  // On a wider HUD the badges are visible. Their fixed slots must still keep
  // the score digits from moving when the server changes.
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.evaluate(() => {
    document.getElementById('player-serve-badge').classList.remove('is-serve-hidden');
    document.getElementById('ai-serve-badge').classList.add('is-serve-hidden');
  });
  await page.waitForTimeout(250);
  const tabletPlayer = await snapshot();
  await page.evaluate(() => {
    document.getElementById('player-serve-badge').classList.add('is-serve-hidden');
    document.getElementById('ai-serve-badge').classList.remove('is-serve-hidden');
  });
  await page.waitForTimeout(250);
  const tabletAi = await snapshot();
  expectStable(tabletAi.playerScore.left, tabletPlayer.playerScore.left, 'tablet: player score x');
  expectStable(tabletAi.aiScore.left, tabletPlayer.aiScore.left, 'tablet: AI score x');
  expectStable(tabletAi.hudHeight, tabletPlayer.hudHeight, 'tablet: HUD height');
  const badgeWidths = await page.evaluate(() => [
    getComputedStyle(document.getElementById('player-serve-badge')).width,
    getComputedStyle(document.getElementById('ai-serve-badge')).width
  ]);
  expect(badgeWidths).toEqual(['47px', '47px']);
});

test('keeps difficulty and destructive actions out of the HUD', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#start-modal .difficulty-btn')).toHaveCount(3);

  await page.getByRole('button', { name: /play solo match/i }).click();
  await expect(page.locator('#top-hud')).not.toHaveClass(/is-menu/);

  await expect(page.locator('#top-hud .difficulty-btn')).toHaveCount(0);
  await expect(page.locator('#top-hud #btn-restart')).toHaveCount(0);
  await expect(page.locator('#top-hud #btn-practice')).toHaveCount(0);
  // Phones use the readable serve status instead of the cramped badge.
  await expect(page.locator('#player-spin-label')).toHaveText('Your Serve');
  await expect(page.locator('#player-serve-badge')).toBeHidden();

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
