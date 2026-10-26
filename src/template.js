/**
 * 模板通道：从 .pptx/.potx 里提取品牌色、字体与页面尺寸
 * 走 ZIP/XML 读取，不依赖 Office 组件
 */
const fs = require('fs');
const JSZip = require('jszip');

const EMU_PER_INCH = 914400;

function hex2rgb(hex) {
  const h = String(hex).replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgb2hex(rgb) {
  return rgb.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function blend(hex, target, ratio) {
  const a = hex2rgb(hex);
  const b = hex2rgb(target);
  return rgb2hex(a.map((v, i) => v + (b[i] - v) * ratio));
}

function parseColorScheme(xml) {
  const keys = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'];
  const out = {};
  keys.forEach((k) => {
    const block = xml.match(new RegExp(`<a:${k}>([\\s\\S]*?)</a:${k}>`));
    if (!block) return;
    const srgb = block[1].match(/<a:srgbClr val="([0-9A-Fa-f]{6})"/);
    if (srgb) { out[k] = srgb[1].toUpperCase(); return; }
    const sys = block[1].match(/<a:sysClr[^>]*lastClr="([0-9A-Fa-f]{6})"/);
    if (sys) out[k] = sys[1].toUpperCase();
  });
  return out;
}

function fontFromBlock(block) {
  if (!block) return '';
  // 只认东亚字体；latin 字体（Calibri 等）在中文 Windows 上会回退，不能当正文
  const ea = block.match(/<a:ea typeface="([^"]+)"/);
  return ea && ea[1].trim() ? ea[1].trim() : '';
}

async function inspectTemplate(file) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));

  const themeName = Object.keys(zip.files).find((n) => /^ppt\/theme\/theme\d+\.xml$/.test(n));
  if (!themeName) throw new Error('不是有效的 pptx/potx：找不到 ppt/theme/theme1.xml');
  const themeXml = await zip.file(themeName).async('string');

  const scheme = parseColorScheme(themeXml);
  const majorBlock = (themeXml.match(/<a:majorFont>[\s\S]*?<\/a:majorFont>/) || [''])[0];
  const minorBlock = (themeXml.match(/<a:minorFont>[\s\S]*?<\/a:minorFont>/) || [''])[0];

  const presXml = await zip.file('ppt/presentation.xml').async('string');
  const sz = presXml.match(/<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
  const widthIn = sz ? Number(sz[1]) / EMU_PER_INCH : 10;
  const heightIn = sz ? Number(sz[2]) / EMU_PER_INCH : 5.625;

  const layoutFiles = Object.keys(zip.files).filter((n) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(n));
  const layouts = [];
  for (const lf of layoutFiles) {
    const x = await zip.file(lf).async('string');
    const m = x.match(/<p:cSld[^>]*name="([^"]*)"/);
    layouts.push({ file: lf.replace('ppt/slideLayouts/', ''), name: m ? m[1] : '' });
  }

  return {
    file,
    scheme,
    fonts: {
      heading: fontFromBlock(majorBlock) || fontFromBlock(minorBlock),
      body: fontFromBlock(minorBlock) || fontFromBlock(majorBlock),
    },
    size: { widthIn: Number(widthIn.toFixed(3)), heightIn: Number(heightIn.toFixed(3)) },
    layouts,
  };
}

/** 把模板的品牌色映射成 slide-forge 的调色板 */
function paletteFromTemplate(info) {
  const s = info.scheme || {};
  const dark = s.dk2 || s.dk1 || '1E2761';
  const light = s.lt1 || 'FFFFFF';
  const accent = s.accent1 || 'E8B04B';
  const text = s.dk1 && s.dk1 !== '000000' ? s.dk1 : '1F2430';
  return {
    bg: light,
    bgDark: dark,
    primary: dark,
    secondary: s.lt2 || blend(dark, light, 0.72),
    accent,
    text,
    muted: blend(text, light, 0.55),
    line: blend(text, light, 0.88),
    card: blend(dark, light, 0.95),
    onDark: light,
    onDarkMuted: blend(light, dark, 0.28),
  };
}

/** 把模板风格叠加到 spec 上（字体、配色） */
function applyTemplate(spec, info) {
  const palette = paletteFromTemplate(info);
  spec.theme = Object.assign({}, spec.theme, {
    palette: Object.assign({}, spec.theme.palette, palette),
    fonts: {
      heading: spec.theme.fonts.heading || info.fonts.heading,
      body: info.fonts.body || spec.theme.fonts.body,
    },
    template: {
      file: info.file,
      size: info.size,
      layouts: info.layouts,
    },
  });
  return spec;
}

/** 模板尺寸与内置 16:9 画布的差异提示 */
function templateWarnings(info) {
  const w = info.size.widthIn;
  const h = info.size.heightIn;
  const ratio = w / h;
  const warnings = [];
  if (Math.abs(ratio - 16 / 9) > 0.02) {
    warnings.push(
      `模板尺寸 ${w}×${h}in（比例 ${ratio.toFixed(2)}）不是 16:9，当前版本按 16:9 画布输出，可能存在比例差异`
    );
  }
  if (!info.fonts.body) warnings.push('模板未声明中文字体，正文将使用默认字体');
  return warnings;
}

module.exports = {
  inspectTemplate, paletteFromTemplate, applyTemplate, templateWarnings,
};
