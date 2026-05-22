export const ApiRoutes = {
  wechatLogin: '/auth/wechat-login',
  rooms: '/rooms',
  joinRoom: (roomId: string) => `/rooms/${roomId}/join`,
  leaveRoom: (roomId: string) => `/rooms/${roomId}/leave`,
  addAi: (roomId: string) => `/rooms/${roomId}/add-ai`,
  startGame: (roomId: string) => `/rooms/${roomId}/start`,
  room: (roomId: string) => `/rooms/${roomId}`,
  gameView: (gameId: string) => `/games/${gameId}/view`,
  gameAction: (gameId: string) => `/games/${gameId}/actions`,
  replays: '/replays',
  replay: (gameId: string) => `/replays/${gameId}`,
};
