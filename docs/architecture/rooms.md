# Room and Game State Holders

## GameCoordinator service
- `GameCoordinator` does not persist its own mutable fields beyond references to the injected `roomRegistry` and `profileRepository`, but it orchestrates several mutable game structures via the registry. 【F:src/application/services/GameCoordinator.js†L76-L82】
- Every join action retrieves or creates a `room` from the registry and appends player records by calling `room.game.addPlayer` / `addAiPlayer`, which in turn mutate the Ludo game collections (`players`, `playerTokens`, `playerPaths`). 【F:src/application/services/GameCoordinator.js†L96-L125】【F:src/domain/entities/LudoGame.js†L19-L84】
- Room-scoped game state tracked through the coordinator includes:
  - `room.game.players`: ordered list of human and AI player descriptors (id, socket linkage, profile metadata). 【F:src/domain/entities/LudoGame.js†L19-L84】
  - `room.game.playerTokens`: `Map<playerId, token[]>` holding each pawn's status (`base`, `active`, `finished`) and step count. 【F:src/domain/entities/LudoGame.js†L20-L22】【F:src/domain/entities/LudoGame.js†L138-L217】
  - `room.game.playerPaths`: per-player traversal paths constructed from the starting index. 【F:src/domain/entities/LudoGame.js†L21-L22】【F:src/domain/entities/LudoGame.js†L46-L64】
  - `room.game.turnIndex` and `room.game.currentPlayer`: locate whose turn is active; adjusted after moves, skips, or removals. 【F:src/domain/entities/LudoGame.js†L23-L24】【F:src/domain/entities/LudoGame.js†L246-L311】
  - `room.game.phase`: lifecycle marker (`waiting`, `playing`, `finished`). 【F:src/domain/entities/LudoGame.js†L24-L25】【F:src/domain/entities/LudoGame.js†L90-L118】【F:src/domain/entities/LudoGame.js†L246-L311】
  - `room.game.turnState`: dice roll, pending moves, and `awaitingMove` flag; mutated by dice rolls, moves, AI execution, and skip logic. 【F:src/domain/entities/LudoGame.js†L25-L34】【F:src/application/services/GameCoordinator.js†L175-L214】【F:src/domain/entities/LudoGame.js†L163-L217】
  - `room.game.lastEvent` and `room.game.history`: append-only structures summarizing dice rolls, captures, finishes, and wins with timestamps. 【F:src/domain/entities/LudoGame.js†L26-L27】【F:src/domain/entities/LudoGame.js†L187-L247】
  - `room.game.winnerId` and `room.game.pendingResults`: populated on victory (including participant roster) and consumed by `persistPendingResults` for profile persistence. 【F:src/domain/entities/LudoGame.js†L27-L29】【F:src/domain/entities/LudoGame.js†L286-L311】【F:src/application/services/GameCoordinator.js†L84-L117】
  - `room.game.createdAt`: timestamp assigned on room creation (via `RoomRegistry`). 【F:src/infrastructure/rooms/RoomRegistry.js†L10-L18】
- Connection lifecycle: `joinPlayer` and `removeSocket` maintain the socket-to-room binding, cleaning rooms when the game empties. `debugEndGame`, `runAiTurns`, and `executeAiStep` adjust `phase`, `turnState`, and `history` directly, showcasing the mutable surfaces that a distributed coordinator must preserve. 【F:src/application/services/GameCoordinator.js†L96-L125】【F:src/application/services/GameCoordinator.js†L138-L214】

## RoomRegistry infrastructure
- `rooms`: `Map<roomId, { id, game, createdAt }>` storing canonical, lowercased ids and the live `LudoGame` instance for each room. Creation happens lazily via `getOrCreate`. 【F:src/infrastructure/rooms/RoomRegistry.js†L4-L19】
- `socketToRoom`: `Map<socketId, roomId>` used to reconnect events to a room or expunge sockets on disconnect. 【F:src/infrastructure/rooms/RoomRegistry.js†L5-L7】【F:src/infrastructure/rooms/RoomRegistry.js†L21-L40】
- Membership changes funnel through the registry:
  - `setSocketRoom` and `getRoomBySocket` manage lookup indirection for transports. 【F:src/infrastructure/rooms/RoomRegistry.js†L21-L34】
  - `removeSocket` deletes the socket binding, removes the player via `room.game.removePlayer`, and destroys empty rooms. 【F:src/infrastructure/rooms/RoomRegistry.js†L26-L40】
  - `removeRoom` allows administrative teardown, while `listActiveRooms` exposes counts and phase snapshots for dashboards. 【F:src/infrastructure/rooms/RoomRegistry.js†L42-L58】

## Coordinator ↔ Registry invariants
- All public coordinator flows begin by asking the registry for the room, guaranteeing trimmed, lowercased ids and a pre-initialized `LudoGame`. 【F:src/application/services/GameCoordinator.js†L76-L138】【F:src/infrastructure/rooms/RoomRegistry.js†L10-L19】
- Socket membership is the glue between services: joins call `setSocketRoom`, and disconnections rely on `removeSocket` to eject players and prune empty rooms. Any Redis-backed registry must atomically update both the room roster and socket index to preserve this invariant. 【F:src/application/services/GameCoordinator.js†L108-L125】【F:src/application/services/GameCoordinator.js†L154-L170】【F:src/infrastructure/rooms/RoomRegistry.js†L21-L40】
- Game conclusion handling assumes `pendingResults` survives until `persistPendingResults` consumes it; external storage should keep participant lists and winner ids side-by-side with room lifecycle timestamps. 【F:src/application/services/GameCoordinator.js†L84-L117】【F:src/domain/entities/LudoGame.js†L286-L324】
- Automated turns mutate the same `turnState` and history objects as human moves (`rollDice`, `moveToken`, `advanceTurn`), so remote executors must serialize dice rolls, move resolutions, and resulting turn index changes exactly once to avoid divergent state. 【F:src/application/services/GameCoordinator.js†L175-L214】【F:src/domain/entities/LudoGame.js†L163-L311】
