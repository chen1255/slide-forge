/**
 * 内置主题：一套主题 = 调色板 + 字体 + 字号阶梯
 * 颜色统一不带 # 前缀（pptxgenjs 的硬性要求）
 */
const { getProfile, listProfiles } = require('./profile');

const THEMES = {
  'midnight-executive': {
    label: '午夜高管',
    palette: {
      bg: 'FFFFFF',
      bgDark: '1E2761',
      primary: '1E2761',
      secondary: 'CADCFC',
      accent: 'B87F22',
      text: '1F2430',
      muted: '6B7280',
      line: 'E3E7EF',
      card: 'F4F6FB',
      onDark: 'FFFFFF',
      onDarkMuted: 'AEB9D9',
    },
    fonts: { heading: '微软雅黑', body: '微软雅黑' },
  },
  'forest-moss': {
    label: '森林苔藓',
    palette: {
      bg: 'FFFFFF',
      bgDark: '2C5F2D',
      primary: '2C5F2D',
      secondary: '97BC62',
      accent: 'B0861F',
      text: '1F2A1F',
      muted: '5F6B5F',
      line: 'E1E8DC',
      card: 'F3F6EF',
      onDark: 'FFFFFF',
      onDarkMuted: 'C9D8BC',
    },
    fonts: { heading: '微软雅黑', body: '微软雅黑' },
  },
  'coral-energy': {
    label: '珊瑚活力',
    palette: {
      bg: 'FFFFFF',
      bgDark: '2F3C7E',
      primary: '2F3C7E',
      secondary: 'F9E795',
      accent: 'F96167',
      text: '23283B',
      muted: '6B7280',
      line: 'EDE3DA',
      card: 'FDF4F2',
      onDark: 'FFFFFF',
      onDarkMuted: 'D7D9EC',
    },
    fonts: { heading: '微软雅黑', body: '微软雅黑' },
  },
  'charcoal-minimal': {
    label: '炭灰极简',
    palette: {
      bg: 'FFFFFF',
      bgDark: '36454F',
      primary: '36454F',
      secondary: 'D8DEE3',
      accent: 'A8873A',
      text: '1C1C1C',
      muted: '6E6E6E',
      line: 'E5E5E5',
      card: 'F4F4F4',
      onDark: 'FFFFFF',
      onDarkMuted: 'C3CBD1',
    },
    fonts: { heading: '微软雅黑', body: '微软雅黑' },
  },
};

/** 字号阶梯：标题必须明显大于正文，否则页面没有层次 */
const TYPE_SCALE = {
  display: 44,
  title: 30,
  section: 38,
  subtitle: 16,
  body: 14,
  small: 11,
  caption: 10,
  kpi: 42,
};

function themeNames() {
  return Object.keys(THEMES);
}

/**
 * 解析主题：内置主题名 / 已保存的 profile 名 / spec 里的覆盖项（palette, fonts, sizes）
 * 名字先查内置主题，查不到再查用户 profile，两者都没有才报错。
 */
function resolveTheme(spec) {
  const t = spec && spec.theme ? spec.theme : {};
  const name = typeof t === 'string' ? t : t.name || 'midnight-executive';
  let base = THEMES[name];
  let fromProfile = false;

  if (!base) {
    const prof = getProfile(name);
    if (prof) {
      // profile 只存差异，缺的键回落到默认主题，避免老 profile 因为新增色槽而崩
      const fallback = THEMES['midnight-executive'];
      base = {
        label: prof.label || name,
        palette: Object.assign({}, fallback.palette, prof.palette),
        fonts: Object.assign({}, fallback.fonts, prof.fonts),
        sizes: prof.sizes || {},
      };
      fromProfile = true;
    }
  }

  if (!base) {
    const saved = listProfiles().map((p) => p.name);
    const hint = saved.length ? `；已保存的 profile：${saved.join(' / ')}` : '；可用 profile save 存一套自己的品牌色';
    throw new Error(
      `未知主题 "${name}"，可用：${themeNames().join(' / ')}${hint}`
    );
  }
  const profileSizes = fromProfile ? base.sizes || {} : {};
  const theme = {
    name,
    label: base.label,
    fromProfile,
    palette: Object.assign({}, base.palette, t.palette || {}),
    fonts: Object.assign({}, base.fonts, t.fonts || {}),
    sizes: Object.assign({}, TYPE_SCALE, profileSizes, t.sizes || {}),
  };
  if (spec && spec.meta && spec.meta.language === 'en-US') {
    theme.fonts = Object.assign({ heading: 'Arial', body: 'Arial' }, t.fonts || {});
  }
  return theme;
}

module.exports = { THEMES, TYPE_SCALE, themeNames, resolveTheme };
