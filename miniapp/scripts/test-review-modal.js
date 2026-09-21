const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function fixture() {
  let page;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'pages/orders/detail.js'), 'utf8'), {
    Page: value => { page = value; }, require: () => ({}), console, wx: {}
  });
  page.data = JSON.parse(JSON.stringify(page.data));
  page.setData = update => Object.assign(page.data, update);
  return page;
}

test('modal close handlers belong only to sibling backdrops, not form ancestors', () => {
  const wxml = fs.readFileSync(path.join(root, 'pages/orders/detail.wxml'), 'utf8');
  assert.doesNotMatch(wxml, /catchtap=""/);
  for (const [state, close] of [['showReviewModal', 'closeReviewModal'],
    ['showDisputeModal', 'closeDisputeModal']]) {
    const container = wxml.match(new RegExp(`<view class="modal-mask"[^>]*${state}[^>]*>`));
    assert(container, 'Modal container missing: ' + state);
    assert.doesNotMatch(container[0], /(?:bind|catch)tap=/);
    assert.match(wxml, new RegExp(
      `<view class="modal-backdrop"[^>]*bindtap="${close}"[^>]*><\\/view>\\s*<view class="modal`
    ));
  }
});

test('rating targets are views with per-category datasets and a usable hit area', () => {
  const wxml = fs.readFileSync(path.join(root, 'pages/orders/detail.wxml'), 'utf8');
  const targets = [...wxml.matchAll(/<view\s+wx:for="\{\{starRange\}\}"([\s\S]*?)>★<\/view>/g)];
  assert.equal(targets.length, 3);
  for (const [index, type] of ['attitude', 'quality', 'price'].entries()) {
    assert.match(targets[index][1], new RegExp(`data-type="${type}"`));
    assert.match(targets[index][1], /bindtap="onScoreTap"/);
  }
  const css = fs.readFileSync(path.join(root, 'pages/orders/detail.wxss'), 'utf8');
  const starRule = css.match(/\.rate-star\s*\{([^}]+)\}/)[1];
  assert.match(starRule, /min-width:\s*64rpx/);
  assert.match(starRule, /min-height:\s*72rpx/);
});

test('all three ratings support 1 to 5, preserve other fields and keep the modal open', () => {
  const page = fixture(); page.openReviewModal();
  for (const type of ['attitude', 'quality', 'price']) {
    for (const score of [1, 2, 3, 4, 5]) {
      const previous = { ...page.data.reviewScores };
      page.onScoreTap({ currentTarget: { dataset: { type, score: String(score) } } });
      assert.equal(page.data.reviewScores[type], score);
      for (const other of Object.keys(previous).filter(key => key !== type)) {
        assert.equal(page.data.reviewScores[other], previous[other]);
      }
      assert.equal(page.data.showReviewModal, true);
    }
  }
});

test('invalid ratings do not corrupt the draft', () => {
  const page = fixture(); page.openReviewModal();
  const original = JSON.stringify(page.data.reviewScores);
  for (const [type, score] of [['unknown', 2], ['attitude', 0], ['quality', 6],
    ['price', '2bad'], ['attitude', 2.5]]) {
    page.onScoreTap({ currentTarget: { dataset: { type, score } } });
    assert.equal(JSON.stringify(page.data.reviewScores), original);
  }
});

test('review text accepts Chinese and multiline content without changing scores or closing', () => {
  const page = fixture(); page.openReviewModal();
  page.onScoreTap({ currentTarget: { dataset: { type: 'quality', score: 3 } } });
  page.onReviewCommentInput({ detail: { value: '测试草稿，不提交\n施工质量评价' } });
  assert.equal(page.data.reviewComment, '测试草稿，不提交\n施工质量评价');
  assert.equal(page.data.reviewScores.quality, 3);
  assert.equal(page.data.showReviewModal, true);
  page.closeReviewModal(); assert.equal(page.data.showReviewModal, false);
});
