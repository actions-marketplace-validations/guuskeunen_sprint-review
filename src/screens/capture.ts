import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { CaptureConfig } from '../config.ts';

export class CaptureError extends Error {}

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
} as const;

/** The smallest part of Playwright this needs, so it stays an optional dependency. */
interface Browser {
  newContext(options: Record<string, unknown>): Promise<{
    newPage(): Promise<{
      goto(url: string, options: Record<string, unknown>): Promise<unknown>;
      waitForTimeout(ms: number): Promise<void>;
      locator(selector: string): {
        first(): {
          waitFor(options: Record<string, unknown>): Promise<void>;
          screenshot(options: Record<string, unknown>): Promise<Buffer>;
        };
      };
      screenshot(options: Record<string, unknown>): Promise<Buffer>;
    }>;
    close(): Promise<void>;
  }>;
  close(): Promise<void>;
}

/**
 * Photographs every configured page on every device and keeps the pictures in a folder for the
 * day: `<dir>/2026-11-16/customer-page-desktop.png`. The next sprint compares against them.
 * Masked selectors are painted over before the picture is taken.
 */
export async function capture(config: CaptureConfig, root: string, day = new Date().toISOString().slice(0, 10), onStep: (m: string) => void = () => {}, elementTimeout = 15_000): Promise<string[]> {
  // Playwright with its own browser, or playwright-core with the Chrome already installed: no download.
  const found = await loadPlaywright();
  if (!found) throw new CaptureError('Taking screenshots needs Playwright: npm install --save-dev playwright-core (uses your installed Chrome), or playwright && npx playwright install chromium');
  const { chromium, core } = found;
  const out = resolve(root, config.dir, day);
  mkdirSync(out, { recursive: true });
  const executablePath = process.env.SPRINT_REVIEW_CHROME || undefined;
  let browser: Browser;
  try {
    browser = await chromium.launch({ ...(executablePath ? { executablePath } : core ? { channel: 'chrome' } : {}), args: ['--no-sandbox'] });
  } catch (e) {
    throw new CaptureError(`Could not start the browser: ${(e as Error).message.split('\n')[0]}. Install Chrome, run npx playwright install chromium, or set SPRINT_REVIEW_CHROME to a Chrome binary.`);
  }
  const written: string[] = [];
  try {
    const schemes = config.darkMode ? (['light', 'dark'] as const) : (['light'] as const);
    for (const device of config.devices) for (const scheme of schemes) {
      const context = await browser.newContext({ ...VIEWPORTS[device], colorScheme: scheme, ...(config.storageState ? { storageState: resolve(root, config.storageState) } : {}) });
      const page = await context.newPage();
      for (const [key, { url, selector }] of Object.entries(config.pages)) {
        const target = config.baseUrl ? new URL(url, config.baseUrl).toString() : url;
        onStep(`Photographing ${key} on ${device}${scheme === 'dark' ? ', dark mode' : ''}`);
        await page.goto(target, { waitUntil: 'networkidle', timeout: 60_000 });
        if (config.wait) await page.waitForTimeout(config.wait);
        const file = join(out, `${key}-${device}${scheme === 'dark' ? '-dark' : ''}.png`);
        const mask = config.mask.map((m) => page.locator(m));
        if (selector) {
          // One element: a card or a panel, cropped to itself. Missing on the page: skipped, the rest goes on.
          const element = page.locator(selector).first();
          try {
            await element.waitFor({ state: 'visible', timeout: elementTimeout });
          } catch {
            onStep(`Not found on ${key}: ${selector}`);
            continue;
          }
          await element.screenshot({ path: file, animations: 'disabled', mask, maskColor: '#1f2937' });
        } else {
          await page.screenshot({ path: file, fullPage: true, animations: 'disabled', mask, maskColor: '#1f2937' });
        }
        written.push(file);
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  return written;
}

type Chromium = { launch(options: Record<string, unknown>): Promise<Browser> };

async function loadPlaywright(): Promise<{ chromium: Chromium; core: boolean } | null> {
  for (const name of ['playwright', 'playwright-core']) {
    try {
      return { chromium: ((await import(name)) as { chromium: Chromium }).chromium, core: name === 'playwright-core' };
    } catch {
      // not installed: try the next one
    }
  }
  return null;
}
