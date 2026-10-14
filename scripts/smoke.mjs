// Browser smoke test + screenshots. Requires the dev server (npm run dev).
// Usage: node scripts/smoke.mjs [outDir] [baseUrl]
import { chromium } from 'playwright-core';
const out = process.argv[2] ?? 'shots';
const base = process.argv[3] ?? 'http://localhost:5173/';
const exe = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.addInitScript(() => localStorage.setItem('sanctumfall.helpSeen', '1'));
await page.goto(base);
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/01-title.png` });
await page.click('text=Begin the Vigil');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/02-map.png` });
await page.click('.site >> nth=0');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/03-briefing.png` });
await page.click('.overlay >> text=Begin');
await page.waitForTimeout(6000);
await page.screenshot({ path: `${out}/04-battle.png` });
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
await browser.close();
