const express = require("express");
const cors = require("cors");
const path = require("path");
const { client, init, rowsOf, firstRow } = require("./db");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const parseBook = (row) => ({
  ...row,
  tags: JSON.parse(row.tags || "[]"),
});

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

app.get(
  "/api/books",
  asyncHandler(async (req, res) => {
    const result = await client.execute(
      `SELECT id, title, author, collection, type, editorial, year_of_publication,
              isbn, tags, description, prize, created_at, updated_at,
              CASE WHEN cover_image IS NOT NULL AND cover_image != '' THEN 1 ELSE 0 END AS has_cover
       FROM books ORDER BY created_at DESC`,
    );
    res.json(
      rowsOf(result).map((b) => ({
        ...parseBook(b),
        has_cover: !!b.has_cover,
      })),
    );
  }),
);

app.get(
  "/api/books/:id",
  asyncHandler(async (req, res) => {
    const book = firstRow(
      await client.execute({
        sql: "SELECT * FROM books WHERE id = ?",
        args: [req.params.id],
      }),
    );
    if (!book) return res.status(404).json({ error: "Book not found" });
    res.json(parseBook(book));
  }),
);

app.get(
  "/api/books/:id/cover",
  asyncHandler(async (req, res) => {
    const row = firstRow(
      await client.execute({
        sql: "SELECT cover_image FROM books WHERE id = ?",
        args: [req.params.id],
      }),
    );
    if (!row || !row.cover_image) return res.status(404).send();

    const match = row.cover_image.match(/^data:(image\/[^;]+);base64,(.+)$/s);
    if (!match) return res.status(404).send();

    const [, mime, b64] = match;
    const buf = Buffer.from(b64, "base64");
    res.set("Content-Type", mime);
    res.set("Cache-Control", "public, max-age=86400");
    res.send(buf);
  }),
);

