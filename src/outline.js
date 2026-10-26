/**
 * 大纲生成：
 *   1) --from doc.md   把长文档拆成完整 spec（纯本地规则，不调模型）
 *   2) --llm           调 DeepSeek 生成完整大纲（需要 DEEPSEEK_API_KEY）
 *   3) 都没有           生成一份可编辑的骨架 spec，提示用户补内容
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { slugify } = require('./spec');
const {
  splitSections,
  splitPages,
  keyPoints,
  sentences,
  extractSeries,
  detectShape,
  trimSentence,
} = require('./extract');

/** 允许用 <!-- layout: x --> 指定的版式（都能直接吃一组要点） */
const FORCE_SHAPES = new Set(['bullets', 'cards', 'process', 'timeline', 'compare']);

const DEFAULT_API = 'https://api.deepseek.com/chat/completions';
const DOC_EXT = new Set(['.md', '.markdown', '.txt', '.text']);

function stripFence(text) {
  return String(text).replace(/^```[a-zA-Z]*\s*/m, '').replace(/```\s*$/m, '').trim();
}

/** 单元格是不是纯数值（可带千分位、小数与常见单位） */
function numericCell(cell) {
  const m = /^(-?\d[\d,]*(?:\.\d+)?)\s*(%|万元|亿元|万|亿|元|人|个|台|次|天|小时|美元)?$/.exec(
    String(cell).trim()
  );
  if (!m) return null;
  return { value: Number(m[1].replace(/,/g, '')), unit: m[2] || '' };
}

/** 第一列做类目、某一列全是数值的表格 → 可以画图 */
function chartableTable(t) {
  if (!t.headers.length || t.rows.length < 3) return null;
  for (let c = 1; c < t.headers.length; c += 1) {
    const parsed = t.rows.map((r) => numericCell(r[c]));
    if (parsed.every(Boolean)) {
      const units = new Set(parsed.map((p) => p.unit).filter(Boolean));
      return {
        labels: t.rows.map((r) => String(r[0]).slice(0, 10)),
        values: parsed.map((p) => p.value),
        unit: units.size === 1 ? [...units][0] : '',
        column: t.headers[c],
      };
    }
  }
  return null;
}

function chartSlide(chart, title, points) {
  const sum = chart.values.reduce((a, b) => a + b, 0);
  const isPie = chart.type === 'pie' && chart.values.every((v) => v >= 0) && sum > 0;
  const payload = {
    type: isPie ? 'pie' : chart.type,
    labels: chart.labels,
    series: [{ name: chart.name || '数值', values: chart.values }],
    showValue: chart.labels.length <= 10,
  };
  if (chart.unit) payload.title = `单位：${chart.unit}`;
  return {
    layout: 'chart',
    title,
    chart: payload,
    insight: points.slice(0, 3),
  };
}

function tableSlides(t, title, points) {
  const cap = t.caption || title;
  const chunk = 8;
  const pages = [];
  for (let i = 0; i < t.rows.length; i += chunk) {
    const rows = t.rows.slice(i, i + chunk);
    const suffix = i === 0 ? '' : '（续）';
    pages.push({
      layout: 'table',
      title: cap + suffix,
      columns: t.headers,
      rows,
      takeaway: i + chunk >= t.rows.length && points.length ? points[0] : undefined,
    });
  }
  return pages;
}

