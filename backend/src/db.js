const { DatabaseSync } = require("node:sqlite");
const path = require("path");

// DB_PATH lets tests point at a throwaway copy instead of the real library.
const db = new DatabaseSync(
  process.env.DB_PATH || path.join(__dirname, "../books.db"),
);

db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT DEFAULT '',
    collection TEXT DEFAULT '',
    type TEXT DEFAULT '',
    editorial TEXT DEFAULT '',
    year_of_publication INTEGER,
    isbn TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    cover_image TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);

try {
  db.exec(`ALTER TABLE books ADD COLUMN cover_image TEXT DEFAULT NULL`);
} catch {
  // column already exists
}

try {
  db.exec(`ALTER TABLE books ADD COLUMN description TEXT DEFAULT NULL`);
} catch {
  // column already exists
}

try {
  db.exec(`ALTER TABLE books ADD COLUMN collection TEXT DEFAULT ''`);
} catch {
  // column already exists
}

try {
  db.exec(`ALTER TABLE books ADD COLUMN type TEXT DEFAULT ''`);
} catch {
  // column already exists
}

module.exports = db;
