import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Book, getBooks } from '../api';
import { BookCard } from './BookCard';

const ALL_TAGS = ['Conceptual', 'Documentary', 'Fashion', 'Landscape', 'Nudity', 'Portrait', 'StreetPhotography', 'WarPhotography'] as const;

/** Active filters get an indigo tint so it's obvious at a glance which ones are engaged. */
const filterSelectClass = (active: boolean) =>
  `border rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 truncate ${
    active ? 'border-indigo-500 text-indigo-700 font-medium' : 'border-gray-300 text-gray-600'
  }`;

/** Author is stored as a single `;`-joined string, so split before offering it as a filter. */
const splitAuthors = (value: string) =>
  value
    .split(/[,;]+/)
    .map((a) => a.trim())
    .filter(Boolean);

type SortField =
  | 'title'
  | 'author'
  | 'collection'
  | 'type'
  | 'editorial'
  | 'year_of_publication'
  | 'created_at';
type SortDir = 'asc' | 'desc';

export function BookList() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // All filter/sort state lives in the URL so navigating to /edit and back restores it.
  const search = params.get('q') ?? '';
  const filterTag = params.get('tag') ?? '';
  const filterCollection = params.get('col') ?? '';
  const filterType = params.get('type') ?? '';
  const filterEditorial = params.get('pub') ?? '';
  const filterAuthor = params.get('author') ?? '';
  const yearFrom = params.get('from') ?? '';
  const yearTo = params.get('to') ?? '';
  const sortField = (params.get('sort') as SortField) || 'created_at';
  const sortDir = (params.get('dir') as SortDir) || 'desc';

  const setParam = (key: string, value: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    }, { replace: true });

  const setSearch = (v: string) => setParam('q', v);
  const setFilterTag = (v: string) => setParam('tag', v);
  const setFilterCollection = (v: string) => setParam('col', v);
  const setFilterType = (v: string) => setParam('type', v);
  const setFilterEditorial = (v: string) => setParam('pub', v);
  const setFilterAuthor = (v: string) => setParam('author', v);
  const setYearFrom = (v: string) => setParam('from', v);
  const setYearTo = (v: string) => setParam('to', v);
  const setSortField = (v: SortField) => setParam('sort', v);
  const setSortDir = (v: SortDir) => setParam('dir', v);

  useEffect(() => {
    getBooks()
      .then(setBooks)
      .catch(() => setError('Could not connect to the server. Make sure the backend is running.'))
      .finally(() => setLoading(false));
  }, []);

  const handleDeleted = (id: number) => setBooks((prev) => prev.filter((b) => b.id !== id));

  // Filter dropdowns are built from the data itself, so they only ever offer values
  // that actually match something. A field with no values renders no dropdown at all.
  const options = useMemo(
    () => ({
      collections: [...new Set(books.map((b) => b.collection).filter(Boolean))].sort(),
      types: [...new Set(books.map((b) => b.type).filter(Boolean))].sort(),
      editorials: [...new Set(books.map((b) => b.editorial).filter(Boolean))].sort(),
      authors: [...new Set(books.flatMap((b) => splitAuthors(b.author)))].sort(),
    }),
    [books]
  );

  const isFiltering =
    !!search ||
    !!filterTag ||
    !!filterCollection ||
    !!filterType ||
    !!filterEditorial ||
    !!filterAuthor ||
    !!yearFrom ||
    !!yearTo;

  const clearFilters = () =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        ['q', 'tag', 'col', 'type', 'pub', 'author', 'from', 'to'].forEach((k) => next.delete(k));
        return next;
      },
      { replace: true }
    );

  const filtered = books
    .filter((book) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        book.title.toLowerCase().includes(q) ||
        book.author.toLowerCase().includes(q) ||
        book.collection.toLowerCase().includes(q) ||
        book.isbn.includes(q);
      const matchesTag = !filterTag || book.tags.includes(filterTag);
      const matchesCollection = !filterCollection || book.collection === filterCollection;
      const matchesType = !filterType || book.type === filterType;
      const matchesEditorial = !filterEditorial || book.editorial === filterEditorial;
      const matchesAuthor = !filterAuthor || splitAuthors(book.author).includes(filterAuthor);

      // A book with no year can't satisfy either bound, so it drops out once one is set.
      const year = book.year_of_publication;
      const from = yearFrom ? parseInt(yearFrom) : null;
      const to = yearTo ? parseInt(yearTo) : null;
      const matchesYear =
        (from === null || (year !== null && year >= from)) &&
        (to === null || (year !== null && year <= to));

      return (
        matchesSearch &&
        matchesTag &&
        matchesCollection &&
        matchesType &&
        matchesEditorial &&
        matchesAuthor &&
        matchesYear
      );
    })
    .sort((a, b) => {
      let aVal: string | number = a[sortField] ?? '';
      let bVal: string | number = b[sortField] ?? '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  return (
    <div>
      <div className="sticky top-[56px] bg-gray-50 pt-2 pb-3 z-10">
        <input
          type="text"
          placeholder="Search by title, author, collection or ISBN…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-2 mt-2">
          Order by
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="flex-1 border border-gray-300 rounded-xl px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="created_at">Date added</option>
            <option value="title">Title</option>
            <option value="author">Author</option>
            <option value="collection">Collection</option>
            <option value="type">Type</option>
            <option value="editorial">Editorial / Publisher</option>
            <option value="year_of_publication">Year</option>
          </select>
          <button
            onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
            title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
            className="border border-gray-300 rounded-xl px-3 py-1.5 text-sm bg-white hover:border-gray-400 transition-colors"
          >
            {sortDir === 'asc' ? '↑' : '↓'}
          </button>
        </div>
        {/* Field filters — each dropdown is omitted when the data has no values for it */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          {options.editorials.length > 0 && (
            <select
              value={filterEditorial}
              onChange={(e) => setFilterEditorial(e.target.value)}
              className={filterSelectClass(!!filterEditorial)}
            >
              <option value="">All publishers</option>
              {options.editorials.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          {options.authors.length > 0 && (
            <select
              value={filterAuthor}
              onChange={(e) => setFilterAuthor(e.target.value)}
              className={filterSelectClass(!!filterAuthor)}
            >
              <option value="">All authors</option>
              {options.authors.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          {options.types.length > 0 && (
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className={filterSelectClass(!!filterType)}
            >
              <option value="">All types</option>
              {options.types.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          {options.collections.length > 0 && (
            <select
              value={filterCollection}
              onChange={(e) => setFilterCollection(e.target.value)}
              className={filterSelectClass(!!filterCollection)}
            >
              <option value="">All collections</option>
              {options.collections.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          <div className="col-span-2 flex items-center gap-2">
            <span className="text-xs text-gray-500 shrink-0">Year</span>
            <input
              type="number"
              min="1000"
              max="2099"
              placeholder="From"
              value={yearFrom}
              onChange={(e) => setYearFrom(e.target.value)}
              className={`flex-1 min-w-0 ${filterSelectClass(!!yearFrom)}`}
            />
            <span className="text-xs text-gray-400">–</span>
            <input
              type="number"
              min="1000"
              max="2099"
              placeholder="To"
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value)}
              className={`flex-1 min-w-0 ${filterSelectClass(!!yearTo)}`}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setFilterTag('')}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              !filterTag
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            All
          </button>
          {ALL_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setFilterTag(filterTag === tag ? '' : tag)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filterTag === tag
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
        {!loading && !error && (
          <div className="flex items-center gap-2 mt-2">
            <p className="text-xs text-gray-500">
              <span className="font-semibold text-gray-700">{filtered.length}</span>
              {isFiltering && <> of {books.length}</>} {books.length === 1 ? 'book' : 'books'}
              {isFiltering && ' shown'}
            </p>
            {isFiltering && (
              <button
                onClick={clearFilters}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mt-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-3">📚</p>
          <p className="font-medium text-gray-500">
            {books.length === 0 ? 'No books yet' : 'No books match your search'}
          </p>
          {books.length === 0 && (
            <p className="text-sm mt-1">Tap + to add your first book</p>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-3 mt-1 pb-20">
          {filtered.map((book) => (
            <BookCard key={book.id} book={book} onDeleted={handleDeleted} />
          ))}
          <p className="text-center text-xs text-gray-400 pt-2">
            {filtered.length} {filtered.length === 1 ? 'book' : 'books'}
          </p>
        </div>
      )}

      <button
        onClick={() => navigate('/new', { state: { from: `/${location.search}` } })}
        className="fixed bottom-6 right-6 bg-indigo-600 text-white w-14 h-14 rounded-full shadow-lg text-3xl flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all"
        title="Add new book"
      >
        +
      </button>
    </div>
  );
}
