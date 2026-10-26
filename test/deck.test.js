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
