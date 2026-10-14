// Watch the Leviathan's first rites, then force a defeat to see the result screen.
export default async ({ page, out, wait }) => {
  await page.keyboard.press('Space');
  await wait(150);
  await page.keyboard.press('Space');
  await wait(1700);
  await page.screenshot({ path: `${out}/40-tide.png` });
  await wait(7000);
  await page.screenshot({ path: `${out}/41-round2.png` });
  await page.evaluate(() => {
    const b = window.sanctumfall.battle;
    for (const e of b.session.state.entities) if (e.faction === 'vigil') e.hp = 1;
    b.session.state.entities.filter((e) => e.faction === 'vigil').forEach((e) => (e.pos = { x: 2, y: e.pos.y }));
    b.anim.sync(b.session.state);
  });
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Space');
    await wait(150);
    await page.keyboard.press('Space');
    await wait(5000);
    if (await page.locator('.overlay').count()) break;
  }
  await page.screenshot({ path: `${out}/42-defeat.png` });
};
