import { _decorator } from 'cc';
import { loadScene } from '../app/SceneNavigator';
import { BaseScene } from '../core/BaseScene';
import { gameManager } from '../game/GameManager';
import { mockFinishedGameView } from '../mock/MockData';
import { createButton, createLabel, ensureCanvas, ensureChild, ensureComponent } from '../ui/RuntimeUi';
import { ResultPanelView } from './ResultPanelView';

const { ccclass, property } = _decorator;

@ccclass('ResultController')
export class ResultController extends BaseScene {
  @property(ResultPanelView)
  resultPanel: ResultPanelView | null = null;

  async start(): Promise<void> {
    await this.enter();
  }

  async enter(): Promise<void> {
    await super.enter();
    this.buildRuntimeUi();
    const view = gameManager.snapshot().view || mockFinishedGameView;
    this.resultPanel?.renderResult(view.result);
  }

  openReplay(): void {
    loadScene('Replay');
  }

  backToLobby(): void {
    loadScene('Lobby');
  }

  private buildRuntimeUi(): void {
    const canvas = ensureCanvas(this.node);
    if (!this.resultPanel) {
      const panelNode = ensureChild(canvas, 'ResultPanel');
      this.resultPanel = ensureComponent(panelNode, ResultPanelView);
      this.resultPanel.titleLabel = createLabel(panelNode, 'TitleLabel', '牌局结束');
      this.resultPanel.detailLabel = createLabel(panelNode, 'DetailLabel', '结算中');
    }
    createButton(canvas, 'ReplayButton', '查看回放', () => this.openReplay());
    createButton(canvas, 'LobbyButton', '返回大厅', () => this.backToLobby());
  }
}
