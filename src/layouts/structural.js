/**
 * 结构类版式：封面 / 章节页 / 目录 / 结尾
 * 纵向坐标一律用 dy(g, y16, weight) 从 16:9 平滑映射到更高的画布
 */
const { text, fitFont, dy, slack } = require('../kit');
const { darkScene, lightScene, titleBlock } = require('./common');

const cover = (s, th, g) => {
  const p = th.palette;
  const { W, M, H } = g;
  const scene = darkScene(th);
  const els = scene.elements;
  const titleW = 7.9;
  const tSize = fitFont(s.title || '', th.sizes.display, titleW, 1.8);

  // 视觉母题：左上角实心色块 + 右侧细描边圆
  els.push({
    type: 'rect', x: M, y: dy(g, 1.38, 0.28), w: 0.3, h: 0.3,
    fill: p.accent, radius: 0.03, line: null,
  });
  els.push({
    type: 'rect', x: 7.55, y: dy(g, 0.55, 0.2), w: 2.15, h: 2.15,
    fill: null, radius: 1.08, line: { color: p.secondary, width: 1, transparency: 60 },
  });

  if (s.kicker) {
    els.push(text({
      x: M + 0.46, y: dy(g, 1.36, 0.28), w: 6.2, h: 0.34,
      text: s.kicker, fontSize: th.sizes.small, bold: true,
      color: p.onDarkMuted, font: th.fonts.body, valign: 'middle',
    }));
  }
  const titleY = dy(g, 1.85, 0.28);
  els.push(text({
    x: M, y: titleY, w: titleW, h: 1.8,
    text: s.title || '', fontSize: tSize, bold: true,
    color: p.onDark, font: th.fonts.heading,
  }));
  if (s.subtitle) {
    // 副标题只小幅下移，保持与标题的视觉距离
    els.push(text({
      x: M, y: dy(g, 3.72, 0.18), w: 7.6, h: 0.72,
      text: s.subtitle, fontSize: th.sizes.subtitle,
      color: p.onDarkMuted, font: th.fonts.body,
    }));
  }
  const foot = [s.author || th.meta && th.meta.author, s.date].filter(Boolean).join('   ·   ');
  if (foot) {
    els.push(text({
      x: M, y: H - 0.765, w: 8.9, h: 0.3,
      text: foot, fontSize: th.sizes.caption,
      color: p.onDarkMuted, font: th.fonts.body,
    }));
  }
  return scene;
};

const section = (s, th, g) => {
  const p = th.palette;
  const { M } = g;
  const scene = darkScene(th);
  const els = scene.elements;
  const num = s.number || String(s.index).padStart(2, '0');

  els.push(text({
    x: M, y: dy(g, 0.85, 0.42), w: 3.2, h: 1.62,
    text: String(num), fontSize: 84, bold: true,
    color: p.onDarkMuted, font: th.fonts.heading,
  }));
  const tSize = fitFont(s.title || '', th.sizes.section, 8.6, 1.2);
  els.push(text({
    x: M, y: dy(g, 2.45, 0.42), w: 8.6, h: 1.2,
    text: s.title || '', fontSize: tSize, bold: true,
    color: p.onDark, font: th.fonts.heading,
  }));
  if (s.note) {
    els.push(text({
      x: M, y: dy(g, 3.62, 0.42), w: 7.4, h: 0.8,
      text: s.note, fontSize: 13,
      color: p.onDarkMuted, font: th.fonts.body,
    }));
  }
  return scene;
};

const toc = (s, th, g) => {
  const p = th.palette;
  const { W, M } = g;
  const scene = lightScene(th);
  const els = scene.elements;
  els.push(...titleBlock(s, th, g));

  const items = s.items || [];
  const rows = Math.ceil(items.length / 2);
  const colW = (W - 2 * M - 0.7) / 2;
  // 行距随画布高度放宽，但单行不超过上限，避免两三条目录被拉得过散
  const cap = 0.98 + slack(g) * 0.3;
  const rowH = Math.min(cap, (3.35 + slack(g) * 0.85) / Math.max(rows, 1));

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

const end = (s, th, g) => {
  const p = th.palette;
  const { M } = g;
  const scene = darkScene(th);
  const els = scene.elements;
  els.push(text({
    x: M, y: dy(g, 1.85, 0.34), w: 8.9, h: 1.0,
    text: s.title || '谢谢观看', fontSize: 40, bold: true,
    color: p.onDark, font: th.fonts.heading,
  }));
  if (s.note) {
    els.push(text({
      x: M, y: dy(g, 3.0, 0.34), w: 7.6, h: 0.7,
      text: s.note, fontSize: th.sizes.subtitle,
      color: p.onDarkMuted, font: th.fonts.body,
    }));
  }
  const contact = Array.isArray(s.contact) ? s.contact.join('   ·   ') : s.contact;
  if (contact) {
    els.push(text({
      x: M, y: dy(g, 3.95, 0.34), w: 8.6, h: 0.4,
      text: contact, fontSize: 12,
      color: p.secondary, font: th.fonts.body,
    }));
  }
  return scene;
};

module.exports = { cover, section, toc, end };
