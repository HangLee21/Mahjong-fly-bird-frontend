# WebSocket 协议

客户端发送：

```json
{
  "type": "GAME_ACTION",
  "requestId": "req_001",
  "roomId": "886688",
  "gameId": "game_001",
  "payload": {
    "type": "DISCARD",
    "tile": 18,
    "actionId": 103,
    "clientSeq": 18
  }
}
```

服务端推送：

| type | payload |
| --- | --- |
| `ROOM_UPDATE` | `{ room }` |
| `GAME_VIEW` | `{ view }` |
| `GAME_EVENTS` | `{ events }` |
| `ERROR` | `{ code, message }` |
| `PONG` | 空 |
