const test = require('node:test');
const assert = require('node:assert/strict');
const { imageExtension, imageCountText } = require('../src/utils/orderExportImages');

test('export image extension maps mime and filename', () => {
  assert.equal(imageExtension('image/jpeg', 'a.webp'), 'jpeg');
  assert.equal(imageExtension('image/png', 'a.jpg'), 'png');
  assert.equal(imageExtension('', 'scene.PNG'), 'png');
  assert.equal(imageExtension('', 'a.webp'), null);
});

test('export image count text', () => {
  assert.equal(imageCountText(1, {}), '无');
  assert.equal(imageCountText(2, { 2: ['/a.jpg', '/b.jpg'] }), '2张');
});
