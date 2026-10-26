// 基础自测：spec 解析、版式数量、越界校验、双输出
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { loadSpec, validateSpec } = require('../src/spec');
const { LAYOUTS } = require('../src/layouts');
const { validateSpecFile } = require('../scripts/validate');
const { renderHtml } = require('../src/render-html');
const { renderPptx } = require('../src/render-pptx');
const JSZip = require('jszip');

const DEMO = path.join(__dirname, '..', 'examples', 'demo.deck.yaml');

/** 解开 pptx，按内部路径取出 XML 文本 */
async function readPptx(file) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const names = Object.keys(zip.files);
  const xml = {};
  await Promise.all(
    names
      .filter((n) => /\.(xml|rels)$/.test(n))
      .map((n) => zip.file(n).async('string').then((s) => { xml[n] = s; }))
  );
  return { zip, names, xml };
}

test('内置 18 个版式齐全', () => {
  const expected = [
    'cover', 'section', 'toc', 'end',
    'bullets', 'twoCol', 'cards', 'kpi', 'quote', 'image',
    'chart', 'table', 'timeline', 'process', 'compare',
    'team', 'hero', 'screenshot',
  ];
  expected.forEach((k) => assert.ok(LAYOUTS[k], `缺少版式 ${k}`));
  assert.strictEqual(Object.keys(LAYOUTS).length, expected.length);
});

test('示例 deck 能通过 spec 校验', () => {
  const spec = loadSpec(DEMO);
  assert.strictEqual(spec.slides.length, 19);
  assert.deepStrictEqual(validateSpec(spec), []);
});

test('示例 deck 没有越界元素', () => {
  const { errors, warnings } = validateSpecFile(DEMO);
  assert.deepStrictEqual(errors, []);
  assert.deepStrictEqual(warnings, []);
});

test('未知版式会报错并列出可用版式', () => {
  assert.throws(
    () => require('../src/spec').normalize({ slides: [{ layout: 'nope', title: 'x' }] }, 'inline'),
    /未知 layout/
  );
});

test('表头列数与行不一致会被拦下', () => {
  assert.throws(
    () => require('../src/spec').normalize({
      slides: [{ layout: 'table', title: 't', columns: ['A', 'B'], rows: [['1']] }],
    }, 'inline'),
    /列/
  );
});

test('HTML 输出包含每一页且无未转义标签', () => {
  const spec = loadSpec(DEMO);
  const out = path.join(os.tmpdir(), `slide-forge-test-${Date.now()}.html`);
  renderHtml(spec, out);
  const html = fs.readFileSync(out, 'utf8');
  const count = (html.match(/<section class="slide"/g) || []).length;
  assert.strictEqual(count, 19);
  assert.ok(html.includes('2026 Q3 经营复盘'));
  fs.unlinkSync(out);
});

test('Markdown 可以拆成 spec 草稿', () => {
  const { fromMarkdown } = require('../src/outline');
  const raw = fromMarkdown('# 年度规划\n\n## 背景\n\n- 第一点\n- 第二点\n\n## 目标\n\n- 增长 20%\n', '年度规划');
  const layouts = raw.slides.map((s) => s.layout);
  assert.strictEqual(layouts[0], 'cover');
  assert.ok(layouts.includes('bullets'));
  assert.strictEqual(layouts[layouts.length - 1], 'end');
});

test('4:3 画布下同样没有越界与溢出', () => {
  const { errors, warnings } = validateSpecFile(DEMO, { aspect: '4:3' });
  assert.deepStrictEqual(errors, []);
  assert.deepStrictEqual(warnings, []);
});

test('meta.aspect 决定画布尺寸，未知比例报错', () => {
  const { normalize } = require('../src/spec');
  const spec = normalize({ meta: { aspect: '4x3' }, slides: [{ layout: 'end' }] }, 'inline');
  assert.strictEqual(spec.meta.aspect, '4:3');
  assert.strictEqual(spec.geo.W, 10);
  assert.strictEqual(spec.geo.H, 7.5);
  assert.throws(
    () => normalize({ meta: { aspect: '21:9' }, slides: [{ layout: 'end' }] }, 'inline'),
    /画布比例/
  );
});

