/**
 * 场景图元 -> PPTX
 * 所有 layout 只产出场景描述，pptx / html 两个后端各自消费同一份数据
 */
const path = require('path');
const fs = require('fs');
const pptxgen = require('pptxgenjs');
const { LAYOUTS } = require('./layouts');
const { geoFor } = require('./kit');

const CHART_TYPE = {
  bar: 'bar', column: 'bar', line: 'line', pie: 'pie', doughnut: 'doughnut',
  area: 'area', scatter: 'scatter', radar: 'radar',
};

function seriesColors(theme) {
  const p = theme.palette;
  return [p.primary, p.accent, p.secondary, p.muted, p.text, p.line];
}

function drawText(slide, el, theme) {
  slide.addText(el.text == null ? '' : String(el.text), {
    x: el.x, y: el.y, w: el.w, h: el.h,
    fontSize: el.fontSize || theme.sizes.body,
    fontFace: el.font || theme.fonts.body,
    bold: !!el.bold,
    italic: !!el.italic,
    color: el.color || theme.palette.text,
    align: el.align || 'left',
    valign: el.valign || 'top',
    margin: el.margin == null ? 0 : el.margin,
    charSpacing: el.charSpacing,
    breakLine: false,
  });
}

function drawRect(slide, el, P, theme) {
  const isRound = !!(el.radius && el.radius > 0);
  const opts = {
    x: el.x, y: el.y, w: el.w, h: el.h,
    fill: el.fill ? { color: el.fill } : { color: 'FFFFFF', transparency: 100 },
    line: el.line
      ? { color: el.line.color, width: el.line.width == null ? 1 : el.line.width, transparency: el.line.transparency || 0 }
      : { color: 'FFFFFF', width: 0, transparency: 100 },
  };
  if (isRound) {
    opts.rectRadius = el.radius;
    slide.addShape(P.ShapeType.roundRect, opts);
  } else {
    slide.addShape(P.ShapeType.rect, opts);
  }
  if (el.transparency) {
    // 透明遮罩：pptxgenjs 的 fill 不直接支持透明度参数，用叠加半透明形状近似
    slide.addShape(P.ShapeType.rect, {
      x: el.x, y: el.y, w: el.w, h: el.h,
      fill: { color: el.fill, transparency: el.transparency },
      line: { color: 'FFFFFF', width: 0, transparency: 100 },
    });
  }
}

function drawLine(slide, el, P) {
  slide.addShape(P.ShapeType.line, {
    x: el.x1, y: el.y1,
    w: el.x2 - el.x1, h: el.y2 - el.y1,
    line: {
      color: el.color, width: el.width == null ? 1 : el.width,
      dashType: el.dash === 'dash' ? 'dash' : 'solid',
    },
  });
}

function drawChart(slide, el, P, theme) {
  const c = el.chart || {};
  const type = CHART_TYPE[String(c.type || 'bar').toLowerCase()] || 'bar';
  const data = (c.series || []).map((s, i) => ({
    name: s.name || `系列${i + 1}`,
    labels: c.labels || [],
    values: s.values || [],
  }));

  const opts = {
    x: el.x, y: el.y, w: el.w, h: el.h,
    showTitle: !!c.title,
    title: c.title,
    titleFontSize: 11,
    titleColor: theme.palette.primary,
    showLegend: data.length > 1,
    legendPos: 'b',
    legendFontSize: 9,
    chartColors: data.length === 1 ? [theme.palette.primary] : seriesColors(theme),
    catAxisLabelColor: theme.palette.muted,
    valAxisLabelColor: theme.palette.muted,
    catAxisLabelFontSize: 9,
    valAxisLabelFontSize: 9,
    valGridLine: { color: theme.palette.line, size: 0.5 },
    catGridLine: { style: 'none' },
    border: { pt: 0, color: theme.palette.bg },
  };

  if (c.stacked) {
    opts.barGrouping = 'stacked';
    opts.dataLabelPosition = 'ctr';
  } else if (type !== 'pie' && type !== 'doughnut') {
    opts.dataLabelPosition = 'outEnd';
  }

  if (type === 'bar') opts.barDir = c.horizontal ? 'bar' : 'col';
  if (type === 'pie' || type === 'doughnut') {
    // 饼图的每个扇区就是类目，必须给多色并显示图例，否则只有百分比看不出是谁
    opts.chartColors = seriesColors(theme);
    opts.showLegend = c.legend !== false;
    opts.showPercent = true;
    opts.showValue = false;
  } else if ((type === 'line' || type === 'area') && data.length > 1) {
    // 多条折线/面积图的逐点数值标签会互相压住（两条线数值接近时完全糊成一团），
    // 默认关闭；坐标轴 + 图例已经够读，确需标注时显式写 chart.showValue: true
    opts.showValue = c.showValue === true;
  } else {
    opts.showValue = c.showValue !== false;
  }
  if (c.title) opts.showTitle = true;
  if (c.legend === false) opts.showLegend = false;

  slide.addChart(P.ChartType[type], data, opts);
}

