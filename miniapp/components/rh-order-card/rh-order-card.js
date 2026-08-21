const statusUtil = require('../../utils/status');
const theme = require('../../utils/theme');

Component({
  properties: {
    order: { type: Object, value: {} }
  },
  data: {
    view: {
      no: '',
      name: '',
      time: '',
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
      const time = item.appointment_time || item.expected_visit_time || item.created_at || '';
      this.setData({
        view: {
          no: item.order_no || '',
          name: item.service_name || '',
          time,
          addr: item.full_address || theme.joinAddress(item),
          master: item.worker_name
            ? `${item.worker_name}${item.worker_phone ? ' ' + theme.maskPhone(item.worker_phone) : ''}`
            : '',
          statusText: meta.text,
          tagClass: meta.tagClass,
          actions: meta.actions
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