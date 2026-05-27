import { _decorator, Component, Label } from 'cc';
import type { ScoreResult } from '../game/GameTypes';

const { ccclass, property } = _decorator;

@ccclass('ResultPanelView')
export class ResultPanelView extends Component {
  @property(Label)
  titleLabel: Label | null = null;

  @property(Label)
  detailLabel: Label | null = null;

  renderResult(result: ScoreResult | undefined): void {
    if (this.titleLabel) this.titleLabel.string = result?.title || '牌局结束';
    if (this.detailLabel) {
      this.detailLabel.string =
        result?.fanItems.map((item) => `${item.name} ${item.points}分`).join('\n') || '暂无结算明细';
    }
  }
}