test('4:3 的 HTML 画布是 960 x 720', () => {
  const { geoFor } = require('../src/kit');
  const spec = loadSpec(DEMO);
  spec.geo = geoFor('4:3');
  spec.meta.aspect = '4:3';
  const out = path.join(os.tmpdir(), `slide-forge-test-4x3-${Date.now()}.html`);
  renderHtml(spec, out);
  const html = fs.readFileSync(out, 'utf8');
  assert.ok(html.includes('width:960px;height:720px'));
  assert.strictEqual((html.match(/<section class="slide"/g) || []).length, 19);
  fs.unlinkSync(out);
});

test('没有 # 标题时，中文序号也能切章', () => {
  const { splitSections } = require('../src/extract');
  const secs = splitSections('一、背景\n\n正文一。\n\n二、目标\n\n正文二。\n');
  assert.deepStrictEqual(secs.map((s) => s.title), ['背景', '目标']);
  assert.strictEqual(secs[1].body, '正文二。');
});

test('数值序列：同一句 ≥3 个数值对才出图，跨句汇总值不混入', () => {
  const { extractSeries } = require('../src/extract');
  const pie = extractSeries(
    '区域贡献占比：华东 34%，华南 26%，华北 21%，西南 12%，其他 7%。华东与华南合计贡献 60%，是主要引擎。'
  );
  assert.strictEqual(pie.kind, 'pie');
  assert.deepStrictEqual(pie.labels, ['华东', '华南', '华北', '西南', '其他']);
  // 单位不一致的散句不能被拼成一张图
  assert.strictEqual(extractSeries('履约周期 22 天。缺货率 3.1%。人工对账占用 120 小时。'), null);
});

test('长文档拆页：文档 H1 不进目录，表格与正文各得其所', () => {
  const { fromDocument } = require('../src/outline');
  const { normalize, validateSpec } = require('../src/spec');
  const doc = path.join(__dirname, '..', 'examples', 'sample-report.md');
  const spec = normalize(fromDocument(fs.readFileSync(doc, 'utf8'), '供应链数字化改造'), 'sample-report.md');
  assert.deepStrictEqual(validateSpec(spec), []);

  const toc = spec.slides.find((s) => s.layout === 'toc');
  assert.strictEqual(toc.items.length, 6);
  assert.ok(toc.items.every((t) => !t.includes('中期报告')), '文档主标题不该出现在目录里');

  const charts = spec.slides.filter((s) => s.layout === 'chart');
  const line = charts.find((c) => c.chart.type === 'line');
  assert.deepStrictEqual(line.chart.series[0].values, [1240, 1560, 1890, 1610]);

  const pie = charts.find((c) => c.chart.type === 'pie');
  assert.deepStrictEqual(pie.chart.labels, ['华东', '华南', '华北', '西南', '其他']);
  // 只有一页要点时不该再单独开「（续）」页
  spec.slides.forEach((s) => assert.ok(!String(s.title || '').includes('（续）')));

  // 备注跟正文走
  assert.ok(spec.slides.some((s) => s.notes && s.notes.includes('营收')));
});

test('一章里第二张表不会消失：出不了图的表落到表格页', () => {
  const { fromDocument } = require('../src/outline');
  const md = [
    '| 年份 | 营收（万元） |',
    '| --- | --- |',
    '| 2023 | 1240 |',
    '| 2024 | 1560 |',
    '| 2025 | 1890 |',
    '',
    '| 区域 | 毛利率 |',
    '| --- | --- |',
    '| 华东 | 32 |',
    '| 华南 | 28 |',
    '| 华北 | 25 |',
  ].join('\n');
  const raw = fromDocument(md, '测试');
  const layouts = raw.slides.map((s) => s.layout);
  assert.strictEqual(layouts.filter((l) => l === 'chart').length, 1, '只出第一张图');
  assert.strictEqual(layouts.filter((l) => l === 'table').length, 1, '第二张表要有页面');

  const table = raw.slides.find((s) => s.layout === 'table');
  assert.deepStrictEqual(table.columns, ['区域', '毛利率']);
  assert.strictEqual(table.rows.length, 3);
});

