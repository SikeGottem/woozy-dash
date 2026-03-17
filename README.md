# Woozy Command Dashboard

Terminal-themed personal command center built with Next.js. Displays tasks, agent status, finances, freelance clients, and a chat interface — all reading from a local SQLite database.

## Setup

```bash
git clone <repo-url>
cd woozy-dash
npm install
```

Set the database path (defaults to `~/.openclaw/workspace/woozy.db`):

```bash
# .env.local
WOOZY_DB_PATH=/path/to/woozy.db
```

Run the dev server:

```bash
npm run dev
# Opens on http://localhost:3001
```

## Architecture

- **Next.js 16** App Router (`app/` directory)
- **SQLite** via `better-sqlite3` (read-only)
- **No external UI libraries** — all custom CSS
- Components in `app/components/`, charts in `app/components/charts/`
- API routes in `app/api/` (data, agents, chat, tasks, state, capture, history)

## Features

- Context modes (Uni / Work / Personal / Deep)
- Focus mode with timer/stopwatch
- Agent command center (spawn, monitor, DM)
- PIN-locked financial dashboard
- Quick capture to Obsidian vault
- Chat panel connected to main AI session
