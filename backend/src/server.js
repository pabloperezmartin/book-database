const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const parseBook = (book) => ({
  ...book,
  tags: JSON.parse(book.tags || "[]"),
});

app.get("/api/books", (req, res) => {
  const books = db
    .prepare("SELECT * FROM books ORDER BY created_at DESC")
    .all();
  res.json(books.map(parseBook));
});

app.get("/api/books/:id", (req, res) => {
  const book = db
    .prepare("SELECT * FROM books WHERE id = ?")
    .get(req.params.id);
  if (!book) return res.status(404).json({ error: "Book not found" });
  res.json(parseBook(book));
});

app.post("/api/books", (req, res) => {
  const {
    title,
    author,
    collection,
    editorial,
    year_of_publication,
    isbn,
    tags,
    cover_image,
    description,
  } = req.body;
  if (!title) return res.status(400).json({ error: "Title is required" });

  const result = db
    .prepare(
      `
    INSERT INTO books (title, author, collection, editorial, year_of_publication, isbn, tags, cover_image, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      title,
      author || "",
      collection || "",
      editorial || "",
      year_of_publication || null,
      isbn || "",
      JSON.stringify(tags || []),
      cover_image || null,
      description || null,
    );

  const book = db
    .prepare("SELECT * FROM books WHERE id = ?")
    .get(Number(result.lastInsertRowid));
  res.status(201).json(parseBook(book));
});

app.put("/api/books/:id", (req, res) => {
  const {
    title,
    author,
    collection,
    editorial,
    year_of_publication,
    isbn,
    tags,
    cover_image,
    description,
  } = req.body;
  if (!title) return res.status(400).json({ error: "Title is required" });

  const exists = db
    .prepare("SELECT * FROM books WHERE id = ?")
    .get(req.params.id);
  if (!exists) return res.status(404).json({ error: "Book not found" });

  db.prepare(
    `
    UPDATE books
    SET title = ?, author = ?, collection = ?, editorial = ?, year_of_publication = ?,
        isbn = ?, tags = ?, cover_image = ?, description = ?, updated_at = datetime('now')
    WHERE id = ?
  `,
  ).run(
    title,
    author || "",
    collection || "",
    editorial || "",
    year_of_publication || null,
    isbn || "",
    JSON.stringify(tags || []),
    cover_image !== undefined ? cover_image : exists.cover_image,
    description !== undefined ? description : exists.description,
    req.params.id,
  );

  const book = db
    .prepare("SELECT * FROM books WHERE id = ?")
    .get(req.params.id);
  res.json(parseBook(book));
});

app.delete("/api/books/:id", (req, res) => {
  const result = db
    .prepare("DELETE FROM books WHERE id = ?")
    .run(req.params.id);
  if (result.changes === 0)
    return res.status(404).json({ error: "Book not found" });
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
