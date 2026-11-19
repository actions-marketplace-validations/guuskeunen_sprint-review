import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { CaptureConfig } from './config.ts';

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
      locator(selector: string): unknown;
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
export async function capture(config: CaptureConfig, root: string, day = new Date().toISOString().slice(0, 10), onStep: (m: string) => void = () => {}): Promise<string[]> {
  let chromium: { launch(options: Record<string, unknown>): Promise<Browser> };
  try {
    const mod = (await import('playwright' as string)) as { chromium: typeof chromium };
    chromium = mod.chromium;
  } catch {
    throw new CaptureError('Taking screenshots needs Playwright: npm install --save-dev playwright && npx playwright install chromium');
  }
  const out = resolve(root, config.dir, day);
  mkdirSync(out, { recursive: true });
  const executablePath = process.env.SPRINT_REVIEW_CHROME || undefined;
  let browser: Browser;
  try {
    browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox'] });
  } catch (e) {
    throw new CaptureError(`Could not start the browser: ${(e as Error).message.split('\n')[0]}. Run npx playwright install chromium, or set SPRINT_REVIEW_CHROME to a Chrome binary.`);
  }
  const written: string[] = [];
  try {
    for (const device of config.devices) {
      const context = await browser.newContext({ ...VIEWPORTS[device], ...(config.storageState ? { storageState: resolve(root, config.storageState) } : {}) });
      const page = await context.newPage();
      for (const [key, url] of Object.entries(config.pages)) {
        const target = config.baseUrl ? new URL(url, config.baseUrl).toString() : url;
        onStep(`Photographing ${key} on ${device}`);
        await page.goto(target, { waitUntil: 'networkidle', timeout: 60_000 });
        if (config.wait) await page.waitForTimeout(config.wait);
        const file = join(out, `${key}-${device}.png`);
        await page.screenshot({ path: file, fullPage: true, animations: 'disabled', mask: config.mask.map((m) => page.locator(m)), maskColor: '#1f2937' });
        written.push(file);
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  return written;
}
