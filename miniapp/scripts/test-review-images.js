const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
// vm 沙箱里创建的数组与测试上下文不是同一个 realm，按内容比较
const plain = value => JSON.parse(JSON.stringify(value));

function fixture({ wx = {}, api = {}, request = {} } = {}) {
  let page;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'pages/orders/detail.js'), 'utf8'), {
    Page: value => { page = value; }, console, wx,
    require: name => (name.endsWith('utils/api') ? api : name.endsWith('utils/request') ? request : {})
  });
  page.data = JSON.parse(JSON.stringify(page.data));
  page.setData = update => Object.assign(page.data, update);
  page.loadOrderDetail = async () => {};
  return page;
}

test('opening the review modal clears any previous image draft', () => {
  const page = fixture(); page.data.reviewImages = ['/tmp/old.jpg']; page.openReviewModal();
  assert.deepEqual(plain(page.data.reviewImages), []);
});

test('image picking never exceeds 3 and only asks for the remaining count', () => {
  let asked; let success;
  const page = fixture({ wx: { chooseImage: options => { asked = options.count; success = options.success; }, showToast() {} } });
  page.openReviewModal();
  page.chooseReviewImages(); assert.equal(asked, 3);
  success({ tempFilePaths: ['/tmp/1.jpg', '/tmp/2.jpg'] });
  page.chooseReviewImages(); assert.equal(asked, 1);
  success({ tempFilePaths: ['/tmp/3.jpg', '/tmp/4.jpg'] });
  assert.deepEqual(plain(page.data.reviewImages), ['/tmp/1.jpg', '/tmp/2.jpg', '/tmp/3.jpg']);
});

test('a full image list shows a hint instead of opening the picker', () => {
  let opened = false; let toast;
  const page = fixture({ wx: { chooseImage() { opened = true; }, showToast: t => { toast = t; } } });
  page.openReviewModal(); page.data.reviewImages = ['a', 'b', 'c'];
  page.chooseReviewImages();
  assert.equal(opened, false); assert.match(toast.title, /最多上传3张/);
});

test('a draft image can be removed by index', () => {
  const page = fixture(); page.openReviewModal(); page.data.reviewImages = ['a', 'b', 'c'];
  page.removeReviewImage({ currentTarget: { dataset: { index: 1 } } });
  assert.deepEqual(plain(page.data.reviewImages), ['a', 'c']);
});

test('submit uploads images one by one, then sends them together with the video', async () => {
  const uploads = []; let payload;
  const page = fixture({
    wx: { showToast() {} },
    api: { submitReview: async (id, body) => { payload = { id, body }; return { success: true }; } },
    request: { upload: async (file, kind) => { uploads.push([file, kind]); return `/api/upload/file/${kind}-${uploads.length}`; } }
  });
  page.data.order = { id: 42 }; page.openReviewModal();
  page.data.reviewImages = ['/tmp/1.jpg', '/tmp/2.jpg']; page.data.reviewVideo = '/tmp/v.mp4'; page.data.reviewComment = '很好';
  await page.submitReview();
  assert.deepEqual(plain(uploads), [['/tmp/1.jpg', 'image'], ['/tmp/2.jpg', 'image'], ['/tmp/v.mp4', 'video']]);
  assert.equal(payload.id, 42);
  assert.deepEqual(plain(payload.body.images), ['/api/upload/file/image-1', '/api/upload/file/image-2']);
  assert.equal(payload.body.video_url, '/api/upload/file/video-3');
  assert.equal(page.data.showReviewModal, false); assert.equal(page.data.submitting, false);
});

test('submit works with images only, and a failed upload keeps the modal and draft', async () => {
  let submitted = 0; let toast;
  const page = fixture({
    wx: { showToast: t => { toast = t; } },
    api: { submitReview: async () => { submitted++; return { success: true }; } },
    request: { upload: async () => { throw new Error('上传失败'); } }
  });
  page.data.order = { id: 1 }; page.openReviewModal();
  page.data.reviewImages = ['/tmp/1.jpg']; page.data.reviewComment = 'x';
  await page.submitReview();
  assert.equal(submitted, 0); assert.equal(page.data.showReviewModal, true);
  assert.deepEqual(plain(page.data.reviewImages), ['/tmp/1.jpg']); assert.equal(toast.title, '上传失败'); assert.equal(page.data.submitting, false);
});

test('wxml wires every review-image handler to a page method', () => {
  const wxml = fs.readFileSync(path.join(root, 'pages/orders/detail.wxml'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'pages/orders/detail.js'), 'utf8');
  for (const handler of ['chooseReviewImages', 'removeReviewImage', 'previewReviewDraftImage', 'onPreviewReviewImage']) {
    assert.match(wxml, new RegExp(`(?:bind|catch):?tap="${handler}"`), handler + ' missing in wxml');
    assert.match(js, new RegExp(`\\b${handler}\\(`), handler + ' missing in js');
  }
  const service = fs.readFileSync(path.join(root, 'pages/services/detail.wxml'), 'utf8');
  assert.match(service, /bindtap="onPreviewReviewImage"/);
  assert.match(fs.readFileSync(path.join(root, 'pages/services/detail.js'), 'utf8'), /onPreviewReviewImage\(/);
});
