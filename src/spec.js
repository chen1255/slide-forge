/**
 * spec 解析与规范化：YAML / JSON 都支持
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { resolveTheme } = require('./theme');
const { geoFor } = require('./kit');
const { LAYOUTS } = require('./layouts');

const DEFAULTS = {
  meta: {
    title: '未命名演示',
    subtitle: '',
    author: '',
    date: '',
    language: 'zh-CN',
    aspect: '16:9',
  },
  theme: 'midnight-executive',
  output: { dir: 'out', speakerNotes: true },
};

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function slugify(s, fallback) {
  const out = String(s || '')
    .replace(/[\\/:*?"<>|\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return out || fallback;
}

function parseSpec(text, filename) {
  let raw;
  if (/\.json$/i.test(filename || '')) {
    raw = JSON.parse(text);
  } else {
    raw = yaml.load(text);
  }
  if (!raw || typeof raw !== 'object') {
    throw new Error('spec 内容为空或格式不正确');
  }
  return raw;
}

function formatDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** YAML 会把 2026-10-26 解析成 Date，统一转回字符串 */
function coerceDates(value) {
  if (value instanceof Date) return formatDate(value);
  if (Array.isArray(value)) return value.map(coerceDates);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).forEach((k) => { out[k] = coerceDates(value[k]); });
    return out;
  }
  return value;
}

function normalize(rawIn, sourceName) {
  const raw = coerceDates(rawIn);
  const meta = Object.assign({}, DEFAULTS.meta, raw.meta || {});
  if (!meta.date) meta.date = formatDate(new Date());

  // 画布比例：16:9（默认）或 4:3，也接受 "4x3" 之类写法
  const geo = geoFor(meta.aspect);
  meta.aspect = geo.aspect;

  const theme = resolveTheme(raw.theme ? { theme: raw.theme } : {});

  const out = Object.assign({}, DEFAULTS.output, raw.output || {});
  const base = slugify(meta.title, `deck-${Date.now()}`);
  const dir = out.dir || 'out';
  const pptx = out.pptx || path.join(dir, `${base}.pptx`);
  const html = out.html || path.join(dir, `${base}.html`);

  const slides = (raw.slides || []).map((s, i) => {
    const layout = s.layout || 'bullets';
    if (!LAYOUTS[layout]) {
      throw new Error(
        `第 ${i + 1} 页使用了未知 layout "${layout}"，可用：${Object.keys(LAYOUTS).join(' / ')}`
      );
    }
    const slide = Object.assign({}, s, { layout, index: i + 1 });
    // 图表类型缺省为 bar；写成不支持的值则在 validateSpec 里报错，不要静默降级
    if (slide.chart && typeof slide.chart === 'object' && !slide.chart.type) {
      slide.chart = Object.assign({}, slide.chart, { type: 'bar' });
    }
    return slide;
  });

  const spec = {
    meta,
    geo,
    theme,
    output: { dir, pptx, html, speakerNotes: out.speakerNotes !== false },
    slides,
    source: sourceName,
  };

  const errors = validateSpec(spec);
  if (errors.length) {
    const err = new Error(`spec 校验失败：\n- ${errors.join('\n- ')}`);
    err.errors = errors;
    throw err;
  }
  return spec;
}

/** 支持的图表类型，与 render-pptx 的类型映射保持一致 */
const CHART_TYPES = ['bar', 'column', 'line', 'pie', 'doughnut', 'area', 'scatter', 'radar'];

const REQUIRED = {
  cover: ['title'],
  section: ['title'],
  bullets: ['items'],
  twoCol: ['left'],
  cards: ['items'],
  kpi: ['items'],
  chart: ['chart'],
  table: ['columns', 'rows'],
  timeline: ['items'],
  quote: ['quote'],
  image: [],
  end: [],
  toc: ['items'],
  team: ['members'],
  hero: ['title'],
  compare: ['before', 'after'],
  process: ['steps'],
  screenshot: [],
};

function validateSpec(spec) {
  const errors = [];
  if (!spec.slides.length) errors.push('slides 不能为空，至少要有 1 页');

  spec.slides.forEach((s) => {
    const need = REQUIRED[s.layout] || [];
    need.forEach((k) => {
      const v = s[k];
      if (v == null || (Array.isArray(v) && !v.length)) {
        errors.push(`第 ${s.index} 页（${s.layout}）缺少必填字段 "${k}"`);
      }
    });

    if (s.layout === 'chart') {
      const c = s.chart || {};
      if (!c.labels || !c.labels.length) errors.push(`第 ${s.index} 页图表缺少 labels`);
      if (!c.series || !c.series.length) errors.push(`第 ${s.index} 页图表缺少 series`);
      if (c.type && !CHART_TYPES.includes(String(c.type).toLowerCase())) {
        errors.push(
          `第 ${s.index} 页图表类型 "${c.type}" 不支持，可用：${CHART_TYPES.join(' / ')}`
        );
      }
      (c.series || []).forEach((ser, i) => {
        if (!ser.values || ser.values.length !== (c.labels || []).length) {
          errors.push(`第 ${s.index} 页图表 series[${i}] 的 values 数量与 labels 不一致`);
        }
      });
    }

    if (s.layout === 'table') {
      const cols = s.columns || [];
      (s.rows || []).forEach((r, i) => {
        if (r.length !== cols.length) {
          errors.push(`第 ${s.index} 页表格第 ${i + 1} 行有 ${r.length} 列，表头是 ${cols.length} 列`);
        }
      });
    }
  });
  return errors;
}

function loadSpec(file) {
  const abs = path.resolve(file);
  const text = fs.readFileSync(abs, 'utf8');
  const raw = parseSpec(text, abs);
  return normalize(raw, abs);
}

module.exports = {
  DEFAULTS, CHART_TYPES, loadSpec, parseSpec, normalize, validateSpec, slugify, today,
};
