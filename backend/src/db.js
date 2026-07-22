const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, '../books.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT DEFAULT '',
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

module.exports = db;
