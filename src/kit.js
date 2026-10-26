/**
 * 版面常量与文本测量工具
 * 单位一律为英寸；画布宽度固定 10in，比例只改高度：
 *   16:9 → 10 x 5.625，4:3 → 10 x 7.5
 * 页面里的 pt 与英寸换算：1pt = 1/72 英寸
 */

const ASPECTS = {
  '16:9': { aspect: '16:9', W: 10, H: 5.625, M: 0.55 },
  '4:3': { aspect: '4:3', W: 10, H: 7.5, M: 0.55 },
};

const BASE_H = ASPECTS['16:9'].H;

const W = ASPECTS['16:9'].W;
const H = ASPECTS['16:9'].H;
const M = ASPECTS['16:9'].M; // 左右安全边距，Anthropic 版式规范建议 >= 0.5"

/** 按比例取画布规格，兼容 "4x3" 之类的写法 */
function geoFor(aspect) {
  const key = String(aspect || '16:9').trim().replace(/[x×]/i, ':');
  const geo = ASPECTS[key];
  if (!geo) {
    throw new Error(`不支持的画布比例 "${aspect}"，可用：${Object.keys(ASPECTS).join(' / ')}`);
  }
  return geo;
}

/** 相对 16:9 多出来的纵向空间：16:9 为 0，4:3 为 1.875in */
function slack(g) {
  return g.H - BASE_H;
}

/** 把 16:9 下的绝对 y 坐标按权重下移，weight=0 不动，=1 完全贴底 */
function dy(g, y, weight) {
  return y + slack(g) * weight;
}

/** 单字符宽度（以 em 为单位），用于估算中文/英文混排的占位 */
function charEm(ch) {
  const code = ch.codePointAt(0);
  if (code >= 0x2e80 || code === 0x3000) return 1.0; // CJK、全角标点
  if (ch === ' ') return 0.3;
  if (ch === '\t') return 0.6;
  if (/[0-9]/.test(ch)) return 0.56;
  if (/[A-Z]/.test(ch)) return 0.66;
  if (/[a-z]/.test(ch)) return 0.53;
  if (/[,.;:!|'`]/.test(ch)) return 0.28;
  return 0.5;
}

/** 估算一段文本的宽度（英寸） */
function measure(text, fontSize) {
  let em = 0;
  for (const ch of String(text)) em += charEm(ch);
  return (em * fontSize) / 72;
}

/** 把中英文切成排版 token：CJK 每字一个 token，英文按单词 */
function tokenize(text) {
  const tokens = [];
  let buf = '';
  for (const ch of String(text)) {
    const isCjk = ch.codePointAt(0) >= 0x2e80 || ch === '\u3000';
    if (isCjk || ch === ' ') {
      if (buf) {
        tokens.push(buf);
        buf = '';
      }
      tokens.push(ch);
    } else {
      buf += ch;
    }
  }
  if (buf) tokens.push(buf);
  return tokens;
}

/** 估算在给定宽度下的行数（含手动换行） */
function lineCount(text, fontSize, widthIn) {
  let lines = 0;
  for (const para of String(text).split('\n')) {
    lines += 1;
    let cur = 0;
    for (const t of tokenize(para)) {
      const tw = measure(t, fontSize);
      if (cur + tw > widthIn && cur > 0) {
        lines += 1;
        cur = t === ' ' ? 0 : tw;
      } else {
        cur += tw;
      }
    }
  }
  return lines;
}

/** 文本在给定框内是否放得下 */
function fits(text, fontSize, w, h, lineHeight = 1.35) {
  const need = (lineCount(text, fontSize, w) * fontSize * lineHeight) / 72;
  return need <= h;
}

/** 自动缩小字号直到放得下，保底 minSize */
function fitFont(text, fontSize, w, h, opts = {}) {
  const min = opts.minSize || 8;
  const lineHeight = opts.lineHeight || 1.35;
  let size = fontSize;
  while (size > min && !fits(text, size, w, h, lineHeight)) size -= 1;
  return size;
}

/** 生成文本图元（pptx 与 html 共用同一份场景描述） */
function text(o) {
  return Object.assign({ type: 'text', margin: 0, valign: 'top', align: 'left' }, o);
}

function list(o) {
  return Object.assign({ type: 'list', bullet: true, gap: 0.18 }, o);
}

function rect(o) {
  return Object.assign({ type: 'rect', radius: 0, transparency: 0 }, o);
}

function line(o) {
  return Object.assign({ type: 'line', width: 1, dash: 'solid' }, o);
}

function image(o) {
  return Object.assign({ type: 'image', fit: 'cover' }, o);
}

/** 图片缺失时的占位框：画边框 + 说明，不伪造内容 */
function imagePlaceholder(o) {
  return Object.assign({ type: 'placeholder', label: '图片占位' }, o);
}

/** 简易几何：卡片横向均分 */
function columns(x, y, w, h, count, gap) {
  const cw = (w - gap * (count - 1)) / count;
  return Array.from({ length: count }, (_, i) => ({
    x: x + i * (cw + gap),
    y,
    w: cw,
    h,
  }));
}

module.exports = {
  ASPECTS, W, H, M, geoFor, slack, dy,
  measure, lineCount, fits, fitFont, tokenize, charEm,
  text, list, rect, line, image, imagePlaceholder, columns,
};
