/**
 * SVG 输出：把同一份 scene 画成独立 .svg，一页一个文件
 *
 * 存在意义：PPTX 里的图表是 OOXML 原生对象，轻量预览器不渲染；而导 PNG 又依赖
 * 本机 PowerPoint。SVG 是纯文本、矢量、任何浏览器都能看，也不依赖 Office。
 * 图表部分直接复用 render-html 的 SVG 片段，保证三种输出图形一致。
 */
const fs = require('fs');
const path = require('path');
const { LAYOUTS } = require('./layouts');
const { measure, tokenize } = require('./kit');
const { barSvg, lineSvg, pieSvg, spreadSvg, esc, PX, PT } = require('./render-html');

const escAttr = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const hex = (c) => (c ? `#${String(c).replace('#', '')}` : 'none');

/** 透明度 0-100（PPTX 口径）→ SVG opacity */
const opacityOf = (t) => (t ? 1 - Number(t) / 100 : 1);

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

/** 图片尽量内嵌为 data URI，保证单个 svg 文件自包含 */
function imageHref(src) {
  if (!src) return null;
  if (/^data:/.test(src)) return src;
  if (/^https?:\/\//.test(src)) return src;
  try {
    const buf = fs.readFileSync(src);
    const mime = MIME[path.extname(src).toLowerCase()] || 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * 按可用宽度断行
 * 宽度用 kit.measure 计算（与 PPTX 侧同一套字宽模型），单位英寸
 */
function wrapText(text, fontSize, maxWidthIn) {
  const lines = [];
  String(text == null ? '' : text).split('\n').forEach((para) => {
    const tokens = tokenize(para);
    let cur = '';
    let curW = 0;
    tokens.forEach((t) => {
      const tw = measure(t, fontSize);
      if (curW + tw > maxWidthIn && cur) {
        lines.push(cur);
        cur = t === ' ' ? '' : t;
        curW = t === ' ' ? 0 : tw;
      } else {
        cur += t;
        curW += tw;
      }
    });
    lines.push(cur);
  });
  return lines;
}

function anchorOf(align) {
  if (align === 'center') return 'middle';
  if (align === 'right') return 'end';
  return 'start';
}

/** x 坐标按对齐方式换算 */
function anchorX(el, align) {
  const x = el.x * PX;
  if (align === 'center') return x + (el.w * PX) / 2;
  if (align === 'right') return x + el.w * PX;
  return x;
}

function textSvg(el, theme) {
  const text = el.text == null ? '' : String(el.text);
  if (!text) return '';
  const sizePt = el.fontSize || theme.sizes.body;
  const sizePx = sizePt * PT;
  const lh = sizePx * 1.35;
  const lines = wrapText(text, sizePt, el.w);
  const blockH = lines.length * lh;

  const align = el.align || 'left';
  const anchor = anchorOf(align);
  const x = anchorX(el, align);

  let firstY;
  const top = el.y * PX;
  const boxH = el.h * PX;
  if (el.valign === 'middle') firstY = top + (boxH - blockH) / 2 + sizePx * 0.82;
  else if (el.valign === 'bottom') firstY = top + boxH - blockH + sizePx * 0.82;
  else firstY = top + sizePx * 0.82;

  const style = [
    `font-family:${escAttr(el.font || theme.fonts.body)}`,
    `font-size:${sizePx.toFixed(1)}px`,
    `fill:${hex(el.color || theme.palette.text)}`,
    el.bold ? 'font-weight:700' : '',
    el.italic ? 'font-style:italic' : '',
  ].filter(Boolean).join(';');

  const tspans = lines
    .map((ln, i) => `<tspan x="${x.toFixed(1)}" y="${(firstY + i * lh).toFixed(1)}">${esc(ln)}</tspan>`)
    .join('');
  return `<text text-anchor="${anchor}" style="${style}" xml:space="preserve">${tspans}</text>`;
}

function listSvg(el, theme) {
  const items = el.items || [];
  if (!items.length) return '';
  const sizePt = el.fontSize || theme.sizes.body;
  const sizePx = sizePt * PT;
  const gapPx = (el.gap || 0.18) * PX;
  const lh = sizePx * 1.35;
  const bulletW = el.bullet === false ? 0 : sizePx * 1.1;
  const color = el.color || theme.palette.text;

  let y = el.y * PX + sizePx * 0.82;
  let out = '';
  items.forEach((it) => {
    const raw = typeof it === 'string' ? it : (it && (it.text || it.title)) || '';
    const lines = wrapText(raw, sizePt, el.w - bulletW / PX);
    if (el.bullet !== false) {
      out += `<circle cx="${(el.x * PX + sizePx * 0.28).toFixed(1)}" cy="${(y - sizePx * 0.3).toFixed(1)}" r="${(sizePx * 0.14).toFixed(1)}" fill="${hex(el.bulletColor || theme.palette.accent)}"/>`;
    }
    lines.forEach((ln, i) => {
      out += `<text x="${(el.x * PX + bulletW + (i === 0 ? 0 : 0)).toFixed(1)}" y="${(y + i * lh).toFixed(1)}" style="font-family:${escAttr(el.font || theme.fonts.body)};font-size:${sizePx.toFixed(1)}px;fill:${hex(color)}">${esc(ln)}</text>`;
    });
    y += lines.length * lh + gapPx;
  });
  return out;
}

function rectSvg(el, theme) {
  const r = el.radius ? (el.radius * PX).toFixed(1) : 0;
  const fill = el.fill ? hex(el.fill) : 'none';
  const stroke = el.line && el.line.color ? hex(el.line.color) : 'none';
  const sw = el.line && el.line.width ? el.line.width : 0;
  const dash = el.line && el.line.dash === 'dash' ? ' stroke-dasharray="6 4"' : '';
  const fo = el.fill ? opacityOf(el.transparency) : 1;
  const so = el.line && el.line.transparency ? opacityOf(el.line.transparency) : 1;
  const attrs = [
    `x="${(el.x * PX).toFixed(1)}"`, `y="${(el.y * PX).toFixed(1)}"`,
    `width="${(el.w * PX).toFixed(1)}"`, `height="${(el.h * PX).toFixed(1)}"`,
    `rx="${r}"`, `fill="${fill}"`,
    fo !== 1 ? `fill-opacity="${fo}"` : '',
    sw ? `stroke="${stroke}" stroke-width="${(sw * PT).toFixed(1)}"` : '',
    so !== 1 ? `stroke-opacity="${so}"` : '',
    dash,
  ].filter(Boolean).join(' ');
  return `<rect ${attrs}/>`;
}

function lineSvgEl(el) {
  const dash = el.dash === 'dash' ? ' stroke-dasharray="6 4"' : '';
  return `<line x1="${(el.x1 * PX).toFixed(1)}" y1="${(el.y1 * PX).toFixed(1)}" x2="${(el.x2 * PX).toFixed(1)}" y2="${(el.y2 * PX).toFixed(1)}" stroke="${hex(el.color)}" stroke-width="${((el.width || 1) * PT).toFixed(1)}"${dash}/>`;
}

/**
 * 表格
 * 真实结构（见 src/layouts/data.js）：columns 是已算好的列宽数组（英寸），
 * 没有 h，总高 = rowH × 行数；每个 cell 是 { text, options:{color,fill,bold,fontSize} }
 */
function tableSvg(el, theme) {
  const rows = el.rows || [];
  const colW = (el.columns || []).map((w) => (typeof w === 'number' ? w : 1));
  if (!rows.length || !colW.length) return '';

  const p = theme.palette;
  const x0 = el.x * PX;
  const y0 = el.y * PX;
  const rowH = (el.rowH || 0.5) * PX;
  const border = (el.border && el.border.color) || p.line;
  const borderW = el.border && el.border.width ? el.border.width : 0.75;

  let out = '';

  rows.forEach((row, r) => {
    const ry = y0 + rowH * r;
    let cx = x0;

    row.forEach((cell, i) => {
      if (i >= colW.length) return;
      const cw = colW[i] * PX;
      const isObj = cell && typeof cell === 'object';
      const text = String(isObj ? cell.text : cell == null ? '' : cell);
      const o = (isObj && cell.options) || {};

      // 单元格底色：表头来自 options.fill（headerFill）
      const bg = o.fill && o.fill.color ? o.fill.color : (r === 0 ? el.headerFill : null);
      if (bg) out += `<rect x="${cx.toFixed(1)}" y="${ry.toFixed(1)}" width="${cw.toFixed(1)}" height="${rowH.toFixed(1)}" fill="${hex(bg)}"/>`;

      if (!text) { cx += cw; return; }

      const sizePx = (o.fontSize || el.fontSize || 11.5) * PT;
      const color = o.color || p.text;
      const bold = o.bold ? ';font-weight:600' : '';
      // 单行文本，超出单元格宽度就缩字号
      const maxW = cw - 16;
      let fs2 = sizePx;
      while (fs2 > 8 && measure(text, fs2 / PT) * PX > maxW) fs2 -= 0.5;

      out += `<text x="${(cx + 8).toFixed(1)}" y="${(ry + rowH / 2 + fs2 * 0.35).toFixed(1)}" style="font-family:${escAttr(theme.fonts.body)};font-size:${fs2.toFixed(1)}px;fill:${hex(color)}${bold}">${esc(text)}</text>`;
      cx += cw;
    });
  });

  // 网格线：横线逐行、竖线逐列，收在表格范围内
  const totalW = colW.reduce((a, b) => a + b, 0) * PX;
  const totalH = rowH * rows.length;
  for (let r = 0; r <= rows.length; r += 1) {
    const y = y0 + rowH * r;
    out += `<line x1="${x0.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x0 + totalW).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${hex(border)}" stroke-width="${borderW}"/>`;
  }
  let vx = x0;
  for (let i = 0; i <= colW.length; i += 1) {
    out += `<line x1="${vx.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${vx.toFixed(1)}" y2="${(y0 + totalH).toFixed(1)}" stroke="${hex(border)}" stroke-width="${borderW}"/>`;
    vx += (colW[i] || 0) * PX;
  }
  return out;
}

function placeholderSvg(el, theme) {
  const p = theme.palette;
  return `<rect x="${(el.x * PX).toFixed(1)}" y="${(el.y * PX).toFixed(1)}" width="${(el.w * PX).toFixed(1)}" height="${(el.h * PX).toFixed(1)}" fill="${hex(p.card)}" stroke="${hex(p.line)}" stroke-width="1" stroke-dasharray="6 4"/>`
    + `<text x="${((el.x + el.w / 2) * PX).toFixed(1)}" y="${((el.y + el.h / 2) * PX).toFixed(1)}" text-anchor="middle" style="font-family:${escAttr(theme.fonts.body)};font-size:13px;fill:${hex(p.muted)}">${esc(el.label || '图片占位')}</text>`;
}

function imageSvg(el) {
  const href = imageHref(el.src);
  const box = `x="${(el.x * PX).toFixed(1)}" y="${(el.y * PX).toFixed(1)}" width="${(el.w * PX).toFixed(1)}" height="${(el.h * PX).toFixed(1)}"`;
  if (!href) return placeholderSvg(el, { palette: { card: 'F4F4F4', line: 'DDD', muted: '888' }, fonts: { body: 'sans-serif' } });
  const fit = el.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice';
  return `<image ${box} href="${escAttr(href)}" preserveAspectRatio="${fit}"/>`;
}

function chartSvg(el, theme) {
  const w = el.w * PX;
  const h = el.h * PX;
  const c = el.chart || {};
  const type = String(c.type || 'bar').toLowerCase();
  let inner;
  if (type === 'pie') inner = pieSvg(c, w, h, theme, false);
  else if (type === 'doughnut') inner = pieSvg(c, w, h, theme, true);
  else if (type === 'line') inner = lineSvg(c, w, h, theme);
  else if (type === 'scatter') inner = spreadSvg(c, w, h, theme);
  else inner = barSvg(c, w, h, theme);
  return `<g transform="translate(${(el.x * PX).toFixed(1)},${(el.y * PX).toFixed(1)})">${inner}</g>`;
}

function elementSvg(el, theme) {
  switch (el.type) {
    case 'text': return textSvg(el, theme);
    case 'list': return listSvg(el, theme);
    case 'rect': return rectSvg(el, theme);
    case 'line': return lineSvgEl(el);
    case 'table': return tableSvg(el, theme);
    case 'chart': return chartSvg(el, theme);
    case 'image': return imageSvg(el, theme);
    case 'placeholder': return placeholderSvg(el, theme);
    default: return '';
  }
}

/** 把一页 scene 画成完整 svg 文本 */
function sceneToSvg(scene, theme, geo, title, page = {}) {
  const W = geo.W * PX;
  const H = geo.H * PX;
  const bg = (scene.background && scene.background.color) || theme.palette.bg;
  const escTitle = esc(title || '');
  const no = page.index || 1;
  const total = page.total || 1;
  // id 带页码，多个 svg 内联到同一页面时不会互相抢 aria-labelledby
  const tid = `sf-${no}-title`;
  const did = `sf-${no}-desc`;
  const desc = esc(`第 ${no} 页，共 ${total} 页；配色 ${theme.label}，画布 ${geo.aspect}`);
  const body = (scene.elements || []).map((el) => elementSvg(el, theme)).join('');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="${tid} ${did}">`,
    `<title id="${tid}">${escTitle}</title>`,
    `<desc id="${did}">${desc}</desc>`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="${hex(bg)}"/>`,
    body,
    '</svg>',
  ].join('\n');
}

/**
 * 输出整份 deck 的 SVG
 * 返回生成的文件路径数组，一页一个
 */
function renderSvg(spec, outDir) {
  const dir = outDir || spec.output.dir;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const base = path.basename(spec.output.pptx || 'deck').replace(/\.pptx$/i, '');
  const files = [];
  spec.slides.forEach((s, i) => {
    const title = [spec.meta.title, s.title || s.heading].filter(Boolean).join(' · ');
    const scene = LAYOUTS[s.layout](s, Object.assign({}, spec.theme, { meta: spec.meta }), spec.geo);
    const svg = sceneToSvg(scene, spec.theme, spec.geo, title, { index: i + 1, total: spec.slides.length });
    const file = path.join(dir, `${base}-${String(i + 1).padStart(2, '0')}.svg`);
    fs.writeFileSync(file, svg, 'utf8');
    files.push(file);
  });
  return files;
}

module.exports = { renderSvg, sceneToSvg, wrapText, elementSvg };
