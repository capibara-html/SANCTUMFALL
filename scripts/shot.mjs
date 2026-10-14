// Screenshot helper for visual review. Usage:
//   node scripts/shot.mjs <url> <out.png> [width] [height] [actions.json]
import { chromium } from 'playwright-core';
const [url, out, w = '1600', h = '1000'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url);
await page.waitForTimeout(800);
await page.screenshot({ path: out, fullPage: true });
console.log(logs.join('\n'));
await browser.close();
