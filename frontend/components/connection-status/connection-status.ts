const LABELS: Record<string, string> = {
  DISCONNECTED: '离线',
  CONNECTING: '连接中',
  CONNECTED: '已连接',
  RECONNECTING: '重连中',
  ERROR: '连接异常',
};

Component({
  properties: {
    status: { type: String, value: 'DISCONNECTED' },
  },
  data: {
    label: '离线',
  },
  observers: {
    status(status: string) {
      this.setData({ label: LABELS[status] || status });
    },
  },
});
