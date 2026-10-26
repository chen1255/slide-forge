/**
 * 特殊版式：团队 / 全幅图标题 / 截图说明
 */
const { W, H, M, text, fitFont } = require('../kit');
const { lightScene, darkScene, titleBlock } = require('./common');

const team = (s, th) => {
  const p = th.palette;
  const scene = lightScene(th);
  scene.elements.push(...titleBlock(s, th));

  const members = (s.members || []).slice(0, 4);
  const n = Math.max(1, members.length);
  const gap = 0.3;
  const cardW = (W - 2 * M - gap * (n - 1)) / n;

  members.forEach((m, i) => {
    const x = M + i * (cardW + gap);
    scene.elements.push({
      type: 'rect', x, y: 1.45, w: cardW, h: 2.95,
      fill: p.card, line: null, radius: 0.08,
    });
    const initial = (m.name || '?').trim().charAt(0);
    scene.elements.push({
      type: 'rect', x: x + 0.24, y: 1.68, w: 0.62, h: 0.62,
      fill: p.primary, line: null, radius: 0.31,
    });
    scene.elements.push(text({
      x: x + 0.24, y: 1.68, w: 0.62, h: 0.62,
      text: initial, fontSize: 18, bold: true, align: 'center', valign: 'middle',
      color: p.onDark, font: th.fonts.heading,
    }));
    scene.elements.push(text({
      x: x + 0.24, y: 2.44, w: cardW - 0.48, h: 0.32,
      text: m.name || '', fontSize: 15, bold: true,
      color: p.primary, font: th.fonts.heading,
    }));
    scene.elements.push(text({
      x: x + 0.24, y: 2.8, w: cardW - 0.48, h: 0.3,
      text: m.role || '', fontSize: 11,
      color: p.accent, font: th.fonts.body,
    }));
    if (m.bio) {
      const bSize = fitFont(m.bio, 10.5, cardW - 0.48, 0.95, { minSize: 9 });
      scene.elements.push(text({
        x: x + 0.24, y: 3.16, w: cardW - 0.48, h: 1.0,
        text: m.bio, fontSize: bSize,
        color: p.muted, font: th.fonts.body,
      }));
    }
  });
  return scene;
};

const hero = (s, th) => {
  const p = th.palette;
  const scene = darkScene(th);
  const els = scene.elements;

  els.push({
    type: s.src ? 'image' : 'placeholder',
    src: s.src, label: '背景图占位',
    x: 0, y: 0, w: W, h: H, fit: 'cover',
  });
  els.push({
    type: 'rect', x: 0, y: 0, w: W, h: H,
    fill: p.bgDark, line: null, radius: 0, transparency: 38,
  });

  const tSize = fitFont(s.title || '', 36, 8.2, 1.5);
  els.push(text({
    x: M, y: 3.4, w: 8.2, h: 1.55,
    text: s.title || '', fontSize: tSize, bold: true,
    color: p.onDark, font: th.fonts.heading,
  }));
  if (s.subtitle) {
    els.push(text({
      x: M, y: 4.42, w: 7.4, h: 0.5,
      text: s.subtitle, fontSize: 14,
      color: p.onDarkMuted, font: th.fonts.body,
    }));
  }
  return scene;
};

const screenshot = (s, th) => {
  const p = th.palette;
  const scene = lightScene(th);
  const hasTitle = !!s.title;
  if (hasTitle) scene.elements.push(...titleBlock(s, th));

  const fy = hasTitle ? 1.28 : 0.5;
  const fh = hasTitle ? 3.3 : 4.2;

  scene.elements.push({
    type: 'rect', x: M, y: fy, w: W - 2 * M, h: fh,
    fill: p.bg, line: { color: p.line, width: 1 }, radius: 0.1,
  });
  // 浏览器窗口顶栏 + 三个圆点
  scene.elements.push({
    type: 'rect', x: M, y: fy, w: W - 2 * M, h: 0.28,
    fill: p.card, line: null, radius: 0.1,
  });
  [0, 1, 2].forEach((i) => {
    scene.elements.push({
      type: 'rect', x: M + 0.16 + i * 0.16, y: fy + 0.1, w: 0.08, h: 0.08,
      fill: p.line, line: null, radius: 0.04,
    });
  });
  scene.elements.push({
    type: s.src ? 'image' : 'placeholder',
    src: s.src, label: s.alt || '界面截图占位',
    x: M + 0.1, y: fy + 0.36, w: W - 2 * M - 0.2, h: fh - 0.46, fit: 'contain',
  });

  if (s.caption) {
    scene.elements.push(text({
      x: M, y: fy + fh + 0.12, w: W - 2 * M, h: 0.3,
      text: s.caption, fontSize: th.sizes.caption,
      color: p.muted, font: th.fonts.body,
    }));
  }
  return scene;
};

module.exports = { team, hero, screenshot };
