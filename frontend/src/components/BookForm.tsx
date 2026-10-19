import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Book, createBook, updateBook, getBook, getBooks, lookupISBN, searchByTitle, TitleSearchResult, BookFormData, bookCoverUrl } from '../api';
import { BarcodeScanner } from './BarcodeScanner';

const TAGS = ['Conceptual', 'Documentary', 'Fashion', 'Landscape', 'Nudity', 'Portrait', 'StreetPhotography', 'WarPhotography'] as const;
const BOOK_TYPES = ['Catalog', 'Literature', 'Magazine', 'Monograph', 'Photobook', 'Tutorial'] as const;

const TAG_COLORS: Record<string, { on: string; off: string }> = {
  Conceptual: { on: 'bg-blue-100 text-blue-800 border-blue-300', off: 'bg-white text-gray-500 border-gray-300' },
  Documentary: { on: 'bg-blue-100 text-blue-800 border-blue-300', off: 'bg-white text-gray-500 border-gray-300' },
  Fashion:     { on: 'bg-purple-100 text-purple-800 border-purple-300', off: 'bg-white text-gray-500 border-gray-300' },
  Nudity:      { on: 'bg-red-100 text-red-800 border-red-300', off: 'bg-white text-gray-500 border-gray-300' },
  Landscape:   { on: 'bg-yellow-100 text-yellow-800 border-yellow-300', off: 'bg-white text-gray-500 border-gray-300' },
  Portrait:    { on: 'bg-green-100 text-green-800 border-green-300', off: 'bg-white text-gray-500 border-gray-300' },
  StreetPhotography: { on: 'bg-purple-100 text-purple-800 border-purple-300', off: 'bg-white text-gray-500 border-gray-300' },
  WarPhotography:    { on: 'bg-red-100 text-red-800 border-red-300', off: 'bg-white text-gray-500 border-gray-300' },
};

const EMPTY_FORM: BookFormData = {
  title: '',
  author: '',
  collection: '',
  type: '',
  editorial: '',
  year_of_publication: null,
  isbn: '',
  tags: [],
  cover_image: null,
  description: null,
  prize: '',
};

type LookupStatus = 'idle' | 'loading' | 'found' | 'not-found';
type SearchMode = 'isbn' | 'title';

/** Which submit button was pressed: finish and go back to the list, save and start a fresh form, or save and advance to the next book in the list. */
type SaveIntent = 'finish' | 'another' | 'next' | 'prev';

const splitAuthors = (value: string) =>
  value
    .split(/[,;]+/)
    .map((a) => a.trim())
    .filter(Boolean);

