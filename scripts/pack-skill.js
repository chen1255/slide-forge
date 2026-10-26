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
 * engine/ 内嵌 bin、src 与生产依赖，装到目标机器后无需联网、无需再跑 npm install。
 */
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const ROOT = path.resolve(__dirname, '..');
const SRC_SKILL = path.join(ROOT, 'skills', 'slide-forge');
const DIST = path.join(ROOT, 'dist');
const OUT_DIR = path.join(DIST, 'slide-forge');
const ZIP_PATH = path.join(DIST, 'slide-forge.zip');

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

  // 2. 内嵌引擎：bin + src + package.json + 生产依赖
  const ENGINE = path.join(OUT_DIR, 'engine');
  fs.mkdirSync(ENGINE, { recursive: true });
  copyTree(path.join(ROOT, "bin"), path.join(ENGINE, "bin"));
  copyTree(path.join(ROOT, "src"), path.join(ENGINE, "src"));
  // bin/slideforge.js 依赖 ../scripts/validate，必须一并内嵌
  fs.mkdirSync(path.join(ENGINE, 'scripts'), { recursive: true });
  fs.copyFileSync(
    path.join(ROOT, 'scripts', 'validate.js'),
    path.join(ENGINE, 'scripts', 'validate.js')
  );
  fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(ENGINE, 'package.json'));
  fs.copyFileSync(path.join(ROOT, 'LICENSE'), path.join(ENGINE, 'LICENSE'));

  const rootModules = path.join(ROOT, 'node_modules');
  if (!fs.existsSync(rootModules)) {
    console.error('✗ 缺少 node_modules，先执行 npm ci');
    process.exit(1);
  }
  copyTree(rootModules, path.join(ENGINE, "node_modules"));

  // 3. 冒烟：内嵌引擎能不能被 require 起来
  const engineBin = path.join(ENGINE, 'bin', 'slideforge.js');
  if (!fs.existsSync(engineBin)) {
    console.error('✗ 内嵌引擎缺少 bin/slideforge.js');
    process.exit(1);
  }

  // 4. 打包
  const size = await zip(OUT_DIR, ZIP_PATH);
  const stats = countFiles(OUT_DIR);

  console.log(`✓ 技能目录 ${path.relative(ROOT, OUT_DIR)}`);
  console.log(`  ${stats.n} 个文件，${kb(stats.bytes)}（含内嵌依赖）`);
  console.log(`✓ 压缩包 ${path.relative(ROOT, ZIP_PATH)}   ${kb(size)}`);
  console.log(`\n下一步：\n  node dist/slide-forge/engine/bin/slideforge.js themes\n  python <skill-creator>/scripts/package_skill.py dist/slide-forge`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
