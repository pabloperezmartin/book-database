export interface Book {
  id: number;
  title: string;
  author: string;
  collection: string;
  type: string;
  editorial: string;
  year_of_publication: number | null;
  isbn: string;
  tags: string[];
  cover_image: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export type BookFormData = Omit<Book, 'id' | 'created_at' | 'updated_at'>;

const BASE = '/api';

export async function getBooks(): Promise<Book[]> {
  const res = await fetch(`${BASE}/books`);
  if (!res.ok) throw new Error('Failed to fetch books');
  return res.json();
}

export async function getBook(id: number): Promise<Book> {
  const res = await fetch(`${BASE}/books/${id}`);
  if (!res.ok) throw new Error('Book not found');
  return res.json();
}

export async function createBook(data: BookFormData): Promise<Book> {
  const res = await fetch(`${BASE}/books`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create book');
  return res.json();
}

export async function updateBook(id: number, data: BookFormData): Promise<Book> {
  const res = await fetch(`${BASE}/books/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update book');
  return res.json();
}

export async function deleteBook(id: number): Promise<void> {
  const res = await fetch(`${BASE}/books/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error('Failed to delete book');
}

// --- Admin -----------------------------------------------------------------

/** Fields whose free-text values can be managed in bulk from the Admin page. */
export type AdminField = 'editorial' | 'author' | 'type' | 'collection' | 'tags';

export interface FieldValue {
  value: string;
  count: number;
}

export interface CleanupGroup {
  field: AdminField;
  canonical: string;
  /** Why the variants differ: 'whitespace', 'accents', or 'whitespace + accents'. */
  reason: string;
  variants: FieldValue[];
  affected: number;
}

const postJSON = async <T>(path: string, body: unknown): Promise<T> => {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data as T;
};

export async function getFieldValues(field: AdminField): Promise<FieldValue[]> {
  const res = await fetch(`${BASE}/admin/values/${field}`);
  if (!res.ok) throw new Error('Failed to load values');
  return (await res.json()).values;
}

/** Renames `from` to `to` across all books; merges if `to` already exists. */
export async function renameFieldValue(
  field: AdminField,
  from: string,
  to: string
): Promise<{ updated: number; merged: boolean }> {
  return postJSON(`/admin/values/${field}/rename`, { from, to });
}

/** Removes the value from every book: blanks scalars, drops list entries. */
export async function deleteFieldValue(
  field: AdminField,
  value: string
): Promise<{ updated: number }> {
  return postJSON(`/admin/values/${field}/delete`, { value });
}

export async function getCleanupGroups(): Promise<CleanupGroup[]> {
  const res = await fetch(`${BASE}/admin/cleanup`);
  if (!res.ok) throw new Error('Failed to load cleanup suggestions');
  return (await res.json()).groups;
}

export async function fixCleanup(
  field?: AdminField
): Promise<{ updated: number; fields: AdminField[] }> {
  return postJSON('/admin/cleanup/fix', field ? { field } : {});
}

export interface TitleSearchResult {
  title: string;
  author: string;
  editorial: string;
  year_of_publication: number | null;
  isbn: string;
}

export async function searchByTitle(query: string): Promise<TitleSearchResult[]> {
  try {
    const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(query)}&limit=7&fields=title,author_name,publisher,first_publish_year,isbn`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.docs as Array<Record<string, unknown>>).map((doc) => ({
      title: (doc.title as string) || '',
      author: (doc.author_name as string[])?.[0] || '',
      editorial: (doc.publisher as string[])?.[0] || '',
      year_of_publication: (doc.first_publish_year as number) || null,
      isbn: (doc.isbn as string[])?.[0] || '',
    }));
  } catch {
    return [];
  }
}

export async function lookupISBN(isbn: string): Promise<Partial<BookFormData>> {
  try {
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
    const res = await fetch(url);
    if (!res.ok) return {};
    const data = await res.json();
    const book = data[`ISBN:${isbn}`];
    if (!book) return {};

    const yearMatch = (book.publish_date as string | undefined)?.match(/\d{4}/);

    return {
      title: (book.title as string) || '',
      author: (book.authors as Array<{ name: string }>)?.[0]?.name || '',
      editorial: (book.publishers as Array<{ name: string }>)?.[0]?.name || '',
      year_of_publication: yearMatch ? parseInt(yearMatch[0]) : null,
      isbn,
    };
  } catch {
    return {};
  }
}
