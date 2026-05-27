import { _decorator, Component, Node, Vec3 } from 'cc';
import { mapSeats } from '../GameViewMapper';
import type { LocalSeatPosition, PlayerGameView, PlayerPublicView, TileId } from '../GameTypes';
import { createLabel, ensureChild, ensureComponent } from '../../ui/RuntimeUi';
import { getTileLabel } from '../../utils/TileUtils';
import { ActionPanelView } from './ActionPanelView';
import { CenterTableView } from './CenterTableView';
import { DiscardView } from './DiscardView';
import { HandView } from './HandView';
import { MeldView } from './MeldView';
import { PlayerSeatView } from './PlayerSeatView';
import { TileView } from './TileView';

const { ccclass, property } = _decorator;

@ccclass('GameBoardView')
export class GameBoardView extends Component {
  @property(HandView)
  handView: HandView | null = null;

  @property(ActionPanelView)
  actionPanel: ActionPanelView | null = null;

  @property(CenterTableView)
  centerTable: CenterTableView | null = null;

  renderGameView(view: PlayerGameView, selectedTile: TileId | null, legalDiscardTiles: TileId[], submitting: boolean): void {
    this.ensureRuntimeRegions();
    this.centerTable?.renderCenter(view);
    this.handView?.renderHand(view.self.hand, legalDiscardTiles, selectedTile);
    this.actionPanel?.renderActions(view.legalActions, submitting);
    this.renderTableStatus(view);
    this.renderPublicKongTiles(view);
    this.renderSeats(view);
    this.renderDiscards(view);
    this.renderMelds(view);
  }

  private ensureRuntimeRegions(): void {
    if (!this.centerTable) this.centerTable = ensureComponent(ensureChild(this.node, 'CenterTable'), CenterTableView);
    if (!this.handView) this.handView = ensureComponent(ensureChild(this.node, 'Hand'), HandView);
    if (!this.actionPanel) this.actionPanel = ensureComponent(ensureChild(this.node, 'ActionPanel'), ActionPanelView);
    ensureChild(this.node, 'Seats');
    ensureChild(this.node, 'Discards');
    ensureChild(this.node, 'Melds');
    ensureChild(this.node, 'PublicKongTiles');
    ensureChild(this.node, 'Status');
  }

  private renderTableStatus(view: PlayerGameView): void {
    const status = ensureChild(this.node, 'Status');
    status.removeAllChildren();
    createLabel(status, 'DealerLabel', `庄家：${view.dealer}`);
    createLabel(status, 'ScoreLabel', `分数：${view.scores.join(' / ')}`);
    createLabel(status, 'XiaoJiLabel', `小鸡万能：${view.xiaoJiActiveAsWild ? '开启' : '关闭'}`);
    createLabel(status, 'LastDiscardLabel', `上张出牌：${view.lastDiscard ? `${getTileLabel(view.lastDiscard.tile)} / ${view.lastDiscard.fromPlayer}号位` : '无'}`);
    createLabel(status, 'RestrictionLabel', `限制：${view.restrictions?.join('、') || '无'}`);
  }

  private renderPublicKongTiles(view: PlayerGameView): void {
    const region = ensureChild(this.node, 'PublicKongTiles');
    region.removeAllChildren();
    createLabel(region, 'TitleLabel', '公开杠牌');
    view.publicKongTiles.forEach((tileId, index) => {
      const node = new Node(`PublicKongTile${index}`);
      node.setPosition(new Vec3(index * 48, -48, 0));
      ensureComponent(node, TileView).setTile(tileId);
      region.addChild(node);
    });
  }

  private renderSeats(view: PlayerGameView): void {
    const region = ensureChild(this.node, 'Seats');
    region.removeAllChildren();
    const mapped = mapSeats(view);
    mapped.forEach((seat) => {
      const player = seat.isSelf
        ? ({
            seatIndex: view.playerIndex,
            handCount: view.self.hand.length,
            melds: view.self.melds,
            discards: view.self.discards,
            status: 'SELF',
            nickname: '我',
          } satisfies PlayerPublicView)
        : view.opponents.find((opponent) => opponent.seatIndex === seat.seatIndex);
      if (!player) return;
      const seatNode = ensureChild(region, `Seat_${seat.position}`);
      seatNode.setPosition(this.positionForSeat(seat.position));
      const seatView = ensureComponent(seatNode, PlayerSeatView);
      seatView.nameLabel = createLabel(seatNode, 'NameLabel', player.nickname || `座位 ${player.seatIndex}`);
      seatView.countLabel = createLabel(seatNode, 'CountLabel', `${player.handCount} 张`);
      seatView.renderSeat(player, seat.position, view.currentPlayer === player.seatIndex);
    });
  }

  private renderDiscards(view: PlayerGameView): void {
    const region = ensureChild(this.node, 'Discards');
    region.removeAllChildren();
    const players: Array<{ position: LocalSeatPosition; discards: TileId[] }> = [
      { position: 'bottom', discards: view.self.discards },
      ...view.opponents.map((player) => ({
        position: mapSeats(view).find((seat) => seat.seatIndex === player.seatIndex)?.position || 'top',
        discards: player.discards,
      })),
    ];
    players.forEach((player) => {
      const node = ensureChild(region, `Discards_${player.position}`);
      node.setPosition(this.positionForDiscard(player.position));
      ensureComponent(node, DiscardView).renderDiscards(player.discards, player.position);
    });
  }

  private renderMelds(view: PlayerGameView): void {
    const region = ensureChild(this.node, 'Melds');
    region.removeAllChildren();
    const selfNode = ensureChild(region, 'Melds_bottom');
    selfNode.setPosition(new Vec3(-420, -230, 0));
    ensureComponent(selfNode, MeldView).renderMelds(view.self.melds);
    view.opponents.forEach((player) => {
      const position = mapSeats(view).find((seat) => seat.seatIndex === player.seatIndex)?.position || 'top';
      const node = ensureChild(region, `Melds_${position}`);
      node.setPosition(this.positionForMeld(position));
      ensureComponent(node, MeldView).renderMelds(player.melds);
    });
  }

  private positionForSeat(position: LocalSeatPosition): Vec3 {
    if (position === 'bottom') return new Vec3(0, -300, 0);
    if (position === 'right') return new Vec3(520, 0, 0);
    if (position === 'top') return new Vec3(0, 300, 0);
    return new Vec3(-520, 0, 0);
  }

  private positionForDiscard(position: LocalSeatPosition): Vec3 {
    if (position === 'bottom') return new Vec3(-120, -105, 0);
    if (position === 'right') return new Vec3(240, 120, 0);
    if (position === 'top') return new Vec3(-120, 105, 0);
    return new Vec3(-240, 120, 0);
  }

  private positionForMeld(position: LocalSeatPosition): Vec3 {
    if (position === 'bottom') return new Vec3(-420, -230, 0);
    if (position === 'right') return new Vec3(420, -180, 0);
    if (position === 'top') return new Vec3(-420, 230, 0);
    return new Vec3(-560, -180, 0);
  }
}
