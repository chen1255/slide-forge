#!/usr/bin/env node
/**
 * 把 skills/slide-forge 组装成自包含的技能包，并打成可分发的 zip。
 *
 *   node scripts/pack-skill.js
 *
 * 产物：
 *   dist/slide-forge/          技能目录（SKILL.md + references/ + assets/ + engine/）
 *   dist/slide-forge.zip       提交/分发用的压缩包，顶层目录为 slide-forge/
 *
 * engine/ 只放「一个文件」：用 esbuild 把 bin + src + 生产依赖压成
 * engine/bin/slideforge.js。早期版本是把 node_modules 整个拷进去，会有 400+ 个文件，
 * 技能市场的上传口有文件数上限（报「文件数量超出限制」），所以改成单文件内联。
 * 装到目标机器后依然无需联网、无需 npm install。
 */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const JSZip = require('jszip');

const ROOT = path.resolve(__dirname, '..');
const SRC_SKILL = path.join(ROOT, 'skills', 'slide-forge');
const DIST = path.join(ROOT, 'dist');
const OUT_DIR = path.join(DIST, 'slide-forge');
const ZIP_PATH = path.join(DIST, 'slide-forge.zip');

// 技能市场对上传包的文件数有上限，超过这个数就报警
const FILE_BUDGET = 40;

// 只在拷贝技能源目录的「直接子项」时生效；node_modules 内部同名目录（如 pptxgenjs/dist）必须保留
const SKIP_TOP = new Set(['.git', 'out', 'dist', 'node_modules', '.DS_Store']);

function copyTree(from, to, depth = 0) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (depth === 0 && SKIP_TOP.has(entry.name)) continue;
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst, depth + 1);
    else fs.copyFileSync(src, dst);
  }
}

function countFiles(dir) {
  let n = 0;
  let bytes = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = countFiles(p);
      n += sub.n;
      bytes += sub.bytes;
    } else {
      n += 1;
      bytes += fs.statSync(p).size;
    }
  }
  return { n, bytes };
}

async function zip(skillDir, zipPath) {
  const zipFile = new JSZip();
  const base = path.basename(skillDir);
  (function walk(dir, rel) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      const r = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(p, r);
      else zipFile.file(r, fs.readFileSync(p));
    }
  })(skillDir, base);
  const buf = await zipFile.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
  fs.writeFileSync(zipPath, buf);
  return buf.length;
}

function kb(n) {
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

async function main() {
  if (!fs.existsSync(path.join(SRC_SKILL, 'SKILL.md'))) {
    console.error(`✗ 未找到 ${path.join(SRC_SKILL, 'SKILL.md')}`);
    process.exit(1);
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  // 1. 技能自身的文档与素材
  copyTree(SRC_SKILL, OUT_DIR);

  // 2. 内嵌引擎：bin + src + 生产依赖压成单文件，不再拷 node_modules
  const ENGINE = path.join(OUT_DIR, 'engine');
  fs.mkdirSync(path.join(ENGINE, 'bin'), { recursive: true });
  const engineBin = path.join(ENGINE, 'bin', 'slideforge.js');
  esbuild.buildSync({
    entryPoints: [path.join(ROOT, 'bin', 'slideforge.js')],
    outfile: engineBin,
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    absWorkingDir: ROOT,
    legalComments: 'none',
    minify: true,
    banner: {
      js: '// slide-forge engine bundle — 由 scripts/pack-skill.js 生成，请勿手改。源码：github.com/chen1255/slide-forge',
    },
    logLevel: 'warning',
  });
  fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(ENGINE, 'package.json'));
  fs.copyFileSync(path.join(ROOT, 'LICENSE'), path.join(ENGINE, 'LICENSE'));

  // 3. 冒烟：单文件引擎确实被压出来了，且能独立跑起来（不依赖任何 node_modules）
  if (!fs.existsSync(engineBin)) {
    console.error('✗ 内嵌引擎缺少 bin/slideforge.js');
    process.exit(1);
  }
  const smoke = require('child_process').spawnSync(
    process.execPath,
    [engineBin, 'themes'],
    { cwd: path.dirname(engineBin), encoding: 'utf8' }
  );
  if (smoke.status !== 0) {
    console.error('✗ 单文件引擎启动失败：\n' + (smoke.stderr || '').slice(0, 800));
    process.exit(1);
  }

  // 4. 打包
  const size = await zip(OUT_DIR, ZIP_PATH);
  const stats = countFiles(OUT_DIR);

  console.log(`✓ 技能目录 ${path.relative(ROOT, OUT_DIR)}`);
  console.log(`  ${stats.n} 个文件，${kb(stats.bytes)}（引擎已内联为单文件）`);
  console.log(`✓ 压缩包 ${path.relative(ROOT, ZIP_PATH)}   ${kb(size)}`);
  if (stats.n > FILE_BUDGET) {
    console.warn(`! 文件数 ${stats.n} 超过预算 ${FILE_BUDGET}，部分上传口会报「文件数量超出限制」`);
  } else {
    console.log(`  文件数在预算内（≤ ${FILE_BUDGET}）`);
  }
  console.log(`\n下一步：\n  node dist/slide-forge/engine/bin/slideforge.js themes\n  python scripts/make-zips.py`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
