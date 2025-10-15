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

Profiles persist locally in `data/profiles.json`. The file is created automatically; committing it is optional—adjust `.gitignore` if needed.

## Environment Setup

Create `.env` (or export variables before `npm start`):

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
PORT=3000
```

When testing without Google sign-in, omit the client ID. The UI will disable join actions until sign-in succeeds.

## Running

```bash
npm start
```

The server hosts both API endpoints and static assets:

- http://localhost:3000 — Main UI
- `/health` — Liveness check
- `/config` — Google client config returned to the client

## Code Overview

| File | Purpose |
| --- | --- |
| `src/server.js` | Express + Socket.IO server, auth endpoints, AI turn executor. |
| `src/game.js` | Authoritative game logic, history, capture rules, win detection. |
| `src/roomManager.js` | Tracks socket membership per room, cleans empty rooms. |
| `src/profileStore.js` | JSON persistence for Google profiles, wins/games. |
| `src/sessionManager.js` | In-memory session token issue/lookup. |
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

AI turns run synchronously on the server; `handleAiTurns` loops until a human’s turn or max iterations (safe guard of 40 loops).

## Testing Tips

- **Manual**: open multiple browser tabs, sign in with different Google accounts (or use incognito windows).
- **AI**: Add AI players to speed up testing end-of-game stats.
- **Profiles**: Inspect `data/profiles.json` after games to confirm wins/games increments.
- **Syntax**: Quick checks with
  ```bash
  node --check src/server.js
  node --check src/game.js
  ```

## Linting / Formatting

No formal lint setup yet. Consider adding ESLint + Prettier before long-term maintenance.

## Deployment Notes

- Ensure `GOOGLE_CLIENT_ID` is exposed (or served via `/config` as done here).
- `profiles.json` should live on persistent storage (mounted volume or a proper database) when deployed.
- Consider TLS termination and origin checks before production.

## Contributing

1. Branch from `main`.
2. Implement fixes/features with clear commits.
3. Provide manual test notes or add unit tests if introduced.
4. Open a pull request summarising user-facing changes and any new environment requirements.

