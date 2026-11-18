/* Screenshots of the State Dossier's Flourish charts (datasets/state_details.json,
   chart_url), after each has finished animating. Needs Google Chrome and internet.
   Run: node tools/capture_flourish.js */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, '..', 'public', 'flourish');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const mods = JSON.parse(fs.readFileSync(path.join(ROOT, 'datasets', 'state_details.json'), 'utf8')).Odisha.slides_detail.filter((m) => m.chart_url);
  const browser = await puppeteer.launch({executablePath: CHROME, headless: true, defaultViewport: {width: 1100, height: 700, deviceScaleFactor: 1.5}});
  const index = [];
  for (const [k, m] of mods.entries()) {
    const page = await browser.newPage();
    try {
      await page.goto(m.chart_url, {waitUntil: 'networkidle2', timeout: 60000});
      await wait(6000);
      const file = `chart${k + 1}.png`;
      await page.screenshot({path: path.join(OUT, file)});
      index.push({file, title: (m.title || '').replace(/\uFFFD/g, '–')});
      console.log('shot', file, m.title);
    } catch (e) {
      console.log('failed', m.chart_url, e.message);
    }
    await page.close();
  }
  fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'flourish.json'), JSON.stringify(index, null, 1));
  await browser.close();
})();
