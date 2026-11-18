#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exporter = path.join(root, 'src', 'academic-presentation', 'export_pdf.mjs');
const decks = process.argv.slice(2).map(value => path.resolve(value));
if (!decks.length) decks.push(path.join(root, 'decks', 'starter'));

for (const deck of decks) {
  const run = spawnSync(process.execPath, [exporter, deck], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const manifest = JSON.parse(fs.readFileSync(path.join(deck, 'output', 'build-manifest.json'), 'utf8'));
  const pdf = fs.readFileSync(path.join(deck, 'presentation.pdf'));
  assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, manifest.slides);
  const boxes = [...pdf.toString('latin1').matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)];
  assert.ok(boxes.length, 'PDF has no MediaBox');
  const expected = [manifest.slide_width * 0.75, manifest.slide_height * 0.75];
  for (const match of boxes) {
    assert.ok(Math.abs(Number(match[1]) - expected[0]) < 0.1);
    assert.ok(Math.abs(Number(match[2]) - expected[1]) < 0.1);
  }
}

// A failed export must not replace an existing PDF.
const broken = fs.mkdtempSync(path.join(os.tmpdir(), 'academic-pdf-export-'));
try {
  fs.writeFileSync(path.join(broken, 'presentation.pdf'), 'keep-existing');
  const run = spawnSync(process.execPath, [exporter, broken], { encoding: 'utf8' });
  assert.notEqual(run.status, 0);
  assert.equal(fs.readFileSync(path.join(broken, 'presentation.pdf'), 'utf8'), 'keep-existing');
} finally {
  fs.rmSync(broken, { recursive: true, force: true });
}

const noManifest = fs.mkdtempSync(path.join(os.tmpdir(), 'academic-pdf-manifest-'));
try {
  fs.mkdirSync(path.join(noManifest, 'output'));
  fs.writeFileSync(path.join(noManifest, 'output', 'index.html'), '<!doctype html>');
  const run = spawnSync(process.execPath, [exporter, noManifest], { encoding: 'utf8' });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /build-manifest\.json/);
} finally {
  fs.rmSync(noManifest, { recursive: true, force: true });
}

console.log(`PDF export tests passed (${decks.length} deck variants).`);
