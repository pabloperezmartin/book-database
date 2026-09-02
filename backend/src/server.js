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
    type,
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
    INSERT INTO books (title, author, collection, type, editorial, year_of_publication, isbn, tags, cover_image, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      title,
      author || "",
      collection || "",
      type || "",
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
    type,
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
    SET title = ?, author = ?, collection = ?, type = ?, editorial = ?, year_of_publication = ?,
        isbn = ?, tags = ?, cover_image = ?, description = ?, updated_at = datetime('now')
    WHERE id = ?
  `,
  ).run(
    title,
    author || "",
    collection || "",
    type || "",
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

// ---------------------------------------------------------------------------
// Admin: manage the free-text values denormalized across books.
//
// There are no publishers/authors tables — each book stores the value inline.
// So "renaming a publisher" is a bulk UPDATE, and renaming onto an existing
// name is what a merge is. Fields come in two shapes:
//   scalar    — one value per book (editorial, type, collection)
//   multi     — many per book (author as a ';'-joined string, tags as JSON)
// ---------------------------------------------------------------------------

const SCALAR_FIELDS = ["editorial", "type", "collection"];
const MULTI_FIELDS = ["author", "tags"];
const ADMIN_FIELDS = [...SCALAR_FIELDS, ...MULTI_FIELDS];

const splitAuthors = (value) =>
  (value || "")
    .split(/[,;]+/)
    .map((a) => a.trim())
    .filter(Boolean);

const joinAuthors = (list) => list.join("; ");

const parseTags = (value) => {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
};

/** Read a book's values for a field as an array, regardless of field shape. */
const valuesOf = (book, field) => {
  if (field === "author") return splitAuthors(book.author);
  if (field === "tags") return parseTags(book.tags);
  return book[field] ? [book[field]] : [];
};

/** Serialize an array back into the column format for a multi-value field. */
const serializeMulti = (field, list) => {
  const deduped = [...new Set(list)];
  return field === "tags" ? JSON.stringify(deduped) : joinAuthors(deduped);
};

const allBooks = () => db.prepare("SELECT * FROM books").all();

const validateField = (field, res) => {
  if (!ADMIN_FIELDS.includes(field)) {
    res.status(400).json({ error: `Unknown field '${field}'` });
    return false;
  }
  return true;
};

/** Distinct values for a field with the number of books using each. */
app.get("/api/admin/values/:field", (req, res) => {
  const { field } = req.params;
  if (!validateField(field, res)) return;

  const counts = new Map();
  for (const book of allBooks()) {
    for (const value of valuesOf(book, field)) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }

  // localeCompare returns 0 for canonically-equivalent strings (e.g. precomposed
  // "é" vs "e" + combining accent), so tie-break on raw code units to keep the
  // order deterministic — otherwise identical-looking rows shuffle between calls.
  const values = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value) || (a.value < b.value ? -1 : a.value > b.value ? 1 : 0));

  res.json({ field, values });
});

/**
 * Rename `from` to `to` across every book. If `to` already exists the two
 * collapse into one — that is the merge. Returns how many books changed.
 */
app.post("/api/admin/values/:field/rename", (req, res) => {
  const { field } = req.params;
  if (!validateField(field, res)) return;

  const from = req.body?.from;
  const to = typeof req.body?.to === "string" ? req.body.to.trim() : "";
  if (!from || typeof from !== "string")
    return res.status(400).json({ error: "'from' is required" });
  if (!to) return res.status(400).json({ error: "'to' is required" });
  if (from === to) return res.json({ updated: 0, merged: false });

  const books = allBooks();
  const targetExisted = books.some((b) => valuesOf(b, field).includes(to));

  const isMulti = MULTI_FIELDS.includes(field);
  const update = db.prepare(
    `UPDATE books SET ${field} = ?, updated_at = datetime('now') WHERE id = ?`,
  );

  let updated = 0;
  // better-sqlite3-style transaction via node:sqlite exec
  db.exec("BEGIN");
  try {
    for (const book of books) {
      const current = valuesOf(book, field);
      if (!current.includes(from)) continue;

      if (isMulti) {
        const next = current.map((v) => (v === from ? to : v));
        update.run(serializeMulti(field, next), book.id);
      } else {
        update.run(to, book.id);
      }
      updated++;
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    return res.status(500).json({ error: String(err) });
  }

  res.json({ updated, merged: targetExisted });
});

/**
 * Remove a value everywhere it appears: blanks the column for scalar fields,
 * drops the entry from the list for multi-value fields.
 */
app.post("/api/admin/values/:field/delete", (req, res) => {
  const { field } = req.params;
  if (!validateField(field, res)) return;

  const value = req.body?.value;
  if (!value || typeof value !== "string")
    return res.status(400).json({ error: "'value' is required" });

  const isMulti = MULTI_FIELDS.includes(field);
  const update = db.prepare(
    `UPDATE books SET ${field} = ?, updated_at = datetime('now') WHERE id = ?`,
  );

  let updated = 0;
  db.exec("BEGIN");
  try {
    for (const book of allBooks()) {
      const current = valuesOf(book, field);
      if (!current.includes(value)) continue;

      if (isMulti) {
        update.run(
          serializeMulti(
            field,
            current.filter((v) => v !== value),
          ),
          book.id,
        );
      } else {
        update.run("", book.id);
      }
      updated++;
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    return res.status(500).json({ error: String(err) });
  }

  res.json({ updated });
});

/**
 * The canonical form of a value: Unicode-normalized (NFC) and trimmed.
 *
 * Two classes of near-duplicate hide in this data and both look identical on
 * screen: trailing whitespace ("TASCHEN " vs "TASCHEN") and differing Unicode
 * normalization ("é" as U+00E9 vs "e"+U+0301). Collapsing both to one key lets
 * a single pass find and fix them.
 */
const canonicalize = (value) => value.normalize("NFC").trim();

/** Why a group needs fixing — drives the label shown in the UI. */
const reasonFor = (variants, canonical) => {
  const offenders = variants.filter((v) => v.value !== canonical);
  const whitespace = offenders.some((v) => v.value.trim() !== v.value);
  const unicode = offenders.some(
    (v) => v.value.trim() !== v.value.trim().normalize("NFC"),
  );
  if (whitespace && unicode) return "whitespace + accents";
  if (unicode) return "accents";
  return "whitespace";
};

const findCleanupGroups = () => {
  const groups = [];
  const books = allBooks();

  for (const field of ADMIN_FIELDS) {
    const counts = new Map();
    for (const book of books) {
      for (const value of valuesOf(book, field)) {
        counts.set(value, (counts.get(value) || 0) + 1);
      }
    }

    const byCanonical = new Map();
    for (const [value, count] of counts) {
      const key = canonicalize(value);
      if (!key) continue;
      if (!byCanonical.has(key)) byCanonical.set(key, []);
      byCanonical.get(key).push({ value, count });
    }

    for (const [canonical, variants] of byCanonical) {
      // Only interesting if something actually needs changing.
      if (variants.every((v) => v.value === canonical)) continue;
      groups.push({
        field,
        canonical,
        reason: reasonFor(variants, canonical),
        variants: variants.sort((a, b) => b.count - a.count),
        affected: variants
          .filter((v) => v.value !== canonical)
          .reduce((n, v) => n + v.count, 0),
      });
    }
  }

  return groups;
};

app.get("/api/admin/cleanup", (req, res) => {
  res.json({ groups: findCleanupGroups() });
});

/** Rewrite every variant onto its canonical form, merging duplicates. */
app.post("/api/admin/cleanup/fix", (req, res) => {
  const field = req.body?.field;
  if (field && !ADMIN_FIELDS.includes(field))
    return res.status(400).json({ error: `Unknown field '${field}'` });

  const groups = findCleanupGroups().filter((g) => !field || g.field === field);
  const targetFields = [...new Set(groups.map((g) => g.field))];

  let updated = 0;
  db.exec("BEGIN");
  try {
    for (const f of targetFields) {
      const isMulti = MULTI_FIELDS.includes(f);
      const update = db.prepare(
        `UPDATE books SET ${f} = ?, updated_at = datetime('now') WHERE id = ?`,
      );

      for (const book of allBooks()) {
        const current = valuesOf(book, f);
        const next = current.map(canonicalize).filter(Boolean);
        const changed =
          current.length !== next.length ||
          current.some((v, i) => v !== next[i]);
        if (!changed) continue;

        update.run(isMulti ? serializeMulti(f, next) : next[0] || "", book.id);
        updated++;
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    return res.status(500).json({ error: String(err) });
  }

  res.json({ updated, fields: targetFields });
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
