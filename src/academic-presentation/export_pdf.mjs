#!/usr/bin/env node
/* Export an already-built Reveal deck to one searchable PDF page per slide. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let chromium;
try { ({ chromium } = await import('playwright-core')); }
catch (_) {
  console.error('[FAIL] playwright-core is not installed. Run npm ci in src/academic-presentation.');
  process.exit(1);
}

const deckArg = process.argv[2];
if (!deckArg) {
  console.error('Usage: node export_pdf.mjs <deck-dir>');
  process.exit(2);
}

const deckDir = path.resolve(deckArg);
const outputDir = path.join(deckDir, 'output');
const indexPath = path.join(outputDir, 'index.html');
const manifestPath = path.join(outputDir, 'build-manifest.json');
const pdfPath = path.join(deckDir, 'presentation.pdf');
const tempPdfPath = path.join(deckDir, `.presentation.${process.pid}.tmp.pdf`);

function fail(message) { throw new Error(message); }
if (!fs.existsSync(indexPath)) fail(`Missing ${indexPath}. Run the build first.`);
if (!fs.existsSync(manifestPath)) fail(`Missing ${manifestPath}. Run the build first.`);

let manifest;
try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
catch (error) { fail(`Invalid build-manifest.json: ${error.message}`); }
const expectedPages = Number(manifest.slides);
const slideWidth = Number(manifest.slide_width);
const slideHeight = Number(manifest.slide_height);
if (!Number.isInteger(expectedPages) || expectedPages < 1 ||
    !Number.isFinite(slideWidth) || !Number.isFinite(slideHeight)) {
  fail('build-manifest.json is missing valid slides/slide_width/slide_height values.');
}

const executableFallbacks = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
async function launchBrowser() {
  const options = [{ channel: 'chrome' }, { channel: 'msedge' },
    ...executableFallbacks.filter(fs.existsSync).map(executablePath => ({ executablePath }))];
  for (const option of options) {
    try { return await chromium.launch({ headless: true, ...option }); } catch (_) { /* try next */ }
  }
  fail('Cannot start system Chrome or Edge. Install one of them and try again.');
}

let browser;
try {
  browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: slideWidth, height: slideHeight }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 500));
  });
  page.on('pageerror', error => consoleErrors.push(String(error).slice(0, 500)));
  page.on('requestfailed', request => failedRequests.push(request.url()));

  const url = new URL(pathToFileURL(indexPath).href);
  url.searchParams.set('print-pdf', '');
  url.searchParams.set('pdfSeparateFragments', 'false');
  url.searchParams.set('pdfMaxPagesPerSlide', '1');
  await page.goto(url.href, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__deck && __deck.isReady(), { timeout: 30000 });
  // Let the template's own ready callback finish its final Reveal layout pass before
  // rendering every deferred diagram for the static print document.
  await page.waitForTimeout(500);
  await page.addStyleTag({ content: `
    html.print-pdf body.has-chapter-nav .reveal {
      position: relative !important; inset: auto !important;
      width: auto !important; height: auto !important;
    }
    html.print-pdf .reveal .slides .pdf-page > section:not(.layout-html) {
      display: flex !important; flex-direction: column;
    }
    html.print-pdf .reveal .slides .pdf-page > section {
      width: var(--slide-width) !important; height: var(--slide-height) !important;
      padding: 34px 52px 58px 52px !important;
    }
    html.print-pdf body.ratio-4-3 .reveal .slides .pdf-page > section {
      padding-left: 42px !important; padding-right: 42px !important;
    }
    html.print-pdf .reveal .slides .pdf-page > section:is(
      .layout-bullets,.layout-image,.layout-image-text,.layout-multi-image,
      .layout-compare,.layout-table,.layout-roadmap,.layout-conclusion,.layout-chapter-overview
    ) { padding-top: 72px !important; }
    html.print-pdf body.has-chapter-nav .reveal .slides .pdf-page > section.layout-html {
      padding-top: 34px !important;
    }
    html.print-pdf body.has-chapter-nav .reveal .slides .pdf-page > section > .kicker {
      top: 34px !important; height: 28px !important; line-height: 28px !important;
    }
    html.print-pdf .reveal .slides .pdf-page:last-child {
      page-break-after: auto !important; break-after: auto !important;
    }
  ` });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    if (window.MathJax?.startup?.promise) await MathJax.startup.promise;
    await Promise.all([...document.images].map(async image => {
      if (!image.complete) await new Promise((resolve, reject) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', () => reject(new Error(`Image failed: ${image.src}`)), { once: true });
      });
      if (!image.naturalWidth) throw new Error(`Image failed: ${image.src}`);
      if (image.decode) await image.decode().catch(() => {});
    }));
    const mermaidNodes = [...document.querySelectorAll('.mermaid:not([data-processed="true"])')];
    if (mermaidNodes.length) await mermaid.run({ nodes: mermaidNodes });
    for (const slide of document.querySelectorAll('.slides section')) {
      if (slide.querySelector('.multi-images')) await window.layoutMultiImages(slide);
    }
    // Chromium otherwise paginates a few trailing layout pixels into a blank page.
    // Clamp the print document to the exact Reveal page-strip height.
    const printHeight = document.querySelector('.slides').getBoundingClientRect().height;
    document.documentElement.style.setProperty('height', `${printHeight}px`, 'important');
    document.body.style.setProperty('height', `${printHeight}px`, 'important');
    document.documentElement.style.setProperty('overflow', 'hidden', 'important');
    document.body.style.setProperty('overflow', 'hidden', 'important');
  });
  await page.waitForTimeout(250);

  const readiness = await page.evaluate(() => ({
    pdfPages: document.querySelectorAll('.pdf-page').length,
    mermaids: document.querySelectorAll('.mermaid').length,
    mermaidSvgs: document.querySelectorAll('.mermaid svg').length,
    multiStates: [...document.querySelectorAll('.multi-images')].map(node => node.dataset.multiState),
    notesVisible: [...document.querySelectorAll('aside.notes')].some(node => getComputedStyle(node).display !== 'none'),
  }));
  if (readiness.pdfPages !== expectedPages) fail(`Print layout has ${readiness.pdfPages} pages; manifest expects ${expectedPages}.`);
  if (readiness.mermaidSvgs !== readiness.mermaids) fail(`Mermaid rendering incomplete (${readiness.mermaidSvgs}/${readiness.mermaids}).`);
  if (readiness.multiStates.some(state => state !== 'ready')) fail(`Multi-image rendering incomplete: ${readiness.multiStates.join(', ')}`);
  if (readiness.notesVisible) fail('Presenter Notes unexpectedly visible in print layout.');
  if (failedRequests.length) fail(`Resource loading failed: ${failedRequests.join(', ')}`);
  if (consoleErrors.length) fail(`Page rendering error: ${consoleErrors.join(' | ')}`);

  await page.pdf({ path: tempPdfPath, printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false });
  const pdfData = fs.readFileSync(tempPdfPath);
  const actualPages = (pdfData.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
  if (actualPages !== expectedPages) fail(`Generated PDF has ${actualPages} pages; manifest expects ${expectedPages}.`);
  fs.copyFileSync(tempPdfPath, pdfPath);
  fs.unlinkSync(tempPdfPath);
  console.log(`[OK] ${pdfPath} (${actualPages} pages, ${manifest.aspect_ratio || `${slideWidth}:${slideHeight}`})`);
} catch (error) {
  if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
  console.error(`[FAIL] ${error.message}`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
