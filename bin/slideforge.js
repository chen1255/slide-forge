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
const { inspectTemplate, applyTemplate, templateWarnings, paletteFromTemplate } = require('../src/template');
const { geoFor } = require('../src/kit');
const { formatTable } = require('../src/contrast');

/** 在扩展名前插入后缀：out/x.pptx -> out/x-4x3.pptx */
function addSuffix(file, suffix) {
  return file.replace(/(\.[^\\/]+)$/, `${suffix}$1`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--no-html') args.html = false;
    else if (a === '--no-notes') args.notes = false;
    else if (a === '--llm') args.llm = true;
    else if (a === '--contrast') args.contrast = true;
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

  // 画布比例：命令行覆盖 spec，并给默认文件名加后缀，避免覆盖 16:9 产物
  if (args.aspect && typeof args.aspect === 'string') {
    const geo = geoFor(args.aspect);
    spec.geo = geo;
    spec.meta.aspect = geo.aspect;
    const sfx = geo.aspect === '4:3' ? '-4x3' : '-16x9';
    spec.output.pptx = addSuffix(spec.output.pptx, sfx);
    spec.output.html = addSuffix(spec.output.html, sfx);
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
      '  build ... --aspect    改画布比例：16:9（默认）或 4:3',
      '  build ... --template  套用 .pptx/.potx 的品牌色与字体',
      '  check <spec.yaml>     校验 spec 与版面（越界、文字溢出、配色对比度）',
      '  check ... --contrast  额外打印 11 组前景/背景的对比度明细',
      '  doctor [spec.yaml]    体检环境：Node、依赖、字体是否已装、能否导 PNG',
      '  svg <spec.yaml>       每页导出一张独立 .svg（不依赖 PowerPoint，矢量可缩放）',
      '  profile list          查看已保存的品牌 profile',
      '  profile save <名字>   存一套品牌：--template 品牌.pptx 或 --from spec.yaml',
      '  profile show|rm <名字> 查看颜色明细 / 删除',
      '  themes                列出内置主题',
      '  template <file>       查看模板的配色、字体与版式',
      '  new "<主题>"          生成 spec 初稿（--llm 用模型写内容）',
      '  new "<主题>" --from   把 Markdown 文档转成 spec',
      '    --slides N          页数上限（默认 24）',
      '    --author <名字>      封面署名',
      '    --no-notes          不生成演讲者备注',
    ].join('\n'));
    return;
  }

  if (cmd === 'doctor') {
    const { runDoctor, formatReport } = require('../src/doctor');
    let fonts = [];
    if (target) {
      // 带上具体 spec 时，检查它真正会用到的字体
      const spec = loadSpec(target);
      const t = spec.theme;
      fonts = [t.fonts.heading, t.fonts.body].filter(Boolean);
      fonts = [...new Set(fonts)];
    } else {
      const { THEMES } = require('../src/theme');
      fonts = [...new Set(Object.values(THEMES).flatMap((t) => [t.fonts.heading, t.fonts.body]))];
    }
    const report = runDoctor({ fonts, outDir: path.resolve('out') });
    console.log(formatReport(report));
    const failed = report.checks.some((c) => c.ok === false)
      || report.office.ok === false
      || report.fonts.some((f) => f.status === 'missing');
    if (failed) process.exitCode = 1;
    return;
  }

  if (cmd === 'svg') {
    if (!target) throw new Error('请给出 spec 文件路径');
    const { renderSvg } = require('../src/render-svg');
    const spec = loadSpec(target);
    if (args.aspect) {
      spec.geo = geoFor(args.aspect);
      spec.meta.aspect = spec.geo.aspect;
    }
    const dir = args.out || path.join(spec.output.dir, 'svg');
    const files = renderSvg(spec, dir);
    console.log(`SVG  → ${path.resolve(dir)}`);
    console.log(`共 ${files.length} 页，每页一个文件（矢量，浏览器可直接打开或另存 PNG）`);
    return;
  }

  if (cmd === 'profile') {
    const { listProfiles, getProfile, saveProfile, removeProfile, profileDir } = require('../src/profile');
    const sub = args._[1];
    const name = args._[2];

    if (!sub || sub === 'list') {
      const list = listProfiles();
      console.log(`profile 目录：${profileDir()}`);
      if (!list.length) {
        console.log('  （空）用 profile save <名字> --template 公司模板.pptx 存一套');
        return;
      }
      list.forEach((p) => {
        const src = p.source ? `  ← ${p.source}` : '';
        console.log(`  ${p.name.padEnd(20)} ${String(p.label).padEnd(12)} ${p.paletteKeys} 色槽${src}`);
      });
      return;
    }

    if (sub === 'show') {
      const p = getProfile(name);
      if (!p) throw new Error(`没有名为 "${name}" 的 profile，用 profile list 看已有的`);
      console.log(`${p.name}（${p.label}）`);
      Object.entries(p.palette).forEach(([k, v]) => console.log(`  ${k.padEnd(14)} ${v}`));
      if (Object.keys(p.fonts).length) console.log(`  字体           ${JSON.stringify(p.fonts)}`);
      if (Object.keys(p.sizes).length) console.log(`  字号           ${JSON.stringify(p.sizes)}`);
      return;
    }

    if (sub === 'save') {
      if (!name) throw new Error('用法：profile save <名字> --template 品牌.pptx  或  --from spec.yaml');
      let palette = null;
      let fonts = {};
      let sizes = {};
      let source = '';

      if (args.template) {
        const info = await inspectTemplate(args.template);
        palette = paletteFromTemplate(info);
        fonts = { heading: info.fonts.heading, body: info.fonts.body };
        source = path.basename(args.template);
        templateWarnings(info).forEach((w) => console.log(`[提示] ${w}`));
      } else if (args.from) {
        const spec = loadSpec(args.from);
        palette = spec.theme.palette;
        fonts = spec.theme.fonts;
        sizes = spec.theme.sizes;
        source = path.basename(args.from);
      } else {
        throw new Error('请指定来源：--template 品牌.pptx 或 --from spec.yaml');
      }

      const file = saveProfile(name, { label: name, palette, fonts, sizes, source });
      console.log(`已保存 ${file}`);
      console.log(`之后在 spec 里写 theme: ${name} 即可使用`);
      return;
    }

    if (sub === 'rm') {
      if (!name) throw new Error('用法：profile rm <名字>');
      const ok = removeProfile(name);
      console.log(ok ? `已删除 ${name}` : `没有名为 "${name}" 的 profile`);
      return;
    }

    throw new Error(`未知子命令 "${sub}"，可用：list / show / save / rm`);
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
    const { spec, errors, warnings, contrast } = validateSpecFile(target, { aspect: args.aspect });
    console.log(
      `检查 ${spec.slides.length} 页，主题 ${spec.theme.name}，画布 ${spec.meta.aspect}`
    );
    if (args.contrast) console.log(formatTable(contrast.table));
    warnings.forEach((w) => console.log(`  ! ${w}`));
    errors.forEach((e) => console.log(`  x ${e}`));
    if (!errors.length && !warnings.length) {
      console.log(`  全部通过，配色对比度 ${contrast.table.length} 项达标`);
    }
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
