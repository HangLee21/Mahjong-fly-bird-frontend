import { _decorator, Color, Component, Graphics, Input, Label, Layers, Node, tween, UITransform, Vec3 } from 'cc';
import { createImage, createLabel, createLayout, ensureComponent, RuntimeLayout } from './RuntimeUi';

const { ccclass } = _decorator;

const BACKDROP_COLOR = new Color(10, 14, 20, 235);
const ACCENT_COLOR = new Color(46, 204, 113, 255);
const BAR_BG_COLOR = new Color(255, 255, 255, 30);
const BAR_BORDER_COLOR = new Color(255, 255, 255, 90);
const ERROR_COLOR = new Color(231, 76, 60, 255);
const LOADING_DIR = 'textures/ui/loading';
// loading_bar_bg.png was trimmed to 1249x261 (aspect 4.785).
const IMAGE_BAR_WIDTH = 560;
const IMAGE_BAR_HEIGHT = Math.round(IMAGE_BAR_WIDTH / 4.785);
const FALLBACK_BAR_WIDTH = 560;
const FALLBACK_BAR_HEIGHT = 16;
const SPINNER_RADIUS = 26;
const SPINNER_SPEED = 240;

@ccclass('LoadingOverlay')
export class LoadingOverlay extends Component {
  private percentLabel: Label | null = null;
  private tipLabel: Label | null = null;
  private errorLabel: Label | null = null;
  private codeTitle: Label | null = null;
  private codeSpinner: Graphics | null = null;
  private codeBar: Graphics | null = null;
  private imageBarFill: Node | null = null;
  private imageBarY = -45;
  private spinnerAngle = 0;
  private progress = 0;
  private assetsApplied = false;
  private retryResolve: (() => void) | null = null;
  private layout: RuntimeLayout | null = null;

  build(layout: RuntimeLayout): void {
    this.layout = layout;
    const root = this.node;
    root.layer = Layers.Enum.UI_2D;
    ensureComponent(root, UITransform).setContentSize(layout.width, layout.height);
    this.imageBarY = layout.h(-7);

    const backdropNode = new Node('LoadingBackdrop');
    backdropNode.layer = Layers.Enum.UI_2D;
    root.addChild(backdropNode);
    const backdrop = ensureComponent(backdropNode, Graphics);
    backdrop.fillColor = BACKDROP_COLOR;
    backdrop.rect(-layout.width / 2, -layout.height / 2, layout.width, layout.height);
    backdrop.fill();

    const spinnerNode = new Node('LoadingSpinner');
    spinnerNode.layer = Layers.Enum.UI_2D;
    root.addChild(spinnerNode);
    ensureComponent(spinnerNode, UITransform).setContentSize(120, 120);
    const spinner = ensureComponent(spinnerNode, Graphics);
    spinner.lineWidth = 7;
    spinner.strokeColor = ACCENT_COLOR;
    spinnerNode.setPosition(0, layout.h(8), 0);
    this.codeSpinner = spinner;
    this.drawSpinner(0);

    const title = createLabel(root, 'LoadingTitle', '资源加载中', new Vec3(0, layout.h(16), 0));
    (title as Label & { fontSize?: number; lineHeight?: number }).fontSize = 46;
    (title as Label & { fontSize?: number; lineHeight?: number }).lineHeight = 58;
    this.codeTitle = title;

    this.percentLabel = createLabel(root, 'LoadingPercent', '0%', new Vec3(0, layout.h(3), 0));
    (this.percentLabel as Label & { fontSize?: number; lineHeight?: number }).fontSize = 34;
    (this.percentLabel as Label & { fontSize?: number; lineHeight?: number }).lineHeight = 42;

    const barNode = new Node('LoadingBar');
    barNode.layer = Layers.Enum.UI_2D;
    root.addChild(barNode);
    barNode.setPosition(0, this.imageBarY, 0);
    const barBackground = ensureComponent(barNode, Graphics);
    barBackground.fillColor = BAR_BG_COLOR;
    barBackground.strokeColor = BAR_BORDER_COLOR;
    barBackground.lineWidth = 2;
    barBackground.roundRect(-FALLBACK_BAR_WIDTH / 2, -FALLBACK_BAR_HEIGHT / 2, FALLBACK_BAR_WIDTH, FALLBACK_BAR_HEIGHT, FALLBACK_BAR_HEIGHT / 2);
    barBackground.fill();
    barBackground.stroke();

    const barFillNode = new Node('LoadingBarFill');
    barFillNode.layer = Layers.Enum.UI_2D;
    barNode.addChild(barFillNode);
    const barFill = ensureComponent(barFillNode, Graphics);
    barFill.fillColor = ACCENT_COLOR;
    this.codeBar = barFill;
    this.drawBar(0);

    this.tipLabel = createLabel(root, 'LoadingTip', '正在准备…', new Vec3(0, layout.h(-13), 0));
    (this.tipLabel as Label & { fontSize?: number; lineHeight?: number }).fontSize = 24;
    (this.tipLabel as Label & { fontSize?: number; lineHeight?: number }).lineHeight = 30;

    this.errorLabel = createLabel(root, 'LoadingError', '', new Vec3(0, layout.h(-18), 0));
    (this.errorLabel as Label & { fontSize?: number; lineHeight?: number }).fontSize = 26;
    (this.errorLabel as Label & { fontSize?: number; lineHeight?: number }).lineHeight = 32;
    (this.errorLabel as Label & { color?: Color }).color = ERROR_COLOR;
    this.errorLabel.node.active = false;
  }