/** 按形态把一章正文拆成若干内容页 */
function contentSlides(sec, title, points) {
  const slides = [];
  let chartPlaced = false;

  sec.tables.forEach((t, i) => {
    const fit = chartableTable(t);
    const cap = t.caption || (i === 0 ? `${title}数据` : `${title}数据 ${i + 1}`);
    const asChart = !!fit && !chartPlaced;
    if (asChart) {
      const sum = fit.values.reduce((a, b) => a + b, 0);
      const timeLike = fit.labels.filter((l) => /(年|季度|Q[1-4]|月|(19|20)\d{2})/i.test(l)).length;
      let type = 'bar';
      if (fit.unit === '%' && sum >= 95 && sum <= 105) type = 'pie';
      else if (timeLike >= Math.ceil(fit.labels.length * 0.6)) type = 'line';
      slides.push(
        chartSlide(
          { type, labels: fit.labels, values: fit.values, unit: fit.unit, name: fit.column },
          cap,
          points
        )
      );
      chartPlaced = true;
    }
    // 出不了图的表格一律落到表格页，否则一张表都不剩；
    // 已出图但行数多时再补一页明细
    if (!asChart || t.rows.length > 6) slides.push(...tableSlides(t, cap, points));
  });

  if (!chartPlaced) {
    const series = extractSeries(sec.body);
    if (series) {
      slides.push(
        chartSlide(
          { type: series.kind, labels: series.labels, values: series.values, unit: series.unit },
          `${title}数据`,
          points
        )
      );
      chartPlaced = true;
    }
  }

  // 图已经承载了前 3 条要点，剩下的才做文字页
  let rest = chartPlaced ? points.slice(3) : points;
  // 只剩一句时不再单独占一页，挂成图表页底部的结论条
  const lastChart = slides[slides.length - 1];
  if (chartPlaced && rest.length === 1 && lastChart && !lastChart.takeaway) {
    lastChart.takeaway = rest[0];
    rest = [];
  }
  if (!rest.length) return slides;

  let shape = FORCE_SHAPES.has(sec.force) ? sec.force : detectShape(sec.body).shape;
  // 已有图表时不再把同样的句子改造成时间线或卡片
  if (chartPlaced && (shape === 'timeline' || shape === 'cards')) shape = 'bullets';

  if (shape === 'compare' && rest.length >= 2) {
    const idx = rest.findIndex((p) => /(目标|之后|现在|改革后|改造后|after|新的做法)/i.test(p));
    const split = idx > 0 ? idx : Math.ceil(rest.length / 2);
    slides.push({
      layout: 'compare',
      title: `${title}：现状与目标`,
      before: { title: '现状', items: rest.slice(0, split) },
      after: { title: '目标', items: rest.slice(split) },
    });
    return slides;
  }

  if (shape === 'process' && rest.length >= 3) {
    const steps = rest.slice(0, 4).map((p) => {
      const [head, ...tail] = p.split(/[：:，,]/);
      return {
        // 步骤序号已经由版式给出，标题里不必再留「首先/其次」
        title: trimSentence(head.replace(/^(首先|其次|再次|接着|然后|最后)\s*/, ''), 12),
        body: tail.length ? trimSentence(tail.join('，'), 40) : '',
      };
    });
    slides.push({ layout: 'process', title, steps });
    return slides;
  }

  if (shape === 'timeline' && rest.length >= 3) {
    const items = rest.slice(0, 5).map((p) => {
      const ym = /((?:19|20)\d{2})\s*年\s*(\d{1,2})\s*月/.exec(p);
      const y = /((?:19|20)\d{2})\s*年/.exec(p);
      const q = /(Q[1-4]|第[一二三四]季度|\d{1,2}\s*月)/i.exec(p);
      const m = ym || y || q;
      const when = m ? m[0].replace(/\s+/g, '') : '';
      const body = when ? p.replace(m[0], '').replace(/^[，,、\s]+/, '') : p;
      return { when, title: trimSentence(body, 24), body: '' };
    });
    slides.push({ layout: 'timeline', title, items });
    return slides;
  }

  if (shape === 'cards' && !slides.length) {
    slides.push({
      layout: 'cards',
      title,
      items: rest.slice(0, 6).map((p, i) => ({
        tag: String(i + 1).padStart(2, '0'),
        title: trimSentence(p, 20),
        body: '',
      })),
    });
    return slides;
  }

  // 兜底：要点按每页 4 条分页；最后一页只剩一条时并到上一页做结论条
  const perPage = slides.length ? 3 : 4;
  const pages = [];
  for (let i = 0; i < rest.length; i += perPage) {
    pages.push({ layout: 'bullets', title: title + (i === 0 ? '' : '（续）'), items: rest.slice(i, i + perPage) });
  }
  const tail = pages[pages.length - 1];
  if (pages.length > 1 && tail.items.length === 1) {
    pages[pages.length - 2].takeaway = tail.items[0];
    pages.pop();
  }
  slides.push(...pages);
  return slides;
}

/**
 * 长文档 → 完整 spec：封面 + 目录 + 每章（隔断页 + 内容页）+ 结尾
 * 章节取最浅一级标题，H3 及以下的正文并回上一章；每页带 speaker notes（--no-notes 可关掉）
 */
