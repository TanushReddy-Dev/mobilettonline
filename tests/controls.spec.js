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

async function seedControlMode(page, mode) {
  await page.addInitScript(({ key, value }) => {
    try {
      if (!sessionStorage.getItem('wtt-control-seeded')) {
        sessionStorage.setItem('wtt-control-seeded', '1');
        localStorage.setItem(key, value);
      }
    } catch (_) {}
  }, { key: 'wtt-control-mode', value: mode });
}

async function startMatch(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /play solo match/i }).click();
  await expect(page.locator('#table-canvas')).toBeVisible();
  // Let the paddle settle at its serve position before measuring it.
  await page.waitForTimeout(500);
}

// The player's classic forehand rubber is the only saturated red surface that
// stays in the lower half of the court, so its pixel centroid is a dependable
// proxy for paddle position in headless Chromium.
async function redCentroid(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('table-canvas');
    const context = canvas.getContext('2d');
    const startY = Math.floor(canvas.height * 0.45);
    const height = canvas.height - startY;
    const data = context.getImageData(0, startY, canvas.width, height).data;
    let sumX = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a > 200 && r > 105 && r > g * 1.35 && r > b * 1.12) {
        const x = (i / 4) % canvas.width;
        sumX += x;
        count++;
      }
    }
    return { x: count ? sumX / count : -1, count };
  });
}

test('waits for an explicit serve instead of launching on a tap', async ({ page }) => {
  await startMatch(page);

  const serve = page.locator('#serve-action');
  await expect(serve).toBeVisible();
  const serveBox = await serve.boundingBox();
  expect(serveBox.height).toBeGreaterThanOrEqual(44);

  const box = await page.locator('#table-canvas').boundingBox();
  // A simple tap to position the paddle must not serve.
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.78);
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.up();
  await page.waitForTimeout(300);

  await expect(page.locator('#rally-count')).toHaveText('0');
  await expect(serve).toBeVisible();

  // The explicit button launches the serve and then gets out of the way.
  await serve.click();
  await expect.poll(async () => Number(await page.locator('#rally-count').textContent()), {
    timeout: 4000
  }).toBeGreaterThan(0);
  await expect(serve).toBeHidden();
});

test('relative drag only starts in the lower court and mirrors movement', async ({ page }) => {
  await seedControlMode(page, 'relative');
  await startMatch(page);

  const box = await page.locator('#table-canvas').boundingBox();
  const before = await redCentroid(page);
  expect(before.count).toBeGreaterThan(10);

  // A drag that begins above the lower-30% zone must not touch the paddle.
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.45, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const afterIgnored = await redCentroid(page);
  expect(afterIgnored.count).toBeGreaterThan(10);
  expect(Math.abs(afterIgnored.x - before.x)).toBeLessThan(12);

  // A drag that begins in the lower court mirrors the thumb's horizontal delta.
  await page.mouse.move(box.x + box.width * 0.68, box.y + box.height * 0.80);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.30, box.y + box.height * 0.80, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const afterDrag = await redCentroid(page);
  expect(afterDrag.count).toBeGreaterThan(10);
  expect(afterDrag.x).toBeLessThan(afterIgnored.x - 20);

  // A tap in the relative zone only repositions; it must not serve.
  const serve = page.locator('#serve-action');
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.82);
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.up();
  await page.waitForTimeout(300);
  await expect(page.locator('#rally-count')).toHaveText('0');
  await expect(serve).toBeVisible();

  // A fresh upward drag is the deliberate serve gesture.
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.82);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.77, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => Number(await page.locator('#rally-count').textContent()), {
    timeout: 4000
  }).toBeGreaterThan(0);
  await expect(serve).toBeHidden();
});

test('direct drag style keeps absolute pointer control above the lower court', async ({ page }) => {
  await startMatch(page);

  const box = await page.locator('#table-canvas').boundingBox();
  const before = await redCentroid(page);
  expect(before.count).toBeGreaterThan(10);

  // Direct mode maps the pointer 1:1 anywhere on the canvas, including the
  // upper half that relative mode deliberately ignores.
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.45);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(500);
  const after = await redCentroid(page);
  expect(after.count).toBeGreaterThan(10);
  expect(after.x).toBeGreaterThan(before.x + 20);
});

test('lets the player choose a drag style and persists it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /settings/i }).first().click();

  const direct = page.locator('#setting-control-direct');
  const relative = page.locator('#setting-control-relative');
  await expect(direct).toHaveAttribute('aria-pressed', 'true');
  await expect(relative).toHaveAttribute('aria-pressed', 'false');

  await relative.click();
  await expect(relative).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('wtt-control-mode'))).toBe('relative');

  await page.reload();
  await page.getByRole('button', { name: /settings/i }).first().click();
  await expect(page.locator('#setting-control-relative')).toHaveAttribute('aria-pressed', 'true');

  // Reset preferences returns the drag style to Direct and clears the key.
  await page.locator('#btn-reset-preferences').click();
  await expect(page.locator('#setting-control-direct')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('wtt-control-mode'))).toBeNull();
});
