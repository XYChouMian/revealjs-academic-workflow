// 真实浏览器回归：章节导航、自动总览、ending 正文边界与附录排除。
import { chromium } from '../src/academic-presentation/node_modules/playwright-core/index.mjs';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(path.join(root, 'backups'), { recursive: true });
const temp = mkdtempSync(path.join(root, 'backups', 'chapter-nav-test-'));
const base = (slide_id, layout, title) => ({ slide_id, layout, title, content: {}, notes: '说明', sources: ['test'] });
const slides = [base('cover', 'cover', '封面'), base('overview', 'chapter-overview', '汇报结构')];
for (let i = 0; i < 8; i++) {
  slides.push(base(`chapter-${i}`, 'section', `第${i + 1}章：足够长的章节标题与研究问题`));
  slides.push({ ...base(`content-${i}`, 'bullets', '统一标题位置'), ...(i % 2 ? { kicker: '眉题' } : {}),
                content: { bullets: ['章节归属自动更新'] }, cite: 'test' });
}
slides.push({ ...base('ending', 'ending', '感谢聆听'), content: { subtitle: '正文结束' } });
slides.push(base('appendix-section', 'section', '附录章节不应收录'));
slides.push({ ...base('appendix-content', 'bullets', '附录内容'), content: { bullets: ['补充材料'] }, cite: 'test' });

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
const noSections = build('no-sections', { chapter_nav: true }, [base('cover', 'cover', '封面'), base('plain', 'bullets', '内容')]);
const invalidFlag = build('invalid-flag', { chapter_nav: 'true' });
const twoEndings = build('two-endings', {}, [...slides, base('ending-2', 'ending', '再次结束')]);
const emptyOverview = build('empty-overview', {}, [base('cover', 'cover', '封面'), base('overview', 'chapter-overview', '结构')]);
const lateOverview = build('late-overview', {}, [base('chapter', 'section', '正文'), base('ending', 'ending', '结束'), base('overview', 'chapter-overview', '结构')]);
for (const fixture of [on, off, absent, noSections]) assert.equal(fixture.result.status, 0, fixture.result.stderr);
for (const fixture of [invalidFlag, twoEndings, emptyOverview, lateOverview]) assert.notEqual(fixture.result.status, 0);

const indexOf = id => slides.findIndex(s => s.slide_id === id);
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
  assert.equal(await page.locator('.chapter-overview-item').count(), 8);
  assert.equal(await page.locator('.chapter-track').getByText('附录章节不应收录').count(), 0);
  assert.equal(await page.locator('.chapter-overview-list').getByText('附录章节不应收录').count(), 0);
  assert.equal(await page.locator('[aria-current]').count(), 0);
  await page.evaluate(idx => __deck.slide(idx), indexOf('overview'));
  assert.equal(await page.evaluate(() => {
    const slide = __deck.getCurrentSlide();
    const list = slide.querySelector('.chapter-overview-list');
    return list.scrollHeight <= list.clientHeight + 1;
  }), true);

  await page.evaluate(idx => __deck.slide(idx), indexOf('content-0'));
  assert.equal(await page.locator('[aria-current]').textContent(), slides[indexOf('chapter-0')].title);
  const geometry = await page.evaluate(() => {
    const slide = __deck.getCurrentSlide();
    return { title: (slide.querySelector('h2').getBoundingClientRect().top - slide.getBoundingClientRect().top) / __deck.getScale(),
      nav: document.querySelector('.chapter-nav').getBoundingClientRect().bottom,
      stage: document.querySelector('.reveal').getBoundingClientRect().top };
  });
  assert.ok(Math.abs(geometry.title - 74) < 1);
  assert.ok(geometry.stage >= geometry.nav, JSON.stringify(geometry));

  await page.evaluate(idx => __deck.slide(idx), indexOf('content-7'));
  assert.equal(await page.locator('[aria-current]').textContent(), slides[indexOf('chapter-7')].title);
  assert.ok(await page.locator('.chapter-track').evaluate(el => el.scrollLeft > 0));
  await page.evaluate(idx => __deck.slide(idx), indexOf('overview'));
  await page.locator('.chapter-overview-item').last().click();
  assert.equal(await page.evaluate(() => __deck.getCurrentSlide().id), 'chapter-7');

  for (const id of ['ending', 'appendix-section', 'appendix-content']) {
    await page.evaluate(idx => __deck.slide(idx), indexOf(id));
    assert.equal(await page.locator('[aria-current]').count(), 0, id);
  }
  await load(on.url + '#/appendix-content');
  assert.equal(await page.locator('[aria-current]').count(), 0);
  await page.locator('.chapter-track a').first().click();
  assert.equal(await page.evaluate(() => __deck.getCurrentSlide().id), 'chapter-0');

  await page.evaluate(idx => __deck.slide(idx), indexOf('content-1'));
  const withKicker = await page.evaluate(() => {
    const slide = __deck.getCurrentSlide();
    return (slide.querySelector('h2').getBoundingClientRect().top - slide.getBoundingClientRect().top) / __deck.getScale();
  });
  assert.ok(Math.abs(withKicker - geometry.title) < 1);
  await page.setViewportSize({ width: 800, height: 600 });
  assert.ok(await page.locator('.chapter-track').evaluate(el => el.scrollWidth > el.clientWidth));
  for (const fixture of [off, absent, noSections]) {
    await load(fixture.url);
    assert.equal(await page.locator('.chapter-nav').count(), 0);
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('has-chapter-nav')), false);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: 导航/总览/ending 边界/附录排除、点击、直达、长标题、缩放与标题对齐');
} finally {
  await browser.close();
}
