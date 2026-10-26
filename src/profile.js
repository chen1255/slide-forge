/**
 * 品牌 profile：把一套配色 + 字体存成可复用的名字
 *
 * 痛点：用户每次都要在 spec 里贴 11 个色值，或者每次 build 都带 --template。
 * 存成 profile 后，spec 里写 `theme: 客户A` 即可，跨会话有效。
 *
 * 存放位置：~/.slideforge/profiles/<name>.json
 * 可用 SLIDEFORGE_HOME 覆盖根目录（测试与多环境隔离用）
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

function home() {
  return process.env.SLIDEFORGE_HOME || path.join(os.homedir(), '.slideforge');
}

function profileDir() {
  return path.join(home(), 'profiles');
}

/** profile 名会变成文件名，必须挡住路径穿越与保留字符 */
function assertName(name) {
  const n = String(name || '').trim();
  if (!n) throw new Error('请给出 profile 名称');
  if (!/^[\w\u4e00-\u9fa5][\w\u4e00-\u9fa5 .-]{0,40}$/.test(n)) {
    throw new Error(`profile 名称只能用中英文、数字、空格、点、下划线、短横线，且不超过 41 字符："${n}"`);
  }
  if (/^\.+$/.test(n)) throw new Error('profile 名称不能只有点');
  return n;
}

const fileOf = (name) => path.join(profileDir(), `${assertName(name)}.json`);

function ensureDir() {
  fs.mkdirSync(profileDir(), { recursive: true });
}

/** 列出全部 profile，按更新时间倒序 */
function listProfiles() {
  let files;
  try { files = fs.readdirSync(profileDir()); } catch { return []; }
  return files
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const name = f.replace(/\.json$/, '');
      try {
        const p = JSON.parse(fs.readFileSync(path.join(profileDir(), f), 'utf8'));
        return {
          name,
          label: p.label || name,
          source: p.source || '',
          updatedAt: p.updatedAt || '',
          paletteKeys: p.palette ? Object.keys(p.palette).length : 0,
        };
      } catch {
        return { name, label: name, source: '（文件损坏）', updatedAt: '', paletteKeys: 0 };
      }
    })
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

/** 读一个 profile，不存在返回 null */
function getProfile(name) {
  const file = fileOf(name);
  if (!fs.existsSync(file)) return null;
  try {
    const p = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!p || !p.palette) return null;
    return { name: p.name || name, label: p.label || name, palette: p.palette, fonts: p.fonts || {}, sizes: p.sizes || {}, source: p.source || '', updatedAt: p.updatedAt || '' };
  } catch {
    return null;
  }
}

/** 保存（覆盖同名） */
function saveProfile(name, data) {
  const n = assertName(name);
  if (!data || !data.palette) throw new Error('profile 必须包含 palette');
  ensureDir();
  const payload = {
    name: n,
    label: data.label || n,
    palette: data.palette,
    fonts: data.fonts || {},
    sizes: data.sizes || {},
    source: data.source || '',
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(fileOf(n), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return fileOf(n);
}

function removeProfile(name) {
  const file = fileOf(name);
  if (!fs.existsSync(file)) return false;
  fs.unlinkSync(file);
  return true;
}

module.exports = { home, profileDir, listProfiles, getProfile, saveProfile, removeProfile, assertName };
