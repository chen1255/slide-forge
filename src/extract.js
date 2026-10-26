/**
 * 长文档结构化抽取（纯规则，不依赖模型）
 *   splitSections  按标题把文档切成章节，并把表格块单独摘出来
 *   keyPoints      从段落里挑出信息量最高的几句，做页面要点
 *   extractSeries  识别「标签 + 数值」序列，判断该画柱状/折线/饼图
 *   detectShape    判断一段内容更适合对比 / 流程 / 时间线 / 卡片
 */

const BULLET = /^\s{0,3}(?:[-*+•]|\d+[.)、])\s+/;

/** 去掉列表符号、强调标记与行首标题井号，但保留正文里的数字 */
function cleanLine(raw) {
  return String(raw)
    .replace(BULLET, '')
    .replace(/^#{1,6}\s+/, '')
    .replace(/\*\*|__|`/g, '')
    .trim();
}

/** 表格单元格只去强调标记，不动前导减号（-5 是有意义的数值） */
function cleanCell(raw) {
  return String(raw)
    .replace(/\*\*|__|`/g, '')
    .replace(/^#+\s*/, '')
    .trim();
}

function headingOf(line, allowNumbered) {
  const hash = /^(#{1,6})\s+(.+?)\s*#*$/.exec(line);
  if (hash) return { level: hash[1].length, title: hash[2].trim() };
  if (!allowNumbered) return null;
  if (line.length > 22) return null;
  if (/[。！？；;]$/.test(line)) return null;

  const cn = /^[（(]?([一二三四五六七八九十]+)[)）、.]\s*(.+)$/.exec(line);
  if (cn) return { level: 2, title: cn[2].trim() };

  // 需要「1. 标题」这种带空格的写法，避免把「1.5 倍」当成标题
  const num = /^(\d+(?:\.\d+)*)[.、)]\s+(.+)$/.exec(line);
  if (num) {
    return {
      level: Math.min(3, num[1].split('.').length),
      title: num[2].trim(),
    };
  }
  return null;
}

function tableCells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cleanCell);
}

/** 从行数组里摘出 Markdown 管道表格，返回表格与剩余行 */
function extractTables(lines) {
  const tables = [];
  const rest = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const next = (lines[i + 1] || '').trim();
    const isHeader = line.includes('|');
    const isRule = /^\|?[\s:|-]+\|[\s:|-]*$/.test(next) && next.includes('-');

    if (isHeader && isRule) {
      const headers = tableCells(line).filter((h, idx, arr) => !(arr.length === 1 && !h));
      const rows = [];
      let j = i + 2;
      while (j < lines.length && (lines[j] || '').includes('|')) {
        const cells = tableCells(lines[j]);
        if (cells.some((c) => c !== '')) {
          while (cells.length < headers.length) cells.push('');
          rows.push(cells.slice(0, headers.length));
        }
        j += 1;
      }
      const last = [...rest].reverse().find((l) => l.trim());
      const caption = last && /^(表|图|Table|Fig)/i.test(cleanCell(last)) ? cleanCell(last) : '';
      tables.push({ headers, rows, caption });
      i = j - 1;
      continue;
    }
    rest.push(lines[i]);
  }
  return { tables, rest };
}

/**
 * 按标题切章节。文档里有 # 标题时，中文序号/数字编号不当作标题（避免把列表项升级成章节）
 */
function splitSections(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const hasHash = lines.some((l) => /^#{1,6}\s+/.test(l.trim()));
  const raw = [];
  let cur = { level: 1, title: '', lines: [] };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    const h = headingOf(line, !hasHash);
    if (h) {
      if (cur.title || cur.lines.some((l) => l.trim())) raw.push(cur);
      cur = { level: h.level, title: h.title, lines: [] };
      return;
    }
    cur.lines.push(rawLine);
  });
  if (cur.title || cur.lines.some((l) => l.trim())) raw.push(cur);

  return raw
    .map((s) => {
      const { tables, rest } = extractTables(s.lines);
      return {
        level: s.level,
        title: s.title,
        body: rest.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
        tables,
      };
    })
    .filter((s) => s.title || s.body || s.tables.length);
}

/** 把正文切成句子（保留句末标点，方便之后判断语气） */
function sentences(text) {
  return String(text)
    .replace(/[ \t]+/g, ' ')
    .split(/\n+/)
    .flatMap((p) => p.split(/(?<=[。！？；!?;])/))
    .map(cleanLine)
    .filter((s) => s.length >= 6);
}

function trimSentence(text, limit) {
  const t = text.replace(/[。；;]$/, '');
  if (t.length <= limit) return t;
  const cut = t.slice(0, limit);
  const comma = Math.max(cut.lastIndexOf('，'), cut.lastIndexOf(','));
  return `${(comma > limit * 0.5 ? cut.slice(0, comma) : cut).trim()}…`;
}

/**
 * 选要点：含数字/百分比的句子优先，其次靠前的句子；返回时保持原文顺序
 */
