import { _decorator, Component, Node, Prefab, instantiate, Vec3 } from 'cc';
import type { LocalSeatPosition, TileId } from '../GameTypes';
import { ensureComponent } from '../../ui/RuntimeUi';
import { TileView } from './TileView';

const { ccclass, property } = _decorator;

@ccclass('DiscardView')
export class DiscardView extends Component {
  @property(Prefab)
  tilePrefab: Prefab | null = null;

  renderDiscards(tiles: TileId[], position: LocalSeatPosition): void {
    this.node.removeAllChildren();
    const vertical = position === 'left' || position === 'right';
    tiles.forEach((tileId, index) => {
      const node = this.tilePrefab ? instantiate(this.tilePrefab) : new Node();
      node.setPosition(new Vec3(vertical ? 0 : (index % 8) * 30, vertical ? -index * 22 : -Math.floor(index / 8) * 40, 0));
      ensureComponent(node, TileView).setTile(tileId);
      this.node.addChild(node);
    });
  }
}
