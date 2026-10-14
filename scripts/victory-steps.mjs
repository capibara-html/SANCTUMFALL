// Force a near-won state and seal the last wound through the real UI.
export default async ({ click, hover, page, out, wait }) => {
  await page.evaluate(() => {
    const b = window.sanctumfall.battle;
    const s = b.session.state;
    const wounds = s.entities.filter((e) => e.defId === 'wound');
    s.entities = s.entities.filter((e) => e !== wounds[1]);
    s.stats.woundsSealed = 1;
    wounds[0].hp = 1;
    const m = s.entities.find((e) => e.defId === 'consecrator');
    m.pos = { x: 1, y: 3 };
    b.anim.sync(s);
    b.refresh();
  });
  await click(1, 3);
  await page.keyboard.press('1');
  await hover(1, 1);
  await page.screenshot({ path: `${out}/30-seal-preview.png` });
  await click(1, 1);
  await wait(500);
  await page.screenshot({ path: `${out}/31-seal-anim.png` });
  await wait(2500);
  await page.screenshot({ path: `${out}/32-victory.png` });
  await page.click('text=Onward');
  await wait(1500);
  await page.screenshot({ path: `${out}/33-next.png` });
};
