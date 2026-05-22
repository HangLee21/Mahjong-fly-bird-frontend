import { Component } from 'cc';

export class BaseScene extends Component {
  protected initialized = false;

  async enter(): Promise<void> {
    this.initialized = true;
  }

  leave(): void {
    this.initialized = false;
  }
}
