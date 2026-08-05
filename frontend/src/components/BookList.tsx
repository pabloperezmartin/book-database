import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Book, getBooks } from '../api';
import { BookCard } from './BookCard';

const ALL_TAGS = ['Documentary', 'Portrait', 'Nudity', 'Fashion'];

type SortField = 'title' | 'author' | 'collection' | 'year_of_publication' | 'created_at';
type SortDir = 'asc' | 'desc';

export function BookList() {
  const navigate = useNavigate();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    getBooks()
      .then(setBooks)
      .catch(() => setError('Could not connect to the server. Make sure the backend is running.'))
      .finally(() => setLoading(false));
  }, []);

  const handleDeleted = (id: number) => setBooks((prev) => prev.filter((b) => b.id !== id));

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
      return matchesSearch && matchesTag;
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
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
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
            <option value="year_of_publication">Year</option>
          </select>
          <button
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
            className="border border-gray-300 rounded-xl px-3 py-1.5 text-sm bg-white hover:border-gray-400 transition-colors"
          >
            {sortDir === 'asc' ? '↑' : '↓'}
          </button>
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
        onClick={() => navigate('/new')}
        className="fixed bottom-6 right-6 bg-indigo-600 text-white w-14 h-14 rounded-full shadow-lg text-3xl flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all"
        title="Add new book"
      >
        +
      </button>
    </div>
  );
}
