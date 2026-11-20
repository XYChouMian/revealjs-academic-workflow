/* Multi-image: deterministic bounded search in logical slide coordinates.
   No dependency on viewport scale, source-image cropping, or font shrinking. */
(function () {
  'use strict';
  const BEAM = 12;
  const EPS = 0.01;
  const better = (a, b) => !b || a.min > b.min + EPS ||
    (Math.abs(a.min - b.min) <= EPS && a.total > b.total + EPS);
  function score(boxes, ratios, measure) {
    let min = Infinity, total = 0, valid = true;
    for (const box of boxes) {
      const fit = measure(box.i, box.w, box.h);
      const area = fit?.area || 0;
      if (!fit) valid = false;
      min = Math.min(min, area); total += area;
    }
    return { min: valid ? min : -1, total, valid, boxes };
  }
  function equalGrid(ids, rect, columns, gap) {
    const rows = Math.ceil(ids.length / columns);
    const w = (rect.w - gap * (columns - 1)) / columns;
    const h = (rect.h - gap * (rows - 1)) / rows;
    return ids.map((i, j) => ({ i, x: rect.x + j % columns * (w + gap),
      y: rect.y + Math.floor(j / columns) * (h + gap), w, h }));
  }
  function optimize(ids, width, height, ratios, measure, gap) {
    const full = { x: 0, y: 0, w: width, h: height };
    const evaluate = boxes => score(boxes, ratios, measure);
    let baseline;
    for (let columns = 1; columns <= ids.length; columns++) {
      const s = evaluate(equalGrid(ids, full, columns, gap));
      if (better(s, baseline)) baseline = s;
    }
    let best = baseline;
    // For unresolved groups, use the best equal-grid estimate. Each expansion splits
    // one group; only twelve whole-page candidates survive each depth (no permutations).
    function estimate(groups) {
      const boxes = [];
      for (const group of groups) {
        let pick;
        for (let c = 1; c <= group.ids.length; c++) {
          const s = evaluate(equalGrid(group.ids, group, c, gap));
          if (better(s, pick)) pick = s;
        }
        boxes.push(...pick.boxes);
      }
      return evaluate(boxes);
    }
    let beam = [{ groups: [{ ...full, ids }], rank: baseline }];
    for (let depth = 1; depth < ids.length; depth++) {
      const next = [];
      for (const state of beam) {
        const group = state.groups.reduce((a, b) => a.ids.length >= b.ids.length ? a : b);
        const rest = state.groups.filter(g => g !== group);
        const sorted = [...group.ids].sort((a, b) => ratios[a] - ratios[b] || a - b);
        const orders = [group.ids, sorted, [...sorted].reverse()];
        const seen = new Set();
        const partitions = [];
        for (const order of orders) {
          for (let k = 1; k < order.length; k++) {
            const left = order.slice(0, k), right = order.slice(k);
            const key = [...left].sort((a, b) => a - b).join(',');
            if (!seen.has(key)) { seen.add(key); partitions.push([left, right]); }
          }
        }
        // Keep candidate count bounded even for an unusually large image list.
        const selected = partitions.length <= 12 ? partitions :
          Array.from({ length: 12 }, (_, i) => partitions[Math.floor(i * partitions.length / 12)]);
        for (const [a, b] of selected) {
          for (const axis of ['x', 'y']) {
            const weight = list => list.reduce((sum, i) => sum +
              Math.sqrt(axis === 'x' ? ratios[i] : 1 / ratios[i]), 0);
            const natural = weight(a) / (weight(a) + weight(b));
            const fractions = [...new Set([0.33, 0.5, 0.67, natural].map(v =>
              Math.max(0.15, Math.min(0.85, v))))];
            for (const f of fractions) {
              let first, second;
              if (axis === 'x') {
                const w = (group.w - gap) * f;
                first = { ...group, ids: a, w };
                second = { ...group, ids: b, x: group.x + w + gap, w: group.w - w - gap };
              } else {
                const h = (group.h - gap) * f;
                first = { ...group, ids: a, h };
                second = { ...group, ids: b, y: group.y + h + gap, h: group.h - h - gap };
              }
              const groups = [...rest, first, second];
              const rank = estimate(groups);
              next.push({ groups, rank });
              if (depth === ids.length - 1 && rank.valid &&
                  rank.total >= baseline.total - EPS && better(rank, best)) best = rank;
            }
          }
        }
      }
      next.sort((a, b) => better(a.rank, b.rank) ? -1 : better(b.rank, a.rank) ? 1 : 0);
      beam = next.slice(0, BEAM);
    }
    return { ...best, baseline: { min: baseline.min, total: baseline.total } };
  }
  function waitImage(img) {
    if (img.complete) return img.naturalWidth ? Promise.resolve() : Promise.reject(new Error('图片加载失败: ' + img.getAttribute('src')));
    return new Promise((resolve, reject) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', () => reject(new Error('图片加载失败: ' + img.getAttribute('src'))), { once: true });
    });
  }
  async function layout(grid) {
    const panels = [...grid.children];
    const imgs = panels.map(p => p.querySelector('img'));
    await Promise.all(imgs.map(waitImage));
    const width = grid.clientWidth, height = grid.clientHeight;
    if (!width || !height) return;
    const ratios = imgs.map(img => img.naturalWidth / img.naturalHeight);
    if (ratios.some(r => !Number.isFinite(r) || r <= 0)) throw new Error('图片缺少有效原始尺寸');
    const signature = [width, height, ...ratios, ...panels.map(p =>
      [p.dataset.contentPosition, p.querySelector('.multi-title')?.innerHTML, p.querySelector('.multi-copy')?.innerHTML].join(':'))].join('|');
    if (grid.dataset.multiSignature === signature) { grid.dataset.multiState = 'ready'; return; }
    const gap = parseFloat(getComputedStyle(grid).getPropertyValue('--multi-gap'));
    const baseTitle = panels.length <= 3 ? 22 : panels.length === 4 ? 20 : 18;
    const baseCopy = panels.length <= 3 ? 20 : 18;
    let cache = new Map(), fits = new Map();
    function setFontScale(scale) {
      grid.style.setProperty('--multi-title-size', (baseTitle * scale) + 'px');
      grid.style.setProperty('--multi-copy-size', (baseCopy * scale) + 'px');
      cache = new Map(); fits = new Map();
    }
      const probe = document.createElement('div');
      probe.className = 'multi-panel multi-measure';
      probe.style.cssText = 'position:absolute;visibility:hidden;height:auto;left:0;top:0;';
      grid.appendChild(probe);
      function textHeight(i, type, w) {
        const bucket = Math.max(1, Math.floor(w / 4) * 4);
        const key = i + ':' + type + ':' + bucket;
        if (!cache.has(key)) {
          probe.style.width = bucket + 'px';
          probe.replaceChildren();
          const el = panels[i].querySelector('.multi-' + type);
          if (!el) return 0;
          const clone = el.cloneNode(true);
          clone.style.cssText = 'position:static;width:100%;height:auto;';
          probe.appendChild(clone);
          cache.set(key, { height: probe.getBoundingClientRect().height / window.__deck.getScale(),
            valid: clone.scrollWidth <= clone.clientWidth + 2 });
        }
        const value = cache.get(key);
        return value.valid ? value.height : Infinity;
      }
      function measure(i, w, h) {
        const key = [i, w.toFixed(3), h.toFixed(3)].join(':');
        if (fits.has(key)) return fits.get(key);
        const panel = panels[i], ratio = ratios[i];
        const title = panel.querySelector('.multi-title'), copy = panel.querySelector('.multi-copy');
        const modes = !copy && !title ? ['bottom'] : panel.dataset.contentPosition === 'auto' ? ['bottom', 'right'] : [panel.dataset.contentPosition];
        let best;
        for (const mode of modes) {
          const sidebar = mode === 'right' || mode === 'left';
          const fractions = sidebar ? [0.25, 0.33, 0.4, 0.5, 0.7] : [0];
          for (const fraction of fractions) {
            const cw = sidebar ? w * fraction : 0;
            if (sidebar && cw < 160) continue;
            const maxWidth = Math.min(w - (cw ? cw + 8 : 0), h * ratio);
            const geometry = iw => {
              const ih = iw / ratio;
              const th = title ? textHeight(i, 'title', cw || iw) : 0;
              const ch = copy ? textHeight(i, 'copy', cw || iw) : 0;
              if (!Number.isFinite(th + ch)) return null;
              const tg = title ? 8 : 0, cg = copy ? 8 : 0;
              const textGroup = th + (title && copy ? 8 : 0) + ch;
              if (sidebar && textGroup > ih + 0.01) return null;
              const needed = sidebar ? ih : th + tg + ih + cg + ch;
              if (needed > h + 0.01 || iw < 1) return null;
              const groupX = (w - iw - (cw ? cw + 8 : 0)) / 2;
              const x = groupX + (mode === 'left' ? cw + 8 : 0);
              const copyX = mode === 'left' ? groupX : mode === 'right' ? x + iw + 8 : x;
              const y = sidebar ? (h - ih) / 2 : (h - needed) / 2 + th + tg;
              const textY = y + (ih - textGroup) / 2;
              return { area: iw * ih, mode, fraction, image: { x, y, w: iw, h: ih },
                title: { x: copyX, y: sidebar ? textY : y - tg - th, w: cw || iw, h: th },
                copy: { x: copyX,
                  y: sidebar ? textY + th + (title && copy ? 8 : 0) : y + ih + cg, w: cw || iw, h: ch } };
            };
            // Text wraps in steps; scan a bounded width range before refining its
            // largest feasible interval. This also measures text at image width.
            for (let step = 0; step < 32; step++) {
              const iw = maxWidth * (1 - step / 32);
              let found = geometry(iw);
              if (!found) continue;
              let lo = iw, hi = Math.min(maxWidth, iw + maxWidth / 32);
              for (let k = 0; k < 8; k++) {
                const mid = (lo + hi) / 2, fit = geometry(mid);
                if (fit) { lo = mid; found = fit; } else hi = mid;
              }
              if (!best || found.area > best.area + EPS) best = found;
              break;
            }
          }
        }
        fits.set(key, best);
        return best;
      }
      function place(el, rect) {
        if (el) Object.assign(el.style, { left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px' });
      }
      function attempt(scale) {
        setFontScale(scale);
        let result;
        const placements = [];
        if (grid.dataset.mode === 'auto') {
          result = optimize(panels.map((_, i) => i), width, height, ratios, measure, gap);
          if (!result.valid) return null;
          for (const box of result.boxes) {
            Object.assign(panels[box.i].style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' });
          }
        }
        for (let i = 0; i < panels.length; i++) {
          const bounds = panels[i].getBoundingClientRect(), revealScale = window.__deck.getScale();
          const fit = measure(i, bounds.width / revealScale, bounds.height / revealScale);
          if (!fit) return null;
          placements.push(fit);
        }
        return { result, placements };
      }
      let solution = attempt(1), resolvedScale = 1;
      if (!solution) {
        let failedScale = 1, passingScale = null;
        for (let i = 0, scale = 0.75; i < 32; i++, scale *= 0.75) {
          const candidate = attempt(scale);
          if (candidate) { solution = candidate; passingScale = scale; break; }
          failedScale = scale;
        }
        if (!solution) {
          probe.remove();
          throw new Error('多图页无法形成有效图文几何，请检查网格尺寸与内容结构');
        }
        let lo = passingScale, hi = failedScale;
        for (let i = 0; i < 8; i++) {
          const mid = (lo + hi) / 2;
          const candidate = attempt(mid);
          if (candidate) { solution = candidate; lo = mid; }
          else hi = mid;
        }
        resolvedScale = lo;
        solution = attempt(resolvedScale);
      }
      try {
        if (solution.result) {
          const result = solution.result;
          grid.dataset.multiMetrics = JSON.stringify({ min: result.min, total: result.total, baseline: result.baseline });
        }
        for (let i = 0; i < panels.length; i++) {
          const fit = solution.placements[i];
          panels[i].dataset.resolvedPosition = fit.mode;
          panels[i].dataset.contentFraction = fit.fraction;
          place(panels[i].querySelector('.figure'), fit.image);
          place(panels[i].querySelector('.multi-title'), fit.title);
          place(panels[i].querySelector('.multi-copy'), fit.copy);
        }
      }
      finally { probe.remove(); }
    const resolvedTitle = baseTitle * resolvedScale, resolvedCopy = baseCopy * resolvedScale;
    grid.dataset.resolvedFontScale = resolvedScale.toFixed(6);
    grid.dataset.resolvedTitleSize = resolvedTitle.toFixed(3);
    grid.dataset.resolvedCopySize = resolvedCopy.toFixed(3);
    for (const panel of panels) {
      const figure = panel.querySelector('.figure');
      const text = [...panel.querySelectorAll('.multi-title,.multi-copy')];
      if (figure.clientHeight < 1 || text.some(el => el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) ||
          panel.scrollHeight > panel.clientHeight + 2) {
        throw new Error('多图页图文空间不足，请调整网格、减少说明或拆页');
      }
    }
    grid.dataset.multiSignature = signature;
    grid.dataset.multiState = 'ready';
  }
  window.layoutMultiImages = function (slide) {
    const grids = slide ? [...slide.querySelectorAll('.multi-images')] : [];
    const pending = grids.map(grid => {
      grid.dataset.multiState = 'pending';
      // MathJax/font/image readiness is part of layout completion, not a screenshot delay.
      const run = Promise.all([document.fonts?.ready,
        window.MathJax?.startup?.promise]).then(() => layout(grid)).catch(error => {
          grid.dataset.multiState = 'error';
          grid.dataset.multiError = error.message;
          console.error('Multi-image layout failed:', error.message);
        });
      return run;
    });
    window.__multiImageReady = Promise.all(pending);
    return window.__multiImageReady;
  };
})();
