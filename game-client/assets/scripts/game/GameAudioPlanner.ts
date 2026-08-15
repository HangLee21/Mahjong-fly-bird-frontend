import type { Meld, MeldType, PlayerGameView, TileId } from './GameTypes';

export type GameAudioCue =
  | { kind: 'MELD'; meldType: MeldType; seatIndex: number; stepIndex: number }
  | { kind: 'DISCARD'; tile: TileId; seatIndex: number; stepIndex: number };

function meldsForSeat(view: PlayerGameView, seatIndex: number): Meld[] {
  if (seatIndex === view.playerIndex) return view.self.melds;
  return [...view.opponents, ...(view.players ?? [])]
    .find((player) => player.seatIndex === seatIndex)?.melds ?? [];
}

function discardCountForSeat(view: PlayerGameView, seatIndex: number): number {
  if (seatIndex === view.playerIndex) return view.self.discards.length;
  return [...view.opponents, ...(view.players ?? [])]
    .find((player) => player.seatIndex === seatIndex)?.discards.length ?? 0;
}

/**
 * Converts one authoritative state transition into ordered presentation cues.
 * A response and its following discard may be collapsed into one snapshot, so
 * both cues must be retained instead of treating them as mutually exclusive.
 */
export function planGameAudioCues(previous: PlayerGameView, current: PlayerGameView): GameAudioCue[] {
  if (previous.gameId !== current.gameId || current.stepIndex <= previous.stepIndex) return [];

  const newMelds: Array<{ meld: Meld; seatIndex: number }> = [];
  for (let seatIndex = 0; seatIndex < 4; seatIndex += 1) {
    const beforeCount = meldsForSeat(previous, seatIndex).length;
    const after = meldsForSeat(current, seatIndex);
    after.slice(beforeCount).forEach((meld) => newMelds.push({ meld, seatIndex }));
  }

  // Do not replay a long backlog after reconnect. The newest meld is enough to
  // explain the current table state, followed by the newest discard if present.
  const newestMeld = newMelds.sort((a, b) => a.meld.stepIndex - b.meld.stepIndex).pop();
  const cues: GameAudioCue[] = [];
  if (newestMeld) {
    cues.push({
      kind: 'MELD',
      meldType: newestMeld.meld.type,
      seatIndex: newestMeld.seatIndex,
      stepIndex: newestMeld.meld.stepIndex,
    });
  }

  const discard = current.lastDiscard;
  if (discard) {
    const beforeCount = discardCountForSeat(previous, discard.fromPlayer);
    const afterCount = discardCountForSeat(current, discard.fromPlayer);
    if (afterCount > beforeCount) {
      cues.push({
        kind: 'DISCARD',
        tile: discard.tile,
        seatIndex: discard.fromPlayer,
        stepIndex: current.stepIndex,
      });
    }
  }
  return cues;
}
