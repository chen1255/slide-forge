/**
 * 数据类版式：图表 / 表格 / 时间线 / 流程 / 对比
 */
const { W, M, text, fitFont, measure } = require('../kit');
const { lightScene, titleBlock, takeawayBar, stackText } = require('./common');

const chart = (s, th) => {
  const p = th.palette;
  const scene = lightScene(th);
  scene.elements.push(...titleBlock(s, th));

  const insights = (s.insight || []).filter(Boolean);
  const hasInsight = insights.length > 0;
  const cw = hasInsight ? 6.35 : W - 2 * M;

  scene.elements.push({
    type: 'chart',
    x: M, y: 1.4, w: cw, h: hasInsight ? 3.2 : 3.4,
    chart: s.chart,
  });

  if (hasInsight) {
    const ix = M + cw + 0.35;
    const iw = W - M - ix;
    scene.elements.push(text({
      x: ix, y: 1.42, w: iw, h: 0.3,
      text: s.insightTitle || '解读', fontSize: 11, bold: true,
      color: p.accent, font: th.fonts.heading,
    }));
    const body = stackText(insights, {
      x: ix, y: 1.78, w: iw, maxY: 4.55,
      theme: th, size: 11.5, gap: 0.14, hasBullet: false, color: p.text,
    });
    scene.elements.push(...body.elements);
  }
  scene.elements.push(...takeawayBar(s, th));
  return scene;
};

const table = (s, th) => {
  const p = th.palette;
  const scene = lightScene(th);
  scene.elements.push(...titleBlock(s, th));

  const cols = (s.columns || []).map((c) => (typeof c === 'string' ? { label: c } : c));
  const rows = s.rows || [];
  const total = W - 2 * M;
  const fontSize = 11.5;

  // 列宽按内容权重分配：中文按 2 个英文宽计算
  const raw = cols.map((c, ci) => {
    const headerW = measure(c.label || '', fontSize + 1);
    const cellW = rows.reduce(
      (mx, r) => Math.max(mx, measure(String(r[ci] == null ? '' : r[ci]), fontSize)),
      0
    );
    return Math.max(headerW, cellW) + 0.34;
  });
  const sum = raw.reduce((a, b) => a + b, 0);
  const colW = raw.map((w) => Math.max(0.85, (w / sum) * total));
  const scale = total / colW.reduce((a, b) => a + b, 0);
  const finalW = colW.map((w) => w * scale);

  const header = cols.map((c, i) => ({
    text: c.label || '',
    options: { bold: true, fill: { color: p.primary }, color: p.onDark, fontSize: fontSize + 0.5 },
  }));
  const body = rows.map((r, ri) =>
    r.map((v) => ({
      text: String(v == null ? '' : v),
      options: {
        color: p.text,
        fill: { color: ri % 2 === 0 ? p.bg : p.card },
        fontSize,
      },
    }))
  );

  scene.elements.push({
    type: 'table',
    x: M, y: 1.42, w: total,
    columns: finalW,
    rows: [header, ...body],
    fontSize,
    rowH: Math.min(0.6, Math.max(0.34, 3.2 / (rows.length + 1))),
    headerFill: p.primary,
    border: { color: p.line, width: 0.75 },
  });
  scene.elements.push(...takeawayBar(s, th));
  return scene;
};

const timeline = (s, th) => {
  const p = th.palette;
  const scene = lightScene(th);
  scene.elements.push(...titleBlock(s, th));

  const items = (s.items || []).slice(0, 5);
  const n = Math.max(1, items.length);
  const gap = 0.18;
  const colW = (W - 2 * M - gap * (n - 1)) / n;
  const axisY = 2.5;

  scene.elements.push({
    type: 'line', x1: M + 0.1, y1: axisY, x2: W - M - 0.1, y2: axisY,
    color: p.line, width: 2,
  });

  items.forEach((it, i) => {
    const x = M + i * (colW + gap);
    const cx = x + 0.16;
    scene.elements.push({
      type: 'rect', x: cx - 0.08, y: axisY - 0.08, w: 0.16, h: 0.16,
      fill: p.accent, line: null, radius: 0.08,
    });
    if (it.when) {
      scene.elements.push(text({
        x, y: axisY - 0.55, w: colW, h: 0.32,
        text: it.when, fontSize: 11.5, bold: true,
        color: p.accent, font: th.fonts.body,
      }));
    }
    const tSize = fitFont(it.title || '', 14, colW - 0.1, 0.6);
    scene.elements.push(text({
      x, y: axisY + 0.2, w: colW, h: 0.64,
      text: it.title || '', fontSize: tSize, bold: true,
      color: p.primary, font: th.fonts.heading,
    }));
    if (it.body) {
      const bSize = fitFont(it.body, 11, colW - 0.1, 1.1, { minSize: 9 });
      scene.elements.push(text({
        x, y: axisY + 0.9, w: colW, h: 1.2,
        text: it.body, fontSize: bSize,
        color: p.muted, font: th.fonts.body,
      }));
    }
  });
  return scene;
};

