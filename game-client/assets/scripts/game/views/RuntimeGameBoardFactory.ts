import { Label, Node } from 'cc';
import { ensureChild, ensureComponent, ensureView } from '../../ui/RuntimeUi';
import { ActionPanelView } from './ActionPanelView';
import { CenterTableView } from './CenterTableView';
import { GameBoardView } from './GameBoardView';
import { HandView } from './HandView';

export function buildGameBoardView(parent: Node): GameBoardView {
  const board = ensureView(parent, 'GameBoard', GameBoardView);
  const centerTable = ensureView(board.node, 'CenterTable', CenterTableView);
  const hand = ensureView(board.node, 'Hand', HandView);
  const actionPanel = ensureView(board.node, 'ActionPanel', ActionPanelView);

  centerTable.currentPlayerLabel = ensureComponent(ensureChild(centerTable.node, 'CurrentPlayerLabel'), Label);
  centerTable.wallLabel = ensureComponent(ensureChild(centerTable.node, 'WallLabel'), Label);

  board.centerTable = centerTable;
  board.handView = hand;
  board.actionPanel = actionPanel;
  return board;
}