app.post(
  "/api/books",
  asyncHandler(async (req, res) => {
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
      prize,
    } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });

    const result = await client.execute({
      sql: `INSERT INTO books (title, author, collection, type, editorial, year_of_publication, isbn, tags, cover_image, description, prize)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
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
        prize || "",
      ],
    });

    const book = firstRow(
      await client.execute({
        sql: "SELECT * FROM books WHERE id = ?",
        args: [Number(result.lastInsertRowid)],
      }),
    );
    res.status(201).json(parseBook(book));
  }),
);

app.put(
  "/api/books/:id",
  asyncHandler(async (req, res) => {
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
      prize,
    } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });

    const exists = firstRow(
      await client.execute({
        sql: "SELECT * FROM books WHERE id = ?",
        args: [req.params.id],
      }),
    );
    if (!exists) return res.status(404).json({ error: "Book not found" });

    await client.execute({
      sql: `UPDATE books
            SET title = ?, author = ?, collection = ?, type = ?, editorial = ?, year_of_publication = ?,
                isbn = ?, tags = ?, cover_image = ?, description = ?, prize = ?, updated_at = datetime('now')
            WHERE id = ?`,
      args: [
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
        prize !== undefined ? prize : exists.prize || "",
        req.params.id,
      ],
    });

    const book = firstRow(
      await client.execute({
        sql: "SELECT * FROM books WHERE id = ?",
        args: [req.params.id],
      }),
    );
    res.json(parseBook(book));
  }),
);

app.delete(
  "/api/books/:id",
  asyncHandler(async (req, res) => {
    const result = await client.execute({
      sql: "DELETE FROM books WHERE id = ?",
      args: [req.params.id],
    });
    if (result.rowsAffected === 0)
      return res.status(404).json({ error: "Book not found" });
    res.status(204).send();
  }),
);

// ---------------------------------------------------------------------------
// Admin: manage the free-text values denormalized across books.
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

const valuesOf = (book, field) => {
  if (field === "author") return splitAuthors(book.author);
  if (field === "tags") return parseTags(book.tags);
  return book[field] ? [book[field]] : [];
};

const serializeMulti = (field, list) => {
  const deduped = [...new Set(list)];
  return field === "tags" ? JSON.stringify(deduped) : joinAuthors(deduped);
};

const allBooks = async () =>
  rowsOf(
    await client.execute(
      "SELECT id, title, author, collection, type, editorial, year_of_publication, isbn, tags, description, prize FROM books",
    ),
  );

const validateField = (field, res) => {
  if (!ADMIN_FIELDS.includes(field)) {
    res.status(400).json({ error: `Unknown field '${field}'` });
    return false;
  }
  return true;
};

app.get(
  "/api/admin/values/:field",
  asyncHandler(async (req, res) => {
    const { field } = req.params;
    if (!validateField(field, res)) return;

    const counts = new Map();
    for (const book of await allBooks()) {
      for (const value of valuesOf(book, field)) {
        counts.set(value, (counts.get(value) || 0) + 1);
      }
    }

    const values = [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort(
        (a, b) =>
          a.value.localeCompare(b.value) ||
          (a.value < b.value ? -1 : a.value > b.value ? 1 : 0),
      );

    res.json({ field, values });
  }),
);

app.post(
  "/api/admin/values/:field/rename",
  asyncHandler(async (req, res) => {
    const { field } = req.params;
    if (!validateField(field, res)) return;

    const from = req.body?.from;
    const to = typeof req.body?.to === "string" ? req.body.to.trim() : "";
    if (!from || typeof from !== "string")
      return res.status(400).json({ error: "'from' is required" });
    if (!to) return res.status(400).json({ error: "'to' is required" });
    if (from === to) return res.json({ updated: 0, merged: false });

    const books = await allBooks();
    const targetExisted = books.some((b) => valuesOf(b, field).includes(to));
    const isMulti = MULTI_FIELDS.includes(field);

    const updates = [];
    for (const book of books) {
      const current = valuesOf(book, field);
      if (!current.includes(from)) continue;

      const newValue = isMulti
        ? serializeMulti(
            field,
            current.map((v) => (v === from ? to : v)),
          )
        : to;

      updates.push({
        sql: `UPDATE books SET ${field} = ?, updated_at = datetime('now') WHERE id = ?`,
        args: [newValue, book.id],
      });
    }

    if (updates.length > 0) {
      await client.batch(updates, "write");
    }

    res.json({ updated: updates.length, merged: targetExisted });
  }),
);

app.post(
  "/api/admin/values/:field/delete",
  asyncHandler(async (req, res) => {
    const { field } = req.params;
    if (!validateField(field, res)) return;

    const value = req.body?.value;
    if (!value || typeof value !== "string")
      return res.status(400).json({ error: "'value' is required" });

    const isMulti = MULTI_FIELDS.includes(field);

    const updates = [];
    for (const book of await allBooks()) {
      const current = valuesOf(book, field);
      if (!current.includes(value)) continue;

      const newValue = isMulti
        ? serializeMulti(
            field,
            current.filter((v) => v !== value),
          )
        : "";

      updates.push({
        sql: `UPDATE books SET ${field} = ?, updated_at = datetime('now') WHERE id = ?`,
        args: [newValue, book.id],
      });
    }

    if (updates.length > 0) {
      await client.batch(updates, "write");
    }

    res.json({ updated: updates.length });
  }),
);

const canonicalize = (value) => value.normalize("NFC").trim();

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

const findCleanupGroups = async () => {
  const groups = [];
  const books = await allBooks();

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

app.get(
  "/api/admin/cleanup",
  asyncHandler(async (req, res) => {
    res.json({ groups: await findCleanupGroups() });
  }),
);

app.post(
  "/api/admin/cleanup/fix",
  asyncHandler(async (req, res) => {
    const field = req.body?.field;
    if (field && !ADMIN_FIELDS.includes(field))
      return res.status(400).json({ error: `Unknown field '${field}'` });

    const groups = (await findCleanupGroups()).filter(
      (g) => !field || g.field === field,
    );
    const targetFields = [...new Set(groups.map((g) => g.field))];

    const updates = [];
    const books = await allBooks();

    for (const f of targetFields) {
      const isMulti = MULTI_FIELDS.includes(f);
      for (const book of books) {
        const current = valuesOf(book, f);
        const next = current.map(canonicalize).filter(Boolean);
        const changed =
          current.length !== next.length ||
          current.some((v, i) => v !== next[i]);
        if (!changed) continue;

        updates.push({
          sql: `UPDATE books SET ${f} = ?, updated_at = datetime('now') WHERE id = ?`,
          args: [isMulti ? serializeMulti(f, next) : next[0] || "", book.id],
        });
      }
    }

    if (updates.length > 0) {
      await client.batch(updates, "write");
    }

    res.json({ updated: updates.length, fields: targetFields });
  }),
);

// ---------------------------------------------------------------------------
// Static frontend (production)
// ---------------------------------------------------------------------------

const distPath = path.join(__dirname, "../../frontend/dist");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// Error handler
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

(async () => {
  await init();
  app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
  });
})();
