// Renders the demo app's close-ups (scripts/demo/screens.html) to PNGs at twice the sharpness,
// for the demo deck. Needs Chrome. Run: node scripts/build-demo-screens.ts
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'demo');
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1280, height: 900 } });
  await page.goto(pathToFileURL(join(dir, 'screens.html')).href);
  for (const name of await page.locator('[data-shot]').evaluateAll((els) => els.map((e) => e.getAttribute('data-shot')!))) {
    await page.locator(`[data-shot="${name}"]`).screenshot({ path: join(dir, `${name}.png`) });
    console.log(`Wrote scripts/demo/${name}.png`);
  }
} finally {
  await browser.close();
}
