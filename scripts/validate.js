/**
 * 版面质量校验：不出文件，只检查场景是否越界或文字放不下
 * 用法：node scripts/validate.js examples/demo.deck.yaml
 */
const path = require('path');
const { W, H, lineCount } = require('../src/kit');
const { LAYOUTS } = require('../src/layouts');
const { loadSpec } = require('../src/spec');

const TOL = 0.02;

function validateSpecFile(file) {
  const spec = loadSpec(file);
  const errors = [];
  const warnings = [];

  spec.slides.forEach((s) => {
    const scene = LAYOUTS[s.layout](s, Object.assign({}, spec.theme, { meta: spec.meta }));
    (scene.elements || []).forEach((el, i) => {
      if (el.type === 'line') return;
      const label = `第 ${s.index} 页（${s.layout}）#${i + 1} ${el.type}`;
      if (el.w == null || el.h == null) return;

      if (el.x < -TOL || el.y < -TOL) {
        errors.push(`${label} 起点越界：x=${el.x.toFixed(2)}, y=${el.y.toFixed(2)}`);
      }
      if (el.x + el.w > W + TOL) {
        errors.push(`${label} 右边越界：${(el.x + el.w).toFixed(2)}in > ${W}in`);
      }
      if (el.y + el.h > H + TOL) {
        errors.push(`${label} 下边越界：${(el.y + el.h).toFixed(2)}in > ${H}in`);
      }
      if (el.type === 'text' && el.text) {
        const size = el.fontSize || 14;
        const need = (lineCount(String(el.text), size, el.w) * size * 1.35) / 72;
        if (need > el.h + 0.12) {
          warnings.push(
            `${label} 文字可能溢出：需要 ${need.toFixed(2)}in，框高 ${el.h.toFixed(2)}in（"${String(el.text).slice(0, 18)}…"）`
          );
        }
      }
    });
  });

  return { spec, errors, warnings };
}

if (require.main === module) {
  const file = process.argv[2] || path.join(__dirname, '..', 'examples', 'demo.deck.yaml');
  const { spec, errors, warnings } = validateSpecFile(file);
  console.log(`检查 ${spec.slides.length} 页`);
  warnings.forEach((w) => console.log(`  ! ${w}`));
  errors.forEach((e) => console.log(`  x ${e}`));
  if (!errors.length && !warnings.length) console.log('  全部通过');
  if (errors.length) process.exit(1);
}

module.exports = { validateSpecFile };