function fromDocument(text, topic, opts = {}) {
  const sections = splitSections(text);
  if (!sections.length) throw new Error('文档是空的，没有可拆的内容');
  const wantNotes = opts.notes !== false;

  const titleSec = sections.find((s) => s.level === 1 && s.title) || null;
  const title = topic || (titleSec && titleSec.title) || '未命名演示';
  // 文档自己的 H1 是整篇的标题：不进目录、不做隔断页，引言段落留给「背景」页
  const chapters = sections.filter(
    (s) => s !== titleSec && (s.title || s.body || s.tables.length)
  );

  // 只把最浅一级标题当章节，更深的标题（H3 及以下）并回上一章：
  // 否则目录里会混进小节，隔断页也会把一章切成好几段
  const chapterLevel = chapters.reduce(
    (min, s) => (s.title ? Math.min(min, s.level) : min),
    Infinity
  );
  const outline = [];
  chapters.forEach((sec) => {
    if (sec.title && sec.level > chapterLevel && outline.length) {
      const host = outline[outline.length - 1];
      host.body = [host.body, sec.body].filter(Boolean).join('\n');
      host.tables = host.tables.concat(sec.tables);
      return;
    }
    outline.push({ ...sec });
  });

  const tocTitles = outline.map((c, i) => c.title || `第 ${i + 1} 部分`);

  const lead = [titleSec, ...outline]
    .filter(Boolean)
    .map((c) => sentences(c.body)[0])
    .find(Boolean);
  const subtitle = lead ? trimSentence(lead, 42) : '';

  const slides = [
    {
      layout: 'cover',
      kicker: '文档拆页',
      title,
      subtitle,
      author: opts.author,
      date: opts.date,
    },
  ];
  if (tocTitles.length > 1) {
    slides.push({ layout: 'toc', title: '目录', items: tocTitles.slice(0, 8) });
  }

  // 文档引言：H1 下面那段综述单独做「背景」页，不占目录、不编号
  if (titleSec && titleSec.body) {
    const items = keyPoints(titleSec.body, 4).filter(
      (p) => !subtitle || !p.replace(/[。…]/g, '').startsWith(subtitle.replace(/[。…]/g, '').slice(0, 12))
    );
    if (items.length) {
      const page = { layout: 'bullets', title: '背景', items };
      if (wantNotes) page.notes = filterNotes(titleSec.body);
      slides.push(page);
    }
  }

  let number = 0;
  outline.forEach((sec) => {
    const name = sec.title || '背景';
    // `---` 手动分页；<!-- layout: x --> 与 <!-- notes: 讲稿 --> 作用于其后的页组
    const content = [];
    splitPages(sec.body).forEach((g, gi) => {
      const body = g.lines.join('\n');
      const pages = contentSlides(
        { body, tables: gi === 0 ? sec.tables : [], force: g.layout },
        gi === 0 ? name : `${name}（续）`,
        keyPoints(body, 6)
      );
      if (!pages.length) return;
      if (wantNotes) {
        const note = g.notes || filterNotes(body);
        if (note) pages[0].notes = note;
      }
      content.push(...pages);
    });
    const needsDivider = content.length >= 2;

    if (needsDivider) {
      number += 1;
      slides.push({ layout: 'section', number: String(number).padStart(2, '0'), title: name });
    }
    slides.push(...content);
  });

  const end = { layout: 'end', title: '谢谢观看' };
  if (wantNotes) end.note = '以上内容由原文自动拆页生成，请按需调整。';
  slides.push(end);

  const cap = Number(opts.slides) || 24;
  const trimmed = trimToCount(slides, cap);
  const result = { meta: { title, subtitle, language: 'zh-CN' }, slides: trimmed };
  if (opts.author) result.meta.author = opts.author;
  if (opts.theme) result.theme = { name: opts.theme };
  return result;
}

/** 备注用原文，但去掉表格符号与过长的重复换行 */
function filterNotes(body, limit = 420) {
  const t = String(body)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.includes('|'))
    .join('\n');
  return t.length > limit ? `${t.slice(0, limit)}…` : t;
}

/** 超页时先砍隔断页，再从尾部截断（保留封面与结尾） */
function trimToCount(slides, cap) {
  if (slides.length <= cap) return slides;
  let out = slides.filter((s) => s.layout !== 'section');
  if (out.length > cap) {
    const head = out.slice(0, Math.max(2, cap - 1));
    out = head.concat(out[out.length - 1]);
  }
  return out;
}

/** Markdown → spec（保留旧接口，内部走同一套拆页逻辑） */
function fromMarkdown(text, topic, opts = {}) {
  return fromDocument(text, topic, opts);
}

