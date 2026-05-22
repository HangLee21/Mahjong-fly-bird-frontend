import { _decorator, Component, Sprite, SpriteFrame, tween, Vec3 } from 'cc';
import { getTileTexturePath, TILE_BACK_TEXTURE } from '../../assets/TileAssetMap';
import type { TileId } from '../GameTypes';

const { ccclass, property } = _decorator;

@ccclass('TileView')
export class TileView extends Component {
  @property(Sprite)
  sprite: Sprite | null = null;

  tileId: TileId | null = null;
  faceDown = false;
  selected = false;
  disabled = false;

  setTile(tileId: TileId): void {
    this.tileId = tileId;
    this.faceDown = false;
    this.loadSprite(getTileTexturePath(tileId));
  }

  setFaceDown(faceDown: boolean): void {
    this.faceDown = faceDown;
    this.loadSprite(faceDown ? TILE_BACK_TEXTURE : this.tileId === null ? TILE_BACK_TEXTURE : getTileTexturePath(this.tileId));
  }

  setSelected(selected: boolean): void {
    this.selected = selected;
    this.node.setPosition(this.node.position.x, selected ? 14 : 0, this.node.position.z);
  }

  setDisabled(disabled: boolean): void {
    this.disabled = disabled;
  }

  playSelectAnimation(): void {
    tween(this.node).to(0.12, { position: new Vec3(this.node.position.x, 14, this.node.position.z) }).start();
  }

  playDiscardAnimation(target: Vec3): Promise<void> {
    return new Promise((resolve) => {
      tween(this.node).to(0.18, { position: target }, { easing: 'quadOut' }).call(resolve).start();
    });
  }

  private loadSprite(_path: string): void {
    // Cocos editor binding: use AssetManager/BundleLoader to assign SpriteFrame at runtime.
    // This stub keeps the component protocol stable for Codex and unit tests.
    if (this.sprite) this.sprite.spriteFrame = this.sprite.spriteFrame as SpriteFrame | null;
  }
}
