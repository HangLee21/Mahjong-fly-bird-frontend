import { _decorator, Component, Node, Prefab, instantiate } from 'cc';
import { ActionLabels } from '../../app/Constants';
import { GameEvents } from '../../app/GameEvents';
import { eventBus } from '../../core/EventBus';
import type { GameAction } from '../GameTypes';

const { ccclass, property } = _decorator;

@ccclass('ActionPanelView')
export class ActionPanelView extends Component {
  @property(Prefab)
  buttonPrefab: Prefab | null = null;

  renderActions(actions: GameAction[], submitting: boolean): void {
    this.node.removeAllChildren();
    actions
      .filter((action) => action.type !== 'DISCARD')
      .forEach((action, index) => {
        const node = this.buttonPrefab ? instantiate(this.buttonPrefab) : new Node();
        node.name = ActionLabels[action.type] || action.type;
        node.active = !submitting;
        node.setPosition(0, -index * 64, 0);
        node.on('click', () => eventBus.emit(GameEvents.ACTION_SELECTED, action));
        this.node.addChild(node);
      });
  }
}
