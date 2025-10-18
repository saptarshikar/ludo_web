/**
 * Coordinated view of a game room returned to transport adapters.
 * @typedef {ReturnType<import('../entities/LudoGame').LudoGame['getState']>} LudoGameState
 */

/**
 * Coordinated view of a game room returned to transport adapters.
 * @typedef {Object} CoordinatedRoom
 * @property {string} id
 * @property {{
 *   getState: () => LudoGameState,
 *   players: Array<any>,
 *   phase: string,
 *   winnerId: string | null,
 *   turnState?: any,
 *   currentPlayer?: any,
 *   pendingResults?: any,
 *   rollDice: (playerId: string) => number,
 *   moveToken: (playerId: string, tokenIndex: number) => void,
 *   startGame: (playerId: string) => void,
 *   addPlayer: (args: any) => any,
 *   addAiPlayer: (difficulty: string) => any,
 *   pushHistory: (entry: any) => void,
 *   advanceTurn: (force: boolean) => void,
 * }} game
 */

/**
 * Summary emitted to clients whenever the room state changes.
 * @typedef {Object} RoomBroadcast
 * @property {string} roomId
 * @property {string} phase
 * @property {Array<any>} players
 * @property {number} availableSeats
 * @property {number} maxPlayers
 * @property {string | null} hostId
 */

/**
 * Parameters supplied to join a player to a room.
 * @typedef {Object} JoinPlayerParams
 * @property {string} roomId
 * @property {string} socketId
 * @property {string | null} [playerName]
 * @property {Object | null} [profile]
 * @property {boolean} [isGuest]
 */

/**
 * Coordinates gameplay orchestration required by transports.
 * @typedef {Object} GameCoordinator
 * @property {(roomId: string) => CoordinatedRoom} getRoomOrFail
 * @property {(params: JoinPlayerParams) => Promise<{ player: any, room: CoordinatedRoom }>} joinPlayer
 * @property {(params: { roomId: string, difficulty: string }) => Promise<{ player: any, room: CoordinatedRoom }> } addAiPlayer
 * @property {(params: { roomId: string, playerId: string }) => Promise<{ room: CoordinatedRoom }> } startGame
 * @property {(params: { roomId: string, playerId: string }) => Promise<{ room: CoordinatedRoom, value: number }> } rollDice
 * @property {(params: { roomId: string, playerId: string, tokenIndex: number }) => Promise<{ room: CoordinatedRoom }> } moveToken
 * @property {(params: { roomId: string }) => Promise<{ room: CoordinatedRoom }> } requestState
 * @property {(socketId: string) => Promise<{ roomId: string, playerId: string, room: CoordinatedRoom | null } | null>} removeSocket
 * @property {(params: { roomId: string }) => Promise<{ room: CoordinatedRoom, winnerId: string }> } debugEndGame
 * @property {(room: CoordinatedRoom) => LudoGameState} buildRoomState
 * @property {(room: CoordinatedRoom, maxIterations?: number) => Promise<Array<any>>} runAiTurns
 * @property {(room: CoordinatedRoom) => Promise<void>} persistPendingResults
 */

module.exports = {};
