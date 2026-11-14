#!/usr/bin/env node
/* academic-presentation 视觉检查：真实浏览器中逐页导航，检测
   控制台错误 / 资源加载失败 / 元素越界 / 垂直溢出 / Mermaid 渲染 / MathJax 产物，
   并输出逐页截图。用法: node visual_check.mjs <deck>/output */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const outDir = process.argv[2];
if (!outDir) { console.error('用法: node visual_check.mjs <deck>/output'); process.exit(2); }
const indexUrl = 'file:///' + path.resolve(outDir, 'index.html').replace(/\\/g, '/');

const EXEC_FALLBACKS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];

async function launch() {
  for (const opt of [{ channel: 'chrome' }, { channel: 'msedge' },
                     ...EXEC_FALLBACKS.map((p) => fs.existsSync(p) ? { executablePath: p } : null)]) {
    if (!opt) continue;
    try { return await chromium.launch({ headless: true, ...opt }); } catch (e) { /* try next */ }
  }
  throw new Error('无法启动 Chrome/Edge（playwright-core 使用系统浏览器）');
}

const report = { pages: [], console_errors: [], request_failed: [] };
let browser;
try {
  browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error') report.console_errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => report.console_errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('requestfailed', (r) => report.request_failed.push(r.url()));

  await page.goto(indexUrl, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__deck && __deck.isReady(), { timeout: 30000 });
  await page.evaluate(() => (window.MathJax && MathJax.startup && MathJax.startup.promise) ? MathJax.startup.promise : null);
  await page.waitForTimeout(500);

  const total = await page.evaluate(() => __deck.getTotalSlides());
  fs.mkdirSync(path.join(outDir, 'screenshots'), { recursive: true });

  for (let i = 0; i < total; i++) {
    await page.evaluate((idx) => __deck.slide(idx), i);
    await page.waitForTimeout(420);
    const info = await page.evaluate(() => {
      const slide = __deck.getCurrentSlide();
      const fr = slide.getBoundingClientRect();
      const scale = fr.width / 1280 || 1;
      const tol = 4 / scale;
      const overflow = [];
      for (const el of slide.querySelectorAll('*')) {
        if (el.closest('aside.notes')) continue;
        if (!el.getClientRects().length) continue;
        const r = el.getBoundingClientRect();
        if (!r.width && !r.height) continue;
        const push = (direction, px) => {
          if (!overflow.some((o) => o.el === el)) {
            overflow.push({ el, tag: el.tagName.toLowerCase(), class: el.getAttribute('class') || '',
                            text: (el.textContent || '').trim().slice(0, 60), direction, px });
          }
        };
        if (r.right > fr.right + tol) push('右溢出', r.right - fr.right);
        if (r.bottom > fr.bottom + tol) push('下溢出', r.bottom - fr.bottom);
        if (r.left < fr.left - tol) push('左溢出', fr.left - r.left);
        if (r.top < fr.top - tol) push('上溢出', fr.top - r.top);
      }
      const mm = slide.querySelectorAll('.mermaid');
      const rendered = slide.querySelectorAll('.mermaid svg');
      let mermaidError = '';
      const bad = slide.querySelector('.mermaid pre');
      if (bad && /Mermaid 渲染失败/.test(bad.textContent || '')) {
        mermaidError = bad.textContent.trim().slice(0, 300);
      }
      // 只保留最外层越界元素：若已记录的元素包含当前元素，则跳过；
      // 若当前元素包含已记录元素，则替换之（避免同一根因刷出几十条 P1）。
      const rootOverflow = [];
      for (const item of overflow) {
        const el = item.el;
        const container = rootOverflow.find((o) => o.el.contains(el));
        if (container) continue;
        const idx = rootOverflow.findIndex((o) => el.contains(o.el));
        if (idx >= 0) rootOverflow[idx] = item;
        else rootOverflow.push(item);
      }
      const srcNoNotes = slide.innerHTML.replace(/<aside class="notes">[\s\S]*?<\/aside>/g, '');
      let mathjaxError = '';
      const mjxErr = slide.querySelector('mjx-merror, .MathJax_Error');
      if (mjxErr) mathjaxError = (mjxErr.textContent || '').trim().slice(0, 200);
      // 版面留白检查：内容（不含引用脚注）结束位置距引用安全区的大块空隙，
      // 即"文字堆在上半部、下半部空白"。封面/章节页刻意留白，不检查。
      let maxBottom = 0;
      for (const el of slide.querySelectorAll('*')) {
        if (el.closest('aside.notes') || el.closest('.cite')) continue;
        if (!el.getClientRects().length) continue;
        const r = el.getBoundingClientRect();
        if (r.width && r.height && r.bottom > maxBottom) maxBottom = r.bottom;
      }
      const bottomGap = Math.round((fr.bottom - 58 * scale) - maxBottom);
      const sparse = bottomGap > 110 * scale &&
        !slide.classList.contains('cover') && !slide.classList.contains('section-slide');
      // 引用脚注安全区：任何内容元素压进 .cite 区域即报告（v1.4，此前靠人眼发现）
      let citeOverlap = null;
      const cite = slide.querySelector('.cite');
      if (cite) {
        const ct = cite.getBoundingClientRect().top;
        for (const el of slide.querySelectorAll('*')) {
          if (el.closest('aside.notes') || el.closest('.cite')) continue;
          if (!el.getClientRects().length) continue;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          if (r.bottom > ct + 2 / scale) {
            if (!citeOverlap || r.bottom > citeOverlap.bottom) {
              citeOverlap = { tag: el.tagName.toLowerCase(), class: el.getAttribute('class') || '',
                              text: (el.textContent || '').trim().slice(0, 60), bottom: r.bottom, px: Math.round(r.bottom - ct) };
            }
          }
        }
        if (citeOverlap) delete citeOverlap.bottom;
      }
      return {
        id: slide.getAttribute('data-slide-id') || slide.id || '',
        scroll_overflow: slide.scrollHeight > slide.clientHeight + 6,
        overflow: rootOverflow.map(({ tag, class: c, text, direction, px }) => ({ tag, class: c, text, direction, px })),
        bottom_gap: bottomGap,
        sparse,
        cite_overlap: citeOverlap,
        mermaid_total: mm.length, mermaid_rendered: rendered.length, mermaid_error: mermaidError,
        mathjax_expected: slide.hasAttribute('data-math'),
        mathjax_any: slide.querySelectorAll('mjx-container').length,
        mathjax_error: mathjaxError,
        _src_has_math: /\$|\\\(|\\\[/.test(srcNoNotes),
      };
    });
    if (info._src_has_math && !info.mathjax_expected) {
      info.mathjax_expected = true; // 兜底：build 未打标但源码含公式
    }
    delete info._src_has_math;
    report.pages.push({ index: i, ...info });
    const sid = String(info.id || `p${i + 1}`).replace(/[^\w.-]/g, '_');
    await page.screenshot({ path: path.join(outDir, 'screenshots', `slide-${String(i + 1).padStart(2, '0')}-${sid}.png`) });
  }
} catch (e) {
  report.console_errors.push('fatal: ' + String(e).slice(0, 400));
} finally {
  if (browser) await browser.close();
}
fs.writeFileSync(path.join(outDir, 'visual-report.json'), JSON.stringify(report, null, 2));
const bad = report.console_errors.length + report.request_failed.length +
  report.pages.reduce((n, p) => n + p.overflow.length + (p.scroll_overflow ? 1 : 0) +
    (p.cite_overlap ? 1 : 0) +
    (p.mermaid_total > p.mermaid_rendered ? 1 : 0) + (p.mermaid_error ? 1 : 0) +
    ((p.mathjax_expected && !p.mathjax_any) ? 1 : 0), 0);
console.log(`[visual] ${report.pages.length} 页已截图; 异常计数=${bad}`);
process.exit(bad ? 1 : 0);
