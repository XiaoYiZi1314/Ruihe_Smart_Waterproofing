const statusUtil = require('../../utils/status');
const theme = require('../../utils/theme');
const { appointmentText } = require('../../utils/booking-slots');

// 卡片时间行：师傅上门时间 > 客户预约时段 > 下单时间，并按实际含义命名
function pickTime(item) {
  const visit = item.estimated_time || item.appointment_time || item.expected_visit_time;
  if (visit) return { label: '预计上门', text: theme.formatTime(visit) };
  const slot = appointmentText(item);
  if (slot) return { label: '预约时间', text: slot };
  return { label: '下单时间', text: theme.formatTime(item.created_at) };
}

Component({
  properties: {
    order: { type: Object, value: {} }
  },
  data: {
    view: {
      no: '',
      name: '',
      time: '',
      timeLabel: '',
      addr: '',
      master: '',
      statusText: '',
      tagClass: 'done',
      actions: []
    }
  },
  observers: {
    order(order) {
      const item = order || {};
      const meta = statusUtil.getStatusMeta(item.status);
      const when = pickTime(item);
      this.setData({
        view: {
          no: item.order_no || '',
          name: item.service_name || '',
          time: when.text,
          timeLabel: when.label,
          addr: item.full_address || theme.joinAddress(item),
          master: item.worker_name
            ? `${item.worker_name}${item.worker_phone ? ' ' + theme.maskPhone(item.worker_phone) : ''}`
            : '',
          statusText: meta.text,
          tagClass: meta.tagClass,
          actions: statusUtil.getOrderActions(item)
        }
      });
    }
  },
  methods: {
    onTap() {
      this.triggerEvent('tap', { order: this.data.order });
    },
    onAction(e) {
      this.triggerEvent('action', {
        action: e.currentTarget.dataset.action,
        order: this.data.order
      });
    }
  }
});