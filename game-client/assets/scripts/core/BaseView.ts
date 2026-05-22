import { Component } from 'cc';

export class BaseView<T = unknown> extends Component {
  protected data: T | null = null;

  render(data: T): void {
    this.data = data;
  }

  clear(): void {
    this.data = null;
  }
}