function skeleton(topic, opts) {
  const count = Number(opts.slides) || 10;
  const body = Math.max(1, count - 4);
  const slides = [
    { layout: 'cover', kicker: '汇报', title: topic, subtitle: '把副标题换成一句话结论' },
    { layout: 'toc', title: '目录', items: ['背景与目标', '核心发现', '方案与动作', '下一步'] },
    { layout: 'section', number: '01', title: '背景与目标' },
  ];
  for (let i = 0; i < body; i += 1) {
    slides.push({
      layout: 'bullets',
      title: `待补充：第 ${i + 1} 个要点`,
      items: ['把这里换成真实的结论或数据', '每条尽量是一句可验证的陈述'],
    });
  }
  slides.push({ layout: 'end', title: '谢谢观看' });
  return {
    meta: { title: topic, subtitle: '把副标题换成一句话结论' },
    theme: { name: opts.theme || 'midnight-executive' },
    slides,
  };
}

async function fromLlm(topic, opts) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('未设置 DEEPSEEK_API_KEY，去掉 --llm 或先配置环境变量');

  const slideCount = Number(opts.slides) || 10;
  const prompt = [
    `你是资深商业汇报顾问。请为主题「${topic}」写一份 ${slideCount} 页中文演示大纲。`,
    '只输出 YAML，不要解释，不要代码块。格式如下：',
    'meta: {title, subtitle, author, date, language: zh-CN}',
    'theme: {name: midnight-executive}',
    'slides: 每项必须有 layout，可选 layout：cover/section/bullets/twoCol/cards/kpi/chart/table/timeline/process/compare/quote/end',
    '要求：',
    '1. 第 1 页 cover，最后 1 页 end；中间至少 1 页 kpi、1 页 chart、1 页 bullets；',
    '2. 每页标题是一句结论，不是名词短语；',
    '3. bullets 每页 3-5 条，每条 15-35 字；',
    '4. chart 必须有 labels 与 series（series 里每项含 name 与 values）；',
    '5. 不要编造具体公司名；数字用示例值即可。',
  ].join('\n');

  const res = await fetch(process.env.DEEPSEEK_API_URL || DEFAULT_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      temperature: 0.4,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`模型调用失败：HTTP ${res.status}`);
  const json = await res.json();
  const content = stripFence(json.choices[0].message.content);
  const raw = yaml.load(content);
  if (!raw || !raw.slides) throw new Error('模型返回的内容不是合法 YAML');
  return raw;
}

async function buildOutline(topic, args) {
  let raw;
  let mode;

  if (args.from && typeof args.from === 'string') {
    const file = path.resolve(args.from);
    const ext = path.extname(file).toLowerCase();
    if (!DOC_EXT.has(ext)) {
      throw new Error(`--from 只接受 Markdown / 纯文本（${[...DOC_EXT].join(' ')}），收到 ${ext || '无扩展名'}`);
    }
    raw = fromDocument(fs.readFileSync(file, 'utf8'), topic, args);
    mode = `从 ${ext === '.txt' || ext === '.text' ? '纯文本' : 'Markdown'} 拆页（${args.from}）`;
  } else if (args.llm) {
    raw = await fromLlm(topic, args);
    mode = '模型生成';
  } else {
    raw = skeleton(topic, args);
    mode = '本地骨架（需补内容）';
  }

  raw.meta = Object.assign({ title: topic, language: 'zh-CN' }, raw.meta || {});
  if (args.theme) raw.theme = { name: args.theme };

  const out = args.o && typeof args.o === 'string'
    ? path.resolve(args.o)
    : path.join(process.cwd(), `${slugify(topic, 'deck')}.deck.yaml`);

  const header = `# 由 slideforge new 生成（${mode}）\n# 改完执行：slideforge build ${path.basename(out)}\n\n`;
  fs.writeFileSync(out, header + yaml.dump(raw, { lineWidth: 120, noRefs: true }), 'utf8');
  console.log(`spec → ${out}`);
  console.log(`生成 ${(raw.slides || []).length} 页（${mode}）`);

  const counts = {};
  (raw.slides || []).forEach((s) => {
    counts[s.layout] = (counts[s.layout] || 0) + 1;
  });
  console.log('版式分布：' + Object.entries(counts).map(([k, v]) => `${k}×${v}`).join('  '));
}

module.exports = {
  buildOutline,
  fromDocument,
  fromMarkdown,
  skeleton,
  fromLlm,
  chartableTable,
  contentSlides,
};
