import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createBook, updateBook, getBook, getBooks, lookupISBN, searchByTitle, TitleSearchResult, BookFormData } from '../api';
import { BarcodeScanner } from './BarcodeScanner';

const TAGS = ['Documentary', 'Portrait', 'Nudity', 'Fashion'] as const;

const TAG_COLORS: Record<string, { on: string; off: string }> = {
  Documentary: { on: 'bg-blue-100 text-blue-800 border-blue-300', off: 'bg-white text-gray-500 border-gray-300' },
  Portrait:    { on: 'bg-green-100 text-green-800 border-green-300', off: 'bg-white text-gray-500 border-gray-300' },
  Nudity:      { on: 'bg-red-100 text-red-800 border-red-300', off: 'bg-white text-gray-500 border-gray-300' },
  Fashion:     { on: 'bg-purple-100 text-purple-800 border-purple-300', off: 'bg-white text-gray-500 border-gray-300' },
};

const EMPTY_FORM: BookFormData = {
  title: '',
  author: '',
  collection: '',
  editorial: '',
  year_of_publication: null,
  isbn: '',
  tags: [],
  cover_image: null,
  description: null,
};

type LookupStatus = 'idle' | 'loading' | 'found' | 'not-found';
type SearchMode = 'isbn' | 'title';

const splitAuthors = (value: string) =>
  value
    .split(/[,;]+/)
    .map((a) => a.trim())
    .filter(Boolean);

