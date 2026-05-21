import { ACTION_LABELS } from '../../config/constants';

Component({
  properties: {
    actions: { type: Array, value: [] },
    submitting: { type: Boolean, value: false },
    selectedTile: { type: Number, value: -1 },
  },
  data: {
    displayActions: [] as Array<{ label: string; index: number; type: string; tile?: number; actionId: number }>,
  },
  observers: {
    actions(actions: Array<{ type: string; tile?: number; actionId: number }>) {
      this.setData({
        displayActions: (actions || []).map((action, index) => ({
          ...action,
          index,
          label: `${ACTION_LABELS[action.type] || action.type}${action.tile !== undefined ? ` ${action.tile}` : ''}`,
        })),
      });
    },
  },
  methods: {
    onAction(event: WechatMiniprogram.BaseEvent) {
      const index = Number(event.currentTarget.dataset.index);
      const action = (this.properties as { actions: unknown[] }).actions[index];
      this.triggerEvent('submitAction', { action });
    },
  },
});
