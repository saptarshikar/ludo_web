# Development Guide

Checklist and tips for contributing to the Ludo Online project.

## Requirements

- Node.js ≥ 18; npm ≥ 9
- Google OAuth 2.0 Web Client ID (configured under Credentials in Google Cloud Console)
- Optional: Git for source control

## Installing

```bash
npm install
```

## Environment Setup

Create `.env` (or export variables before `npm start`):

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
PORT=3000
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=ludo_user
MYSQL_PASSWORD=ludo_pass
MYSQL_DATABASE=ludo
```

When testing without Google sign-in, omit the client ID. The UI will disable join actions until sign-in succeeds.

For the database you can either run `docker-compose up db` (recommended) or point the variables at an existing MySQL 8+ instance with permission to create tables.

## Running

```bash
npm start
```

The server hosts both API endpoints and static assets:

- http://localhost:3000 — Main UI
- `/health` — Liveness check
- `/config` — Google client config returned to the client

### Docker workflow

```bash
export GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
docker-compose up --build
```

This builds the application image, starts the Node server, and launches a MySQL service with persistent storage (`mysql_data` volume).

## Code Overview

| File | Purpose |
| --- | --- |
| `src/server.js` | Composition root wiring Express, Socket.IO, and dependencies. |
| `src/domain/` | Pure game rules (`LudoGame` entity, constants, utilities). |
| `src/application/` | `GameCoordinator` orchestrates gameplay use cases. |
| `src/infrastructure/rooms/RoomRegistry.js` | Manages room lifecycle and socket membership. |
| `src/infrastructure/persistence/MySqlProfileRepository.js` | MySQL-backed profile storage. |
| `src/infrastructure/sessions/InMemorySessionStore.js` | In-memory session token handling. |
| `public/app.js` | Client-side application: auth, lobby, canvas board. |
| `public/styles.css` | Tailored styling for dark theme and responsive layout. |

## Socket Events

| Event | Direction | Payload | Notes |
| --- | --- | --- | --- |
| `joinRoom` | client → server | `{ roomId, playerName, sessionToken }` | Requires valid session. |
| `addAiPlayer` | client → server | `{ difficulty }` | Host-only action. |
| `startGame` | client → server | — | Host-only; resets board. |
| `rollDice` | current player → server | — | Triggers available moves. |
| `moveToken` | current player → server | `{ tokenIndex }` | Must match returned indices. |
| `roomUpdate` | server → clients | Room metadata | Broadcast per change. |
| `gameState` | server → clients | Full board state | Broadcast per change. |

## Auth Flow (Google)

1. Client loads `https://accounts.google.com/gsi/client` script and renders button.
2. Credential returned to client → POST `/auth/google`.
3. Server verifies ID token with `google-auth-library`, stores/updates profile, returns session token.
4. Client uses session token for `/auth/session` and socket `joinRoom`.
5. `/auth/logout` revokes in-memory session; UI clears localStorage.

## AI Heuristics

Implemented in `src/server.js`:

- Easy: random move.
- Medium: tries finishing, then capturing, otherwise random.
- Hard: weighted score on finishing, capturing, and distance progress.

AI turns run on the server; `handleAiTurns` loops until a human’s turn or max iterations (safe guard of 40 loops).

## Testing Tips

- **Manual**: open multiple browser tabs, sign in with different Google accounts (or use incognito windows).
- **Guest mode**: click *Continue as Guest* to validate flows without authentication (stats will not persist).
- **AI**: Add AI players to speed up testing end-of-game stats.
- **Profiles**: Inspect the `profiles` table (`SELECT * FROM profiles;`) after games to confirm wins/games increments.
- **Force win**: use the “Trigger Test Win” button (host only) to randomly declare a winner and exercise end-of-game UI.
- **Skip celebration**: press `Esc` to cancel the 15s fireworks sequence during winner celebrations.
- **Automated tests**: run `npm test` to execute the Jest suite covering domain rules and coordinator flows.
- **Syntax**: Quick checks with
  ```bash
  node --check src/server.js
  node --check src/game.js
  ```

## Linting / Formatting

No formal lint setup yet. Consider adding ESLint + Prettier before long-term maintenance.

## Deployment Notes

- Ensure `GOOGLE_CLIENT_ID` is exposed (or served via `/config` as done here).
- Provide MySQL connection details (`MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`) in the runtime environment.
- Provision the database ahead of time; the server migrates the `profiles` table automatically when it starts.
- Consider TLS termination, WebSocket support, and origin checks before production.

## Contributing

1. Branch from `main`.
2. Implement fixes/features with clear commits.
3. Provide manual test notes or add unit tests if introduced.
4. Open a pull request summarising user-facing changes and any new environment requirements.
