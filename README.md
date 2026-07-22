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

## Features

- **Browse** your book collection
- **Add books** with title, author, editorial, year, ISBN, and tags
- **Edit or delete** existing books
- **Scan ISBN barcodes** using your device camera

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