function drawTable(slide, el, theme) {
  slide.addTable(el.rows, {
    x: el.x, y: el.y, w: el.w,
    colW: el.columns,
    fontSize: el.fontSize || 11.5,
    fontFace: theme.fonts.body,
    rowH: el.rowH,
    border: { pt: el.border ? el.border.width : 0.75, color: el.border ? el.border.color : theme.palette.line },
    color: theme.palette.text,
    valign: 'middle',
    autoPage: false,
  });
}

function drawImage(slide, el) {
  const opts = {
    x: el.x, y: el.y, w: el.w, h: el.h,
    sizing: {
      type: el.fit === 'contain' ? 'contain' : 'cover',
      w: el.w,
      h: el.h,
    },
  };
  if (/^https?:/i.test(el.src)) opts.path = el.src;
  else if (/^data:/.test(el.src)) opts.data = el.src;
  else opts.path = path.resolve(el.src);
  slide.addImage(opts);
}

function drawPlaceholder(slide, el, P, theme) {
  slide.addShape(P.ShapeType.rect, {
    x: el.x, y: el.y, w: el.w, h: el.h,
    fill: { color: theme.palette.card },
    line: { color: theme.palette.line, width: 1, dashType: 'dash' },
  });
  slide.addText(el.label || '图片占位', {
    x: el.x, y: el.y + el.h / 2 - 0.16, w: el.w, h: 0.32,
    fontSize: 10, color: theme.palette.muted, align: 'center', valign: 'middle',
    fontFace: theme.fonts.body, margin: 0,
  });
}

function renderPptx(spec, outPath) {
  const theme = Object.assign({}, spec.theme, { meta: spec.meta });
  const geo = spec.geo || geoFor(spec.meta.aspect);
  const pres = new pptxgen();
  const P = pres; // ShapeType / ChartType 枚举挂在实例上，不在模块上
  pres.layout = geo.aspect === '4:3' ? 'LAYOUT_4x3' : 'LAYOUT_16x9';
  pres.author = spec.meta.author || '';
  pres.title = spec.meta.title || '';

  spec.slides.forEach((s) => {
    const scene = LAYOUTS[s.layout](s, theme, geo);
    const slide = pres.addSlide();
    if (scene.background && scene.background.color) {
      slide.background = { color: scene.background.color };
    }
    (scene.elements || []).forEach((el) => {
      switch (el.type) {
        case 'text': drawText(slide, el, theme); break;
        case 'rect': drawRect(slide, el, P, theme); break;
        case 'line': drawLine(slide, el, P); break;
        case 'chart': drawChart(slide, el, P, theme); break;
        case 'table': drawTable(slide, el, theme); break;
        case 'image': drawImage(slide, el); break;
        case 'placeholder': drawPlaceholder(slide, el, P, theme); break;
        default: break;
      }
    });
    if (spec.output.speakerNotes && s.notes) slide.addNotes(s.notes);
  });

  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return pres.writeFile({ fileName: outPath }).then(() => outPath);
}

module.exports = { renderPptx };
