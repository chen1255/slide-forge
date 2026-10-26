/**
 * 场景图元 -> 单文件 HTML 演示
 * 与 PPTX 共用同一份 layout 场景，保证两种输出的信息结构一致
 */
const fs = require('fs');
const path = require('path');
const { LAYOUTS } = require('./layouts');

const PX = 96;        // 1 英寸 = 96px
const PT = 96 / 72;   // 1pt = 1.333px

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const pos = (el) =>
  `left:${(el.x * PX).toFixed(2)}px;top:${(el.y * PX).toFixed(2)}px;` +
  `width:${(el.w * PX).toFixed(2)}px;height:${(el.h * PX).toFixed(2)}px;`;

function rgba(hex, alphaPct) {
  const h = String(hex).replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${1 - alphaPct / 100})`;
}

const fontStack = (theme, face) =>
  `'${face || theme.fonts.body}','Microsoft YaHei',system-ui,-apple-system,Arial,sans-serif`;

function textEl(el, theme) {
  const size = (el.fontSize || theme.sizes.body) * PT;
  const align = el.align || 'left';
  const v = el.valign === 'middle' ? 'center' : el.valign === 'bottom' ? 'flex-end' : 'flex-start';
  const style =
    `${pos(el)}font-size:${size.toFixed(2)}px;line-height:1.35;` +
    `font-family:${fontStack(theme, el.font)};` +
    `color:#${el.color || theme.palette.text};` +
    `font-weight:${el.bold ? 700 : 400};font-style:${el.italic ? 'italic' : 'normal'};` +
    `text-align:${align};display:flex;align-items:${v};white-space:pre-wrap;`;
  return `<div class="el t" style="${style}">${esc(el.text)}</div>`;
}

function rectEl(el, theme) {
  const bg = el.fill ? `background:${el.transparency ? rgba(el.fill, el.transparency) : '#' + el.fill};` : 'background:transparent;';
  const line = el.line
    ? `border:${((el.line.width == null ? 1 : el.line.width) * PT).toFixed(2)}px solid ${el.line.transparency ? rgba(el.line.color, el.line.transparency) : '#' + el.line.color};`
    : 'border:0;';
  const radius = el.radius ? `border-radius:${(el.radius * PX).toFixed(2)}px;` : '';
  return `<div class="el" style="${pos(el)}${bg}${line}${radius}box-sizing:border-box;"></div>`;
}

function lineEl(el) {
  const x1 = Math.min(el.x1, el.x2);
  const y = (el.y1 + el.y2) / 2;
  const w = Math.abs(el.x2 - el.x1);
  const color = el.color;
  const width = ((el.width == null ? 1 : el.width) * PT).toFixed(2);
  const style = `left:${(x1 * PX).toFixed(2)}px;top:${(y * PX).toFixed(2)}px;width:${(w * PX).toFixed(2)}px;` +
    `border-top:${width}px ${el.dash === 'dash' ? 'dashed' : 'solid'} #${color};`;
  return `<div class="el" style="${style}"></div>`;
}

