const { createClient } = require("@libsql/client");
const path = require("path");

const client = createClient({
  url:
    process.env.TURSO_DATABASE_URL ||
    `file:${process.env.DB_PATH || path.join(__dirname, "../books.db")}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const rowsOf = (result) =>
  result.rows.map((row) =>
    Object.fromEntries(result.columns.map((col) => [col, row[col]])),
  );

const firstRow = (result) => rowsOf(result)[0] ?? null;

async function init() {
  await client.execute(`
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
      description TEXT DEFAULT NULL,
      prize TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  const migrations = [
    "ALTER TABLE books ADD COLUMN cover_image TEXT DEFAULT NULL",
    "ALTER TABLE books ADD COLUMN description TEXT DEFAULT NULL",
    "ALTER TABLE books ADD COLUMN collection TEXT DEFAULT ''",
    "ALTER TABLE books ADD COLUMN type TEXT DEFAULT ''",
    "ALTER TABLE books ADD COLUMN prize TEXT DEFAULT ''",
  ];
  for (const sql of migrations) {
    try {
      await client.execute(sql);
    } catch {
      // column already exists
    }
  }
}

module.exports = { client, init, rowsOf, firstRow };