  /** Stage 0 finished: swap the code-drawn visuals for the AI-generated assets. */
  useLoadedAssets(): void {
    if (this.assetsApplied) return;
    this.assetsApplied = true;

    const layout = this.layout || createLayout();
    const root = this.node;

    if (this.codeTitle) this.codeTitle.node.parent = null;
    const codeSpinnerNode = this.codeSpinner?.node;
    if (codeSpinnerNode) codeSpinnerNode.parent = null;
    const codeBarNode = this.codeBar?.node.parent;
    if (codeBarNode) codeBarNode.parent = null;

    createImage(root, 'LoadingBgImage', `${LOADING_DIR}/loading_bg`, layout.width, layout.height, Vec3.ZERO);
    const logoSize = layout.s(26);
    createImage(root, 'LoadingLogoImage', `${LOADING_DIR}/loading_logo`, logoSize, logoSize, new Vec3(0, layout.h(22), 0));
    const spinnerSize = layout.s(12);
    const spinner = createImage(
      root,
      'LoadingSpinnerImage',
      `${LOADING_DIR}/loading_spinner`,
      spinnerSize,
      spinnerSize,
      new Vec3(0, layout.h(4), 0),
    );
    tween(spinner).by(1, { angle: 360 }).repeatForever().start();

    createImage(
      root,
      'LoadingBarBgImage',
      `${LOADING_DIR}/loading_bar_bg`,
      IMAGE_BAR_WIDTH,
      IMAGE_BAR_HEIGHT,
      new Vec3(0, this.imageBarY, 0),
    );
    const fill = createImage(
      root,
      'LoadingBarFillImage',
      `${LOADING_DIR}/loading_bar_fill`,
      IMAGE_BAR_WIDTH,
      IMAGE_BAR_HEIGHT,
      new Vec3(0, this.imageBarY, 0),
    );
    this.imageBarFill = fill;

    this.percentLabel?.node.setPosition(0, layout.h(-15), 0);
    this.tipLabel?.node.setPosition(0, layout.h(-21), 0);
    this.errorLabel?.node.setPosition(0, layout.h(-26), 0);
    this.setPhase('loading');
    this.drawBar(this.progress);
  }

  setProgress(finished: number, total: number): void {
    const percent = total > 0 ? Math.min(100, Math.max(0, Math.round((finished / total) * 100))) : 100;
    if (this.percentLabel) this.percentLabel.string = `${percent}%`;
    this.progress = percent / 100;
    this.drawBar(this.progress);
  }

  showLoadingPhase(): void {
    this.setPhase('loading');
  }

  private setPhase(phase: 'preparing' | 'loading'): void {
    if (!this.tipLabel) return;
    if (phase === 'preparing') {
      this.tipLabel.string = '正在准备加载页面…';
    } else {
      this.tipLabel.string = '首次加载需下载游戏资源，请耐心等待';
    }
  }

  showError(message: string): void {
    if (this.errorLabel) {
      this.errorLabel.string = message;
      this.errorLabel.node.active = true;
    }
    if (this.tipLabel) this.tipLabel.string = '点击屏幕任意位置重试';
  }

  waitForRetry(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.retryResolve = resolve;
      this.node.on(Input.EventType.TOUCH_START, this.onRetryTap, this);
    });
  }

  hide(): void {
    this.node.active = false;
  }

  update(dt: number): void {
    if (this.assetsApplied) return;
    this.spinnerAngle = (this.spinnerAngle + dt * SPINNER_SPEED) % 360;
    this.drawSpinner(this.spinnerAngle);
  }

  private onRetryTap = (): void => {
    this.node.off(Input.EventType.TOUCH_START, this.onRetryTap, this);
    if (this.errorLabel) this.errorLabel.node.active = false;
    if (this.tipLabel) this.tipLabel.string = '重新连接资源…';
    const resolve = this.retryResolve;
    this.retryResolve = null;
    resolve?.();
  };

  private drawBar(progress: number): void {
    if (this.assetsApplied) {
      const fillNode = this.imageBarFill;
      if (!fillNode) return;
      const ratio = Math.max(0, Math.min(1, progress));
      fillNode.setPosition((IMAGE_BAR_WIDTH / 2) * (ratio - 1), this.imageBarY, 0);
      fillNode.setScale(ratio, 1, 1);
      return;
    }
    const fill = this.codeBar;
    if (!fill) return;
    const width = Math.max(0, Math.min(1, progress)) * (FALLBACK_BAR_WIDTH - 4);
    fill.clear();
    fill.fillColor = ACCENT_COLOR;
    fill.roundRect(-FALLBACK_BAR_WIDTH / 2 + 2, -FALLBACK_BAR_HEIGHT / 2 + 2, width, FALLBACK_BAR_HEIGHT - 4, (FALLBACK_BAR_HEIGHT - 4) / 2);
    fill.fill();
  }

  private drawSpinner(angleDegrees: number): void {
    const spinner = this.codeSpinner;
    if (!spinner) return;
    const radians = (angleDegrees * Math.PI) / 180;
    spinner.clear();
    spinner.strokeColor = ACCENT_COLOR;
    spinner.lineWidth = 7;
    spinner.arc(0, 0, SPINNER_RADIUS, radians, radians + 4.6, false);
    spinner.stroke();
  }
}
