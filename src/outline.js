/**
 * 大纲生成：
 *   1) --from doc.md   把 Markdown 文档拆成页面（纯本地，不调模型）
 *   2) --llm           调 DeepSeek 生成完整大纲（需要 DEEPSEEK_API_KEY）
 *   3) 都没有           生成一份可编辑的骨架 spec，提示用户补内容
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { slugify } = require('./spec');

const DEFAULT_API = 'https://api.deepseek.com/chat/completions';

function stripFence(text) {
  return String(text).replace(/^```[a-zA-Z]*\s*/m, '').replace(/```\s*$/m, '').trim();
}

/** Markdown -> spec：一级标题做封面，二级标题做章节，列表做要点 */
function fromMarkdown(text, topic) {
  const lines = text.split(/\r?\n/);
  let title = topic;
  const sections = [];
  let cur = null;

  lines.forEach((raw) => {
    const line = raw.trim();
    if (/^#\s+/.test(line)) {
      if (!title) title = line.replace(/^#\s+/, '');
      else sections.push({ title: line.replace(/^#\s+/, ''), items: [] });
      cur = sections[sections.length - 1] || null;
    } else if (/^##\s+/.test(line)) {
      cur = { title: line.replace(/^##\s+/, ''), items: [] };
      sections.push(cur);
    } else if (/^[-*]\s+/.test(line)) {
      if (!cur) {
        cur = { title: '要点', items: [] };
        sections.push(cur);
      }
      cur.items.push(line.replace(/^[-*]\s+/, ''));
    } else if (line && cur && !cur.items.length) {
      cur.items.push(line);
    }
  });

  const slides = [
    { layout: 'cover', kicker: '自动生成', title: title || '未命名演示' },
    { layout: 'toc', title: '目录', items: sections.map((s) => s.title) },
  ];

  sections.forEach((s, i) => {
    if (s.items.length) {
      slides.push({ layout: 'bullets', title: s.title, items: s.items.slice(0, 6) });
    } else {
      slides.push({ layout: 'section', number: String(i + 1).padStart(2, '0'), title: s.title });
    }
  });
  slides.push({ layout: 'end', title: '谢谢观看' });

  return { meta: { title: title || '未命名演示' }, slides };
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
    raw = fromMarkdown(fs.readFileSync(path.resolve(args.from), 'utf8'), topic);
    mode = `从 Markdown 拆分（${args.from}）`;
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
}

module.exports = { buildOutline, fromMarkdown, skeleton, fromLlm };
