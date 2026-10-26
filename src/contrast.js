/**
 * WCAG 对比度校验
 * palette 允许用户任意覆盖，但没有任何机制阻止「浅灰字配白底」这种不可读组合。
 * 这里按 WCAG 2.1 的相对亮度公式算出真实对比度，不靠肉眼猜。
 */

/** 6 位十六进制（可带 #）→ [r, g, b] */
function hex2rgb(hex) {
  const h = String(hex || '').replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** sRGB 单通道 → 线性值（WCAG 2.1 定义，不是简单的 gamma 2.2） */
function linearize(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** 相对亮度 */
function luminance(hex) {
  const rgb = hex2rgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(linearize);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 两个颜色的对比度比值，1 ~ 21 */
function ratio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  if (la == null || lb == null) return null;
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

function readable(hex) {
  return hex2rgb(hex) != null;
}

/**
 * 版式里真实出现的「前景 / 背景」组合。
 * 只列源码里确实会同时渲染的配对，避免报出一堆根本不存在的组合。
 * min: AA 阈值，正文 4.5，大字（>=18pt 或 >=14pt bold）3.0
 */
const PAIRS = [
  { fg: 'text', bg: 'bg', min: 4.5, where: '内容页正文' },
  { fg: 'muted', bg: 'bg', min: 4.5, where: '内容页次要文字' },
  { fg: 'primary', bg: 'bg', min: 4.5, where: '页面主标题' },
  { fg: 'accent', bg: 'bg', min: 3.0, where: 'KPI 大数字、时间线日期' },
  { fg: 'text', bg: 'card', min: 4.5, where: '卡片正文' },
  { fg: 'muted', bg: 'card', min: 4.5, where: '卡片说明' },
  { fg: 'primary', bg: 'card', min: 4.5, where: '底部结论条' },
  { fg: 'onDark', bg: 'bgDark', min: 4.5, where: '深色页主文字' },
  { fg: 'onDarkMuted', bg: 'bgDark', min: 4.5, where: '深色页次要文字' },
  { fg: 'onDark', bg: 'primary', min: 4.5, where: '表格表头' },
  { fg: 'secondary', bg: 'bgDark', min: 1.5, where: '封面装饰描边（纯装饰，不作要求）' },
];

/**
 * 判定容差：字体渲染有抗锯齿与次像素，4.47 和 4.5 在实际观感上没有区别，
 * 卡到小数点后两位只会制造噪音，所以留 0.1 的工程余量。
 */
const TOLERANCE = 0.1;

/**
 * 检查一套 palette
 * 返回 { errors, warnings, table }
 * - 低于 3.0 记 error：已经到了看不清的程度，必须换色
 * - 3.0 到阈值之间记 warning：能看但不达标，建议微调
 * - secondary 描边这类纯装饰只做展示，不判罚
 */
function checkPalette(palette) {
  const errors = [];
  const warnings = [];
  const table = [];

  PAIRS.forEach((p) => {
    const fg = palette[p.fg];
    const bg = palette[p.bg];
    const r = ratio(fg, bg);
    const decorative = p.min < 3;
    const row = {
      pair: `${p.fg} on ${p.bg}`,
      where: p.where,
      ratio: r,
      min: p.min,
      pass: r == null ? false : r >= p.min - TOLERANCE,
    };
    table.push(row);
    if (r == null) {
      errors.push(`颜色值非法：${p.fg}="${fg}" / ${p.bg}="${bg}"（需 6 位十六进制，不带 #）`);
      return;
    }
    if (decorative || row.pass) return;

    const detail = `${p.where}：${p.fg}(${fg}) 在 ${p.bg}(${bg}) 上对比度 ${r.toFixed(2)}:1，低于 ${p.min}:1`;
    if (r < 3) errors.push(`${detail}，实际已难以辨认`);
    else warnings.push(detail);
  });

  return { errors, warnings, table };
}

/** 给 CLI 画一张速查表 */
function formatTable(table) {
  return table
    .map((r) => {
      const mark = r.ratio == null ? '×' : r.pass ? '✓' : r.ratio < 3 ? '✗' : '!';
      const val = r.ratio == null ? '  非法' : `${r.ratio.toFixed(2)}:1`;
      return `  ${mark} ${val.padStart(8)}  ≥${r.min}  ${r.pair.padEnd(22)} ${r.where}`;
    })
    .join('\n');
}

module.exports = { hex2rgb, luminance, ratio, readable, checkPalette, formatTable, PAIRS };
