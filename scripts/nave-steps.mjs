// Look at the Drowned Nave: opening, boss inspector, a hovered surge.
export default async ({ click, hover, page, out, wait }) => {
  await hover(1, 3);
  await page.screenshot({ path: `${out}/20-nave.png` });
  await click(7, 7); // inquisitor
  await page.keyboard.press('2');
  await hover(3, 3);
  await page.screenshot({ path: `${out}/21-nave-rebuke.png` });
};