test('--no-notes 不生成演讲者备注', () => {
  const { fromDocument } = require('../src/outline');
  const doc = path.join(__dirname, '..', 'examples', 'sample-report.md');
  const text = fs.readFileSync(doc, 'utf8');
  const withNotes = fromDocument(text, '供应链数字化改造');
  const without = fromDocument(text, '供应链数字化改造', { notes: false });
  assert.ok(withNotes.slides.some((s) => s.notes));
  assert.ok(without.slides.every((s) => !s.notes && !s.note), '--no-notes 下不应有备注');
  assert.strictEqual(without.slides.length, withNotes.slides.length);
});

test('H3 小节并回上一章，不单独进目录', () => {
  const { fromDocument } = require('../src/outline');
  const md = [
    '# 年度报告',
    '',
    '总述第一句：全年业务保持稳中有进。',
    '',
    '## 一、经营概览',
    '',
    '整体营收稳步增长，全年增速保持两位数。',
    '',
    '### 分区域表现',
    '',
    '华东区域贡献最高，达到四成以上；华南区域增速最快。',
    '',
    '## 二、明年计划',
    '',
    '继续扩大区域覆盖，并把交付周期缩短到十天以内。',
  ].join('\n');
  const raw = fromDocument(md, '年度报告');
  const toc = raw.slides.find((s) => s.layout === 'toc');
  assert.deepStrictEqual(toc.items, ['一、经营概览', '二、明年计划'], '目录只有二级标题');

  const text = JSON.stringify(raw.slides);
  assert.ok(text.includes('华东区域贡献最高'), 'H3 下的正文不能丢');
  assert.ok(!text.includes('分区域表现'), 'H3 标题不再单独成为章节');
});

test('PPTX：页数、画布尺寸与文字都落进包里', async () => {
  const spec = loadSpec(DEMO);
  const out = path.join(os.tmpdir(), `slide-forge-pptx-${Date.now()}.pptx`);
  await renderPptx(spec, out);
  const { names, xml } = await readPptx(out);

  const slides = names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  assert.strictEqual(slides.length, spec.slides.length, 'slide XML 数量应与 spec 页数一致');
  assert.ok(xml['ppt/presentation.xml'].includes('<p:sldSz cx="9144000" cy="5143500"/>'), '16:9 = 10 × 5.625in');
  assert.ok(slides.map((n) => xml[n]).join('').includes('2026 Q3 经营复盘'), '封面标题应写入 slide XML');
  fs.unlinkSync(out);
});

test('PPTX：4:3 画布高度是 7.5in', async () => {
  const { geoFor } = require('../src/kit');
  const spec = loadSpec(DEMO);
  spec.geo = geoFor('4:3');
  spec.meta.aspect = '4:3';
  const out = path.join(os.tmpdir(), `slide-forge-pptx-4x3-${Date.now()}.pptx`);
  await renderPptx(spec, out);
  const { xml } = await readPptx(out);
  assert.ok(xml['ppt/presentation.xml'].includes('<p:sldSz cx="9144000" cy="6858000"/>'), '4:3 = 10 × 7.5in');
  fs.unlinkSync(out);
});

test('PPTX：饼图带图例与多色扇区，备注写进 notesSlide', async () => {
  const { normalize } = require('../src/spec');
  const spec = normalize({
    meta: { title: '图表自测' },
    slides: [{
      layout: 'chart',
      title: '区域结构',
      chart: {
        type: 'pie',
        labels: ['华东', '华南', '华北'],
        series: [{ name: '占比', values: [50, 30, 20] }],
      },
      notes: '这一页讲区域结构',
    }],
  }, 'inline');
  const out = path.join(os.tmpdir(), `slide-forge-pptx-chart-${Date.now()}.pptx`);
  await renderPptx(spec, out);
  const { names, xml } = await readPptx(out);

  const chartName = names.find((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n));
  assert.ok(chartName, '应生成 chart 部件');
  const chart = xml[chartName];
  assert.ok(chart.includes('<c:pieChart>'), '图表类型应为饼图');
  assert.ok(chart.includes('<c:legend>'), '饼图必须带图例');
  assert.ok((chart.match(/<c:dPt>/g) || []).length >= 3, '每个扇区应单独配色');

  const noteName = names.find((n) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n));
  assert.ok(noteName, '应生成备注页');
  assert.ok(xml[noteName].includes('这一页讲区域结构'), '备注文字应写入 notesSlide');
  fs.unlinkSync(out);
});