const process = (s, th) => {
  const p = th.palette;
  const scene = lightScene(th);
  scene.elements.push(...titleBlock(s, th));

  const steps = (s.steps || []).slice(0, 4);
  const n = Math.max(1, steps.length);
  const gap = 0.26;
  const colW = (W - 2 * M - gap * (n - 1)) / n;
  const cy = 1.92;

  scene.elements.push({
    type: 'line', x1: M + colW / 2, y1: cy, x2: W - M - colW / 2, y2: cy,
    color: p.line, width: 2,
  });

  steps.forEach((st, i) => {
    const x = M + i * (colW + gap);
    const cx = x + colW / 2;
    scene.elements.push({
      type: 'rect', x: cx - 0.27, y: cy - 0.27, w: 0.54, h: 0.54,
      fill: i === 0 ? p.accent : p.primary, line: null, radius: 0.27,
    });
    scene.elements.push(text({
      x: cx - 0.27, y: cy - 0.27, w: 0.54, h: 0.54,
      text: String(i + 1), fontSize: 16, bold: true, align: 'center', valign: 'middle',
      color: i === 0 ? p.primary : p.onDark, font: th.fonts.heading,
    }));
    const tSize = fitFont(st.title || '', 14, colW - 0.1, 0.6);
    scene.elements.push(text({
      x, y: cy + 0.42, w: colW, h: 0.64,
      text: st.title || '', fontSize: tSize, bold: true,
      color: p.primary, font: th.fonts.heading,
    }));
    if (st.body) {
      const bSize = fitFont(st.body, 11, colW - 0.1, 1.2, { minSize: 9 });
      scene.elements.push(text({
        x, y: cy + 1.1, w: colW, h: 1.3,
        text: st.body, fontSize: bSize,
        color: p.muted, font: th.fonts.body,
      }));
    }
  });
  return scene;
};

const compare = (s, th) => {
  const p = th.palette;
  const scene = lightScene(th);
  scene.elements.push(...titleBlock(s, th));

  const gap = 0.34;
  const panelW = (W - 2 * M - gap) / 2;
  const sides = [
    { data: s.before, x: M, fill: p.card, headFill: p.line, headColor: p.primary },
    { data: s.after, x: M + panelW + gap, fill: p.card, headFill: p.primary, headColor: p.onDark },
  ];

  sides.forEach(({ data, x, fill, headFill, headColor }) => {
    const d = typeof data === 'string' ? { title: data, items: [] } : data || {};
    scene.elements.push({
      type: 'rect', x, y: 1.4, w: panelW, h: 3.38,
      fill, line: null, radius: 0.08,
    });
    scene.elements.push({
      type: 'rect', x, y: 1.4, w: panelW, h: 0.46,
      fill: headFill, line: null, radius: 0.08,
    });
    scene.elements.push(text({
      x: x + 0.22, y: 1.42, w: panelW - 0.44, h: 0.42,
      text: d.title || '', fontSize: 12.5, bold: true, valign: 'middle',
      color: headColor, font: th.fonts.heading,
    }));
    const body = stackText(d.items || [], {
      x: x + 0.22, y: 2.02, w: panelW - 0.44, maxY: 4.6,
      theme: th, size: 12, gap: 0.16, color: p.text,
    });
    scene.elements.push(...body.elements);
  });
  return scene;
};

module.exports = { chart, table, timeline, process, compare };
