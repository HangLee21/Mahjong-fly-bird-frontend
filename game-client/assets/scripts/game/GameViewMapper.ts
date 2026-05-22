import type { LocalSeatPosition, PlayerGameView } from './GameTypes';
import { mapSeatToLocalPosition } from '../utils/TileUtils';

export interface MappedSeat {
  seatIndex: number;
  position: LocalSeatPosition;
  isSelf: boolean;
}

export function mapSeats(view: PlayerGameView): MappedSeat[] {
  return [
    { seatIndex: view.playerIndex, position: 'bottom', isSelf: true },
    ...view.opponents.map((player) => ({
      seatIndex: player.seatIndex,
      position: mapSeatToLocalPosition(view.playerIndex, player.seatIndex),
      isSelf: false,
    })),
  ];
}
