import { _decorator, Component } from 'cc';
import { mapSeats } from '../GameViewMapper';
import type { PlayerGameView, TileId } from '../GameTypes';
import { ActionPanelView } from './ActionPanelView';
import { CenterTableView } from './CenterTableView';
import { HandView } from './HandView';

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
    this.centerTable?.renderCenter(view);
    this.handView?.renderHand(view.self.hand, legalDiscardTiles, selectedTile);
    this.actionPanel?.renderActions(view.legalActions, submitting);
    mapSeats(view);
  }
}
