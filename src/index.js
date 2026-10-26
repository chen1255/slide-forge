/**
 * slide-forge 公共 API
 */
const { loadSpec, parseSpec, normalize, validateSpec } = require('./spec');
const { renderPptx } = require('./render-pptx');
const { LAYOUTS } = require('./layouts');
const { themeNames } = require('./theme');

module.exports = { loadSpec, parseSpec, normalize, validateSpec, renderPptx, LAYOUTS, themeNames };
