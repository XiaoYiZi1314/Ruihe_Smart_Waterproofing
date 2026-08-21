Component({
  properties: {
    loading: { type: Boolean, value: false },
    finished: { type: Boolean, value: false },
    text: { type: String, value: '— 上拉加载更多 —' },
    finishedText: { type: String, value: '没有更多了' }
  }
});