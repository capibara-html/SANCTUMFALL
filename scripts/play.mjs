// Drives a real battle through the UI: select, preview, act, end turn.
// Usage: node scripts/play.mjs <outDir> [encounter]
import { chromium } from 'playwright-core';
const out = process.argv[2] ?? 'shots';
const enc = process.argv[3] ?? 'ashen_parish';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.addInitScript(() => localStorage.setItem('sanctumfall.helpSeen', '1'));
await page.goto('http://localhost:5173/');
await page.waitForTimeout(300);
await page.evaluate((id) => window.sanctumfall.fight(id), enc);
await page.waitForTimeout(6500);
const box = await page.locator('.board-holder canvas').boundingBox();
const S = box.width / 232; // logical view width
const tile = (x, y) => ({ x: box.x + (20 + x * 24 + 12) * S, y: box.y + (34 + y * 24 + 12) * S });
const click = async (x, y, opts) => { const p = tile(x, y); await page.mouse.click(p.x, p.y, opts); await page.waitForTimeout(150); };
const hover = async (x, y) => { const p = tile(x, y); await page.mouse.move(p.x, p.y); await page.waitForTimeout(250); };
globalThis.steps = { click, hover, page };
const script = (await import(process.argv[4] ?? './play-steps.mjs')).default;
await script({ click, hover, page, out, wait: (ms) => page.waitForTimeout(ms) });
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
await browser.close();
