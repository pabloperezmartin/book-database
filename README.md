# Book Library

A personal book database app to catalog your physical book collection. Add books manually or scan their ISBN barcode with your camera.

**Live app**: [book-database-qawg.onrender.com](https://book-database-qawg.onrender.com/)

## Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js + Node.js
- **Database**: [Turso](https://turso.tech) (hosted SQLite) — falls back to a local SQLite file for development
- **Barcode scanning**: `@zxing/library`
- **Hosting**: [Render](https://render.com) (free tier)

## Features

- **Browse** your book collection in list or 3D shelf view
- **Add books** with title, author, editorial, year, ISBN, tags, description, cover photo, and prize
- **Edit or delete** existing books
- **Scan ISBN barcodes** using your device camera
- **Look up book info** automatically from Open Library by ISBN or title
- **Filter and search** by tag, type, publisher, author, collection, and year range
- **Save & navigate** through filtered results with Save & Next / Save & Previous
- **Related books** section showing other books by the same author
- **Admin panel** to manage and clean up field values across the library

## Requirements

- Node.js v22.5+

## Getting Started (local development)

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

In development, the Vite dev server proxies `/api` requests to the backend. The app uses the local SQLite file at `backend/books.db` unless Turso environment variables are set.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start backend and frontend concurrently |
| `npm run dev:backend` | Start backend only |
| `npm run dev:frontend` | Start frontend only |
| `npm run install:all` | Install all dependencies (root + backend + frontend) |
| `npm run render-build` | Build for production (used by Render) |
| `npm start` | Start production server (API + static frontend on one port) |

## Deployment

The app is deployed on Render's free tier with Turso as the database.

### 1. Set up Turso

Install the Turso CLI:

```bash
brew install tursodatabase/tap/turso
```

Or via the install script:

```bash
curl -sSfL https://get.tur.so/install.sh | bash
```

Sign up or log in (opens your browser):

```bash
turso auth signup   # new account
turso auth login    # existing account
```

Create a database from your local SQLite file:

```bash
turso db create book-database --from-file backend/books.db
```

Get the connection URL and auth token (save both for Render):

```bash
turso db show book-database --url
turso db tokens create book-database
```

### 2. Set up Render

1. Push your code to GitHub
2. Go to [render.com](https://render.com) and create a new **Web Service** connected to your repo
3. Render auto-detects the `render.yaml`, or configure manually:
   - **Build command**: `npm run render-build`
   - **Start command**: `npm start`
   - **Plan**: Free
4. Add environment variables:
   - `TURSO_DATABASE_URL` — the `libsql://...` URL from step 1
   - `TURSO_AUTH_TOKEN` — the token from step 1
   - `NODE_VERSION` — `22`
5. Deploy

In production, the Express server serves both the API and the built frontend on a single port (`PORT` is set by Render).

### 3. Deploying updates

Every push to `main` triggers an automatic redeploy on Render:

```bash
git add .
git commit -m "Your changes"
git push
```

You can monitor the deploy in the Render dashboard under **Events** or **Logs**.

To trigger a manual redeploy (e.g. after changing an environment variable), go to your Render service and click **Manual Deploy > Deploy latest commit**.

### Render free tier notes

- The service sleeps after 15 minutes of inactivity and takes ~30 seconds to wake up on the next visit.
- Disk storage is ephemeral (resets on deploy), which is why the database is on Turso instead of a local SQLite file.

## Accessing from your phone (local development)

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

Open that `https://` URL on your phone. The first time, ngrok may show a browser warning — tap **Visit Site** to continue.

> **Note:** Always stop the app with **Ctrl+C**, not Ctrl+Z. Using Ctrl+Z suspends the process without releasing the port, which causes `EADDRINUSE` errors on the next start.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/books` | List all books (without cover image data) |
| GET | `/api/books/:id` | Get a single book (includes cover image) |
| GET | `/api/books/:id/cover` | Get a book's cover image as binary |
| POST | `/api/books` | Create a book |
| PUT | `/api/books/:id` | Update a book |
| DELETE | `/api/books/:id` | Delete a book |
| GET | `/api/admin/values/:field` | List distinct values for a field |
| POST | `/api/admin/values/:field/rename` | Rename/merge a field value |
| POST | `/api/admin/values/:field/delete` | Remove a field value |
| GET | `/api/admin/cleanup` | Find near-duplicate values |
| POST | `/api/admin/cleanup/fix` | Fix near-duplicate values |

## Data Storage

Books are stored in a Turso database (production) or a local SQLite file at `backend/books.db` (development). The database is created automatically on first run. Each book has: `title`, `author`, `collection`, `type`, `editorial`, `year_of_publication`, `isbn`, `tags`, `cover_image`, `description`, `prize`, `created_at`, and `updated_at`.

Cover images are stored as base64 data URIs in the database. The list endpoint excludes them for performance — covers are served individually via `/api/books/:id/cover` with 24-hour browser caching.

## Git Setup

Set the GitHub remote (first time only):

```bash
git remote set-url origin https://token@github.com/pabloperezmartin/book-database.git
```

Push changes:

```bash
git push
```
