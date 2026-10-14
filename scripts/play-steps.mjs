// Default scripted turn in the Ashen Parish.
export default async ({ click, hover, page, out, wait }) => {
  await click(4, 7); // Sister Maelis
  await click(3, 6); // move
  await wait(700);
  await hover(2, 4); // Hallow on the Bile Cantor
  await page.screenshot({ path: `${out}/10-preview.png` });
  await click(2, 4);
  await wait(1500);
  await click(6, 7); // Inquisitor
  await page.keyboard.press('2'); // Rebuke
  await hover(4, 3);
  await page.screenshot({ path: `${out}/11-rebuke.png` });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Space');
  await wait(200);
  await page.screenshot({ path: `${out}/12-confirm.png` });
  await page.keyboard.press('Space');
  await wait(2200);
  await page.screenshot({ path: `${out}/13-reckoning.png` });
  await wait(7000);
  await page.screenshot({ path: `${out}/14-round2.png` });
};
