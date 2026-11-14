// 真实浏览器行为回归；运行 node tests/chapter-nav.mjs。
import { chromium } from '../src/academic-presentation/node_modules/playwright-core/index.mjs';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(path.join(root, 'backups'), { recursive: true });
const temp = mkdtempSync(path.join(root, 'backups', 'chapter-nav-test-'));
const slides = [{ slide_id: 'cover', layout: 'cover', title: '封面', content: {}, notes: '说明', sources: ['test'] }];
for (let i = 0; i < 8; i++) {
  slides.push({ slide_id: `chapter-${i}`, layout: 'section', title: `第${i + 1}章：足够长的章节标题与研究问题`, content: {}, notes: '说明', sources: ['test'] });
  slides.push({ slide_id: `content-${i}`, layout: 'bullets', title: '统一标题位置', ...(i % 2 ? { kicker: '眉题' } : {}), content: { bullets: ['章节归属自动更新'] }, cite: 'test', notes: '说明', sources: ['test'] });
}
function build(name, setting, pages = slides) {
  const dir = path.join(temp, name);
  mkdirSync(path.join(dir, 'content'), { recursive: true });
  writeFileSync(path.join(dir, 'content', 'slides.yaml'), JSON.stringify({ deck: { title: name, ...setting }, slides: pages }));
  const result = spawnSync('python', [path.join(root, 'src/academic-presentation/build.py'), dir], { encoding: 'utf8' });
  return { dir, result, url: pathToFileURL(path.join(dir, 'output/index.html')).href };
}
const on = build('on', { chapter_nav: true });
const off = build('off', { chapter_nav: false });
const absent = build('absent', {});
const empty = build('no-sections', { chapter_nav: true }, [slides[0], slides[2]]);
const invalid = build('invalid', { chapter_nav: 'true' });
for (const fixture of [on, off, absent, empty]) assert.equal(fixture.result.status, 0, fixture.result.stderr);
assert.notEqual(invalid.result.status, 0);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  async function load(url) {
    await page.goto(url);
    await page.waitForFunction(() => window.__deck?.isReady());
  }
  await load(on.url);
  assert.equal(await page.locator('.chapter-track a').count(), 8);
  assert.equal(await page.locator('[aria-current]').count(), 0);
  await page.evaluate(() => __deck.slide(2));
  assert.equal(await page.locator('[aria-current]').textContent(), slides[1].title);
  const geometry = await page.evaluate(() => {
    const slide = __deck.getCurrentSlide();
    return { title: (slide.querySelector('h2').getBoundingClientRect().top - slide.getBoundingClientRect().top) / __deck.getScale(),
      nav: document.querySelector('.chapter-nav').getBoundingClientRect().bottom,
      stage: document.querySelector('.reveal').getBoundingClientRect().top };
  });
  assert.ok(Math.abs(geometry.title - 74) < 1);
  assert.ok(geometry.stage >= geometry.nav, JSON.stringify(geometry));
  await page.evaluate(() => __deck.slide(16));
  assert.equal(await page.locator('[aria-current]').textContent(), slides[15].title);
  assert.ok(await page.locator('.chapter-track').evaluate(el => el.scrollLeft > 0));
  await page.locator('.chapter-track a').first().click();
  assert.equal(await page.evaluate(() => __deck.getCurrentSlide().id), 'chapter-0');
  await load(on.url + '#/content-7');
  assert.equal(await page.locator('[aria-current]').textContent(), slides[15].title);
  await page.evaluate(() => __deck.slide(4));
  const withKicker = await page.evaluate(() => {
    const slide = __deck.getCurrentSlide();
    return (slide.querySelector('h2').getBoundingClientRect().top - slide.getBoundingClientRect().top) / __deck.getScale();
  });
  assert.ok(Math.abs(withKicker - geometry.title) < 1);
  await page.setViewportSize({ width: 800, height: 600 });
  assert.ok(await page.locator('.chapter-track').evaluate(el => el.scrollWidth > el.clientWidth));
  for (const fixture of [off, absent, empty]) {
    await load(fixture.url);
    assert.equal(await page.locator('.chapter-nav').count(), 0);
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('has-chapter-nav')), false);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: 开关/缺省/无章节/非法配置、章节归属、点击、地址直达、长标题滚动、缩放与标题对齐');
} finally {
  await browser.close();
}
