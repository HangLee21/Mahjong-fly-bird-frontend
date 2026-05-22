import { _decorator, Component, Node, Prefab, instantiate, Vec3 } from 'cc';
import type { Meld } from '../GameTypes';

const { ccclass, property } = _decorator;

@ccclass('MeldView')
export class MeldView extends Component {
  @property(Prefab)
  tilePrefab: Prefab | null = null;

  renderMelds(melds: Meld[]): void {
    this.node.removeAllChildren();
    melds.forEach((meld, meldIndex) => {
      meld.tiles.forEach((_tile, tileIndex) => {
        const node = this.tilePrefab ? instantiate(this.tilePrefab) : new Node();
        node.setPosition(new Vec3(tileIndex * 28, -meldIndex * 40, 0));
        this.node.addChild(node);
      });
    });
  }
}
