/**
 * 内容类版式：要点 / 两栏 / 卡片 / 指标 / 引文 / 图片页
 */
const { W, M, text, fitFont, lineCount, rect } = require('../kit');
const { lightScene, darkScene, titleBlock, takeawayBar, stackText } = require('./common');

const bullets = (s, th) => {
  const p = th.palette;
  const scene = lightScene(th);
  scene.elements.push(...titleBlock(s, th));
  const maxY = s.takeaway ? 4.45 : 5.0;
  const stack = stackText(s.items, {
    x: M, y: 1.42, w: W - 2 * M, maxY, theme: th, size: 15, gap: 0.22,
  });
  scene.elements.push(...stack.elements, ...takeawayBar(s, th));
  return scene;
};

const twoCol = (s, th) => {
  const p = th.palette;
  const scene = lightScene(th);
  scene.elements.push(...titleBlock(s, th));

  const hasRight = !!s.right;
  const leftW = hasRight ? 4.0 : W - 2 * M;
  const left = stackText(s.left, {
    x: M, y: 1.42, w: leftW, maxY: 4.95, theme: th, size: 14, gap: 0.2,
  });
  scene.elements.push(...left.elements);

  if (hasRight) {
    const rx = 5.05;
    const rw = W - M - rx;
    scene.elements.push(rect({
      x: rx, y: 1.38, w: rw, h: 3.42,
      fill: p.card, line: null, radius: 0.08,
    }));
    const rTitle = typeof s.right === 'string' ? '' : s.right.title || '';
    if (rTitle) {
      scene.elements.push(text({
        x: rx + 0.24, y: 1.55, w: rw - 0.48, h: 0.36,
        text: rTitle, fontSize: 13, bold: true,
        color: p.primary, font: th.fonts.body,
      }));
    }
    const rItems = typeof s.right === 'string' ? [s.right] : s.right.items || [];
    const r = stackText(rItems, {
      x: rx + 0.24, y: rTitle ? 1.98 : 1.62, w: rw - 0.48, maxY: 4.62,
      theme: th, size: 12, gap: 0.16, hasBullet: false,
      color: p.text,
    });
    scene.elements.push(...r.elements);
  }
  return scene;
};

const cards = (s, th) => {
  const p = th.palette;
  const scene = lightScene(th);
  scene.elements.push(...titleBlock(s, th));

  const items = s.items || [];
  const cols = Math.min(3, Math.max(1, items.length));
  const rows = Math.ceil(items.length / 3);
  const gap = 0.3;
  const cardW = (W - 2 * M - gap * (cols - 1)) / cols;
  const cardH = rows === 1 ? 2.8 : 1.55;
  const rowGap = 0.22;

  items.forEach((it, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const x = M + col * (cardW + gap);
    const y = 1.45 + row * (cardH + rowGap);
    scene.elements.push(rect({
      x, y, w: cardW, h: cardH,
      fill: p.card, line: null, radius: 0.08,
    }));
    const tag = it.tag || String(i + 1).padStart(2, '0');
    scene.elements.push(text({
      x: x + 0.24, y: y + 0.2, w: cardW - 0.48, h: 0.26,
      text: String(tag), fontSize: 11, bold: true,
      color: p.accent, font: th.fonts.heading,
    }));
    const tSize = fitFont(it.title || '', 17, cardW - 0.48, 0.62);
    scene.elements.push(text({
      x: x + 0.24, y: y + 0.5, w: cardW - 0.48, h: 0.66,
      text: it.title || '', fontSize: tSize, bold: true,
      color: p.primary, font: th.fonts.heading,
    }));
    if (it.body) {
      const bodyH = cardH - (rows === 1 ? 1.35 : 1.25);
      const bSize = fitFont(it.body, 11.5, cardW - 0.48, bodyH, { minSize: 9 });
      scene.elements.push(text({
        x: x + 0.24, y: y + (rows === 1 ? 1.32 : 1.22), w: cardW - 0.48, h: bodyH,
        text: it.body, fontSize: bSize,
        color: p.muted, font: th.fonts.body,
      }));
    }
  });
  scene.elements.push(...takeawayBar(s, th));
  return scene;
};

const kpi = (s, th) => {
  const p = th.palette;
  const scene = lightScene(th);
  scene.elements.push(...titleBlock(s, th));

  const items = (s.items || []).slice(0, 4);
  const n = Math.max(1, items.length);
  const gap = 0.34;
  const colW = (W - 2 * M - gap * (n - 1)) / n;

  items.forEach((it, i) => {
    const x = M + i * (colW + gap);
    if (i > 0) {
      scene.elements.push({
        type: 'line', x1: x - gap / 2, y1: 1.75, x2: x - gap / 2, y2: 4.15,
        color: p.line, width: 0.75,
      });
    }
    const vSize = fitFont(it.value || '', th.sizes.kpi, colW - 0.1, 0.92);
    scene.elements.push(text({
      x, y: 1.78, w: colW, h: 0.95,
      text: it.value || '', fontSize: vSize, bold: true,
      color: i === 0 ? p.accent : p.primary, font: th.fonts.heading,
    }));
    scene.elements.push(text({
      x, y: 2.78, w: colW, h: 0.34,
      text: it.label || '', fontSize: 13, bold: true,
      color: p.text, font: th.fonts.body,
    }));
    if (it.note) {
      scene.elements.push(text({
        x, y: 3.16, w: colW, h: 0.7,
        text: it.note, fontSize: 10.5,
        color: p.muted, font: th.fonts.body,
      }));
    }
  });
  scene.elements.push(...takeawayBar(s, th));
  return scene;
};

const quote = (s, th) => {
  const p = th.palette;
  const scene = darkScene(th);
  const els = scene.elements;
  const q = s.quote || '';
  const size = fitFont(q, 26, 8.2, 2.3);
  els.push(text({
    x: 0.9, y: 1.35, w: 8.2, h: 2.4,
    text: q, fontSize: size, bold: false, italic: true,
    color: p.onDark, font: th.fonts.heading,
  }));
  if (s.attribution) {
    els.push(text({
      x: 0.9, y: 3.92, w: 8.2, h: 0.4,
      text: `— ${s.attribution}`, fontSize: 13,
      color: p.onDarkMuted, font: th.fonts.body,
    }));
  }
  return scene;
};

const image = (s, th) => {
  const p = th.palette;
  const scene = lightScene(th);
  const hasTitle = !!s.title;
  if (hasTitle) scene.elements.push(...titleBlock(s, th));

  const fy = hasTitle ? 1.3 : 0.55;
  const fh = hasTitle ? 3.42 : 4.5;
  scene.elements.push(rect({
    x: M, y: fy, w: W - 2 * M, h: fh,
    fill: p.card, line: { color: p.line, width: 1 }, radius: 0.06,
  }));
  scene.elements.push({
    type: s.src ? 'image' : 'placeholder',
    src: s.src,
    label: s.caption || '图片占位',
    x: M + 0.08, y: fy + 0.08, w: W - 2 * M - 0.16, h: fh - 0.16,
    fit: 'contain',
  });
  if (s.caption) {
    scene.elements.push(text({
      x: M, y: fy + fh + 0.1, w: W - 2 * M, h: 0.3,
      text: s.caption, fontSize: th.sizes.caption,
      color: p.muted, font: th.fonts.body,
    }));
  }
  return scene;
};

module.exports = { bullets, twoCol, cards, kpi, quote, image };
