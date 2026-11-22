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
      url(): string;
      fill(selector: string, value: string, options: Record<string, unknown>): Promise<void>;
      click(selector: string, options: Record<string, unknown>): Promise<void>;
      waitForURL(test: (url: URL) => boolean, options: Record<string, unknown>): Promise<void>;
      waitForTimeout(ms: number): Promise<void>;
      locator(selector: string): {
        first(): {
          waitFor(options: Record<string, unknown>): Promise<void>;
          screenshot(options: Record<string, unknown>): Promise<Buffer>;
        };
      };
      screenshot(options: Record<string, unknown>): Promise<Buffer>;
    }>;
    storageState(options: { path: string }): Promise<unknown>;
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
      if (config.login) await logIn(page, config.login, config.baseUrl, onStep);
      for (const [key, { url, selector }] of Object.entries(config.pages)) {
        const target = config.baseUrl ? new URL(url, config.baseUrl).toString() : url;
        onStep(`Photographing ${key} on ${device}${scheme === 'dark' ? ', dark mode' : ''}`);
        await page.goto(target, { waitUntil: 'networkidle', timeout: 60_000 });
        // Sent to a login page: every picture would show it. Stop with what to do instead.
        if (isLoginPage(page.url()) && !isLoginPage(target)) {
          throw new CaptureError(`Not logged in: ${key} went to ${new URL(page.url()).pathname}. ${config.login ? 'Check the login in screenshots.login.' : 'The saved session has expired: log in again, or set screenshots.login so capture logs in by itself.'}`);
        }
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
      // The app may have refreshed the session while the pages loaded, and a refresh token often
      // works only once: keep the new one, or the next capture finds itself logged out.
      if (config.storageState && !config.login) await context.storageState({ path: resolve(root, config.storageState) });
      await context.close();
    }
  } finally {
    await browser.close();
  }
  return written;
}

type Page = Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['newPage']>>;

/** A URL that looks like a login page: /login, /signin, /sign-in, /auth. */
export function isLoginPage(url: string): boolean {
  try {
    return /\/(log-?in|sign-?in|auth)(\/|$)/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/**
 * Logs in with the login form: each field gets the value of its environment variable, so no
 * password is ever in the config. Done when the browser has left the login page.
 */
async function logIn(page: Page, login: NonNullable<CaptureConfig['login']>, baseUrl: string | null, onStep: (m: string) => void): Promise<void> {
  const values = Object.entries(login.fields).map(([selector, name]) => {
    const value = process.env[name];
    if (!value) throw new CaptureError(`Logging in needs ${name} in the environment (screenshots.login.fields).`);
    return [selector, value] as const;
  });
  const url = baseUrl ? new URL(login.url, baseUrl).toString() : login.url;
  onStep('Logging in');
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  for (const [selector, value] of values) await page.fill(selector, value, { timeout: 15_000 });
  await page.click(login.submit, { timeout: 15_000 });
  const start = new URL(url).pathname;
  try {
    await page.waitForURL((u) => u.pathname !== start, { timeout: 30_000 });
  } catch {
    throw new CaptureError(`The login did not get past ${start}: check the account and the selectors in screenshots.login.`);
  }
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
