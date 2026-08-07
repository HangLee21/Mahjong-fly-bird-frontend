import { _decorator, Component, Node, Prefab, instantiate, Vec3 } from 'cc';
import type { Meld } from '../GameTypes';
import { ensureComponent } from '../../ui/RuntimeUi';
import { TileView } from './TileView';

const { ccclass, property } = _decorator;

@ccclass('MeldView')
export class MeldView extends Component {
  @property(Prefab)
  tilePrefab: Prefab | null = null;

  renderMelds(melds: Meld[]): void {
    this.node.removeAllChildren();
    melds.forEach((meld, meldIndex) => {
      const claimedIndex = resolveClaimedIndex(meld);
      meld.tiles.forEach((tileId, tileIndex) => {
        const node = this.tilePrefab ? instantiate(this.tilePrefab) : new Node();
        node.setPosition(new Vec3(tileIndex * 28, -meldIndex * 40, 0));
        const tile = ensureComponent(node, TileView);
        tile.setTile(tileId);
        tile.setSideways(tileIndex === claimedIndex);
        this.node.addChild(node);
      });
    });
  }
}

function resolveClaimedIndex(meld: Meld): number | null {
  if (meld.claimedIndex !== undefined && meld.claimedIndex >= 0 && meld.claimedIndex < meld.tiles.length) {
    return meld.claimedIndex;
  }
  // Fallbacks for data that predates the claimedIndex field.
  if (meld.type === 'PONG') return 1;
  if (meld.type === 'KONG_EXPOSED') return 0;
  if (meld.type === 'KONG_ADDED') return meld.tiles.length - 1;
  return null;
}
