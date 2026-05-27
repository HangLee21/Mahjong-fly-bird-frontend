import { GameEvents } from '../app/GameEvents';
import { eventBus } from '../core/EventBus';
import { replayApi } from './ReplayApi';
import type { ReplayRecord, ReplayStep } from './ReplayTypes';

export class ReplayManager {
  record: ReplayRecord | null = null;
  index = 0;

  async load(gameId: string): Promise<ReplayRecord> {
    this.record = await replayApi.get(gameId);
    this.index = 0;
    this.emitCurrent();
    return this.record;
  }

  current(): ReplayStep | null {
    return this.record?.steps[this.index] || null;
  }

  next(): ReplayStep | null {
    if (!this.record) return null;
    this.index = Math.min(this.index + 1, this.record.steps.length - 1);
    return this.emitCurrent();
  }

  previous(): ReplayStep | null {
    if (!this.record) return null;
    this.index = Math.max(this.index - 1, 0);
    return this.emitCurrent();
  }

  private emitCurrent(): ReplayStep | null {
    const step = this.current();
    if (step) eventBus.emit(GameEvents.GAME_VIEW_CHANGED, { view: step.view, events: step.events });
    return step;
  }
}

export const replayManager = new ReplayManager();
