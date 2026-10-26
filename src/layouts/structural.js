/**
 * 结构类版式：封面 / 章节页 / 目录 / 结尾
 */
const { W, H, M, text, fitFont } = require('../kit');
const { darkScene, lightScene, titleBlock } = require('./common');

const cover = (s, th) => {
  const p = th.palette;
  const scene = darkScene(th);
  const els = scene.elements;
  const titleW = 7.9;
  const tSize = fitFont(s.title || '', th.sizes.display, titleW, 1.8);

  // 视觉母题：左上角实心色块 + 右侧细描边圆
  els.push({ type: 'rect', x: M, y: 1.38, w: 0.3, h: 0.3, fill: p.accent, radius: 0.03, line: null });
  els.push({
    type: 'rect', x: 7.55, y: 0.55, w: 2.15, h: 2.15,
    fill: null, radius: 1.08, line: { color: p.secondary, width: 1, transparency: 60 },
  });

  if (s.kicker) {
    els.push(text({
      x: M + 0.46, y: 1.36, w: 6.2, h: 0.34,
      text: s.kicker, fontSize: th.sizes.small, bold: true,
      color: p.onDarkMuted, font: th.fonts.body, valign: 'middle',
    }));
  }
  els.push(text({
    x: M, y: 1.85, w: titleW, h: 1.8,
    text: s.title || '', fontSize: tSize, bold: true,
    color: p.onDark, font: th.fonts.heading,
  }));
  if (s.subtitle) {
    els.push(text({
      x: M, y: 3.72, w: 7.6, h: 0.72,
      text: s.subtitle, fontSize: th.sizes.subtitle,
      color: p.onDarkMuted, font: th.fonts.body,
    }));
  }
  const foot = [s.author || th.meta && th.meta.author, s.date].filter(Boolean).join('   ·   ');
  if (foot) {
    els.push(text({
      x: M, y: 4.86, w: 8.9, h: 0.3,
      text: foot, fontSize: th.sizes.caption,
      color: p.onDarkMuted, font: th.fonts.body,
    }));
  }
  return scene;
};

const section = (s, th) => {
  const p = th.palette;
  const scene = darkScene(th);
  const els = scene.elements;
  const num = s.number || String(s.index).padStart(2, '0');

  els.push(text({
    x: M, y: 0.85, w: 3.2, h: 1.62,
    text: String(num), fontSize: 84, bold: true,
    color: p.onDarkMuted, font: th.fonts.heading,
  }));
  const tSize = fitFont(s.title || '', th.sizes.section, 8.6, 1.2);
  els.push(text({
    x: M, y: 2.45, w: 8.6, h: 1.2,
    text: s.title || '', fontSize: tSize, bold: true,
    color: p.onDark, font: th.fonts.heading,
  }));
  if (s.note) {
    els.push(text({
      x: M, y: 3.62, w: 7.4, h: 0.8,
      text: s.note, fontSize: 13,
      color: p.onDarkMuted, font: th.fonts.body,
    }));
  }
  return scene;
};

const toc = (s, th) => {
  const p = th.palette;
  const scene = lightScene(th);
  const els = scene.elements;
  els.push(...titleBlock(s, th));

  const items = s.items || [];
  const rows = Math.ceil(items.length / 2);
  const colW = (W - 2 * M - 0.7) / 2;
  const rowH = Math.min(0.98, 3.35 / Math.max(rows, 1));

  items.forEach((it, i) => {
    const col = i < rows ? 0 : 1;
    const row = i % rows;
    const x = M + col * (colW + 0.7);
    const y = 1.45 + row * rowH;
    els.push(text({
      x, y, w: 0.52, h: rowH * 0.6,
      text: String(i + 1).padStart(2, '0'), fontSize: 13, bold: true,
      color: p.accent, font: th.fonts.heading,
    }));
    els.push(text({
      x: x + 0.56, y: y - 0.02, w: colW - 0.56, h: rowH * 0.5,
      text: typeof it === 'string' ? it : it.title || '', fontSize: 15, bold: true,
      color: p.primary, font: th.fonts.body,
    }));
    if (it.note) {
      els.push(text({
        x: x + 0.56, y: y + 0.34, w: colW - 0.56, h: rowH * 0.4,
        text: it.note, fontSize: 10.5,
        color: p.muted, font: th.fonts.body,
      }));
    }
    if (row < rows - 1 || col === 0) {
      els.push({
        type: 'line', x1: x, y1: y + rowH - 0.16, x2: x + colW, y2: y + rowH - 0.16,
        color: p.line, width: 0.75,
      });
    }
  });
  return scene;
};

const end = (s, th) => {
  const p = th.palette;
  const scene = darkScene(th);
  const els = scene.elements;
  els.push(text({
    x: M, y: 1.85, w: 8.9, h: 1.0,
    text: s.title || '谢谢观看', fontSize: 40, bold: true,
    color: p.onDark, font: th.fonts.heading,
  }));
  if (s.note) {
    els.push(text({
      x: M, y: 3.0, w: 7.6, h: 0.7,
      text: s.note, fontSize: th.sizes.subtitle,
      color: p.onDarkMuted, font: th.fonts.body,
    }));
  }
  const contact = Array.isArray(s.contact) ? s.contact.join('   ·   ') : s.contact;
  if (contact) {
    els.push(text({
      x: M, y: 3.95, w: 8.6, h: 0.4,
      text: contact, fontSize: 12,
      color: p.secondary, font: th.fonts.body,
    }));
  }
  return scene;
};

module.exports = { cover, section, toc, end };
