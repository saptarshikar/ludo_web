# Ludo Online

Web-based multiplayer Ludo supporting 2–4 players, real-time board updates, optional AI opponents, and Google sign-in for personalised profiles and win tracking.

## Features

- **Real-time multiplayer** via Socket.IO with lobby, dice rolls, and token movement updates.
- **Interactive canvas board** featuring highlighted safe squares, captures, and current turn cues.
- **AI opponents** at Easy, Medium, and Hard difficulties for filling empty seats or solo play.
- **Google authentication** to create persistent profiles, reuse avatars, and track win/loss records.
- **Automatic stat tracking** that updates profile wins and games at the end of every match.
- **Responsive layout** optimised for desktop and tablet with a modern dark theme.

## Tech Stack

- **Node.js + Express** serving the app, REST endpoints, and static assets.
- **Socket.IO** for real-time game state synchronisation across clients.
- **Canvas** rendering for the Ludo board and animations.
- **Google Identity Services** for OAuth2 sign-in.
- **File-backed persistence** (`data/profiles.json`) to store player stats without a database.

## Prerequisites

- Node.js 18+
- npm 9+
- Google Cloud project with OAuth 2.0 Web Client ID (for sign-in)

## Environment Variables

| Variable | Description |
| --- | --- |
| `PORT` | Port to run the server on (defaults to `3000`). |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Web Client ID for Google Sign-In. Required for authentication features. |

## Getting Started

```bash
git clone <repo-url>
cd ludo
npm install
```

Create an `.env` file (or export variables) with your Google client ID:

```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
PORT=3000
```

Run the server:

```bash
npm start
```

Open `http://localhost:3000` in the browser. Use Google sign-in to create/join rooms. Share the room ID with friends so they can join the same lobby.

## Project Structure

```
├── public/              # Client-side code, canvas renderer, styles
├── src/
│   ├── server.js        # Express + Socket.IO server
│   ├── game.js          # Ludo game engine
│   ├── roomManager.js   # Rooms, sockets, cleanup
│   ├── profileStore.js  # File-backed profile persistence
│   └── sessionManager.js# In-memory session tokens
├── data/profiles.json   # Stored user profiles and wins
├── README.md            # Project overview
└── development.md       # Contributing and dev guides
```

## Key Flows

1. **Authentication**
   - Google credential is posted to `/auth/google`, verified, and mapped to a profile.
   - Clients store a session token to join rooms.
2. **Room Join**
   - Authenticated users join via `joinRoom` socket event, receiving board state syncs.
3. **Game Loop**
   - Host starts the game. Turn order tracks current player; rolling dice reveals valid moves.
   - Moves trigger captures, home paths, safe square logic, and win detection.
4. **AI Turns**
   - AI players automatically roll and choose moves based on difficulty heuristics.
5. **Results**
   - Upon win, stats update (`wins`, `games`) and propagate to connected clients.

## AI Difficulty

| Difficulty | Behaviour |
| --- | --- |
| Easy | Random valid move selection. |
| Medium | Prioritises finishing moves, then captures, otherwise random. |
| Hard | Scores moves by capture potential, finishing, and progression; picks the highest value. |

## Development Aids

- `npm start` runs the server in development mode.
- Profiles persist locally in `data/profiles.json` for manual inspection or reset.
- AI decisions logged via server console if errors occur during their turns.

## Future Enhancements

- Replace file storage with a hosted database for scalability.
- Support spectator mode or reconnection to existing games.
- Add match history and leaderboards.
- Extend UI to mobile phones with touch-friendly inputs.

## License

ISC License (see `LICENSE` if added) or align with organisation needs.

