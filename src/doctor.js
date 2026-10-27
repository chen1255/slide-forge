/**
 * 环境体检：把「跑起来才发现」的问题提前到开工前
 *
 * 重点解决两类静默失败：
 *   1. 字体名在 spec 里写了、本机没装 → 播放器回退到默认字体，不报错
 *   2. 想导 PNG 但本机没有 PowerPoint → qa-render.ps1 直接失败
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * 确定的别名：中文名与磁盘文件名一一对应，且 Office 里两种写法都认
 * （微软雅黑 / Microsoft YaHei 是同一个家族，家族名不变）
 */
const ALIASES = {
  微软雅黑: ['msyh'],
  '微软雅黑 light': ['msyhl'],
  'microsoft yahei': ['msyh'],
  黑体: ['simhei'],
  宋体: ['simsun'],
  新宋体: ['nsimsun'],
  楷体: ['simkai'],
  仿宋: ['simfang'],
  等线: ['deng'],
  arial: ['arial'],
  calibri: ['calibri'],
  'helvetica neue': ['helvetica'],
  helvetica: ['helvetica'],
  georgia: ['georgia'],
  'times new roman': ['times'],
  verdana: ['verdana'],
  tahoma: ['tahoma'],
  consolas: ['consola'],
};

/**
 * 跨命名体系的等价字体：字体本身在，但字体家族名不叫 spec 里写的中文名，
 * Office 按家族名查找仍会回退，所以只能报「疑似」，不能给安心感
 * （思源黑体 = Source Han Sans，国内发行版常装成 Noto Sans SC）
 */
const ALIASES_EQUIVALENT = {
  思源黑体: ['notosanssc', 'sourcehansans', 'notosanscjk'],
  '思源黑体 cn': ['notosanssc', 'sourcehansanssc', 'notosanscjk'],
  思源宋体: ['notoserifsc', 'sourcehanserif', 'notoserifcjk'],
  '思源宋体 cn': ['notoserifsc', 'sourcehanserifsc', 'notoserifcjk'],
  'source han sans': ['sourcehansans', 'notosanssc'],
  'source han serif': ['sourcehanserif', 'notoserifsc'],
  苹方: ['pingfang'],
  '苹方-简': ['pingfang'],
  华文黑体: ['stheiti'],
};

function fontDirs() {
  const home = os.homedir();
  if (process.platform === 'win32') {
    const win = process.env.WINDIR || 'C:\\Windows';
    return [
      path.join(win, 'Fonts'),
      path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'Microsoft', 'Windows', 'Fonts'),
    ];
  }
  if (process.platform === 'darwin') {
    return ['/System/Library/Fonts', '/Library/Fonts', path.join(home, 'Library', 'Fonts')];
  }
  return ['/usr/share/fonts', '/usr/local/share/fonts', path.join(home, '.fonts'), path.join(home, '.local', 'share', 'fonts')];
}

/** 递归收集字体文件名（小写、去扩展名），作为可用的「字体指纹」 */
function collectFontNames(dirs = fontDirs()) {
  const names = new Set();
  const walk = (dir, depth) => {
    if (depth > 3) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full, depth + 1); continue; }
      if (!/\.(ttf|ttc|otf|otc|ttf\.ttc)$/i.test(e.name)) continue;
      names.add(e.name.replace(/\.(ttf|ttc|otf|otc)$/i, '').toLowerCase());
    }
  };
  dirs.forEach((d) => walk(d, 0));
  return names;
}

/**
 * 判断一个字体名在本机是否存在
 * 返回 { status: 'ok' | 'likely' | 'missing' | 'unknown', hit }
 *
 * ok      文件名直接命中，高置信
 * likely  靠别名猜到的（"思源宋体 CN" → NotoSerifSC）。字体确实在，但 Office 按
 *         字体家族名查找，家族名可能不叫这个中文名，仍可能回退，所以不能报 ok
 * missing 没找到
 * unknown 字体目录不可读，无法判断
 */
