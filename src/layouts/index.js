/**
 * layout 注册表
 */
const structural = require('./structural');
const content = require('./content');
const data = require('./data');
const special = require('./special');

const LAYOUTS = Object.assign({}, structural, content, data, special);

module.exports = { LAYOUTS };
