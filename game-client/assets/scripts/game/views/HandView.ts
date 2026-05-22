import { _decorator, Component, Node, Prefab, instantiate, Vec3 } from 'cc';
import { GameEvents } from '../../app/GameEvents';
import { eventBus } from '../../core/EventBus';
import { sortTiles } from '../../utils/TileUtils';
import type { TileId } from '../GameTypes';
import { TileView } from './TileView';

const { ccclass, property } = _decorator;

@ccclass('HandView')
export class HandView extends Component {
  @property(Prefab)
  tilePrefab: Prefab | null = null;

  private tiles: TileView[] = [];
  private selectedTile: TileId | null = null;

  renderHand(hand: TileId[], legalDiscardTiles: TileId[], selectedTile: TileId | null): void {
    this.selectedTile = selectedTile;
    this.node.removeAllChildren();
    this.tiles = [];
    const sorted = sortTiles(hand);
    const legal = new Set(legalDiscardTiles);
    sorted.forEach((tileId, index) => {
      const node = this.tilePrefab ? instantiate(this.tilePrefab) : new Node();
      this.node.addChild(node);
      node.setPosition(new Vec3((index - sorted.length / 2) * 42, selectedTile === tileId ? 14 : 0, 0));
      const tile = node.getComponent(TileView) || new TileView();
      tile.setTile(tileId);
      tile.setDisabled(!legal.has(tileId));
      tile.setSelected(selectedTile === tileId);
      node.on('click', () => eventBus.emit(GameEvents.DISCARD_REQUESTED, tileId));
      this.tiles.push(tile);
    });
  }
}
