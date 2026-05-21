import { mockFinishedView, mockGameView, mockLoginResult, mockReplay, mockReplaySummary, mockRoom } from './data';
import type { LoginResult } from '../../types/auth.types';
import type { ActionResult, ClientAction, PlayerGameView } from '../../types/game.types';
import type { ReplayDetail, ReplaySummary } from '../../types/replay.types';
import type { CreateRoomInput, CreateRoomResult, RoomView, StartGameResult } from '../../types/room.types';

let room: RoomView = { ...mockRoom };
let latestView: PlayerGameView = { ...mockGameView };

export async function mockWechatLogin(): Promise<LoginResult> {
  return mockLoginResult;
}

export async function mockCreateRoom(_input: CreateRoomInput): Promise<CreateRoomResult> {
  room = { ...mockRoom, status: 'WAITING', gameId: undefined };
  return { room };
}

export async function mockJoinRoom(): Promise<RoomView> {
  return room;
}

export async function mockLeaveRoom(): Promise<void> {
  return undefined;
}

export async function mockAddAi(_roomId: string, seatIndex: number): Promise<RoomView> {
  room = {
    ...room,
    seats: room.seats.map((seat) =>
      seat.seatIndex === seatIndex
        ? { ...seat, user: { id: `ai_${seatIndex}`, nickname: `AI ${seatIndex}` }, isAI: true, isReady: true }
        : seat,
    ),
  };
  return room;
}

export async function mockStartGame(): Promise<StartGameResult> {
  room = { ...room, status: 'PLAYING', gameId: mockGameView.gameId };
  latestView = { ...mockGameView, status: 'PLAYING' };
  return { roomId: room.roomId, gameId: mockGameView.gameId };
}

export async function mockGetRoom(): Promise<RoomView> {
  return room;
}

export async function mockGetGameView(): Promise<PlayerGameView> {
  return latestView;
}

export async function mockSubmitAction(_gameId: string, action: ClientAction): Promise<ActionResult> {
  if (action.type === 'DISCARD') {
    latestView = {
      ...mockFinishedView,
      self: {
        ...mockFinishedView.self,
        discards: [...mockFinishedView.self.discards, action.tile || 18],
      },
    };
  }
  return { accepted: true, view: latestView };
}

export async function mockListReplays(): Promise<ReplaySummary[]> {
  return [mockReplaySummary];
}

export async function mockGetReplay(): Promise<ReplayDetail> {
  return mockReplay;
}
