const assert = require('assert');
const { actionLabel, actionOptions, decorateLog, ADMIN_ACTION_LABELS } = require('../src/utils/operationLog');

assert.equal(actionLabel('toggle_service'), '上架/下架服务');
assert.equal(actionLabel('toggle_hot'), '设置热门服务');
assert.equal(actionLabel('update_config'), '更新站点配置');
assert.equal(actionLabel('unknown_action'), '其他操作');
assert.equal(decorateLog({ action: 'toggle_category' }).action_label, '切换分类状态');
assert.ok(actionOptions().some(item => item.value === 'toggle_service' && item.label === '上架/下架服务'));
assert.equal(actionOptions().length, Object.keys(ADMIN_ACTION_LABELS).length);
assert.ok(!actionOptions().some(item => item.value === 'urge'));
console.log('operation log labels tests passed');
