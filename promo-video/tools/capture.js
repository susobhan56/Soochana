/* Screenshots of the real portal for the promo's montage scenes.
   Needs the portal served at http://localhost:8777 (python -m http.server 8777
   in the portal folder) and Google Chrome installed.
   Run: node tools/capture.js [name ...]   (no names = every shot) */
const path = require('path');
const puppeteer = require('puppeteer-core');

const BASE = 'http://localhost:8777/';
const OUT = path.join(__dirname, '..', 'public', 'shots');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* Scroll in small steps so scroll-driven scenes and lazy charts wake up. */
const scrollTo = async (page, sel, offset = 0) => {
  const y = await page.evaluate((s, o) => {
    const el = s ? document.querySelector(s) : null;
    return (el ? el.getBoundingClientRect().top + window.scrollY : 0) + o;
  }, sel, offset);
  for (let k = 1; k <= 12; k++) {
    await page.evaluate((v) => window.scrollTo(0, v), (y * k) / 12);
    await wait(120);
  }
};

const ask = async (page, q) => {
  await page.type('#chatbot-text-input', q, {delay: 25});
  await page.click('#chatbot-send-btn');
  await wait(2200);
};

const SHOTS = {
  home: {url: 'index.html#lander', settle: 8000},
  story1: {url: 'index.html#lander', settle: 4000, sel: '#story', offset: 700},
  story2: {url: 'index.html#lander', settle: 4000, sel: '#story', offset: 2600},
  dossier: {url: 'index.html#lander', settle: 4000, sel: '#dashboard', offset: 500},
  rankings: {url: 'index.html#lander', settle: 4000, sel: '#rankings', offset: -60},
  district: {url: 'district.html?id=Koraput', settle: 8000},
  district2: {url: 'district.html?id=Koraput', settle: 5000, offset: 1100},
  compare: {url: 'odisha_compare.html', settle: 6000},
  compare2: {url: 'odisha_compare.html', settle: 5000, offset: 900},
  health: {url: 'district-health.html', settle: 6000},
  health2: {url: 'district-health.html', settle: 4000, offset: 1150},
  tectonics: {url: 'tectonics.html', settle: 6000},
  explore: {url: 'explore.html', settle: 9000},
  learn: {url: 'learn/index.html', settle: 5000},
  learn2: {url: 'learn/neural-networks.html', settle: 6000},
  repository: {url: 'repository.html', settle: 5000},
  report: {url: 'report.html', settle: 5000},
  themes: {url: 'themes.html', settle: 5000},
  assistant: {
    url: 'index.html#lander',
    settle: 5000,
    run: async (page) => {
      await page.click('#chatbot-trigger');
      await wait(1200);
      await ask(page, 'What is the infant mortality rate in Koraput?');
      await ask(page, 'And Puri?');
      await wait(800);
    },
  },
};

(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHOTS);
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--hide-scrollbars'],
    defaultViewport: {width: 1600, height: 1000, deviceScaleFactor: 1.2},
  });
  for (const name of names) {
    const s = SHOTS[name];
    const page = await browser.newPage();
    await page.goto(BASE + s.url, {waitUntil: 'networkidle2', timeout: 60000});
    /* The "What's new" toast would sit over every shot. */
    await page.addStyleTag({content: '.wn-toast{display:none!important}'});
    await wait(s.settle);
    if (s.sel || s.offset) {
      await scrollTo(page, s.sel, s.offset || 0);
      await wait(3500);
    }
    if (s.run) await s.run(page);
    await page.screenshot({path: path.join(OUT, name + '.png')});
    console.log('shot', name);
    await page.close();
  }
  await browser.close();
})();
