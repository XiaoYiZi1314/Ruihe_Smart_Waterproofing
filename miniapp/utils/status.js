const STATUS_MAP = {
  pending: {
    key: 'pending',
    text: '待确认',
    tagClass: 'pending',
    desc: '我们已收到您的预约，将尽快与您联系确认',
    actions: [
      { key: 'cancel', text: '取消预约', variant: 'line' },
      { key: 'urge', text: '催单', variant: 'line' }
    ]
  },
  confirmed: {
    key: 'confirmed',
    text: '已确认',
    tagClass: 'confirmed',
    desc: '工单已确认，师傅将按预约时间上门',
    actions: [
      { key: 'cancel', text: '取消预约', variant: 'line' },
      { key: 'callMaster', text: '联系师傅', variant: 'line' },
      { key: 'urge', text: '催单', variant: 'line' }
    ]
  },
  in_progress: {
    key: 'doing',
    text: '进行中',
    tagClass: 'doing',
    desc: '师傅正在现场施工，请您耐心等待',
    actions: [
      { key: 'callMaster', text: '联系师傅', variant: 'line' }
    ]
  },
  waiting_acceptance: {
    key: 'doing',
    text: '待验收',
    tagClass: 'doing',
    desc: '施工已完成，请确认最终价格',
    actions: [
      { key: 'callMaster', text: '联系师傅', variant: 'line' },
      { key: 'confirm', text: '确认验收', variant: 'brand' },
      { key: 'dispute', text: '价格异议', variant: 'line' }
    ]
  },
  pending_review: {
    key: 'doing',
    text: '待验收',
    tagClass: 'doing',
    desc: '施工已完成，请确认最终价格并验收',
    actions: [
      { key: 'callMaster', text: '联系师傅', variant: 'line' },
      { key: 'confirm', text: '确认验收', variant: 'brand' },
      { key: 'dispute', text: '价格异议', variant: 'line' }
    ]
  },
  negotiating: {
    key: 'pending',
    text: '价格协商中',
    tagClass: 'pending',
    desc: '价格异议已提交，管理员正在处理',
    actions: [
      { key: 'progress', text: '查看详情', variant: 'brand' }
    ]
  },
  price_negotiating: {
    key: 'pending',
    text: '价格协商中',
    tagClass: 'pending',
    desc: '价格异议已提交，管理员正在处理，请耐心等待',
    actions: [
      { key: 'callMaster', text: '联系师傅', variant: 'line' }
    ]
  },
  completed: {
    key: 'done',
    text: '已完成',
    tagClass: 'done',
    desc: '服务已完成，感谢您的信任',
    actions: [
      { key: 'review', text: '评价服务', variant: 'brand' }
    ]
  },
  cancelled: {
    key: 'cancel',
    text: '已取消',
    tagClass: 'cancel',
    desc: '工单已取消',
    actions: [
      { key: 'rebook', text: '重新预约', variant: 'line' }
    ]
  }
};

function getStatusMeta(status) {
  return STATUS_MAP[status] || {
    key: status,
    text: status || '未知',
    tagClass: 'done',
    desc: '',
    actions: []
  };
}

function getStatusText(status) {
  return getStatusMeta(status).text;
}

function getOrderActions(order) {
  return getStatusMeta(order.status).actions.filter(action =>
    !(action.key === 'dispute' && order.price_adjusted_at) &&
    !(action.key === 'review' && (order.review_submitted_at || order.review)));
}

module.exports = {
  getOrderActions,
  STATUS_MAP,
  getStatusMeta,
  getStatusText
};