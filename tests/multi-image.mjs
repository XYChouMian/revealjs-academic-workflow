// Real browser integration: image area, manual placement, readiness, and four view modes.
import { chromium } from '../src/academic-presentation/node_modules/playwright-core/index.mjs';
import { mkdirSync, cpSync, writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.PYTHONUTF8 = '1';
process.env.PYTHONIOENCODING = 'utf-8';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const previews = path.join(root, 'backups/multi-image-preview-20261117');
mkdirSync(previews, { recursive: true });
const run = (script, args) => spawnSync('python', [path.join(root, 'src/academic-presentation', script), ...args],
  { encoding: 'utf8', cwd: root, timeout: 180000 });
const starter = path.join(root, 'decks/starter');
const parseSource = run('build.py', [starter]);
assert.equal(parseSource.status, 0, parseSource.stderr);
// Keep normal YAML scalar styles: JSON-encoded multiline notes would trigger the
// intentional LaTeX escape guard, even though JSON itself is valid YAML.
const data = JSON.parse(spawnSync('python', ['-c',
  'import yaml,json,sys;print(json.dumps(yaml.safe_load(open(sys.argv[1],encoding="utf-8"))))',
  path.join(starter, 'content/slides.yaml')], { encoding: 'utf8' }).stdout);
function build(name, source, assets = true) {
  const dir = path.join(previews, name);
  mkdirSync(path.join(dir, 'content'), { recursive: true });
  const yaml = spawnSync('python', ['-c',
    'import yaml,json,sys;yaml.SafeDumper.add_representer(str,lambda d,s:d.represent_scalar("tag:yaml.org,2002:str",s.replace("\\r\\n","\\n"),style="|" if "\\n" in s else None));print(yaml.safe_dump(json.load(sys.stdin),allow_unicode=True,sort_keys=False))'],
    { encoding: 'utf8', input: JSON.stringify(source) });
  assert.equal(yaml.status, 0, yaml.stderr);
  writeFileSync(path.join(dir, 'content/slides.yaml'), yaml.stdout);
  if (assets) cpSync(path.join(starter, 'assets'), path.join(dir, 'assets'), { recursive: true });
  if (name === 'stress') {
    for (const [name, w, h] of [['portrait-test.svg', 200, 700], ['panorama-test.svg', 1200, 160]]) {
      writeFileSync(path.join(dir, 'assets/diagrams', name), `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#eef2f7"/><text x="10" y="35" font-size="20">RATIO TEST ONLY</text></svg>`);
    }
  }
  const result = run('build.py', [dir]);
  return { dir, result, url: pathToFileURL(path.join(dir, 'output/index.html')).href };
}
const fixtures = [];
for (const aspect_ratio of ['16:9', '4:3']) for (const chapter_nav of [true, false]) {
  const name = aspect_ratio.replace(':', '-') + (chapter_nav ? '-nav' : '-no-nav');
  const source = structuredClone(data);
  Object.assign(source.deck, { aspect_ratio, chapter_nav, title: '多图预览 · ' + name });
  const fixture = build(name, source);
  assert.equal(fixture.result.status, 0, fixture.result.stderr);
  fixtures.push({ ...fixture, aspect_ratio, chapter_nav });
}
const base = (id, content) => ({ slide_id: id, layout: 'multi-image', title: '多图验证',
  content, cite: '功能测试，非实验结果', notes: '验证原始图片比例与可选说明。', sources: ['test'] });
const src = ['square.svg', 'wide.svg', 'white-background.png', 'white-background.jpg', 'portrait-test.svg', 'panorama-test.svg'];
const images = count => Array.from({ length: count }, (_, i) => ({ src: 'assets/diagrams/' + src[i % src.length],
  ...(i % 3 === 0 ? { title: '标题可换行：图片与物理解释', content: '带公式 $u(t)$ 的文字说明。' } : {}),
  ...(i % 3 === 1 ? { content: ['说明按实际高度占位。'], white_background: 'blend' } : {}) }));
const stressCounts = [2, 3, 4, 5, 6];
const stress = build('stress', { deck: { title: '测试' }, slides: stressCounts.map(n => base('n' + n, { images: images(n) })) });
assert.equal(stress.result.status, 0, stress.result.stderr);
const invalid = [
  { images: [{ ...images(1)[0], content_position: 'top' }, ...images(1)] },
  { mode: 'unknown', images: images(2) }, { images: [{ src: '' }, ...images(1)] },
  { images: images(2), gap: -1 }, { images: images(2), columns: [1, 1] },
  { images: [{ ...images(1)[0], content: { wrong: true } }, ...images(1)] },
  { mode: 'manual', columns: [1, 0], rows: [1], images: images(2) },
  { mode: 'manual', columns: [1, 1], rows: [1], images: images(2).map(x => ({ ...x, row: 1, column: 1 })) },
  { mode: 'manual', columns: [1, 1], rows: [1], images: images(2).map((x, i) => ({ ...x, row: 1, column: i + 2 })) },
];
for (let i = 0; i < invalid.length; i++) {
  const result = build('invalid-' + i, { deck: { title: 'invalid' }, slides: [base('bad', invalid[i])] }, false);
  assert.notEqual(result.result.status, 0, 'Invalid fixture accepted: ' + i);
}
const missing = build('missing', { deck: { title: 'missing' }, slides: [base('missing', { images: [
  ...images(1), { src: 'assets/missing.png' }] })] });
assert.notEqual(run('validate.py', [missing.dir]).status, 0, 'Missing image passed static checks');
const crowded = build('crowded', { deck: { title: 'crowded' }, slides: [base('crowded', {
  mode: 'manual', columns: [1, 1], rows: [1], images: images(2).map((item, i) => ({
    ...item, content: '说明不可被截断。'.repeat(500), row: 1, column: i + 1 })) })] });
assert.equal(crowded.result.status, 0, crowded.result.stderr);
const rightCases = build('right-cases', { deck: { title: 'right group tests' }, slides: [
  base('seventy', { mode: 'manual', columns: [1, 1], rows: [1], images: [
    { src: 'assets/diagrams/square.svg', title: '70% only', content: '<span style="white-space:nowrap">' + 'M'.repeat(20) + '</span>', content_position: 'right', row: 1, column: 1 },
    { src: 'assets/diagrams/square.svg', row: 1, column: 2 }] }),
  base('title-copy', { images: [
    { src: 'assets/diagrams/square.svg', title: 'Only title', content_position: 'right' },
    { src: 'assets/diagrams/square.svg', content: '第一行<br>第二行 $u(t)$', content_position: 'right' }] }),
] });
assert.equal(rightCases.result.status, 0, rightCases.result.stderr);
const leftCases = build('left-cases', { deck: { title: '左右文字栏对照' }, slides: [
  base('left-right', { mode: 'manual', columns: [1, 1], rows: [1], images: ['left', 'right'].map((position, i) => ({
    src: 'assets/diagrams/square.svg', title: '标题与说明', content: '整组文字<br>与图片垂直居中',
    content_position: position, row: 1, column: i + 1 })) }),
] });
assert.equal(leftCases.result.status, 0, leftCases.result.stderr);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
async function ready() {
  await page.waitForFunction(() => window.__deck?.isReady());
  await page.evaluate(() => window.__multiImageReady);
}
async function checkCurrent() {
  const result = await page.evaluate(() => {
    const grid = __deck.getCurrentSlide().querySelector('.multi-images');
    const panels = [...grid.querySelectorAll(':scope > .multi-panel')];
    const boxes = panels.map(p => p.getBoundingClientRect());
    const overlaps = boxes.some((a, i) => boxes.slice(i + 1).some(b =>
      a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1));
    const boundary = grid.getBoundingClientRect();
    const alignment = panels.every(p => {
      const img = p.querySelector('img').getBoundingClientRect();
      const title = p.querySelector('.multi-title')?.getBoundingClientRect();
      const copy = p.querySelector('.multi-copy')?.getBoundingClientRect();
      const cx = r => r.x + r.width / 2, cy = r => r.y + r.height / 2;
      if (['right', 'left'].includes(p.dataset.resolvedPosition)) {
        const texts = [title, copy].filter(Boolean);
        const top = Math.min(...texts.map(r => r.top)), bottom = Math.max(...texts.map(r => r.bottom));
        if (Math.abs((top + bottom) / 2 - cy(img)) > 1 || top < img.top - 1 || bottom > img.bottom + 1) return false;
        if (p.dataset.resolvedPosition === 'left' ? texts.some(r => r.right > img.left + 1) : texts.some(r => r.left < img.right - 1)) return false;
        if (title && copy && (title.bottom > copy.top || Math.abs(cx(title) - cx(copy)) > 1)) return false;
      } else {
        if (title && (Math.abs(cx(title) - cx(img)) > 1 || title.bottom > img.top + 1)) return false;
        if (copy && (Math.abs(cx(copy) - cx(img)) > 1 || copy.top < img.bottom - 1)) return false;
      }
      if (p.dataset.contentPosition !== 'auto' && (copy || title) && p.dataset.contentPosition !== p.dataset.resolvedPosition) return false;
      return true;
    });
    return { state: grid.dataset.multiState, error: grid.dataset.multiError,
      alignment,
      metrics: JSON.parse(grid.dataset.multiMetrics || 'null'), overlaps,
      outside: boxes.some(b => b.left < boundary.left - 1 || b.top < boundary.top - 1 || b.right > boundary.right + 1 || b.bottom > boundary.bottom + 1),
      actualArea: panels.reduce((sum, p) => {
        const img = p.querySelector('img'), box = p.querySelector('.figure');
        const ratio = img.naturalWidth / img.naturalHeight;
        const bounds = box.getBoundingClientRect(), scale = __deck.getScale();
        return sum + Math.min(bounds.height / scale, bounds.width / scale / ratio) ** 2 * ratio;
      }, 0),
      styles: panels.map(p => ({ w: p.clientWidth, h: p.clientHeight,
        img: getComputedStyle(p.querySelector('img')).objectFit,
        title: p.querySelector('.multi-title') ? getComputedStyle(p.querySelector('.multi-title')).fontSize : null,
        copy: p.querySelector('.multi-copy') ? getComputedStyle(p.querySelector('.multi-copy')).fontSize : null })),
      count: panels.length,
      resolved: { scale: Number(grid.dataset.resolvedFontScale),
        title: Number(grid.dataset.resolvedTitleSize), copy: Number(grid.dataset.resolvedCopySize) },
      positions: boxes.map(b => [b.x, b.y, b.width, b.height]) };
  });
  assert.equal(result.state, 'ready', JSON.stringify(result));
  assert.equal(result.alignment, true, JSON.stringify(result));
  assert.equal(result.overlaps, false); assert.equal(result.outside, false);
  const titleSizes = [], copySizes = [];
  for (const style of result.styles) {
    assert.equal(style.img, 'contain');
    if (style.title) titleSizes.push(parseFloat(style.title));
    if (style.copy) copySizes.push(parseFloat(style.copy));
  }
  assert.ok(titleSizes.every(size => Math.abs(size - result.resolved.title) < 0.02));
  assert.ok(copySizes.every(size => Math.abs(size - result.resolved.copy) < 0.02));
  assert.ok(new Set(titleSizes.map(size => size.toFixed(2))).size <= 1, 'title sizes differ within one page');
  assert.ok(new Set(copySizes.map(size => size.toFixed(2))).size <= 1, 'copy sizes differ within one page');
  const baseTitle = result.count <= 3 ? 22 : result.count === 4 ? 20 : 18;
  const baseCopy = result.count <= 3 ? 20 : 18;
  assert.ok(result.resolved.title <= baseTitle + 0.01 && result.resolved.copy <= baseCopy + 0.01);
  assert.ok(Math.abs(result.resolved.title - baseTitle * result.resolved.scale) < 0.02);
  assert.ok(Math.abs(result.resolved.copy - baseCopy * result.resolved.scale) < 0.02);
  if (result.metrics) {
    assert.ok(result.metrics.min >= result.metrics.baseline.min - 1);
    assert.ok(result.metrics.total >= result.metrics.baseline.total - 1);
    assert.ok(result.actualArea >= result.metrics.total - 200, JSON.stringify(result));
  }
  return result;
}
try {
  for (const fixture of fixtures) {
    await page.setViewportSize({ width: fixture.aspect_ratio === '4:3' ? 960 : 1280, height: 720 });
    await page.goto(fixture.url + '#/s13a-multi-auto'); await ready();
    const initial = await checkCurrent();
    await page.reload(); await ready();
    assert.deepEqual((await checkCurrent()).positions, initial.positions, 'Layout changed on reload');
    for (const position of ['right', 'left', 'bottom']) {
      await page.evaluate(position => {
        __deck.getCurrentSlide().querySelector('.multi-panel').dataset.contentPosition = position;
        return layoutMultiImages(__deck.getCurrentSlide());
      }, position);
      await checkCurrent();
    }
    await page.evaluate(() => __deck.slide(__deck.getSlides().findIndex(s => s.id === 's13b-multi-manual')));
    await page.evaluate(() => window.__multiImageReady);
    const manual = await checkCurrent();
    assert.ok(manual.positions[0][3] > manual.positions[1][3] * 1.8);
    assert.ok(manual.positions[0][0] < manual.positions[1][0]);
    assert.ok(manual.positions[1][1] < manual.positions[2][1]);
    await page.setViewportSize({ width: 800, height: 600 });
    await ready(); await checkCurrent();
    const validation = run('validate.py', [fixture.dir, '--visual']);
    assert.equal(validation.status, 0, validation.stdout + validation.stderr);
    console.log(fixture.aspect_ratio, fixture.chapter_nav ? 'nav' : 'no-nav', validation.stdout.trim());
  }
  for (const width of [1280, 960]) {
    await page.setViewportSize({ width, height: 720 });
    await page.goto(stress.url); await ready();
    if (width === 960) {
      // Exercise a real 960px logical canvas, not a scaled 1280px slide in a narrow window.
      await page.evaluate(() => {
        document.body.classList.replace('ratio-16-9', 'ratio-4-3');
        __deck.configure({ width: 960 });
        __deck.layout();
        return layoutMultiImages(__deck.getCurrentSlide());
      });
    }
    for (let i = 0; i < stressCounts.length; i++) {
      const start = Date.now();
      await page.evaluate(idx => __deck.slide(idx), i);
      await page.evaluate(() => window.__multiImageReady);
      const result = await checkCurrent();
      assert.equal(result.resolved.scale, 1, 'short stress fixture should use its count tier without extra shrinking');
      console.log('stress', width, stressCounts[i], 'images:', Date.now() - start, 'ms',
        'area ratio', (result.metrics.total / result.metrics.baseline.total).toFixed(3));
    }
  }
  assert.deepEqual(errors, []);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(rightCases.url); await ready(); await checkCurrent();
  assert.equal(await page.locator('.present .multi-panel').first().getAttribute('data-content-fraction'), '0.7', '70% candidate was not selected');
  await page.evaluate(() => {
    __deck.getCurrentSlide().querySelector('.multi-panel').dataset.contentPosition = 'left';
    return layoutMultiImages(__deck.getCurrentSlide());
  });
  await checkCurrent();
  assert.equal(await page.locator('.present .multi-panel').first().getAttribute('data-content-fraction'), '0.7');
  await page.evaluate(() => __deck.slide(1));
  await page.evaluate(() => window.__multiImageReady); await checkCurrent();
  await page.evaluate(() => {
    __deck.getCurrentSlide().querySelectorAll('.multi-panel').forEach(p => p.dataset.contentPosition = 'left');
    return layoutMultiImages(__deck.getCurrentSlide());
  });
  await checkCurrent();
  assert.deepEqual(errors, []);
  await page.goto(leftCases.url); await ready(); await checkCurrent();
  await page.screenshot({ path: path.join(leftCases.dir, 'output/left-right-preview.png') });
  // Test an actual HTTP origin too, without requiring a persistent server or deployment setup.
  const serveDir = fixtures[0].dir;
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(serveDir, 'output', name === '/' ? 'index.html' : name);
    try {
      const ext = path.extname(file);
      res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[ext] || 'application/octet-stream');
      res.end(readFileSync(file));
    } catch (_) { res.statusCode = 404; res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + '/#/s13a-multi-auto');
    await ready(); await checkCurrent();
  } finally { await new Promise(resolve => server.close(resolve)); }
  assert.deepEqual(errors, []);
  await page.goto(missing.url); await ready();
  assert.equal(await page.locator('.multi-images').getAttribute('data-multi-state'), 'error');
  assert.match(await page.locator('.multi-images').getAttribute('data-multi-error'), /图片加载失败/);
  await page.goto(crowded.url); await ready();
  const crowdedResult = await checkCurrent();
  assert.ok(crowdedResult.resolved.copy < 18, 'crowded text did not shrink below 18px');
  console.log('PASS: multi-image auto/manual, adaptive fonts, 4 view modes, 2/3/4/5/6 images, schema failures, file/HTTP, missing image');
} finally { await browser.close(); }
