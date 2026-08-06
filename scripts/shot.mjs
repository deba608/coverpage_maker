/**
 * Dev helper: screenshot a page at A4 pixel size.
 *
 * Usage:
 *   node scripts/shot.mjs <url> <output.png>
 */

import puppeteer from "puppeteer";

const [, , url, out] = process.argv;

// Validate required arguments
if (!url || !out) {
  console.error("Missing required arguments.");
  console.error("Usage:");
  console.error("  node scripts/shot.mjs <url> <output.png>");
  process.exit(1);
}

let browser;

try {
  browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  await page.setViewport({
    width: 900,
    height: 1400,
    deviceScaleFactor: 1,
  });

  await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });

  // Wait for web fonts to finish loading
  await page.evaluate(async () => {
    if ("fonts" in document) {
      await document.fonts.ready;
    }
  });

  await page.screenshot({
    path: out,
    fullPage: true,
  });

  console.log(`Screenshot saved to: ${out}`);
} catch (error) {
  console.error("Failed to capture screenshot.");
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) {
    await browser.close();
  }
}
