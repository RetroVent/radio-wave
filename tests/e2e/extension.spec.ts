import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, expect, test, type BrowserContext } from '@playwright/test';

const EXTENSION_DIST = resolve(process.cwd(), 'dist');

function resolveChromiumExecutable(): string | undefined {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    '/Users/ishanksahni/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

async function launchExtensionContext(): Promise<{
  context: BrowserContext;
  extensionId: string;
  userDataDir: string;
}> {
  const userDataDir = mkdtempSync(join(tmpdir(), 'vintage-radio-mv3-test-'));
  const executablePath = resolveChromiumExecutable();

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath,
    args: [
      '--headless=new',
      `--disable-extensions-except=${EXTENSION_DIST}`,
      `--load-extension=${EXTENSION_DIST}`,
      '--autoplay-policy=no-user-gesture-required',
      '--mute-audio',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker', { timeout: 15000 });
  }
  const extensionId = serviceWorker.url().split('/')[2];
  return { context, extensionId, userDataDir };
}

test.describe('Vintage Radio — Real Chrome MV3 Extension & AudioWorklet E2E', () => {
  test('loads Manifest V3 service worker cleanly, enforces popup ergonomics, persists settings, and runs zero external requests', async () => {
    const { context, extensionId, userDataDir } = await launchExtensionContext();
    const externalRequests: string[] = [];
    const consoleErrors: string[] = [];

    try {
      expect(extensionId).toMatch(/^[a-z]{32}$/);

      const page = await context.newPage();
      page.on('request', (req) => {
        const url = req.url();
        if (!url.startsWith('chrome-extension://') && !url.startsWith('data:')) {
          externalRequests.push(url);
        }
      });
      page.on('pageerror', (err) => consoleErrors.push(err.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.setViewportSize({ width: 380, height: 550 });
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      // Verify initial default profile is Warm Tabletop
      await expect(page.getByRole('heading', { name: 'Vintage Radio' })).toBeVisible();
      await expect(page.getByTestId('preset-warm-tabletop')).toHaveAttribute(
        'aria-checked',
        'true',
      );
      await expect(page.getByTestId('preset-subtitle')).toContainText('domestic tube receiver');

      // Check popup layout has zero horizontal scrollbar overflow and warm neutral surface
      const layoutMetrics = await page.evaluate(() => {
        const doc = document.documentElement;
        const bodyStyle = window.getComputedStyle(document.body);
        return {
          overflowX: doc.scrollWidth > doc.clientWidth,
          bgColor: bodyStyle.backgroundColor,
          inkColor: bodyStyle.color,
        };
      });
      expect(layoutMetrics.overflowX).toBe(false);
      expect(layoutMetrics.bgColor).toBe('rgb(245, 242, 235)');
      expect(layoutMetrics.inkColor).toBe('rgb(28, 26, 23)');

      // Keyboard navigation across radio profiles (ArrowRight -> Mid-Century AM -> Transistor Pocket)
      await page.getByTestId('preset-warm-tabletop').focus();
      await page.keyboard.press('ArrowRight');
      await expect(page.getByTestId('preset-mid-century-am')).toHaveAttribute(
        'aria-checked',
        'true',
      );
      await page.keyboard.press('ArrowRight');
      await expect(page.getByTestId('preset-transistor-radio')).toHaveAttribute(
        'aria-checked',
        'true',
      );

      // Keyboard 'B' toggles Original / Processed A/B comparison
      await expect(page.getByTestId('compare-processed')).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('b');
      await expect(page.getByTestId('compare-original')).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('b');
      await expect(page.getByTestId('compare-processed')).toHaveAttribute('aria-pressed', 'true');

      // Expand Calibration drawer, verify Transistor Pocket defaults to Mono, then customize & persist
      await page.getByTestId('calibration-toggle').click();
      await expect(page.getByTestId('stereo-slider')).toBeVisible();
      await page.getByTestId('intensity-slider').fill('88');
      await page.getByTestId('intensity-slider').dispatchEvent('change');

      // Reload popup and verify chrome.storage.local persisted preset & intensity override
      await page.reload();
      await expect(page.getByTestId('preset-transistor-radio')).toHaveAttribute(
        'aria-checked',
        'true',
      );
      await expect(page.getByTestId('intensity-slider')).toHaveValue('88');

      // Reset preset restores researched defaults (75% intensity)
      await page.getByTestId('calibration-toggle').click();
      await page.getByTestId('reset-preset').click();
      await expect(page.getByTestId('intensity-slider')).toHaveValue('75');

      // Attempting capture while active tab is chrome-extension:// shows graceful recovery alert
      await page.getByTestId('power-toggle').click();
      await expect(page.getByTestId('error-banner')).toBeVisible();
      await page.getByRole('button', { name: 'Dismiss' }).click();
      await expect(page.getByTestId('error-banner')).toHaveCount(0);

      expect(externalRequests).toEqual([]);
      expect(consoleErrors).toEqual([]);
    } finally {
      await context.close();
      rmSync(userDataDir, { recursive: true, force: true });
    }
  });

  test('executes real-time AudioWorklet DSP inside Signal Workbench across reference signals', async () => {
    const { context, extensionId, userDataDir } = await launchExtensionContext();
    const consoleErrors: string[] = [];

    try {
      const page = await context.newPage();
      page.on('pageerror', (err) => consoleErrors.push(err.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.setViewportSize({ width: 1120, height: 840 });
      await page.goto(`chrome-extension://${extensionId}/workbench.html`);

      await expect(page.getByRole('heading', { name: 'Signal Workbench' })).toBeVisible();

      // Start local Web Audio + AudioWorklet audition generator
      await page.getByTestId('wb-audition-toggle').click();
      await expect(page.getByTestId('wb-audition-toggle')).toContainText(
        'Stop Reference Generator',
      );

      // Switch across reference test signals while live AudioWorklet runs
      await page.getByTestId('wb-signal-pink-noise').click();
      await page.waitForTimeout(350);

      // Verify live AudioWorklet telemetry drives output RMS meter > 0%
      const meterActive = await page.evaluate(() => {
        const fills = Array.from(document.querySelectorAll('.meter-fill')) as HTMLElement[];
        return fills.some((el) => parseFloat(el.style.width || '0') > 5);
      });
      expect(meterActive).toBe(true);

      // Switch profiles live while audio streams through AudioWorklet
      await page.getByTestId('wb-preset-late-night-radio').click();
      await page.waitForTimeout(150);
      await page.getByTestId('wb-preset-clean-vintage').click();
      await page.waitForTimeout(150);

      // Stop generator cleanly
      await page.getByTestId('wb-audition-toggle').click();
      await expect(page.getByTestId('wb-audition-toggle')).toContainText('Play Reference Audio');
      expect(consoleErrors).toEqual([]);
    } finally {
      await context.close();
      rmSync(userDataDir, { recursive: true, force: true });
    }
  });
});
