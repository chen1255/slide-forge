#!/usr/bin/env node
/**
 * slideforge 命令行入口
 *
 *   slideforge build <spec.yaml> [--template brand.pptx] [--pptx out.pptx] [--html out.html] [--no-html]
 *   slideforge check <spec.yaml>
 *   slideforge themes
 *   slideforge template <brand.pptx>
 *   slideforge new "<主题>" [-o spec.yaml] [--slides 10] [--theme name] [--llm]
 *   slideforge new "<主题>" --from doc.md
 */
const path = require('path');
const { loadSpec } = require('../src/spec');
const { renderPptx } = require('../src/render-pptx');
const { validateSpecFile } = require('../scripts/validate');
const { inspectTemplate, applyTemplate, templateWarnings } = require('../src/template');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--no-html') args.html = false;
    else if (a === '--llm') args.llm = true;
    else if (/^-[a-zA-Z]$/.test(a)) {
      const key = a.slice(1);
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) { args[key] = next; i += 1; }
      else args[key] = true;
    } else if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) args[key] = true;
      else { args[key] = next; i += 1; }
    } else args._.push(a);
  }
  return args;
}

async function build(file, args) {
  const spec = loadSpec(file);
  const notes = [];

  if (args.template && typeof args.template === 'string') {
    const info = await inspectTemplate(args.template);
    applyTemplate(spec, info);
    notes.push(...templateWarnings(info));
    notes.push(`已套用模板配色${info.fonts.body ? '与字体' : ''}：${path.basename(args.template)}`);
  }

  if (args.pptx && typeof args.pptx === 'string') spec.output.pptx = path.resolve(args.pptx);
  if (args.html && typeof args.html === 'string') spec.output.html = path.resolve(args.html);

  const pptxPath = await renderPptx(spec, path.resolve(spec.output.pptx));
  console.log(`PPTX  → ${pptxPath}`);

  if (args.html !== false) {
    const { renderHtml } = require('../src/render-html');
    const htmlPath = await renderHtml(spec, path.resolve(spec.output.html));
    console.log(`HTML  → ${htmlPath}`);
  }
  notes.forEach((n) => console.log(`[提示] ${n}`));
  console.log(`共 ${spec.slides.length} 页`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  const target = args._[1];

  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log([
      'slideforge <命令>',
      '',
      '  build <spec.yaml>     生成 PPTX 与 HTML（--no-html 只出 PPTX）',
      '  build ... --template  套用 .pptx/.potx 的品牌色与字体',
      '  check <spec.yaml>     校验 spec 与版面（越界、文字溢出）',
      '  themes                列出内置主题',
      '  template <file>       查看模板的配色、字体与版式',
      '  new "<主题>"          生成 spec 初稿（--llm 用模型写内容）',
      '  new "<主题>" --from   把 Markdown 文档转成 spec',
    ].join('\n'));
    return;
  }

  if (cmd === 'themes') {
    const { THEMES } = require('../src/theme');
    Object.keys(THEMES).forEach((k) => console.log(`${k.padEnd(20)} ${THEMES[k].label}`));
    return;
  }

  if (cmd === 'template') {
    if (!target) throw new Error('请给出模板文件路径');
    const info = await inspectTemplate(target);
    console.log(`尺寸：${info.size.widthIn} × ${info.size.heightIn} in`);
    console.log(`字体：标题 ${info.fonts.heading || '-'} / 正文 ${info.fonts.body || '-'}`);
    console.log('配色：');
    Object.keys(info.scheme).forEach((k) => console.log(`  ${k.padEnd(8)} #${info.scheme[k]}`));
    console.log(`版式：${info.layouts.length} 个`);
    info.layouts.slice(0, 12).forEach((l) => console.log(`  ${l.file.padEnd(20)} ${l.name}`));
    templateWarnings(info).forEach((w) => console.log(`[提示] ${w}`));
    return;
  }

  if (cmd === 'check') {
    if (!target) throw new Error('请给出 spec 文件路径');
    const { spec, errors, warnings } = validateSpecFile(target);
    console.log(`检查 ${spec.slides.length} 页，主题 ${spec.theme.name}`);
    warnings.forEach((w) => console.log(`  ! ${w}`));
    errors.forEach((e) => console.log(`  x ${e}`));
    if (!errors.length && !warnings.length) console.log('  全部通过');
    if (errors.length) process.exit(1);
    return;
  }

  if (cmd === 'build') {
    if (!target) throw new Error('请给出 spec 文件路径');
    await build(target, args);
    return;
  }

  if (cmd === 'new') {
    const { buildOutline } = require('../src/outline');
    if (!target) throw new Error('请给出主题，例如：slideforge new "2026 Q3 经营复盘"');
    await buildOutline(target, args);
    return;
  }

  throw new Error(`未知命令 "${cmd}"`);
}

main().catch((err) => {
  console.error(`\n[slide-forge] ${err.message}`);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
