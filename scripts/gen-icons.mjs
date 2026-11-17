// Renders the app icon SVG to the raster PNGs Android's installer requires.
// Chrome on Android only offers "Install app" when the manifest carries
// 192x192 and 512x512 raster PNG icons; the SVG-only manifest is why the
// install prompt never appears.
import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const svg = await readFile(new URL('../public/icon-192.svg', import.meta.url), 'utf8')
const sizes = [192, 512]
const browser = await chromium.launch()

for (const size of sizes) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(
    `<!doctype html><html><body style="margin:0">${svg
      .replace('width="192"', `width="${size}"`)
      .replace('height="192"', `height="${size}"`)}</body></html>`,
    { waitUntil: 'load' },
  )
  const out = fileURLToPath(new URL(`../public/icon-${size}.png`, import.meta.url))
  await page.screenshot({ path: out, type: 'png', fullPage: false })
  await page.close()
  console.log(`wrote public/icon-${size}.png`)
}

await browser.close()