function checkFont(name, fontNames) {
  if (!fontNames || fontNames.size === 0) return { status: 'unknown', hit: null };
  const raw = String(name || '').trim();
  if (!raw) return { status: 'missing', hit: null };
  const key = raw.toLowerCase().replace(/\s+/g, '');

  // 1) 文件名直接命中（arial → arial, simhei → simhei）
  if (fontNames.has(key)) return { status: 'ok', hit: key };
  if (fontNames.has(raw.toLowerCase())) return { status: 'ok', hit: raw.toLowerCase() };

  // 2) 别名表（微软雅黑 → msyh），这类是确定映射
  const alias = ALIASES[raw.toLowerCase()] || ALIASES[raw];
  if (alias) {
    for (const a of alias) {
      const hit = [...fontNames].find((f) => f === a || f.startsWith(a));
      if (hit) return { status: 'ok', hit };
    }
  }

  // 2b) 跨命名体系的等价字体，字体在但家族名未必认，只能报疑似
  const equiv = ALIASES_EQUIVALENT[raw.toLowerCase()] || ALIASES_EQUIVALENT[raw];
  if (equiv) {
    for (const a of equiv) {
      const hit = [...fontNames].find((f) => f === a || f.startsWith(a));
      if (hit) return { status: 'likely', hit };
    }
  }

  // 3) 归一化后前缀匹配，覆盖 "Noto Sans SC" ↔ notosanssc-vf 这类
  //    磁盘文件名常带字重后缀（-vf / bd / light），家族名本身不带
  const WEIGHT_SUFFIX = /^(vf|bd|b|bold|light|l|regular|r|italic|it|i|heavy|black|medium|semibold|sb|thin|extralight|oblique|mt|mtbold)+$/;
  const compact = key.replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
  if (compact.length >= 4) {
    for (const f of fontNames) {
      const n = f.replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
      if (n === compact) return { status: 'ok', hit: f };
      if (n.length >= 4 && compact.startsWith(n)) return { status: 'likely', hit: f };
      if (n.startsWith(compact)) {
        // notosanssc + vf/bold/light 这类纯字重后缀，就是同一个家族
        const rest = n.slice(compact.length);
        if (WEIGHT_SUFFIX.test(rest)) return { status: 'ok', hit: f };
        return { status: 'likely', hit: f };
      }
    }
  }
  return { status: 'missing', hit: null };
}

/** 在已安装字体里挑一个最接近的替代，给用户可执行的建议 */
function suggestFont(name, fontNames) {
  if (!fontNames || !fontNames.size) return null;
  const list = [...fontNames];
  const prefers = [
    ['notosanssc', 'Noto Sans SC'],
    ['msyh', '微软雅黑'],
    ['simhei', '黑体'],
    ['arial', 'Arial'],
    ['notoserifsc', 'Noto Serif SC'],
    ['simsun', '宋体'],
  ];
  for (const [key, label] of prefers) {
    if (list.some((f) => f === key || f.startsWith(key))) return label;
  }
  return null;
}

function checkNode() {
  const major = Number(process.versions.node.split('.')[0]);
  return {
    ok: major >= 20,
    label: `Node ${process.versions.node}`,
    detail: major >= 20 ? `满足 ≥ 20` : `需要 ≥ 20，当前 ${major}`,
  };
}

/** 单文件内联的引擎包：没有 src/ 与 node_modules，全部压进 bin/slideforge.js */
function isBundled(root) {
  return (
    fs.existsSync(path.join(root, 'bin', 'slideforge.js')) &&
    !fs.existsSync(path.join(root, 'src', 'index.js'))
  );
}

function checkDeps(root) {
  if (isBundled(root)) {
    return {
      ok: true,
      label: '依赖完整性',
      detail: '依赖已内联进单文件引擎，无需 node_modules',
    };
  }
  const need = ['pptxgenjs', 'jszip', 'js-yaml'];
  const missing = need.filter((m) => {
    try { require.resolve(m, { paths: [root] }); return false; } catch { return true; }
  });
  return {
    ok: missing.length === 0,
    label: '依赖完整性',
    detail: missing.length ? `缺少：${missing.join(', ')}，请重新安装技能包` : `${need.join(' / ')} 可用`,
  };
}

function checkEngine(root) {
  const files = isBundled(root)
    ? ['bin/slideforge.js']
    : ['bin/slideforge.js', 'src/index.js', 'src/render-pptx.js', 'scripts/validate.js'];
  const missing = files.filter((f) => !fs.existsSync(path.join(root, f)));
  return {
    ok: missing.length === 0,
    label: '引擎文件',
    detail: missing.length
      ? `缺少 ${missing.join(', ')}，技能包不完整`
      : isBundled(root)
        ? '单文件引擎完整'
        : '核心文件齐全',
  };
}

