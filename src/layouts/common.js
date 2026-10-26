/**
 * 各 layout 共用的页面元素
 * 所有版式都接收画布规格 g（{ W, H, M }），纵向坐标按 g 计算，横向与 16:9 完全一致
 */
const { text, fitFont, lineCount } = require('../kit');

/** 内容区下沿：有结论条时让开 0.55in，没有则只留 0.625in 页边 */
function bodyBottom(g, hasTakeaway) {
  return g.H - (hasTakeaway ? 1.175 : 0.625);
}

/** 页面主标题（内容页统一位置与字号阶梯） */
function titleBlock(s, th, g) {
  const { W, M } = g;
  const value = s.title || s.heading || '';
  const size = fitFont(value, th.sizes.title, W - 2 * M, 0.66);
  return [
    text({
      x: M, y: 0.42, w: W - 2 * M, h: 0.66,
      text: value, fontSize: size, bold: true,
      color: th.palette.primary, font: th.fonts.heading,
    }),
  ];
}

/** 内容页统一浅色底 */
function lightScene(th) {
  return { background: { color: th.palette.bg }, elements: [] };
}

/** 深色底（封面/章节/结尾/引文） */
function darkScene(th) {
  return { background: { color: th.palette.bgDark }, elements: [] };
}

/** 页面底部的一句结论条（始终贴底，4:3 下自动下移） */
function takeawayBar(s, th, g) {
  if (!s.takeaway) return [];
  const { W, M, H } = g;
  const y = H - 1.0;
  const size = fitFont(s.takeaway, th.sizes.small, W - 2 * M - 0.5, 0.52);
  return [
    {
      type: 'rect',
      x: M, y, w: W - 2 * M, h: 0.52,
      fill: th.palette.card, line: null, radius: 0.06,
    },
    text({
      x: M + 0.25, y: y + 0.04, w: W - 2 * M - 0.5, h: 0.44,
      text: s.takeaway, fontSize: size, bold: true,
      color: th.palette.primary, font: th.fonts.body, valign: 'middle',
    }),
  ];
}

/**
 * 垂直堆叠的一段段文字（自动缩字号直到放得下）
 * items: string | { text, note }
 */
function stackText(items, o) {
  const th = o.theme;
  const pad = o.hasBullet === false ? 0 : 0.26;
  const w = o.w - pad;
  const maxY = o.maxY || 5.0;
  const gap = o.gap == null ? 0.2 : o.gap;

  const norm = (items || []).map((it) =>
    typeof it === 'string' ? { text: it } : Object.assign({}, it)
  );

  const heightAt = (size) => {
    const noteSize = Math.max(9, Math.round(size * 0.78));
    return norm.reduce((sum, it) => {
      const h = (lineCount(it.text || '', size, w) * size * 1.35) / 72;
      const nh = it.note
        ? (lineCount(it.note, noteSize, w) * noteSize * 1.35) / 72 + 0.03
        : 0;
      return sum + h + nh;
    }, 0) + gap * Math.max(0, norm.length - 1);
  };

  let size = o.size || th.sizes.body;
  while (size > 9 && o.y + heightAt(size) > maxY) size -= 1;

  const noteSize = Math.max(9, Math.round(size * 0.78));
  const els = [];
  let y = o.y;

  norm.forEach((it, i) => {
    if (o.hasBullet !== false) {
      els.push({
        type: 'rect',
        x: o.x + 0.02, y: y + size * 0.46 / 72, w: 0.09, h: 0.09,
        fill: o.bulletColor || th.palette.accent, radius: 0.02, line: null,
      });
    }
    const lineH = (lineCount(it.text || '', size, w) * size * 1.35) / 72;
    els.push(text({
      x: o.x + (o.hasBullet === false ? 0 : pad), y,
      w, h: lineH + 0.04,
      text: it.text || '', fontSize: size,
      bold: !!o.boldItem && i === 0,
      color: o.color || th.palette.text, font: th.fonts.body,
    }));
    y += lineH;
    if (it.note) {
      const nh = (lineCount(it.note, noteSize, w) * noteSize * 1.35) / 72;
      els.push(text({
        x: o.x + (o.hasBullet === false ? 0 : pad), y: y + 0.03,
        w, h: nh + 0.04,
        text: it.note, fontSize: noteSize,
        color: th.palette.muted, font: th.fonts.body,
      }));
      y += nh + 0.03;
    }
    y += gap;
  });
  return { elements: els, endY: y - gap };
}

module.exports = { bodyBottom, titleBlock, lightScene, darkScene, takeawayBar, stackText };
