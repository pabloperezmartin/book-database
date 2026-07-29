# Book Library

A personal book database app to catalog your physical book collection. Add books manually or scan their ISBN barcode with your camera.

## Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js + Node.js built-in SQLite (`node:sqlite`)
- **Barcode scanning**: `@zxing/library`

## Requirements

- Node.js v22.5+ (uses the built-in `node:sqlite` module, available from v22.5)

## Getting Started

Install dependencies (first time only):

```bash
npm run install:all
```

Start both backend and frontend:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start backend and frontend concurrently |
| `npm run dev:backend` | Start backend only |
| `npm run dev:frontend` | Start frontend only |
| `npm run install:all` | Install all dependencies (root + backend + frontend) |

## Accessing from your phone

The barcode scanner requires camera access, which browsers only allow over **HTTPS**. The easiest way to get a secure public URL is with [ngrok](https://ngrok.com).

**1. Install ngrok** (once):

```bash
brew install ngrok
```

Then create a free account at ngrok.com and authenticate:

```bash
ngrok config add-authtoken <your-token>
```

**2. Start the app** as usual:

```bash
npm run dev
```

**3. In a separate terminal, expose the frontend:**

```bash
ngrok http 5173
```

ngrok will print a line like:

```text
Forwarding  https://abc123.ngrok-free.app -> http://localhost:5173
```

Open that `https://` URL on your phone. The first time, ngrok may show a browser warning — tap **Visit Site** to continue. The camera and barcode scanner will work because the connection is HTTPS.

> **Note:** Always stop the app with **Ctrl+C**, not Ctrl+Z. Using Ctrl+Z suspends the process without releasing the port, which causes `EADDRINUSE` errors on the next start.

## Features

- **Browse** your book collection
- **Add books** with title, author, editorial, year, ISBN, tags, description, and cover photo
- **Edit or delete** existing books
- **Scan ISBN barcodes** using your device camera
- **Look up book info** automatically from Open Library by ISBN

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/books` | List all books |
| GET | `/api/books/:id` | Get a single book |
| POST | `/api/books` | Create a book |
| PUT | `/api/books/:id` | Update a book |
| DELETE | `/api/books/:id` | Delete a book |

## Data Storage

Books are stored in a SQLite database file at `backend/books.db`, created automatically on first run. Each book has: `title`, `author`, `editorial`, `year_of_publication`, `isbn`, `tags`, `created_at`, and `updated_at`.
