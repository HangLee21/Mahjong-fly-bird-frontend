import { _decorator, Component, Label, resources, Sprite, SpriteFrame, Texture2D, tween, Vec3 } from 'cc';
import { getTileTexturePath, TILE_BACK_TEXTURE } from '../../assets/TileAssetMap';
import type { TileId } from '../GameTypes';
import { getTileLabel } from '../../utils/TileUtils';
import { createLabel, ensureChild, ensureComponent } from '../../ui/RuntimeUi';

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
    this.renderFallbackLabel(getTileLabel(tileId));
  }

  setFaceDown(faceDown: boolean): void {
    this.faceDown = faceDown;
    this.loadSprite(faceDown ? TILE_BACK_TEXTURE : this.tileId === null ? TILE_BACK_TEXTURE : getTileTexturePath(this.tileId));
    this.renderFallbackLabel(faceDown ? '背' : this.tileId === null ? '背' : getTileLabel(this.tileId));
  }

  setSelected(selected: boolean): void {
    this.selected = selected;
    this.node.setPosition(this.node.position.x, selected ? 14 : 0, this.node.position.z);
  }

  setDisabled(disabled: boolean): void {
    this.disabled = disabled;
    this.node.name = disabled ? `${this.node.name || 'Tile'}_disabled` : this.node.name || 'Tile';
  }

  /** Rotates the tile 90 degrees to mark it as claimed from another player. */
  setSideways(sideways: boolean): void {
    this.node.angle = sideways ? 90 : 0;
  }

  playSelectAnimation(): void {
    tween(this.node).to(0.12, { position: new Vec3(this.node.position.x, 14, this.node.position.z) }).start();
  }

  playDiscardAnimation(target: Vec3): Promise<void> {
    return new Promise((resolve) => {
      tween(this.node).to(0.18, { position: target }, { easing: 'quadOut' }).call(resolve).start();
    });
  }

  private loadSprite(path: string): void {
    if (!this.sprite) return;
    resources.load(`${path}/spriteFrame`, SpriteFrame, (err, spriteFrame) => {
      if (!err && spriteFrame) {
        if (this.sprite) this.sprite.spriteFrame = spriteFrame;
        return;
      }
      resources.load(`${path}/texture`, Texture2D, (textureErr, texture) => {
        if (!textureErr && texture && this.sprite) {
          const frame = new SpriteFrame() as SpriteFrame & { texture?: Texture2D };
          frame.texture = texture;
          this.sprite.spriteFrame = frame;
        } else {
          resources.load(path, Texture2D, (directTextureErr, directTexture) => {
            if (!directTextureErr && directTexture && this.sprite) {
              const frame = new SpriteFrame() as SpriteFrame & { texture?: Texture2D };
              frame.texture = directTexture;
              this.sprite.spriteFrame = frame;
            } else {
              console.warn(`[TileView] failed to load tile sprite: ${path}`, err || textureErr || directTextureErr);
            }
          });
        }
      });
    });
  }

  private renderFallbackLabel(text: string): void {
    const labelNode = ensureChild(this.node, 'TileLabel');
    const label = ensureComponent(labelNode, Label);
    label.string = text;
    createLabel(this.node, 'TileDebugLabel', text);
  }
}