export function BookForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const [form, setForm] = useState<BookFormData>(EMPTY_FORM);
  const [showScanner, setShowScanner] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle');
  const [searchMode, setSearchMode] = useState<SearchMode>('isbn');
  const [titleQuery, setTitleQuery] = useState('');
  const [titleResults, setTitleResults] = useState<TitleSearchResult[]>([]);
  const [titleSearching, setTitleSearching] = useState(false);
  const [publishers, setPublishers] = useState<string[]>([]);
  const [authors, setAuthors] = useState<string[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [authorInput, setAuthorInput] = useState('');

  useEffect(() => {
    getBooks().then((books) => {
      setPublishers([...new Set(books.map((b) => b.editorial).filter(Boolean))].sort());
      setAuthors([...new Set(books.flatMap((b) => splitAuthors(b.author)))].sort());
      setCollections([...new Set(books.map((b) => b.collection).filter(Boolean))].sort());
    });
  }, []);

  useEffect(() => {
    if (!isEditing || !id) return;
    setFetching(true);
    getBook(parseInt(id))
      .then((book) =>
        setForm({
          title: book.title,
          author: book.author,
          collection: book.collection,
          editorial: book.editorial,
          year_of_publication: book.year_of_publication,
          isbn: book.isbn,
          tags: book.tags,
          cover_image: book.cover_image,
          description: book.description,
        })
      )
      .finally(() => setFetching(false));
  }, [id, isEditing]);

  const handleISBNLookup = async (isbn: string) => {
    setLookupStatus('loading');
    const data = await lookupISBN(isbn);
    if (Object.keys(data).length > 0) {
      setForm((prev) => ({ ...prev, ...data, isbn, tags: prev.tags }));
      setLookupStatus('found');
    } else {
      setLookupStatus('not-found');
    }
    setTimeout(() => setLookupStatus('idle'), 4000);
  };

  const handleScan = (isbn: string) => {
    setShowScanner(false);
    setForm((prev) => ({ ...prev, isbn }));
    handleISBNLookup(isbn);
  };

  const handleTitleSearch = async () => {
    if (!titleQuery.trim()) return;
    setTitleSearching(true);
    setTitleResults([]);
    const results = await searchByTitle(titleQuery.trim());
    setTitleResults(results);
    setTitleSearching(false);
  };

  const applyTitleResult = (result: TitleSearchResult) => {
    setForm((prev) => ({
      ...prev,
      title: result.title || prev.title,
      author: result.author || prev.author,
      editorial: result.editorial || prev.editorial,
      year_of_publication: result.year_of_publication ?? prev.year_of_publication,
      isbn: result.isbn || prev.isbn,
    }));
    setTitleResults([]);
    setTitleQuery('');
  };

  const toggleTag = (tag: string) =>
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
    }));

  const addAuthor = (rawAuthor: string) => {
    const newAuthor = rawAuthor.trim();
    if (!newAuthor) return;
    const current = splitAuthors(form.author);
    const exists = current.some((a) => a.toLowerCase() === newAuthor.toLowerCase());
    if (exists) {
      setAuthorInput('');
      return;
    }
    setForm((prev) => ({ ...prev, author: [...current, newAuthor].join('; ') }));
    setAuthorInput('');
  };

  const removeAuthor = (authorToRemove: string) => {
    const current = splitAuthors(form.author);
    setForm((prev) => ({
      ...prev,
      author: current.filter((a) => a !== authorToRemove).join('; '),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        author: splitAuthors(form.author).join('; '),
      };
      if (isEditing && id) {
        await updateBook(parseInt(id), payload);
      } else {
        await createBook(payload);
      }
      navigate('/');
    } catch {
      alert('Failed to save the book. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <>
      {showScanner && (
        <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
      )}
      <canvas ref={canvasRef} className="hidden" />

      <div className="pb-10">
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
          >
            ← Back
          </button>
          <h2 className="text-xl font-bold text-gray-800">
            {isEditing ? 'Edit Book' : 'Add New Book'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Book lookup */}
          <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
            <p className="text-xs font-medium text-gray-500 mb-2">Look up book info</p>

            {/* Tabs */}
            <div className="flex gap-1 mb-3">
              <button
                type="button"
                onClick={() => { setSearchMode('isbn'); setTitleResults([]); }}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  searchMode === 'isbn' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 border border-gray-300'
                }`}
              >
                By ISBN
              </button>
              <button
                type="button"
                onClick={() => { setSearchMode('title'); setLookupStatus('idle'); }}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  searchMode === 'title' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 border border-gray-300'
                }`}
              >
                By Title
              </button>
            </div>

            {searchMode === 'isbn' && (
              <div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.isbn}
                    onChange={(e) => setForm((prev) => ({ ...prev, isbn: e.target.value }))}
                    placeholder="e.g. 9780061965784"
                    className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="bg-indigo-600 text-white px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 whitespace-nowrap"
                  >
                    📷 Scan
                  </button>
                  {form.isbn && (
                    <button
                      type="button"
                      onClick={() => handleISBNLookup(form.isbn)}
                      disabled={lookupStatus === 'loading'}
                      className="bg-white border border-gray-300 text-gray-700 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 whitespace-nowrap disabled:opacity-50"
                    >
                      🔍
                    </button>
                  )}
                </div>
                {lookupStatus === 'loading' && <p className="text-xs text-indigo-500 mt-1.5">Looking up book info…</p>}
                {lookupStatus === 'found' && <p className="text-xs text-green-600 mt-1.5">✓ Book info filled in automatically</p>}
                {lookupStatus === 'not-found' && <p className="text-xs text-amber-600 mt-1.5">Not found in Open Library. Fill in manually.</p>}
              </div>
            )}

            {searchMode === 'title' && (
              <div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={titleQuery}
                    onChange={(e) => setTitleQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleTitleSearch())}
                    placeholder="Search by title…"
                    className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleTitleSearch}
                    disabled={titleSearching}
                    className="bg-indigo-600 text-white px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 whitespace-nowrap disabled:opacity-50"
                  >
                    {titleSearching ? '…' : '🔍 Search'}
                  </button>
                </div>
                {titleResults.length > 0 && (
                  <ul className="mt-2 border border-gray-200 rounded-xl bg-white overflow-hidden divide-y divide-gray-100">
                    {titleResults.map((r, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => applyTitleResult(r)}
                          className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 transition-colors"
                        >
                          <p className="text-sm font-medium text-gray-800 leading-snug">{r.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {[r.author, r.editorial, r.year_of_publication].filter(Boolean).join(' · ')}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {!titleSearching && titleQuery && titleResults.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1.5">No results found.</p>
                )}
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Book title"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Author */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
            <div className="flex gap-2">
              <input
                type="text"
                list="authors-list"
                value={authorInput}
                onChange={(e) => setAuthorInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addAuthor(authorInput);
                  }
                }}
                placeholder="Add author and press Enter"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => addAuthor(authorInput)}
                className="shrink-0 bg-white border border-gray-300 text-gray-700 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50"
              >
                Add
              </button>
            </div>
            {splitAuthors(form.author).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {splitAuthors(form.author).map((author) => (
                  <span
                    key={author}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200"
                  >
                    {author}
                    <button
                      type="button"
                      onClick={() => removeAuthor(author)}
                      className="text-indigo-500 hover:text-indigo-700 leading-none"
                      aria-label={`Remove ${author}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <datalist id="authors-list">
              {authors.map((a) => <option key={a} value={a} />)}
            </datalist>
          </div>

          {/* Collection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Collection</label>
            <input
              type="text"
              list="collections-list"
              value={form.collection}
              onChange={(e) => setForm((prev) => ({ ...prev, collection: e.target.value }))}
              placeholder="e.g. Favorites, Art, Philosophy"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <datalist id="collections-list">
              {collections.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>

          {/* Editorial */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Editorial / Publisher</label>
            <input
              type="text"
              list="publishers-list"
              value={form.editorial}
              onChange={(e) => setForm((prev) => ({ ...prev, editorial: e.target.value }))}
              placeholder="Publisher name"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <datalist id="publishers-list">
              {publishers.map((p) => <option key={p} value={p} />)}
            </datalist>
          </div>

          {/* Year */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year of Publication</label>
            <input
              type="number"
              list="years-list"
              min="1000"
              max="2099"
              value={form.year_of_publication ?? ''}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  year_of_publication: e.target.value ? parseInt(e.target.value) : null,
                }))
              }
              placeholder="e.g. 2023"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <datalist id="years-list">
              {Array.from({ length: new Date().getFullYear() - 1799 }, (_, i) => new Date().getFullYear() - i).map(
                (y) => <option key={y} value={y} />
              )}
            </datalist>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
            <div className="flex flex-wrap gap-2">
              {TAGS.map((tag) => {
                const active = form.tags.includes(tag);
                const colors = TAG_COLORS[tag];
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                      active ? colors.on : colors.off
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value || null }))
              }
              placeholder="Notes, impressions, summary…"
              rows={4}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Cover image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image</label>
            {form.cover_image && (
              <div className="mb-2 relative inline-block">
                <img
                  src={form.cover_image}
                  alt="Cover"
                  className="h-36 rounded-lg object-cover border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, cover_image: null }))}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const img = new Image();
                const url = URL.createObjectURL(file);
                img.onload = () => {
                  const MAX = 600;
                  const scale = Math.min(1, MAX / Math.max(img.width, img.height));
                  const canvas = canvasRef.current!;
                  canvas.width = img.width * scale;
                  canvas.height = img.height * scale;
                  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
                  setForm((prev) => ({ ...prev, cover_image: canvas.toDataURL('image/jpeg', 0.8) }));
                  URL.revokeObjectURL(url);
                };
                img.src = url;
              }}
              className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving…' : isEditing ? 'Update Book' : 'Add Book'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
