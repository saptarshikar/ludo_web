# Ludo Online

Web-based multiplayer Ludo supporting 2–4 players, real-time board updates, optional AI opponents, and Google sign-in for personalised profiles and win tracking.

## Features

- **Real-time multiplayer** via Socket.IO with lobby, dice rolls, and token movement updates.
- **Interactive canvas board** featuring highlighted safe squares, captures, and current turn cues.
- **AI opponents** at Easy, Medium, and Hard difficulties for filling empty seats or solo play.
- **Google authentication** to create persistent profiles, reuse avatars, and track win/loss records.
- **Guest mode** so players can jump into a room without signing in (no stats recorded).
- **Automatic stat tracking** that updates profile wins and games at the end of every match.
- **Animated dice rolls** with a six-sided die visual rather than plain numbers.
- **Responsive layout** optimised for desktop and tablet with a modern dark theme.

## Tech Stack

- **Node.js + Express** serving the app, REST endpoints, and static assets.
- **Socket.IO** for real-time game state synchronisation across clients.
- **Canvas** rendering for the Ludo board and animations.
- **Google Identity Services** for OAuth2 sign-in.
- **MySQL** persisting player profiles and win statistics.

## Prerequisites

- Node.js 18+
- npm 9+
- Google Cloud project with OAuth 2.0 Web Client ID (for sign-in)
- MySQL 8+ instance (local or containerised)

## Environment Variables

| Variable | Description |
| --- | --- |
| `PORT` | Port to run the server on (defaults to `3000`). |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Web Client ID for Google Sign-In. Required for authentication features. |
| `MYSQL_HOST` | MySQL host (`localhost`, `db`, etc.). |
| `MYSQL_PORT` | MySQL port (defaults to `3306`). |
| `MYSQL_USER` | Database user with read/write access. |
| `MYSQL_PASSWORD` | Password for the database user. |
| `MYSQL_DATABASE` | Database name where tables will be created. |
| `MYSQL_POOL_LIMIT` | Optional connection pool size (defaults to `10`). |

## Getting Started

```bash
git clone <repo-url>
cd ludo
npm install
```

Create an `.env` file (or export variables) with your Google client ID and database connection:

```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
PORT=3000
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=ludo_user
MYSQL_PASSWORD=ludo_pass
MYSQL_DATABASE=ludo
```

Run the server:

```bash
npm start
```

Open `http://localhost:3000` in the browser. Use Google sign-in to create/join rooms. Share the room ID with friends so they can join the same lobby.

> Tip: Click “Continue as Guest” to play without signing in (stats will not persist).

Ensure the MySQL database exists and the user has permission to create tables (the server bootstraps its schema automatically).

### Docker (app container)

Build the container:

```bash
docker build -t ludo-online .
```

Run it against an external MySQL instance:

```bash
docker run \
  -p 3000:3000 \
  -e GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com \
  -e MYSQL_HOST=host.docker.internal \
  -e MYSQL_PORT=3306 \
  -e MYSQL_USER=ludo_user \
  -e MYSQL_PASSWORD=ludo_pass \
  -e MYSQL_DATABASE=ludo \
  ludo-online
```

Visit http://localhost:3000 and sign in with Google to start playing.

### Docker Compose (app + MySQL)

```bash
export GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
docker-compose up --build
```

This launches both the application and a MySQL 8 instance with persistent storage (`mysql_data` volume). The app automatically initialises the `profiles` table on first run.

Default credentials inside the compose file are:

- `MYSQL_DATABASE=ludo`
- `MYSQL_USER=ludo_user`
- `MYSQL_PASSWORD=ludo_pass`

Adjust them (and the matching env vars on the `app` service) as needed.

## Project Structure

```
├── public/              # Client-side code, canvas renderer, styles
├── src/
│   ├── server.js        # Express + Socket.IO server
│   ├── game.js          # Ludo game engine
│   ├── roomManager.js   # Rooms, sockets, cleanup
│   ├── profileStore.js  # MySQL-backed profile persistence
│   └── sessionManager.js# In-memory session tokens
├── README.md            # Project overview
└── development.md       # Contributing and dev guides
```

## Key Flows

1. **Authentication**
   - Google credential is posted to `/auth/google`, verified, and mapped to a profile.
   - Clients store a session token to join rooms.
   - Guests can skip sign-in; they join anonymously and skip stat recording.
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
- `docker-compose up db` launches a managed MySQL instance for local development.
- AI decisions logged via server console if errors occur during their turns.

## Future Enhancements

- Add automated schema migrations (e.g., using Prisma/Knex).
- Support spectator mode or reconnection to existing games.
- Add match history and leaderboards.
- Extend UI to mobile phones with touch-friendly inputs.

## License

[MIT](./LICENSE)