function tableEl(el, theme) {
  const cols = el.columns.map((w) => `<col style="width:${(w * PX).toFixed(2)}px">`).join('');
  const rowH = el.rowH ? `height:${(el.rowH * PX).toFixed(2)}px;` : '';
  const rows = el.rows
    .map((row) => {
      const cells = row
        .map((cell) => {
          const text = typeof cell === 'string' ? cell : cell.text;
          const o = (typeof cell === 'string' ? {} : cell.options) || {};
          const bg = o.fill ? `background:#${o.fill.color};` : '';
          const color = o.color ? `color:#${o.color};` : `color:#${theme.palette.text};`;
          const fs = o.fontSize ? `font-size:${(o.fontSize * PT).toFixed(2)}px;` : '';
          const bold = o.bold ? 'font-weight:700;' : '';
          return `<td style="${bg}${color}${fs}${bold}${rowH}padding:0 8px;vertical-align:middle;">${esc(text)}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  const style =
    `${pos(el)}table-layout:fixed;border-collapse:collapse;` +
    `font-family:${fontStack(theme)};font-size:${((el.fontSize || 11.5) * PT).toFixed(2)}px;`;
  return `<table class="el" style="${style}"><colgroup>${cols}</colgroup><tbody>${rows}</tbody></table>`;
}

function imageEl(el, theme) {
  let src = el.src;
  if (src && !/^(https?:|data:)/i.test(src)) {
    const abs = path.resolve(src);
    if (fs.existsSync(abs)) {
      const ext = path.extname(abs).slice(1).toLowerCase();
      const mime = ext === 'jpg' ? 'jpeg' : ext === 'svg' ? 'svg+xml' : ext;
      src = `data:image/${mime};base64,${fs.readFileSync(abs).toString('base64')}`;
    } else {
      src = '';
    }
  }
  if (!src) {
    return `<div class="el" style="${pos(el)}border:1px dashed #${theme.palette.line};background:#${theme.palette.card};display:flex;align-items:center;justify-content:center;color:#${theme.palette.muted};font-size:12px;font-family:${fontStack(theme)};">图片缺失</div>`;
  }
  return `<img class="el" src="${src}" style="${pos(el)}object-fit:${el.fit === 'contain' ? 'contain' : 'cover'};" alt="">`;
}

function placeholderEl(el, theme) {
  const style = `${pos(el)}border:1px dashed #${theme.palette.line};background:#${theme.palette.card};` +
    `display:flex;align-items:center;justify-content:center;color:#${theme.palette.muted};` +
    `font-size:${10 * PT}px;font-family:${fontStack(theme)};box-sizing:border-box;`;
  return `<div class="el" style="${style}">${esc(el.label || '图片占位')}</div>`;
}

// ---------- 图表（内联 SVG） ----------

function chartColors(c, theme) {
  return [theme.palette.primary, theme.palette.accent, theme.palette.secondary, theme.palette.muted];
}

function barSvg(c, w, h, theme) {
  const labels = c.labels || [];
  const values = (c.series && c.series[0] && c.series[0].values) || [];
  const pad = { l: 40, r: 12, t: c.title ? 30 : 14, b: 30 };
  const pw = w - pad.l - pad.r;
  const ph = h - pad.t - pad.b;
  const max = Math.max.apply(null, values.concat([1])) * 1.18;
  const color = theme.palette.primary;
  let g = '';

  for (let i = 0; i <= 4; i += 1) {
    const y = pad.t + ph - (ph * i) / 4;
    g += `<line x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" stroke="#${theme.palette.line}" stroke-width="1"/>`;
    g += `<text x="${pad.l - 6}" y="${y + 3.5}" text-anchor="end" font-size="9" fill="#${theme.palette.muted}">${Math.round((max * i) / 4)}</text>`;
  }
  const band = pw / Math.max(labels.length, 1);
  const bw = Math.min(band * 0.5, 64);
  labels.forEach((lb, i) => {
    const v = values[i] || 0;
    const bh = (v / max) * ph;
    const x = pad.l + band * i + (band - bw) / 2;
    const y = pad.t + ph - bh;
    g += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="#${color}" rx="2"/>`;
    g += `<text x="${x + bw / 2}" y="${y - 6}" text-anchor="middle" font-size="9.5" fill="#${theme.palette.text}">${v}</text>`;
    g += `<text x="${pad.l + band * i + band / 2}" y="${h - 10}" text-anchor="middle" font-size="9" fill="#${theme.palette.muted}">${esc(lb)}</text>`;
  });
  if (c.title) {
    g += `<text x="${w / 2}" y="16" text-anchor="middle" font-size="10" font-weight="600" fill="#${theme.palette.primary}">${esc(c.title)}</text>`;
  }
  return g;
}

function lineSvg(c, w, h, theme) {
  const labels = c.labels || [];
  const series = c.series || [];
  const pad = { l: 40, r: 14, t: c.title ? 30 : 14, b: 30 };
  const pw = w - pad.l - pad.r;
  const ph = h - pad.t - pad.b;
  const all = series.reduce((a, s) => a.concat(s.values || []), []);
  const max = Math.max.apply(null, all.concat([1])) * 1.18;
  const colors = chartColors(c, theme);
  let g = '';

  for (let i = 0; i <= 4; i += 1) {
    const y = pad.t + ph - (ph * i) / 4;
    g += `<line x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" stroke="#${theme.palette.line}" stroke-width="1"/>`;
    g += `<text x="${pad.l - 6}" y="${y + 3.5}" text-anchor="end" font-size="9" fill="#${theme.palette.muted}">${Math.round((max * i) / 4)}</text>`;
  }
  const step = labels.length > 1 ? pw / (labels.length - 1) : 0;
  series.forEach((s, si) => {
    const pts = (s.values || []).map((v, i) => [pad.l + step * i, pad.t + ph - (v / max) * ph]);
    g += `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#${colors[si % colors.length]}" stroke-width="2.2" stroke-linejoin="round"/>`;
    pts.forEach((p) => { g += `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#${colors[si % colors.length]}"/>`; });
  });
  labels.forEach((lb, i) => {
    g += `<text x="${pad.l + step * i}" y="${h - 10}" text-anchor="middle" font-size="9" fill="#${theme.palette.muted}">${esc(lb)}</text>`;
  });
  if (c.title) {
    g += `<text x="${w / 2}" y="16" text-anchor="middle" font-size="10" font-weight="600" fill="#${theme.palette.primary}">${esc(c.title)}</text>`;
  }
  return g;
}

function pieSvg(c, w, h, theme, donut) {
  const labels = c.labels || [];
  const values = (c.series && c.series[0] && c.series[0].values) || [];
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const colors = chartColors(c, theme);
  const cx = w / 2;
  const cy = h / 2 + 6;
  const r = Math.min(w, h) * 0.32;
  const ir = donut ? r * 0.55 : 0;
  let angle = -Math.PI / 2;
  let g = '';

  values.forEach((v, i) => {
    const a = (v / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(angle + a);
    const y2 = cy + r * Math.sin(angle + a);
    const large = a > Math.PI ? 1 : 0;
    if (v > 0) {
      if (donut) {
        const ix1 = cx + ir * Math.cos(angle + a);
        const iy1 = cy + ir * Math.sin(angle + a);
        const ix2 = cx + ir * Math.cos(angle);
        const iy2 = cy + ir * Math.sin(angle);
        g += `<path d="M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${ix1},${iy1} A${ir},${ir} 0 ${large} 0 ${ix2},${iy2} Z" fill="#${colors[i % colors.length]}"/>`;
      } else {
        g += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z" fill="#${colors[i % colors.length]}"/>`;
      }
    }
    angle += a;
  });

  labels.forEach((lb, i) => {
    const pct = Math.round((values[i] / total) * 100);
    const y = h - 34 + i * 13;
    g += `<rect x="16" y="${y - 7}" width="8" height="8" fill="#${colors[i % colors.length]}"/>`;
    g += `<text x="30" y="${y}" font-size="9.5" fill="#${theme.palette.text}">${esc(lb)} ${pct}%</text>`;
  });
  if (c.title) {
    g += `<text x="${w / 2}" y="16" text-anchor="middle" font-size="10" font-weight="600" fill="#${theme.palette.primary}">${esc(c.title)}</text>`;
  }
  return g;
}

function spreadSvg(c, w, h, theme) {
  const series = c.series || [];
  const xs = series[0] ? series[0].values || [] : [];
  const pad = { l: 40, r: 14, t: c.title ? 30 : 14, b: 30 };
  const pw = w - pad.l - pad.r;
  const ph = h - pad.t - pad.b;
  const ys = series.slice(1).reduce((a, s) => a.concat(s.values || []), []);
  const maxX = Math.max.apply(null, xs.concat([1])) * 1.15;
  const maxY = Math.max.apply(null, ys.concat([1])) * 1.15;
  const colors = chartColors(c, theme);
  let g = '';
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.t + ph - (ph * i) / 4;
    g += `<line x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" stroke="#${theme.palette.line}" stroke-width="1"/>`;
    g += `<text x="${pad.l - 6}" y="${y + 3.5}" text-anchor="end" font-size="9" fill="#${theme.palette.muted}">${Math.round((maxY * i) / 4)}</text>`;
  }
  series.slice(1).forEach((s, si) => {
    (s.values || []).forEach((v, i) => {
      const px = pad.l + ((xs[i] || 0) / maxX) * pw;
      const py = pad.t + ph - (v / maxY) * ph;
      g += `<circle cx="${px}" cy="${py}" r="3.2" fill="#${colors[(si + 1) % colors.length]}"/>`;
    });
  });
  if (c.title) {
    g += `<text x="${w / 2}" y="16" text-anchor="middle" font-size="10" font-weight="600" fill="#${theme.palette.primary}">${esc(c.title)}</text>`;
  }
  return g;
}

function chartEl(el, theme) {
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

  return `<svg class="el" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" style="${pos(el)}">${inner}</svg>`;
}

function renderElement(el, theme) {
  switch (el.type) {
    case 'text': return textEl(el, theme);
    case 'rect': return rectEl(el, theme);
    case 'line': return lineEl(el);
    case 'table': return tableEl(el, theme);
    case 'chart': return chartEl(el, theme);
    case 'image': return imageEl(el, theme);
    case 'placeholder': return placeholderEl(el, theme);
    default: return '';
  }
}

const CSS = `
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#11141c;height:100%;}
body{font-family:'Microsoft YaHei',system-ui,-apple-system,Arial,sans-serif;overflow:hidden;}
#stage{position:absolute;left:50%;top:50%;width:960px;height:540px;transform-origin:center center;}
.slide{position:absolute;inset:0;overflow:hidden;display:none;}
.slide.active{display:block;}
.slide .el{position:absolute;}
#bar{position:fixed;left:0;right:0;bottom:0;height:28px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;color:#9aa4b8;font-size:12px;background:rgba(0,0,0,.35);}
#bar button{background:none;border:1px solid #3a4356;color:#9aa4b8;border-radius:4px;cursor:pointer;font-size:12px;padding:2px 8px;}
@media print{
  html,body{background:#fff;overflow:visible;height:auto;}
  #bar{display:none;}
  #stage{position:static;transform:none!important;width:960px;height:auto;}
  .slide{position:relative;display:block!important;width:960px;height:540px;page-break-after:always;break-after:page;}
}
`;

const JS = `
(function(){
  var slides=[].slice.call(document.querySelectorAll('.slide'));
  var idx=0, counter=document.getElementById('counter');
  function show(n){
    idx=(n+slides.length)%slides.length;
    slides.forEach(function(s,i){s.classList.toggle('active',i===idx);});
    counter.textContent=(idx+1)+' / '+slides.length;
  }
  function fit(){
    var s=Math.min(window.innerWidth/980, (window.innerHeight-30)/560);
    document.getElementById('stage').style.transform='translate(-50%,-50%) scale('+s+')';
  }
  document.addEventListener('keydown',function(e){
    if(e.key==='ArrowRight'||e.key==='ArrowDown'||e.key===' '){e.preventDefault();show(idx+1);}
    if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();show(idx-1);}
    if(e.key==='Home'){show(0);}
    if(e.key==='End'){show(slides.length-1);}
  });
  document.getElementById('prev').onclick=function(){show(idx-1);};
  document.getElementById('next').onclick=function(){show(idx+1);};
  window.addEventListener('resize',fit);
  var m=location.search.match(/[?&]p=(\\d+)/);
  show(m?parseInt(m[1],10)-1:0);fit();
})();
`;

function renderHtml(spec, outPath) {
  const theme = Object.assign({}, spec.theme, { meta: spec.meta });
  const slides = spec.slides.map((s) => {
    const scene = LAYOUTS[s.layout](s, theme);
    const bg = scene.background && scene.background.color;
    const body = (scene.elements || []).map((el) => renderElement(el, theme)).join('');
    return `<section class="slide" style="background:#${bg || theme.palette.bg}">${body}</section>`;
  }).join('\n');

  const title = esc(spec.meta.title || '演示文稿');
  const html = `<!doctype html>
<html lang="${esc(spec.meta.language || 'zh-CN')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>${CSS}</style>
</head>
<body>
<div id="stage">
${slides}
</div>
<div id="bar">
  <span>${title} · ${esc(spec.meta.date || '')}</span>
  <span>
    <button id="prev">上一页</button>
    <span id="counter" style="margin:0 10px;"></span>
    <button id="next">下一页</button>
  </span>
</div>
<script>${JS}</script>
</body>
</html>`;

  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outPath, html, 'utf8');
  return outPath;
}

module.exports = { renderHtml };
