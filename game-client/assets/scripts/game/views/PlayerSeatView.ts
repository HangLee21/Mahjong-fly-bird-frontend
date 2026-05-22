import { _decorator, Component, Label, Node, Prefab, instantiate, Vec3 } from 'cc';
import type { LocalSeatPosition, PlayerPublicView } from '../GameTypes';

const { ccclass, property } = _decorator;

@ccclass('PlayerSeatView')
export class PlayerSeatView extends Component {
  @property(Label)
  nameLabel: Label | null = null;

  @property(Label)
  countLabel: Label | null = null;

  @property(Prefab)
  backTilePrefab: Prefab | null = null;

  renderSeat(player: PlayerPublicView, position: LocalSeatPosition, active: boolean): void {
    if (this.nameLabel) this.nameLabel.string = player.nickname || `座位 ${player.seatIndex}`;
    if (this.countLabel) this.countLabel.string = `${player.handCount} 张`;
    this.node.active = true;
    this.node.name = `${position}_${player.seatIndex}${active ? '_active' : ''}`;
    this.renderBackTiles(player.handCount, position);
  }

  private renderBackTiles(count: number, position: LocalSeatPosition): void {
    const container = new Node();
    this.node.addChild(container);
    const max = Math.min(count, 13);
    for (let index = 0; index < max; index += 1) {
      const node = this.backTilePrefab ? instantiate(this.backTilePrefab) : new Node();
      const vertical = position === 'left' || position === 'right';
      node.setPosition(new Vec3(vertical ? 0 : index * 28, vertical ? -index * 18 : 0, 0));
      container.addChild(node);
    }
  }
}