export function BookForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const state = location.state as { from?: string; listIds?: number[] } | null;
  const listIds = state?.listIds ?? [];
  const currentIndex = listIds.indexOf(parseInt(id ?? ''));
  const prevId = currentIndex > 0 ? listIds[currentIndex - 1] : null;
  const nextId = currentIndex >= 0 && currentIndex < listIds.length - 1 ? listIds[currentIndex + 1] : null;

  const goBack = () => navigate(state?.from ?? '/');
  const goPrev = () => navigate(`/edit/${prevId}`, { state: { from: state?.from, listIds } });
  const goNext = () => navigate(`/edit/${nextId}`, { state: { from: state?.from, listIds } });

  const [form, setForm] = useState<BookFormData>(EMPTY_FORM);
  const [showScanner, setShowScanner] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [saving, setSaving] = useState<SaveIntent | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle');
  const [searchMode, setSearchMode] = useState<SearchMode>('isbn');
  const [titleQuery, setTitleQuery] = useState('');
  const [titleResults, setTitleResults] = useState<TitleSearchResult[]>([]);
  const [titleSearching, setTitleSearching] = useState(false);
  const [publishers, setPublishers] = useState<string[]>([]);
  const [authors, setAuthors] = useState<string[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [prizes, setPrizes] = useState<string[]>([]);
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [authorInput, setAuthorInput] = useState('');

  const loadSuggestions = useCallback(async () => {
    const books = await getBooks();
    setAllBooks(books);
    setPublishers([...new Set(books.map((b) => b.editorial).filter(Boolean))].sort());
    setAuthors([...new Set(books.flatMap((b) => splitAuthors(b.author)))].sort());
    setCollections([...new Set(books.map((b) => b.collection).filter(Boolean))].sort());
    setPrizes([...new Set(books.map((b) => b.prize?.split('#')[0]).filter(Boolean))].sort());
  }, []);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const currentAuthors = useMemo(() => splitAuthors(form.author), [form.author]);

  const relatedBooks = useMemo(() => {
    if (!isEditing || !id || currentAuthors.length === 0) return [];
    const currentId = parseInt(id);
    const authorSet = new Set(currentAuthors);
    return allBooks
      .filter(
        (b) =>
          b.id !== currentId &&
          splitAuthors(b.author).some((a) => authorSet.has(a))
      )
      .sort((a, b) => (b.year_of_publication ?? 0) - (a.year_of_publication ?? 0));
  }, [allBooks, currentAuthors, id, isEditing]);

  useEffect(() => {
    if (!isEditing || !id) return;
    setFetching(true);
    getBook(parseInt(id))
      .then((book) =>
        setForm({
          title: book.title,
          author: book.author,
          collection: book.collection,
          type: book.type,
          editorial: book.editorial,
          year_of_publication: book.year_of_publication,
          isbn: book.isbn,
          tags: book.tags,
          cover_image: book.cover_image,
          description: book.description,
          prize: book.prize || '',
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

  /** Clears the form and every lookup/search bit of state, ready for a fresh entry. */
  const resetForm = () => {
    setForm(EMPTY_FORM);
    setAuthorInput('');
    setSearchMode('isbn');
    setLookupStatus('idle');
    setTitleQuery('');
    setTitleResults([]);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const intent: SaveIntent =
      submitter?.value === 'another' ? 'another' :
      submitter?.value === 'next' ? 'next' :
      submitter?.value === 'prev' ? 'prev' : 'finish';

    setSaving(intent);
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

      if (intent === 'another') {
        setLastSaved(payload.title);
        setAddedCount((n) => n + 1);
        resetForm();
        await loadSuggestions();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (intent === 'next') {
        goNext();
      } else if (intent === 'prev') {
        goPrev();
      } else {
        goBack();
      }
    } catch {
      alert('Failed to save the book. Please try again.');
    } finally {
      setSaving(null);
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
            onClick={() => goBack()}
            className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
          >
            ← Back
          </button>
          <h2 className="text-xl font-bold text-gray-800">
            {isEditing ? 'Edit Book' : 'Add New Book'}
          </h2>
          {isEditing && listIds.length > 0 && (
            <span className="ml-auto text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">
              {currentIndex + 1} of {listIds.length}
            </span>
          )}
          {addedCount > 0 && (
            <span className="ml-auto text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">
              {addedCount} added
            </span>
          )}
        </div>

        {!isEditing && addedCount > 0 && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5">
            <span className="text-green-600 leading-none mt-0.5">✓</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-green-800 leading-snug truncate">
                Saved{lastSaved ? ` “${lastSaved}”` : ''}
              </p>
              <p className="text-xs text-green-700 mt-0.5">
                Form cleared — ready for the next book.
              </p>
            </div>
            <button
              type="button"
              onClick={() => goBack()}
              className="ml-auto shrink-0 text-xs font-medium text-green-800 underline hover:text-green-900"
            >
              Done
            </button>
          </div>
        )}

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

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select a type</option>
              {BOOK_TYPES.map((bookType) => (
                <option key={bookType} value={bookType}>{bookType}</option>
              ))}
            </select>
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

          {/* Prize */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prize</label>
            <div className="flex gap-2">
              <input
                type="text"
                list="prizes-list"
                placeholder="Name / Award"
                value={form.prize.split('#')[0] ?? ''}
                onChange={(e) => {
                  const year = form.prize.split('#')[1] ?? '';
                  const val = e.target.value;
                  setForm((prev) => ({ ...prev, prize: val || year ? `${val}#${year}` : '' }));
                }}
                className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <datalist id="prizes-list">
                {prizes.map((p) => <option key={p} value={p} />)}
              </datalist>
              <input
                type="number"
                placeholder="Year"
                min="1900"
                max="2099"
                value={form.prize.split('#')[1] ?? ''}
                onChange={(e) => {
                  const val = form.prize.split('#')[0] ?? '';
                  const year = e.target.value;
                  setForm((prev) => ({ ...prev, prize: val || year ? `${val}#${year}` : '' }));
                }}
                className="w-28 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
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
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              value="finish"
              disabled={!!saving}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving === 'finish' ? 'Saving…' : isEditing ? 'Update Book' : 'Add Book'}
            </button>
            {isEditing && (prevId !== null || nextId !== null) && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="submit"
                  value="prev"
                  disabled={!!saving || prevId === null}
                  className="w-full bg-white border-2 border-indigo-600 text-indigo-700 py-2.5 rounded-xl font-semibold hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  {saving === 'prev' ? 'Saving…' : '← Save & Previous'}
                </button>
                <button
                  type="submit"
                  value="next"
                  disabled={!!saving || nextId === null}
                  className="w-full bg-white border-2 border-indigo-600 text-indigo-700 py-2.5 rounded-xl font-semibold hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  {saving === 'next' ? 'Saving…' : 'Save & Next →'}
                </button>
              </div>
            )}
            {!isEditing && (
              <>
                <button
                  type="submit"
                  value="another"
                  disabled={!!saving}
                  className="w-full bg-white border-2 border-indigo-600 text-indigo-700 py-3 rounded-xl font-semibold hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving === 'another' ? 'Saving…' : '+ Add Another Book'}
                </button>
                <p className="text-xs text-gray-400 text-center">
                  “Add Book” saves and returns to the list. “Add Another Book” saves and clears the
                  form so you can keep adding.
                </p>
              </>
            )}
          </div>
        </form>

        {/* More by this author — shown in edit mode when there are related books */}
        {isEditing && relatedBooks.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              More by {currentAuthors.length === 1 ? currentAuthors[0] : 'these authors'}
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {relatedBooks.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() =>
                    navigate(`/edit/${b.id}`, {
                      state: { from: state?.from, listIds },
                    })
                  }
                  className="shrink-0 w-28 group text-left"
                >
                  <div className="w-28 h-40 rounded-lg overflow-hidden shadow-sm border border-gray-100 group-hover:shadow-md group-hover:border-gray-200 transition-all duration-200">
                    {b.has_cover ? (
                      <img
                        src={bookCoverUrl(b.id)}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-b from-gray-100 to-gray-200 flex items-center justify-center p-2">
                        <p className="text-[10px] text-gray-500 text-center font-medium leading-tight line-clamp-4">
                          {b.title}
                        </p>
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-medium text-gray-800 mt-1.5 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">
                    {b.title}
                  </p>
                  {b.year_of_publication && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {b.year_of_publication}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