function keyPoints(body, max = 5) {
  const all = sentences(body);
  if (!all.length) return [];
  const scored = all.map((text, i) => {
    let score = 0;
    if (/\d/.test(text)) score += 3;
    if (/[%％]/.test(text)) score += 2;
    if (text.length >= 10 && text.length <= 44) score += 1;
    score += 1 / (i + 1);
    return { text: trimSentence(text, 46), score, i };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .sort((a, b) => a.i - b.i)
    .map((s) => s.text);
}

/** 「2021 年 1,200 万元」这类片段 → { label, value, unit } */
function parsePairs(text) {
  return String(text)
    .split(/[，,；;。！？!?]/)
    .map((rawPart) => {
      const part = rawPart.trim().replace(/[。！？!?]$/, '');
      if (!part) return null;
      const m = /^(.{1,16}?)\s*[:：]?\s*(-?\d[\d,]*(?:\.\d+)?)\s*(%|万元|亿元|万|亿|元|人|个|台|次|天|小时|美元)?$/.exec(
        part
      );
      if (!m) return null;
      // 「区域贡献占比：华东 34%」只取冒号后的部分做类目名
      const label = m[1].split(/[:：]/).pop().trim();
      if (!label || /^\d+$/.test(label)) return null;
      if (label.length > 10 || /[，,。；;、]/.test(label)) return null;
      return {
        label,
        value: Number(m[2].replace(/,/g, '')),
        unit: m[3] || '',
      };
    })
    .filter(Boolean);
}

/**
 * 识别数值序列：同一行里 ≥3 个「标签 + 数值」，或连续多行各 1 个
 * 多行拼接时要求单位一致，避免把「22 天 / 3.1% / 120 小时」这类不同口径的句子拼成假图表
 * 返回 { kind: 'bar'|'line'|'pie', labels, values, unit }
 */
function extractSeries(body) {
  const lines = String(body)
    .split(/\n+/)
    .map(cleanLine)
    .filter(Boolean);

  // 一行里可能塞了好几句：只有「同一句里 ≥3 个数值对」才算序列，
  // 否则另一句里的汇总值（如「华东与华南合计 60%」）会混进同一张图
  let mono = null;
  const singles = [];
  lines.forEach((line) => {
    sentences(line).forEach((sent) => {
      const found = parsePairs(sent);
      if (found.length >= 3) {
        if (!mono || found.length > mono.length) mono = found;
      } else if (found.length === 1) {
        singles.push(found[0]);
      }
    });
  });

  const pairs = mono || singles;
  const monoLine = !!mono;

  const seen = new Set();
  const uniq = pairs.filter((p) => {
    if (seen.has(p.label)) return false;
    seen.add(p.label);
    return true;
  });
  if (uniq.length < 3) return null;

  const units = new Set(uniq.map((p) => p.unit).filter(Boolean));
  const unit = units.size === 1 ? [...units][0] : '';
  if (!monoLine && !unit) return null;

  const labels = uniq.map((p) => p.label);
  const values = uniq.map((p) => p.value);

  if (uniq.length <= 6 && uniq.every((p) => p.unit === '%')) {
    const sum = values.reduce((a, b) => a + b, 0);
    if (sum >= 95 && sum <= 105) return { kind: 'pie', labels, values, unit: '%' };
  }

  const timeLike = labels.filter((l) => /(年|季度|Q[1-4]|月|(19|20)\d{2})/i.test(l)).length;
  return {
    kind: timeLike >= Math.ceil(labels.length * 0.6) ? 'line' : 'bar',
    labels,
    values,
    unit,
  };
}

const COMPARE_BEFORE = /(现状|之前|原来|改革前|改造前|before|目前的做法)/i;
const COMPARE_AFTER = /(目标|之后|现在|改革后|改造后|after|新的做法)/i;
const PROCESS_WORDS = /(首先|其次|再次|接着|然后|最后|第一步|第二步|第三步|step\s*[1-3])/i;
const TIME_LIKE = /(20\d{2}|19\d{2}|Q[1-4]|第[一二三四]季度|\d+月)/i;

/** 判断内容形态，决定用哪种版式承载 */
function detectShape(body) {
  const points = sentences(body);
  const joined = points.join(' ');

  if (COMPARE_BEFORE.test(joined) && COMPARE_AFTER.test(joined)) return { shape: 'compare' };

  const processHits = points.filter((p) => PROCESS_WORDS.test(p)).length;
  if (processHits >= 3) return { shape: 'process' };

  const timeHits = points.filter((p) => TIME_LIKE.test(p)).length;
  if (timeHits >= 3 && timeHits >= Math.ceil(points.length * 0.5)) return { shape: 'timeline' };

  const avg = points.reduce((sum, p) => sum + p.length, 0) / Math.max(1, points.length);
  if (points.length >= 3 && points.length <= 6 && avg <= 24) return { shape: 'cards' };

  return { shape: 'bullets' };
}

module.exports = {
  cleanLine,
  cleanCell,
  headingOf,
  splitSections,
  extractTables,
  sentences,
  trimSentence,
  keyPoints,
  parsePairs,
  extractSeries,
  detectShape,
};
