export class ReconnectPolicy {
  private attempts = 0;

  reset(): void {
    this.attempts = 0;
  }

  nextDelay(): number {
    const delay = this.attempts === 0 ? 0 : Math.min(10000, 1000 * 2 ** (this.attempts - 1));
    this.attempts += 1;
    return delay;
  }
}
