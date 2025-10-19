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

## Redis-backed distributed room schema

### Core keys

| Key | Type | Contents | Notes |
| --- | ---- | -------- | ----- |
| `room:{roomId}` | Hash | Canonical metadata (`id`, `phase`, `turnIndex`, `currentPlayerId`, `winnerId`, `createdAt`, `updatedAt`) | All values stored as strings; `turnIndex` and timestamps are numeric strings. |
| `room:{roomId}:members` | Hash | `playerId -> JSON` describing socket id, profile, seat index, and token summary | Used to rebuild in-memory `players`, `playerTokens`, and `playerPaths`. |
| `room:{roomId}:turn_queue` | Sorted Set | Member: `playerId`, Score: turn order index | Allows atomic `ZPOPMIN`/`ZADD` to rotate turns and skip removed players. |
| `room:{roomId}:events` | List | JSON-encoded command/event records (roll, move, capture, victory) | Acts as durable history for coordinator replay or reconciliation. |
| `socket_room` | Hash | `socketId -> roomId` | Enables quick lookup for disconnect handling across instances. |
| `room_index` | Sorted Set | Member: `roomId`, Score: `updatedAt` | Supports dashboards and idle eviction scans. |

All room identifiers are stored in lowercase to match the `RoomRegistry` invariant. Complex entities (player profiles, token arrays, turn state details) should be JSON encoded inside hashes to keep the Redis schema compact while still letting coordinators fetch a single key when rehydrating room state.

### Command and event lifecycle

1. **Room creation**
   - Coordinator performs `HSETNX room:{roomId}` with metadata and initializes `room_index` and `turn_queue` in a transaction (`MULTI/EXEC` or Lua) to guarantee a single creator wins.
   - `events` list is optionally seeded with a `room_created` record for audit trails.
2. **Player join**
   - Coordinator adds an entry to `room:{roomId}:members` (JSON payload containing socket id, avatar, tokens) and inserts the player into `turn_queue` using `ZADD` with the next seat order.
   - `socket_room` is updated atomically in the same transaction to avoid orphaned sockets if a crash occurs mid-join.
   - A `player_joined` event is pushed to `events` for downstream consumers.
3. **Player leave / disconnect**
   - On explicit leave or socket timeout, coordinator removes the player from `members`, deletes their mapping from `socket_room`, and removes them from `turn_queue` via `ZREM`.
   - If the room empties, metadata `phase` becomes `finished` and cleanup is triggered (see below).
   - A `player_left` event is appended; consumers use this to cancel pending commands.
4. **Turn advancement**
   - `turn_queue` maintains the authoritative order. Dice roll commands atomically fetch `ZPOPMIN`, process the move, and push the player back with incremented index (modulo player count).
   - `room:{roomId}` hash updates `turnIndex`, `currentPlayerId`, and any `turnState` JSON snapshot in the same transaction to keep state cohesive.
   - Roll, move, capture, or skip outcomes are appended to `events` with sufficient payload for idempotent replay (dice value, token id, resulting positions).
5. **Result submission**
   - Once a player finishes, their token statuses in `members` and the `winnerId` / `pendingResults` fields in `room:{roomId}` are updated. A `game_finished` event is added for the profile persistence worker.
   - Coordinators should also flag `phase = finished` when all outcomes are recorded, so other services stop scheduling turns.
6. **Cleanup**
   - After persisting results or if the room becomes empty, `DEL` the room-specific keys (`room:{roomId}`, `:members`, `:turn_queue`, `:events`) and remove the entry from `room_index` and `socket_room`.
   - Cleanup transactions should be conditional (`WATCH room:{roomId}`) to avoid deleting rooms that just received a new join.

### Expiry and reconciliation

- **Idle expiry**: attach a TTL to `room:{roomId}` and related keys when the room enters `waiting` with zero players, refreshing the TTL on each join or turn update. A background job scans `room_index` by `updatedAt` to identify rooms whose `updatedAt` is older than the configured idle threshold, issuing cleanup commands.
- **Coordinator reconciliation**: consumers replay the `events` list to reconstruct state when taking over after a crash. Each command handler should be idempotent by referencing event identifiers or by checking `turnState` hashes before applying mutations. If divergence is detected (e.g., missing member in `members` hash when handling a move), the coordinator logs the issue, rehydrates from authoritative player data, and rewrites the member hash before proceeding.
- **Socket mismatch handling**: when `socket_room` references a room that no longer exists, the consumer deletes the mapping and emits a `player_left` event to keep downstream services consistent.

This schema ensures any coordinator instance can atomically mutate room state, replay game history, and evict stale rooms without relying on in-memory singletons.
