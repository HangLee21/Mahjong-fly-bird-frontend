import { _decorator, Component, Label } from 'cc';
import type { PlayerGameView } from '../GameTypes';

const { ccclass, property } = _decorator;

@ccclass('CenterTableView')
export class CenterTableView extends Component {
  @property(Label)
  currentPlayerLabel: Label | null = null;

  @property(Label)
  wallLabel: Label | null = null;

  renderCenter(view: PlayerGameView): void {
    if (this.currentPlayerLabel) this.currentPlayerLabel.string = String(view.currentPlayer);
    if (this.wallLabel) this.wallLabel.string = `余牌 ${view.wallTilesRemaining}`;
  }
}
