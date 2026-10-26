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

const DEMO = path.join(__dirname, '..', 'examples', 'demo.deck.yaml');

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