function checkWritable(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.doctor-${Date.now()}`);
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return { ok: true, label: '输出目录', detail: `${dir} 可写` };
  } catch (e) {
    return { ok: false, label: '输出目录', detail: `${dir} 不可写：${e.message}` };
  }
}

/** 找本机有没有 PowerPoint / WPS，决定能不能用 qa-render.ps1 导 PNG */
function checkOffice() {
  if (process.platform !== 'win32') {
    return {
      ok: null,
      label: 'PNG 导出',
      detail: '非 Windows，qa-render.ps1 不可用；需要图片时请在浏览器打开 HTML 版另存',
    };
  }
  const candidates = [
    'C:/Program Files/Microsoft Office/root/Office16/POWERPNT.EXE',
    'C:/Program Files (x86)/Microsoft Office/root/Office16/POWERPNT.EXE',
    'C:/Program Files/Microsoft Office/Office16/POWERPNT.EXE',
    'C:/Program Files (x86)/Microsoft Office/Office16/POWERPNT.EXE',
  ];
  const wps = [
    `${process.env.LOCALAPPDATA || ''}/Kingsoft/WPS Office/ksolaunch.exe`,
  ];
  const hit = candidates.find((p) => fs.existsSync(p));
  if (hit) return { ok: true, label: 'PNG 导出', detail: `PowerPoint 可用，可用 qa-render.ps1 导 PNG` };
  const wpsHit = wps.find((p) => p && fs.existsSync(p));
  if (wpsHit) return { ok: true, label: 'PNG 导出', detail: 'WPS 可用（qa-render.ps1 走 PowerPoint COM，WPS 需手动导出）' };
  return {
    ok: false,
    label: 'PNG 导出',
    detail: '未找到 PowerPoint，qa-render.ps1 不可用；需要图片时请在浏览器打开 HTML 版另存',
  };
}

/**
 * 体检入口
 * opts: { root, fonts: [...], outDir }
 */
function runDoctor(opts = {}) {
  const root = opts.root || path.join(__dirname, '..');
  const outDir = opts.outDir || path.join(process.cwd(), 'out');
  const checks = [checkNode(), checkDeps(root), checkEngine(root), checkWritable(outDir)];
  const office = checkOffice();

  const fontNames = collectFontNames();
  const fontResults = (opts.fonts || []).map((f) => {
    const r = checkFont(f, fontNames);
    return {
      font: f,
      ...r,
      suggest: r.status === 'missing' ? suggestFont(f, fontNames) : null,
    };
  });

  return { checks, office, fonts: fontResults, fontCount: fontNames.size };
}

/** 印成给人看的一段话 */
function formatReport(report) {
  const lines = [];
  const mark = (ok) => (ok === true ? '✓' : ok === false ? '×' : '·');
  lines.push('环境');
  report.checks.forEach((c) => lines.push(`  ${mark(c.ok)} ${c.label}：${c.detail}`));

  lines.push('PNG 导出');
  lines.push(`  ${mark(report.office.ok)} ${report.office.detail}`);

  if (report.fonts.length) {
    lines.push(`字体（本机扫描到 ${report.fontCount} 个字体文件）`);
    report.fonts.forEach((f) => {
      if (f.status === 'ok') lines.push(`  ✓ ${f.font}：已安装`);
      else if (f.status === 'likely') {
        lines.push(`  · ${f.font}：本机有 ${f.hit}，但 Office 按字体家族名查找，若显示不对请改用系统里显示的准确名称`);
      } else if (f.status === 'unknown') lines.push(`  · ${f.font}：无法扫描字体目录，未判断`);
      else {
        const s = f.suggest ? `，建议改用「${f.suggest}」` : '，请换成本机已安装的字体';
        lines.push(`  × ${f.font}：未安装，渲染时会静默回退${s}`);
      }
    });
  }
  return lines.join('\n');
}

module.exports = {
  runDoctor, formatReport, checkFont, collectFontNames, suggestFont, ALIASES,
};
